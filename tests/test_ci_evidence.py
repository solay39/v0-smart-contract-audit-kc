import base64
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest


def module(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).resolve().parents[1] / ".github/audit" / f"{name}.py")
    loaded = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(loaded)
    return loaded


finalizer = module("finalize_evidence")
decoder = module("decode_source")
materializer = module("materialize_sources")


class EvidenceTests(unittest.TestCase):
    def test_decoder_bounds_expansion_and_rejects_invalid_utf8(self):
        self.assertEqual(decoder.decode_source(base64.b64encode(gzip.compress(b"source")).decode()), b"source")
        for source in [b"a" * (decoder.MAX_SOURCE_BYTES + 1), b"\xff"]:
            with self.assertRaises(ValueError):
                decoder.decode_source(base64.b64encode(gzip.compress(source)).decode())

    def test_source_digest_preserves_original_crlf_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = b"pragma solidity ^0.8.20;\r\ncontract Fixture {}\r\n"
            (root / "Contract.sol").write_bytes(source)
            layout = materializer.materialize(root / "Contract.sol", root / "sources", "Fixture")
            self.assertEqual(layout["source_sha256"], hashlib.sha256(source).hexdigest())
            self.assertEqual((root / "sources/Contract.sol").read_bytes(), source)

    def test_missing_tools_are_not_successful_or_executed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifest = finalizer.finalize(root, {"JOB_ID": "fixture"})
            self.assertIsNone(manifest["source_sha256"])
            self.assertTrue(all(not value for value in manifest["claims"].values()))
            self.assertTrue(all(tool["status"] == "NOT_RUN" for tool in manifest["tools"].values()))
            self.assertIn("slither.json", manifest["artifacts"])
            self.assertEqual(json.loads((root / "out/foundry.json").read_text())["tests_executed"], False)

    def test_one_tool_failure_preserves_other_results_and_all_hashes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "out").mkdir()
            (root / "work").mkdir()
            (root / "work/Contract.sol").write_bytes(b"fixture source")
            (root / "out/slither.json").write_text('{"success":true,"results":{}}')
            (root / "out/mythril.json").write_text("not valid JSON")
            manifest = finalizer.finalize(root, {
                "JOB_ID": "fixture", "SLITHER_OUTCOME": "success", "MYTHRIL_OUTCOME": "failure",
                "GITHUB_REPOSITORY": "fixture/repo", "GITHUB_RUN_ID": "123", "GITHUB_SHA": "a" * 40,
            })
            self.assertTrue(manifest["claims"]["slither"])
            self.assertFalse(manifest["claims"]["mythril"])
            self.assertEqual(manifest["tools"]["mythril"]["status"], "FAILED")
            self.assertIn("mythril-raw-output.txt", manifest["artifacts"])
            self.assertIn("source.sol", manifest["artifacts"])
            for name, digest in manifest["artifacts"].items():
                self.assertEqual(hashlib.sha256((root / "out" / name).read_bytes()).hexdigest(), digest)

    def test_failed_step_cannot_reuse_a_success_flag(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "out").mkdir()
            (root / "out/mythril.json").write_text('{"success":true,"issues":[]}')
            manifest = finalizer.finalize(root, {"MYTHRIL_OUTCOME": "failure"})
            self.assertFalse(manifest["claims"]["mythril"])
            self.assertFalse(json.loads((root / "out/mythril.json").read_text())["success"])


if __name__ == "__main__":
    unittest.main()
