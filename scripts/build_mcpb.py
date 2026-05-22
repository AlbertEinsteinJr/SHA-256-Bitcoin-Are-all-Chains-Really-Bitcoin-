#!/usr/bin/env python3
"""Build computer-use.mcpb — a zip archive Claude Desktop can install.

Layout of the produced .mcpb:

    manifest.json                 (from bundle/manifest.json)
    server/main.py                (entry shim)
    server/src/                   (copy of repo's src/ — the actual server)
    server/requirements.txt       (runtime deps for the host to install)
    server/lib/                   (optional vendored deps if --with-deps)
    icon.png                      (optional)

Usage:
    python scripts/build_mcpb.py [--with-deps] [--output PATH]

--with-deps  Pip-installs the `mcp` + computer-use extras into bundle's
             server/lib/ so the host doesn't need a network. ~150-300MB.
             Without it, Claude Desktop / the host must `pip install -r
             server/requirements.txt` before launching the server.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
BUNDLE_SRC = REPO / "bundle"
DEFAULT_OUTPUT = REPO / "computer-use.mcpb"

REQUIREMENTS = """\
mcp>=1.0
pyautogui>=0.9.54
mss>=9.0
Pillow>=10.0
# Optional groups — leave commented unless you want them:
# playwright>=1.40
# pytesseract>=0.3.10
# opencv-python>=4.8
# numpy>=1.24
"""


def fail(msg: str) -> None:
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(1)


def validate_manifest(path: Path) -> dict:
    try:
        manifest = json.loads(path.read_text())
    except json.JSONDecodeError as e:
        fail(f"manifest.json is not valid JSON: {e}")

    required = ("dxt_version", "name", "version", "description", "author", "server")
    missing = [k for k in required if k not in manifest]
    if missing:
        fail(f"manifest.json missing required fields: {missing}")

    server = manifest["server"]
    if server.get("type") != "python":
        fail(f"only server.type='python' is supported, got {server.get('type')!r}")
    if "entry_point" not in server:
        fail("manifest server.entry_point is required")

    return manifest


def build(output: Path, with_deps: bool) -> Path:
    manifest_path = BUNDLE_SRC / "manifest.json"
    if not manifest_path.exists():
        fail(f"missing {manifest_path}")
    manifest = validate_manifest(manifest_path)

    with tempfile.TemporaryDirectory() as tmp:
        stage = Path(tmp) / "bundle"
        stage.mkdir()

        # 1. Copy manifest verbatim.
        shutil.copy2(manifest_path, stage / "manifest.json")

        # 2. Copy server/ (entry shim + anything else under bundle/server/).
        shutil.copytree(BUNDLE_SRC / "server", stage / "server")

        # 3. Copy repo's src/ into server/src/ so the entry shim can import it.
        shutil.copytree(
            REPO / "src",
            stage / "server" / "src",
            ignore=shutil.ignore_patterns("__pycache__", "*.pyc"),
        )

        # 4. Drop a requirements.txt next to the source.
        (stage / "server" / "requirements.txt").write_text(REQUIREMENTS)

        # 5. Optionally vendor deps into server/lib/.
        if with_deps:
            lib_dir = stage / "server" / "lib"
            lib_dir.mkdir()
            print(f"installing deps into {lib_dir} ...")
            result = subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "pip",
                    "install",
                    "--target",
                    str(lib_dir),
                    "mcp>=1.0",
                    "pyautogui>=0.9.54",
                    "mss>=9.0",
                    "Pillow>=10.0",
                ],
                capture_output=True,
                text=True,
                check=False,
            )
            if result.returncode != 0:
                print(result.stdout)
                print(result.stderr, file=sys.stderr)
                fail("pip install failed; aborting bundle build")

        # 6. Zip the staging dir into the .mcpb.
        output.parent.mkdir(parents=True, exist_ok=True)
        if output.exists():
            output.unlink()
        with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            for path in sorted(stage.rglob("*")):
                if path.is_file():
                    arcname = path.relative_to(stage).as_posix()
                    zf.write(path, arcname)

    # 7. Report.
    size_kb = output.stat().st_size / 1024
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    print(f"built: {output}")
    print(f"  size:   {size_kb:,.1f} KB")
    print(f"  sha256: {digest}")
    print(f"  name:   {manifest['name']} v{manifest['version']}")
    print(f"  tools:  {len(manifest.get('tools', []))}")
    return output


def verify(path: Path) -> None:
    """Sanity-check the produced zip."""
    with zipfile.ZipFile(path) as zf:
        names = zf.namelist()
        if "manifest.json" not in names:
            fail("bundle is missing manifest.json at root")
        if "server/main.py" not in names:
            fail("bundle is missing server/main.py")
        # Manifest must be valid JSON inside the zip too.
        json.loads(zf.read("manifest.json"))
    print(f"verify: {path} contains {len(names)} entries; manifest.json + server/main.py present")


def main() -> int:
    p = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    p.add_argument("--with-deps", action="store_true", help="Vendor Python deps into the bundle.")
    p.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Output .mcpb path.")
    args = p.parse_args()

    out = build(args.output, with_deps=args.with_deps)
    verify(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
