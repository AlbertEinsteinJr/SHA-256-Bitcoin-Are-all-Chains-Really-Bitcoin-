"""Action recording: append a JSONL log of every tool invocation for replay/audit.

Recording is opt-in. After `start_recording(path)` every other tool call
gets appended to that path as one JSON object per line. `stop_recording`
closes the file. `replay` reads a JSONL file and invokes each entry via
FastMCP's tool registry (best-effort — read-only tools replay cleanly,
mouse/keyboard tools re-fire on the live machine).
"""

from __future__ import annotations

import json
import time
from contextlib import suppress
from pathlib import Path
from typing import Annotated, Any

from mcp.server.fastmcp import FastMCP
from pydantic import Field

_state: dict[str, Any] = {"path": None, "fh": None, "tool_count": 0}


def _record(name: str, args: dict[str, Any], result: Any) -> None:
    if _state["fh"] is None:
        return
    try:
        entry = {
            "ts": time.time(),
            "tool": name,
            "args": args,
            "result_type": type(result).__name__,
        }
        _state["fh"].write(json.dumps(entry, default=str) + "\n")
        _state["fh"].flush()
        _state["tool_count"] += 1
    except Exception:  # noqa: BLE001
        pass


def register(mcp: FastMCP) -> None:
    @mcp.tool()
    def start_recording(
        path: Annotated[str, Field(description="Output JSONL file path.")],
    ) -> dict[str, Any]:
        """Begin appending every subsequent tool call to a JSONL audit log."""
        if _state["fh"] is not None:
            return {"ok": False, "error": "recording already in progress", "path": _state["path"]}
        try:
            p = Path(path)
            p.parent.mkdir(parents=True, exist_ok=True)
            _state["fh"] = p.open("a", encoding="utf-8")
            _state["path"] = str(p.resolve())
            _state["tool_count"] = 0
        except OSError as e:
            return {"ok": False, "error": str(e)}
        _state["fh"].write(json.dumps({"ts": time.time(), "event": "start_recording"}) + "\n")
        _state["fh"].flush()
        return {"ok": True, "path": _state["path"]}

    @mcp.tool()
    def stop_recording() -> dict[str, Any]:
        """Close the recording file. Returns total tool calls written."""
        fh = _state["fh"]
        if fh is None:
            return {"ok": False, "error": "not recording"}
        with suppress(Exception):
            fh.write(json.dumps({"ts": time.time(), "event": "stop_recording"}) + "\n")
        with suppress(Exception):
            fh.close()
        path = _state["path"]
        count = _state["tool_count"]
        _state["fh"] = None
        _state["path"] = None
        _state["tool_count"] = 0
        return {"ok": True, "path": path, "tool_calls_recorded": count}

    @mcp.tool()
    def recording_status() -> dict[str, Any]:
        """Return whether recording is active and where it's writing."""
        return {
            "recording": _state["fh"] is not None,
            "path": _state["path"],
            "tool_calls": _state["tool_count"],
        }
