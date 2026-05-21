"""macOS-native control tools: AppleScript, windows, clipboard, app lifecycle.

All tools degrade safely on non-macOS platforms: they return an error dict
instead of raising. Implementation uses subprocess to shell out to
`osascript` and `pbcopy`/`pbpaste` rather than pyobjc, so we don't take a
hard dependency on PyObjC just for this.
"""

from __future__ import annotations

import platform
import subprocess
from typing import Annotated, Any

from mcp.server.fastmcp import FastMCP
from pydantic import Field

IS_MACOS = platform.system() == "Darwin"


def _osascript(script: str, timeout: float = 30.0) -> tuple[bool, str]:
    """Run an AppleScript and return (ok, stdout_or_error)."""
    if not IS_MACOS:
        return False, "macOS only"
    try:
        result = subprocess.run(
            ["osascript", "-e", script],
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return False, f"osascript timed out after {timeout}s"
    if result.returncode != 0:
        return False, (result.stderr or result.stdout).strip()
    return True, result.stdout.strip()


def register(mcp: FastMCP) -> None:
    """Register macOS tools on the given FastMCP instance."""

    @mcp.tool()
    def osascript(
        script: Annotated[str, Field(description="AppleScript or JXA source to execute.")],
        language: Annotated[
            str, Field(description="'AppleScript' or 'JavaScript'.")
        ] = "AppleScript",
        timeout: Annotated[float, Field(description="Seconds before kill.", gt=0)] = 30.0,
    ) -> dict[str, Any]:
        """Run a script via /usr/bin/osascript. macOS only."""
        if not IS_MACOS:
            return {"ok": False, "error": "macOS only"}
        try:
            result = subprocess.run(
                ["osascript", "-l", language, "-e", script],
                capture_output=True,
                text=True,
                timeout=timeout,
                check=False,
            )
        except subprocess.TimeoutExpired:
            return {"ok": False, "error": f"timed out after {timeout}s"}
        return {
            "ok": result.returncode == 0,
            "stdout": result.stdout.strip(),
            "stderr": result.stderr.strip(),
            "returncode": result.returncode,
        }

    @mcp.tool()
    def list_windows() -> list[dict[str, Any]] | dict[str, str]:
        """List visible windows across all applications. macOS only."""
        if not IS_MACOS:
            return {"error": "macOS only"}
        script = """
        set output to ""
        tell application "System Events"
            repeat with proc in (every process whose visible is true)
                set procName to name of proc
                try
                    repeat with w in (every window of proc)
                        set wTitle to name of w
                        set wPos to position of w
                        set wSize to size of w
                        set output to output & procName & "|" & wTitle & "|" & ¬
                            (item 1 of wPos) & "," & (item 2 of wPos) & "|" & ¬
                            (item 1 of wSize) & "," & (item 2 of wSize) & "\n"
                    end repeat
                end try
            end repeat
        end tell
        return output
        """
        ok, out = _osascript(script)
        if not ok:
            return {"error": out}
        windows: list[dict[str, Any]] = []
        for line in out.splitlines():
            parts = line.split("|")
            if len(parts) != 4:
                continue
            app, title, pos, size = parts
            try:
                x, y = (int(v) for v in pos.split(","))
                w, h = (int(v) for v in size.split(","))
            except ValueError:
                continue
            windows.append({"app": app, "title": title, "x": x, "y": y, "width": w, "height": h})
        return windows

    @mcp.tool()
    def get_active_window() -> dict[str, Any]:
        """Return the frontmost app and its focused window. macOS only."""
        if not IS_MACOS:
            return {"error": "macOS only"}
        script = """
        tell application "System Events"
            set frontApp to first process whose frontmost is true
            set appName to name of frontApp
            try
                set winName to name of front window of frontApp
            on error
                set winName to ""
            end try
            return appName & "|" & winName
        end tell
        """
        ok, out = _osascript(script)
        if not ok:
            return {"error": out}
        app, _, title = out.partition("|")
        return {"app": app, "title": title}

    @mcp.tool()
    def focus_window(
        app: Annotated[str, Field(description="Application name as it appears in System Events.")],
    ) -> dict[str, Any]:
        """Bring the given application to the foreground. macOS only."""
        if not IS_MACOS:
            return {"error": "macOS only"}
        ok, out = _osascript(f'tell application "{app}" to activate')
        return {"ok": ok, "detail": out}

    @mcp.tool()
    def move_window(
        app: str,
        x: Annotated[int, Field(ge=0)],
        y: Annotated[int, Field(ge=0)],
        window_index: Annotated[int, Field(description="1-based window index.", ge=1)] = 1,
    ) -> dict[str, Any]:
        """Move a window to (x, y). macOS only."""
        if not IS_MACOS:
            return {"error": "macOS only"}
        script = f"""
        tell application "System Events" to tell process "{app}"
            set position of window {window_index} to {{{x}, {y}}}
        end tell
        """
        ok, out = _osascript(script)
        return {"ok": ok, "detail": out}

    @mcp.tool()
    def resize_window(
        app: str,
        width: Annotated[int, Field(ge=1)],
        height: Annotated[int, Field(ge=1)],
        window_index: Annotated[int, Field(ge=1)] = 1,
    ) -> dict[str, Any]:
        """Resize a window. macOS only."""
        if not IS_MACOS:
            return {"error": "macOS only"}
        script = f"""
        tell application "System Events" to tell process "{app}"
            set size of window {window_index} to {{{width}, {height}}}
        end tell
        """
        ok, out = _osascript(script)
        return {"ok": ok, "detail": out}

    @mcp.tool()
    def open_app(name: str) -> dict[str, Any]:
        """Launch (or focus) an application by name. macOS only."""
        if not IS_MACOS:
            return {"error": "macOS only"}
        try:
            result = subprocess.run(
                ["open", "-a", name], capture_output=True, text=True, timeout=10, check=False
            )
        except subprocess.TimeoutExpired:
            return {"ok": False, "error": "open timed out"}
        return {
            "ok": result.returncode == 0,
            "stdout": result.stdout.strip(),
            "stderr": result.stderr.strip(),
        }

    @mcp.tool()
    def quit_app(name: str) -> dict[str, Any]:
        """Tell an application to quit gracefully. macOS only."""
        if not IS_MACOS:
            return {"error": "macOS only"}
        ok, out = _osascript(f'tell application "{name}" to quit')
        return {"ok": ok, "detail": out}

    @mcp.tool()
    def clipboard_read() -> dict[str, str]:
        """Return the current clipboard text. macOS only."""
        if not IS_MACOS:
            return {"error": "macOS only"}
        try:
            result = subprocess.run(
                ["pbpaste"], capture_output=True, text=True, timeout=5, check=False
            )
        except subprocess.TimeoutExpired:
            return {"error": "pbpaste timed out"}
        return {"text": result.stdout}

    @mcp.tool()
    def clipboard_write(text: str) -> dict[str, Any]:
        """Replace the clipboard with the given text. macOS only."""
        if not IS_MACOS:
            return {"error": "macOS only"}
        try:
            result = subprocess.run(
                ["pbcopy"], input=text, text=True, capture_output=True, timeout=5, check=False
            )
        except subprocess.TimeoutExpired:
            return {"ok": False, "error": "pbcopy timed out"}
        return {"ok": result.returncode == 0, "bytes": len(text)}

    @mcp.tool()
    def notification(
        title: str,
        message: str,
        sound: Annotated[str, Field(description="System sound name, e.g. 'Glass', 'Ping'.")] = "",
    ) -> dict[str, Any]:
        """Display a macOS Notification Center alert. macOS only."""
        if not IS_MACOS:
            return {"error": "macOS only"}
        # Escape double quotes for AppleScript.
        t = title.replace('"', '\\"')
        m = message.replace('"', '\\"')
        sound_clause = f' sound name "{sound}"' if sound else ""
        ok, out = _osascript(f'display notification "{m}" with title "{t}"{sound_clause}')
        return {"ok": ok, "detail": out}
