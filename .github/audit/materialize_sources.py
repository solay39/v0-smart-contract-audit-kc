"""Restore explorer file boundaries instead of compiling concatenated imports."""
import hashlib
import json
import re
import sys
from pathlib import Path, PurePosixPath

MARKER = re.compile(r"^//\s*[─-]+\s*File:\s*(.*?)\s*[─-]+\s*$", re.MULTILINE)


def split_sources(code: str) -> dict[str, str]:
    markers = list(MARKER.finditer(code))
    if not markers:
        return {"Contract.sol": code}
    if code[:markers[0].start()].strip():
        raise ValueError("Unscoped source before the first file marker")
    if len(markers) > 400:
        raise ValueError("Too many source files")
    sources = {}
    for i, marker in enumerate(markers):
        name = marker.group(1)
        path = PurePosixPath(name)
        if (not re.fullmatch(r"[A-Za-z0-9_@./-]+", name) or path.is_absolute()
                or ".." in path.parts or path.suffix != ".sol"):
            raise ValueError(f"Unsafe source path: {name!r}")
        name = str(path)
        if name in sources:
            raise ValueError(f"Duplicate source path: {name}")
        end = markers[i + 1].start() if i + 1 < len(markers) else len(code)
        sources[name] = code[marker.end():end].lstrip("\r\n")
    return sources


def materialize(input_path: Path, root: Path, contract_name: str):
    code = input_path.read_bytes().decode("utf-8")
    sources = split_sources(code)
    root.mkdir(parents=True, exist_ok=True)
    for name, content in sources.items():
        destination = root / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(content)
    declaration = re.compile(r"\bcontract\s+" + re.escape(contract_name) + r"\b", re.IGNORECASE)
    matches = [name for name, content in sources.items() if declaration.search(content)]
    contracts = [name for name, content in sources.items() if re.search(r"(?<!abstract )\bcontract\s+", content)]
    # Do not silently choose an arbitrary file if the scope is ambiguous.
    if len(matches) == 1:
        entry = matches[0]
    elif len(sources) == 1:
        entry = next(iter(sources))
    elif len(contracts) == 1:
        entry = contracts[0]
    else:
        raise ValueError("Ambiguous entry contract: use the verified Solidity contract name")
    layout = {
        "entry": entry,
        "source_sha256": hashlib.sha256(code.encode()).hexdigest(),
        "sources": {name: hashlib.sha256(content.encode()).hexdigest() for name, content in sources.items()},
    }
    (root.parent / "source-layout.json").write_text(json.dumps(layout))
    return layout


if __name__ == "__main__":
    layout = materialize(Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3])
    print(f"entry={layout['entry']}")
