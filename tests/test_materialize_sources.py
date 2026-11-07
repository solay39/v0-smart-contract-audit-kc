import importlib.util
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("materialize_sources", Path(__file__).resolve().parents[1] / ".github/audit/materialize_sources.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class MaterializeTests(unittest.TestCase):
    def test_single_source_is_unchanged(self):
        code = "pragma solidity ^0.8.20; contract Example {}"
        self.assertEqual(module.split_sources(code), {"Contract.sol": code})

    def test_multifile_restores_relative_import_paths(self):
        code = '// ── File: contracts/Example.sol ──\npragma solidity ^0.8.20; import "../utils/Context.sol"; contract Example is Context {}\n\n// ── File: utils/Context.sol ──\npragma solidity ^0.8.20; abstract contract Context {}'
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "input.sol").write_text(code)
            result = module.materialize(root / "input.sol", root / "sources", "Example")
            self.assertEqual(result["entry"], "contracts/Example.sol")
            self.assertTrue((root / "sources/utils/Context.sol").exists())
            self.assertIn('import "../utils/Context.sol"', (root / "sources/contracts/Example.sol").read_text())
            self.assertEqual(len(result["source_sha256"]), 64)

    def test_traversal_absolute_and_duplicate_paths_are_rejected(self):
        for name in ["../escape.sol", "/tmp/escape.sol", "bad;name.sol"]:
            with self.assertRaises(ValueError):
                module.split_sources(f"// ── File: {name} ──\ncontract X {{}}")
        with self.assertRaises(ValueError):
            module.split_sources("// ── File: X.sol ──\ncontract X {}\n// ── File: X.sol ──\ncontract X {}")

    def test_ambiguous_entrypoint_is_not_guessed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "input.sol").write_text("// ── File: A.sol ──\ncontract A {}\n// ── File: B.sol ──\ncontract B {}")
            with self.assertRaises(ValueError):
                module.materialize(root / "input.sol", root / "sources", "Unknown")


if __name__ == "__main__":
    unittest.main()
