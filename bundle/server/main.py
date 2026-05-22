"""Entry shim for the .mcpb bundle.

The bundle includes a copy of `src/mcp_servers/*` at `${__dirname}/server/src/mcp_servers/`,
and a `lib/` directory with vendored Python dependencies (or none, if the
host installs them lazily). We prepend both to sys.path, then delegate to
the real server's `main()`.
"""

from __future__ import annotations

import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
_BUNDLE_ROOT = os.path.dirname(_HERE)
_SRC_ROOT = os.path.join(_HERE, "src")
_LIB_ROOT = os.path.join(_HERE, "lib")

# Vendored deps (mcp, pydantic, etc.) — present if the bundle was built with
# `python scripts/build_mcpb.py --with-deps`.
if os.path.isdir(_LIB_ROOT):
    sys.path.insert(0, _LIB_ROOT)

# Server source.
if os.path.isdir(_SRC_ROOT):
    sys.path.insert(0, _SRC_ROOT)
else:
    # Dev fallback: when running from a working tree, src lives at repo root.
    sys.path.insert(0, os.path.join(_BUNDLE_ROOT, "..", "src"))


def main() -> int:
    from src.mcp_servers import computer_use_server  # noqa: WPS433  (late import is deliberate)

    computer_use_server.main()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
