#!/usr/bin/env python3
"""
Solay39 Static Analysis Service
Runs real Slither and Mythril analysis on Solidity contracts
"""

import json
import subprocess
import tempfile
import os
import sys
from pathlib import Path

def run_slither(contract_code: str, contract_name: str = "Contract") -> dict:
    """Run Slither static analysis on Solidity code"""
    results = {
        "tool": "slither",
        "version": "0.11.5",
        "success": False,
        "findings": [],
        "detectors_run": 0,
        "error": None
    }
    
    with tempfile.TemporaryDirectory() as tmpdir:
        # Write contract to temp file
        contract_path = Path(tmpdir) / f"{contract_name}.sol"
        contract_path.write_text(contract_code)
        
        try:
            # Run slither with JSON output
            proc = subprocess.run(
                [
                    "slither",
                    str(contract_path),
                    "--json", "-",
                    "--solc-disable-warnings",
                    "--exclude-dependencies",
                ],
                capture_output=True,
                text=True,
                timeout=120,
                cwd=tmpdir
            )
            
            # Parse JSON output
            if proc.stdout:
                try:
                    slither_output = json.loads(proc.stdout)
                    results["success"] = True
                    results["detectors_run"] = slither_output.get("detectors_run", 0)
                    
                    # Extract findings
                    for detector in slither_output.get("results", {}).get("detectors", []):
                        finding = {
                            "check": detector.get("check", "unknown"),
                            "impact": detector.get("impact", "unknown").upper(),
                            "confidence": detector.get("confidence", "unknown").upper(),
                            "description": detector.get("description", ""),
                            "elements": [],
                            "first_markdown_element": detector.get("first_markdown_element", ""),
                        }
                        
                        # Extract source locations
                        for elem in detector.get("elements", [])[:3]:  # Limit to 3 elements
                            if elem.get("source_mapping"):
                                sm = elem["source_mapping"]
                                finding["elements"].append({
                                    "type": elem.get("type", ""),
                                    "name": elem.get("name", ""),
                                    "filename": sm.get("filename_relative", ""),
                                    "lines": sm.get("lines", [])[:5],  # First 5 lines
                                })
                        
                        results["findings"].append(finding)
                        
                except json.JSONDecodeError:
                    results["error"] = "Failed to parse Slither output"
                    results["raw_output"] = proc.stdout[:2000]
            else:
                results["error"] = proc.stderr[:1000] if proc.stderr else "No output from Slither"
                
        except subprocess.TimeoutExpired:
            results["error"] = "Slither analysis timed out (120s limit)"
        except FileNotFoundError:
            results["error"] = "Slither not installed. Install with: pip install slither-analyzer"
        except Exception as e:
            results["error"] = str(e)
    
    return results


def run_mythril(contract_code: str, contract_name: str = "Contract") -> dict:
    """Run Mythril symbolic execution analysis on Solidity code"""
    results = {
        "tool": "mythril",
        "version": "0.24.x",
        "success": False,
        "findings": [],
        "analysis_time": 0,
        "error": None
    }
    
    with tempfile.TemporaryDirectory() as tmpdir:
        contract_path = Path(tmpdir) / f"{contract_name}.sol"
        contract_path.write_text(contract_code)
        
        try:
            # Run myth analyze with JSON output
            proc = subprocess.run(
                [
                    "myth",
                    "analyze",
                    str(contract_path),
                    "--solc-json",
                    "-o", "json",
                    "--execution-timeout", "60",
                    "--max-depth", "22",
                ],
                capture_output=True,
                text=True,
                timeout=180,
                cwd=tmpdir
            )
            
            if proc.stdout:
                try:
                    myth_output = json.loads(proc.stdout)
                    results["success"] = True
                    
                    # Extract issues
                    for issue in myth_output.get("issues", []):
                        finding = {
                            "swc_id": issue.get("swc-id", ""),
                            "swc_title": issue.get("title", ""),
                            "severity": issue.get("severity", "unknown").upper(),
                            "description": issue.get("description", ""),
                            "contract": issue.get("contract", ""),
                            "function": issue.get("function", ""),
                            "filename": issue.get("filename", ""),
                            "lineno": issue.get("lineno", 0),
                            "code": issue.get("code", ""),
                        }
                        results["findings"].append(finding)
                        
                except json.JSONDecodeError:
                    # Mythril sometimes outputs non-JSON
                    if "No issues" in proc.stdout:
                        results["success"] = True
                        results["findings"] = []
                    else:
                        results["error"] = "Failed to parse Mythril output"
                        results["raw_output"] = proc.stdout[:2000]
            else:
                results["error"] = proc.stderr[:1000] if proc.stderr else "No output from Mythril"
                
        except subprocess.TimeoutExpired:
            results["error"] = "Mythril analysis timed out (180s limit)"
        except FileNotFoundError:
            results["error"] = "Mythril not installed. Install with: pip install mythril"
        except Exception as e:
            results["error"] = str(e)
    
    return results


def analyze_contract(contract_code: str, contract_name: str = "Contract") -> dict:
    """Run full static analysis suite"""
    return {
        "slither": run_slither(contract_code, contract_name),
        "mythril": run_mythril(contract_code, contract_name),
    }


if __name__ == "__main__":
    # Read contract from stdin or file
    if len(sys.argv) > 1:
        with open(sys.argv[1], "r") as f:
            code = f.read()
        name = Path(sys.argv[1]).stem
    else:
        code = sys.stdin.read()
        name = "Contract"
    
    results = analyze_contract(code, name)
    print(json.dumps(results, indent=2))
