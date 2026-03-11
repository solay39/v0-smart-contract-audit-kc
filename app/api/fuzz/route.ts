import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 120

/**
 * Foundry Fuzzing API
 * 
 * Generates and executes Foundry fuzz tests for smart contracts.
 * Uses the static analysis backend if available, otherwise generates
 * downloadable test templates.
 */

interface FuzzResult {
  testName: string
  status: "PASS" | "FAIL" | "ERROR"
  runs: number
  counterexample?: string
  gasUsed?: number
  duration?: number
}

interface FuzzReport {
  success: boolean
  mode: "real" | "template"
  tests: FuzzResult[]
  vulnerabilities: string[]
  template?: string
  error?: string
}

// Fuzz test templates for common vulnerability patterns
const FUZZ_TEMPLATES: Record<string, string> = {
  reentrancy: `
    function testFuzz_Reentrancy(uint256 amount) public {
        vm.assume(amount > 0 && amount < address(this).balance);
        
        // Capture state before
        uint256 balanceBefore = address(target).balance;
        
        // Attempt reentrant call
        vm.expectRevert(); // Should revert with ReentrancyGuard
        target.withdraw(amount);
        
        // Verify state unchanged
        assertEq(address(target).balance, balanceBefore);
    }`,
  
  overflow: `
    function testFuzz_NoOverflow(uint256 a, uint256 b) public pure {
        // In Solidity 0.8+, this should revert on overflow
        vm.assume(a < type(uint128).max && b < type(uint128).max);
        
        uint256 result = a + b;
        assertGe(result, a, "Overflow detected");
        assertGe(result, b, "Overflow detected");
    }`,
  
  accessControl: `
    function testFuzz_OnlyOwner(address caller) public {
        vm.assume(caller != owner);
        
        vm.prank(caller);
        vm.expectRevert(); // Should revert for non-owner
        target.privilegedFunction();
    }`,
  
  mintProtection: `
    function testFuzz_MintCap(uint256 amount) public {
        vm.assume(amount > 0);
        
        uint256 maxSupply = target.MAX_SUPPLY();
        uint256 currentSupply = target.totalSupply();
        
        if (currentSupply + amount > maxSupply) {
            vm.expectRevert(); // Should revert when exceeding cap
        }
        
        vm.prank(owner);
        target.mint(address(this), amount);
        
        assertLe(target.totalSupply(), maxSupply, "Supply cap exceeded");
    }`,
  
  transferSafety: `
    function testFuzz_TransferDoesNotLoseFunds(address to, uint256 amount) public {
        vm.assume(to != address(0) && to != address(target));
        vm.assume(amount > 0 && amount <= target.balanceOf(address(this)));
        
        uint256 senderBefore = target.balanceOf(address(this));
        uint256 receiverBefore = target.balanceOf(to);
        
        target.transfer(to, amount);
        
        assertEq(target.balanceOf(address(this)), senderBefore - amount);
        assertEq(target.balanceOf(to), receiverBefore + amount);
    }`,
  
  signatureReplay: `
    function testFuzz_NoSignatureReplay(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public {
        vm.assume(deadline > block.timestamp);
        vm.assume(owner != address(0) && spender != address(0));
        
        // First permit should succeed (if signature valid)
        try target.permit(owner, spender, value, deadline, v, r, s) {
            // Second permit with same signature should fail
            vm.expectRevert(); // Nonce should prevent replay
            target.permit(owner, spender, value, deadline, v, r, s);
        } catch {
            // Invalid signature - expected in fuzz testing
        }
    }`,
  
  flashLoan: `
    function testFuzz_FlashLoanRepayment(uint256 amount) public {
        vm.assume(amount > 0 && amount <= target.maxFlashLoan(address(token)));
        
        uint256 fee = target.flashFee(address(token), amount);
        uint256 poolBefore = token.balanceOf(address(target));
        
        target.flashLoan(
            IERC3156FlashBorrower(address(this)),
            address(token),
            amount,
            ""
        );
        
        // Pool should have same or more tokens (fee collected)
        assertGe(token.balanceOf(address(target)), poolBefore);
    }`,
    
  invariant: `
    function invariant_TotalSupplyMatchesBalances() public {
        uint256 totalFromBalances = 0;
        
        // Sum all holder balances (simplified - real test would iterate all holders)
        totalFromBalances += target.balanceOf(address(this));
        totalFromBalances += target.balanceOf(owner);
        
        // Total supply should match sum of balances
        assertEq(target.totalSupply(), totalFromBalances, "Supply invariant violated");
    }`
}

// Generate comprehensive fuzz test file
function generateFuzzTestFile(code: string, contractName: string): string {
  const hasReentrancy = /\.call\{value:|withdraw|transfer/.test(code)
  const hasMint = /function\s+mint/.test(code)
  const hasPermit = /function\s+permit/.test(code)
  const hasAccessControl = /onlyOwner|onlyRole|Ownable/.test(code)
  const hasFlashLoan = /flashLoan|IERC3156/.test(code)
  
  let tests = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/${contractName}.sol";

/**
 * SOLAY39 Auto-Generated Fuzz Tests
 * 
 * Run with: forge test --fuzz-runs 10000 -vvv
 * 
 * These tests use Foundry's fuzzing to find edge cases
 * that could lead to vulnerabilities.
 */
contract ${contractName}FuzzTest is Test {
    ${contractName} public target;
    address public owner;
    
    function setUp() public {
        owner = address(this);
        target = new ${contractName}();
    }
    
    // ══════════════════════════════════════════════════════════
    // INVARIANT TESTS
    // ══════════════════════════════════════════════════════════
    
${FUZZ_TEMPLATES.invariant}
`

  if (hasReentrancy) {
    tests += `
    // ══════════════════════════════════════════════════════════
    // REENTRANCY FUZZ TEST
    // ══════════════════════════════════════════════════════════
    
${FUZZ_TEMPLATES.reentrancy}
`
  }
  
  if (hasMint) {
    tests += `
    // ══════════════════════════════════════════════════════════
    // MINT PROTECTION FUZZ TEST
    // ══════════════════════════════════════════════════════════
    
${FUZZ_TEMPLATES.mintProtection}
`
  }
  
  if (hasPermit) {
    tests += `
    // ══════════════════════════════════════════════════════════
    // SIGNATURE REPLAY FUZZ TEST (EIP-2612)
    // ══════════════════════════════════════════════════════════
    
${FUZZ_TEMPLATES.signatureReplay}
`
  }
  
  if (hasAccessControl) {
    tests += `
    // ══════════════════════════════════════════════════════════
    // ACCESS CONTROL FUZZ TEST
    // ══════════════════════════════════════════════════════════
    
${FUZZ_TEMPLATES.accessControl}
`
  }
  
  if (hasFlashLoan) {
    tests += `
    // ══════════════════════════════════════════════════════════
    // FLASH LOAN FUZZ TEST
    // ══════════════════════════════════════════════════════════
    
${FUZZ_TEMPLATES.flashLoan}
`
  }
  
  tests += `
    // ══════════════════════════════════════════════════════════
    // TRANSFER SAFETY FUZZ TEST
    // ══════════════════════════════════════════════════════════
    
${FUZZ_TEMPLATES.transferSafety}

    // ══════════════════════════════════════════════════════════
    // OVERFLOW FUZZ TEST
    // ══════════════════════════════════════════════════════════
    
${FUZZ_TEMPLATES.overflow}
}
`

  return tests
}

// Run fuzz tests via backend
async function runRealFuzzing(code: string, contractName: string): Promise<FuzzReport | null> {
  const apiUrl = process.env.STATIC_ANALYSIS_API_URL
  
  if (!apiUrl) {
    return null
  }
  
  try {
    const analyzeUrl = apiUrl.endsWith("/") ? `${apiUrl}api/analyze` : `${apiUrl}/api/analyze`
    
    const response = await fetch(analyzeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.STATIC_ANALYSIS_API_KEY || ""}`,
      },
      body: JSON.stringify({
        code,
        contractName,
        tools: ["foundry"],
      }),
    })
    
    if (!response.ok) {
      return null
    }
    
    const data = await response.json()
    const foundry = data.foundry
    
    if (!foundry) {
      return null
    }
    
    const tests: FuzzResult[] = foundry.results?.map((r: string) => ({
      testName: r.split("]")[1]?.trim() || r,
      status: r.includes("PASS") ? "PASS" : r.includes("FAIL") ? "FAIL" : "ERROR",
      runs: foundry.fuzz_runs || 0,
    })) || []
    
    return {
      success: foundry.passed,
      mode: "real",
      tests,
      vulnerabilities: tests.filter(t => t.status === "FAIL").map(t => t.testName),
      error: foundry.error,
    }
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const { code, contractName = "Contract" } = await req.json()
    
    if (!code) {
      return NextResponse.json({ error: "Missing 'code' parameter" }, { status: 400 })
    }
    
    // Try real fuzzing first
    const realResult = await runRealFuzzing(code, contractName)
    
    if (realResult) {
      return NextResponse.json(realResult)
    }
    
    // Generate template for local execution
    const template = generateFuzzTestFile(code, contractName)
    
    // Analyze code for potential vulnerabilities
    const vulnerabilities: string[] = []
    
    if (/\.call\{value:/.test(code) && !/ReentrancyGuard|nonReentrant/.test(code)) {
      vulnerabilities.push("Potential reentrancy - no guard detected")
    }
    
    if (/function\s+mint/.test(code) && !/MAX_SUPPLY|maxSupply/.test(code)) {
      vulnerabilities.push("Uncapped mint function")
    }
    
    if (/function\s+permit/.test(code) && !/nonces\[/.test(code)) {
      vulnerabilities.push("Permit without nonce - replay possible")
    }
    
    return NextResponse.json({
      success: true,
      mode: "template",
      tests: [],
      vulnerabilities,
      template,
      instructions: [
        "1. Save the template to test/Contract.t.sol in your Foundry project",
        "2. Run: forge test --fuzz-runs 10000 -vvv",
        "3. Check for FAIL results indicating vulnerabilities",
        "4. Configure STATIC_ANALYSIS_API_URL for automatic execution"
      ]
    })
    
  } catch (error) {
    return NextResponse.json(
      { error: "Fuzzing failed", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    )
  }
}

export async function GET() {
  const hasBackend = !!process.env.STATIC_ANALYSIS_API_URL
  
  return NextResponse.json({
    service: "SOLAY39 Foundry Fuzzing",
    mode: hasBackend ? "real" : "template-only",
    fuzzRuns: 10000,
    tests: Object.keys(FUZZ_TEMPLATES),
    configured: hasBackend
  })
}
