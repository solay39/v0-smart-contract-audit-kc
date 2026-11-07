"""Decode workflow input with a hard decompression limit."""
import base64
import gzip
import io
import os
from pathlib import Path

MAX_SOURCE_BYTES = 2 * 1024 * 1024


def decode_source(encoded):
    if len(encoded) > 60_000:
        raise ValueError("Encoded source exceeds dispatch limit")
    compressed = base64.b64decode(encoded, validate=True)
    with gzip.GzipFile(fileobj=io.BytesIO(compressed)) as stream:
        source = stream.read(MAX_SOURCE_BYTES + 1)
    if len(source) > MAX_SOURCE_BYTES:
        raise ValueError("Decompressed source exceeds 2 MiB")
    source.decode("utf-8", errors="strict")
    return source


if __name__ == "__main__":
    Path("work").mkdir(exist_ok=True)
    Path("out").mkdir(exist_ok=True)
    Path("work/Contract.sol").write_bytes(decode_source(os.environ["SRC"]))
