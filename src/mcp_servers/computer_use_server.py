"""Ultimate computer-use MCP server: input + macOS-native + shell + browser + vision + recording.

Each tool group lives in a sibling module (`_input.py`, `_macos.py`, `_shell.py`,
`_browser.py`, `_vision.py`, `_recording.py`) and registers itself via a
`register(mcp)` function. Optional dependencies (Playwright, pytesseract,
OpenCV) are detected at import time; if a group's deps are missing, that
group is skipped silently and the rest of the server still runs.

WARNING: this server drives the *real* desktop, browser, shell, and
filesystem of the machine it runs on. No sandbox, no per-app allowlist —
only pyautogui's FAILSAFE (slam the mouse to the top-left corner to
abort). Do not approve this server on a host with active sensitive
sessions, and prefer a dedicated user or VM.

Run with:
    python -m src.mcp_servers.computer_use_server
or the console script:
    computer-use-mcp-py
"""

from __future__ import annotations

import importlib
import sys
from collections.abc import Callable

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("computer-use")

# Sub-modules in registration order. Each must expose `register(mcp)`.
# `optional` = True means the import is allowed to fail (missing optional
# dep); we just skip the group. `optional` = False means the import is
# mandatory and a failure should propagate.
_GROUPS: list[tuple[str, bool]] = [
    ("_input", False),
    ("_macos", False),
    ("_shell", False),
    ("_browser", True),
    ("_vision", True),
    ("_recording", False),
]


def _load() -> dict[str, str]:
    """Import each group module and call its register(mcp). Return status map."""
    status: dict[str, str] = {}
    for name, optional in _GROUPS:
        try:
            mod = importlib.import_module(f"src.mcp_servers.{name}")
            register: Callable[[FastMCP], None] = mod.register
            register(mcp)
            status[name] = "loaded"
        except Exception as exc:  # noqa: BLE001
            if not optional:
                raise
            status[name] = f"skipped: {type(exc).__name__}: {exc}"
    return status


SERVER_STATUS = _load()


def main() -> None:
    # Print group status to stderr so the user sees what loaded.
    for name, state in SERVER_STATUS.items():
        print(f"[computer-use] {name}: {state}", file=sys.stderr)
    mcp.run()


if __name__ == "__main__":
    main()
