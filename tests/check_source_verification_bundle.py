"""Adversarial integration checks against a genuinely executed evidence bundle.

Usage: python3 tests/check_source_verification_bundle.py path/to/bundle
No synthetic bundle can substitute for the execution step in the CI workflow.
"""
import importlib.util
from pathlib import Path
import shutil
import sys
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location(
    "source_verification", Path(__file__).parents[1] / "scripts/verify-aero-source.py")
v = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(v)


class ExecutedBundleTests(unittest.TestCase):
    bundle = None

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name) / "bundle"
        shutil.copytree(self.bundle, self.root)

    def tearDown(self):
        self.temp.cleanup()

    def edit(self, path, change):
        location = self.root / path
        data = v.strict_json(location)
        change(data)
        v.write_json(location, data)

    def rehash(self):
        # Rehash after tampering: semantic validation must still reject the bundle.
        summary = v.strict_json(self.root / "summary.json")
        summary["files"] = {p.relative_to(self.root).as_posix(): v.sha(p.read_bytes())
                            for p in self.root.rglob("*") if p.is_file() and p != self.root / "summary.json"}
        v.write_json(self.root / "summary.json", summary)

    def rejected(self):
        with self.assertRaises(ValueError):
            v.verify_bundle(self.root)

    def test_real_bundle_is_consistent(self):
        result = v.verify_bundle(self.root)
        self.assertEqual(result["fuzz_cases_reported"], 2048)
        self.assertEqual(result["invariant_campaign"]["calls"], 8192)

    def test_raw_file_tampering_without_rehash(self):
        with (self.root / "forge-results.stderr.log").open("a") as output:
            output.write("changed")
        self.rejected()

    def test_original_source_tampering_with_rehash(self):
        with (self.root / "Aero.sol").open("a") as output:
            output.write("\n// changed")
        self.rehash()
        self.rejected()

    def test_fuzz_kind_forgery_with_rehash(self):
        self.edit("forge-results.json", lambda data: data[v.UNIT_SUITE]["test_results"]
                  ["testFuzz_MintAccounting(uint128)"].update(kind={"Unit": {"gas": 1}}))
        self.rehash()
        self.rejected()

    def test_measured_counts_cannot_be_inflated(self):
        self.edit("summary.json", lambda data: data["observed"].update(fuzz_cases_reported=1000000))
        self.rejected()

    def test_grouped_predicate_cannot_disappear(self):
        self.edit("forge-results.json", lambda data: data[v.INVARIANT_SUITE]["test_results"]
                  [v.INVARIANT_ENTRY]["invariant_predicate_results"].pop())
        self.rehash()
        self.rejected()

    def test_compiler_input_source_cannot_change(self):
        self.edit("build-1-input.json", lambda data: data["input"]["sources"]
                  ["src/Aero.sol"].update(content="different source"))
        self.rehash()
        self.rejected()

    def test_compiler_artifact_cannot_change(self):
        self.edit("build-2-Aero.json", lambda data: data["bytecode"].update(object="0x6000"))
        self.rehash()
        self.rejected()

    def test_passing_mutation_is_not_a_detected_bug(self):
        mutation = v.MUTATIONS["public-mint"]
        path = "negative-controls/public-mint/forge-results.json"
        self.edit(path, lambda data: data[v.UNIT_SUITE]["test_results"]
                  [mutation["test"]].update(status="Success"))
        (self.root / "negative-controls/public-mint/forge-results.exit-code.txt").write_text("0\n")
        self.rehash()
        self.rejected()

    def test_mutant_source_must_be_the_declared_transformation(self):
        (self.root / "negative-controls/public-mint/Aero.sol").write_text("unrelated contract")
        self.rehash()
        self.rejected()

    def test_founder_approval_cannot_be_added(self):
        self.edit("summary.json", lambda data: data["claims"].update(founder_approved=True))
        self.rejected()

    def test_limitations_cannot_be_removed(self):
        self.edit("summary.json", lambda data: data.update(limitations=[]))
        self.rejected()

    def test_unknown_files_not_accepted_even_if_hashed(self):
        (self.root / "fake-certification.json").write_text('{"approved": true}')
        self.rehash()
        self.rejected()

    def test_missing_files_not_accepted_even_if_manifest_is_updated(self):
        (self.root / "foundry-version.txt").unlink()
        self.rehash()
        self.rejected()

    def test_duplicate_json_keys_not_accepted_even_if_hashed(self):
        path = self.root / "toolchain.json"
        data = v.strict_json(path)
        raw = path.read_text().rstrip()
        path.write_text(raw[:-1] + ', "forge_commit": "' + data["forge_commit"] + '"}')
        self.rehash()
        self.rejected()

    def test_symlink_substitution(self):
        path = self.root / "foundry-version.txt"
        original = Path(self.temp.name) / "version.txt"
        path.rename(original)
        path.symlink_to(original)
        self.rejected()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    ExecutedBundleTests.bundle = Path(sys.argv[1]).resolve()
    # Check the real input once before running any mutation of its copies.
    v.verify_bundle(ExecutedBundleTests.bundle)
    unittest.main(argv=[sys.argv[0]], verbosity=2)
