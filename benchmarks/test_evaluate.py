import unittest
from evaluate import evaluate

class EvaluateTests(unittest.TestCase):
    def test_micro_metrics(self):
        result = evaluate({"cases": [{"case_id": "a", "expected_findings": ["x", "y"], "actual_findings": ["x", "z"]}]})
        self.assertEqual(result["micro"], {"tp": 1, "fp": 1, "fn": 1, "precision": 0.5, "recall": 0.5, "f1": 0.5})
    def test_missing_findings(self):
        self.assertEqual(evaluate({"cases": [{"case_id": "a", "expected_findings": ["bug"], "actual_findings": []}]})["micro"]["fn"], 1)
    def test_duplicate_case_id(self):
        with self.assertRaisesRegex(ValueError, "Duplicate case_id"):
            evaluate({"cases": [{"case_id": "a", "expected_findings": [], "actual_findings": []}, {"case_id": "a", "expected_findings": [], "actual_findings": []}]})
    def test_duplicate_finding_id(self):
        with self.assertRaisesRegex(ValueError, "duplicate finding IDs"):
            evaluate({"cases": [{"case_id": "a", "expected_findings": ["bug", "bug"], "actual_findings": []}]})
    def test_empty_dataset(self):
        with self.assertRaisesRegex(ValueError, "non-empty array"):
            evaluate({"cases": []})

if __name__ == "__main__": unittest.main()
