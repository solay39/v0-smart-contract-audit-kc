import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("scanner_reports", ROOT / "scripts/validate-scanner-reports.py")
scanner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scanner)


class ScannerReportTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.directory = Path(self.temp.name)
        self.addCleanup(self.temp.cleanup)

    def write(self, name, value):
        path = self.directory / name
        path.write_text(json.dumps(value))
        return path

    def test_missing_slither_report_is_not_a_pass(self):
        with self.assertRaisesRegex(ValueError, "Missing or invalid"):
            scanner.validate("slither", self.directory)

    def test_invalid_or_truncated_json_fails(self):
        path = self.directory / "slither-report.json"
        path.write_text('{"success": true')
        with self.assertRaises(ValueError):
            scanner.validate_report(path, "slither")

    def test_unsuccessful_or_missing_execution_status_fails(self):
        for value in ({}, [], {"success": False}, {"success": 1}, {"success": True, "error": "compile failed"}):
            with self.subTest(value=value), self.assertRaises(ValueError):
                scanner.validate_report(self.write("report.json", value), "slither")

    def test_slither_success_without_findings_is_supported(self):
        path = self.write("slither-report.json", {"success": True, "error": None, "results": {}})
        self.assertEqual(scanner.validate_report(path, "slither"), 0)

    def test_slither_missing_or_malformed_results_fails(self):
        for results in (None, [], "not executed"):
            with self.subTest(results=results), self.assertRaises(ValueError):
                scanner.validate_report(self.write("report.json", {"success": True, "results": results}), "slither")

    def test_both_scanners_block_high_and_critical_findings(self):
        for tool in ("slither", "mythril"):
            for severity in ("High", "critical"):
                issue = {"impact" if tool == "slither" else "severity": severity}
                value = {"success": True, "results": {"detectors": [issue]}} if tool == "slither" else {"success": True, "issues": [issue]}
                with self.subTest(tool=tool, severity=severity), self.assertRaisesRegex(ValueError, "high/critical"):
                    scanner.validate_report(self.write("report.json", value), tool)

    def test_medium_findings_are_retained_under_existing_high_threshold(self):
        for tool in ("slither", "mythril"):
            issue = {"impact" if tool == "slither" else "severity": "Medium"}
            value = {"success": True, "results": {"detectors": [issue]}} if tool == "slither" else {"success": True, "issues": [issue]}
            self.assertEqual(scanner.validate_report(self.write("report.json", value), tool), 1)

    def test_malformed_issue_lists_and_unknown_severities_fail(self):
        for issues in (None, {}, [None], [{}], [{"impact": "Unknown"}]):
            with self.subTest(issues=issues), self.assertRaises(ValueError):
                scanner.validate_report(self.write("report.json", {"success": True, "results": {"detectors": issues}}), "slither")

    def test_no_mythril_reports_is_not_a_clean_scan(self):
        with self.assertRaisesRegex(ValueError, "Missing or invalid"):
            scanner.validate("mythril", self.directory)

    def test_all_three_expected_mythril_contract_reports_are_required(self):
        for name in scanner.MYTHRIL_CONTRACTS[:-1]:
            self.write(f"mythril-{name}.json", {"success": True, "issues": []})
        with self.assertRaisesRegex(ValueError, "AuditRegistry"):
            scanner.validate("mythril", self.directory)
        self.write("mythril-AuditRegistry.json", {"success": True, "issues": []})
        scanner.validate("mythril", self.directory)

    def test_mythril_missing_issue_list_fails(self):
        with self.assertRaises(ValueError):
            scanner.validate_report(self.write("report.json", {"success": True}), "mythril")

    def test_slither_config_keeps_production_contracts_in_scope(self):
        config = json.loads((ROOT / "slither.config.json").read_text())
        self.assertIsInstance(config["filter_paths"], str)
        self.assertNotIn("contracts/", config["filter_paths"].replace("openzeppelin-contracts/", ""))
        self.assertEqual(set(config), {"filter_paths", "exclude_dependencies"})

    def test_isolated_scanner_installations_are_shared_by_both_workflows(self):
        action = (ROOT / ".github/actions/security-tools/action.yml").read_text()
        for environment in ("slither-tools", "mythril-tools"):
            self.assertIn(f'{environment}/bin/python" -m pip check', action)
        self.assertIn('setuptools==80.9.0', action)
        for file in ("security.yml", "security-gate.yml"):
            self.assertIn("uses: ./.github/actions/security-tools", (ROOT / ".github/workflows" / file).read_text())


if __name__ == "__main__":
    unittest.main()
