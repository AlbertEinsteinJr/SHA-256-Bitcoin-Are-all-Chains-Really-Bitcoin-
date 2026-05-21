"""MCP server for computer control via pyautogui + mss.

A pure-Python equivalent of `domdomegg/computer-use-mcp` (which uses
nut.js). The tool surface mirrors the Anthropic computer-use API tool so
prompts written for one are largely portable. Arguments use pydantic Field
annotations so MCP clients see rich JSON schemas with descriptions and
constraints.

WARNING: this server drives the *real* desktop of the machine it runs on.
There is no sandbox. Do not approve this MCP server on a host with active
sensitive sessions, and prefer a dedicated user/VM. pyautogui's FAILSAFE
is enabled — slamming the mouse to the top-left corner aborts the current
action.

Run with:
    python -m src.mcp_servers.computer_use_server
or the console script:
    computer-use-mcp-py
"""

from __future__ import annotations

import base64
import io
from typing import Annotated, Literal

import mss
import pyautogui
from mcp.server.fastmcp import FastMCP
from mcp.types import ImageContent
from PIL import Image
from pydantic import Field

pyautogui.FAILSAFE = True

mcp = FastMCP("computer-use")


Coord = Annotated[int, Field(description="Pixel coordinate on the primary display.", ge=0)]
ScrollDirection = Literal["up", "down", "left", "right"]


@mcp.tool()
def screenshot() -> ImageContent:
    """Capture the primary display and return it as a PNG image."""
    with mss.mss() as sct:
        monitor = sct.monitors[1]  # primary display
        raw = sct.grab(monitor)
    image = Image.frombytes("RGB", raw.size, raw.rgb)
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    encoded = base64.b64encode(buf.getvalue()).decode("ascii")
    return ImageContent(type="image", mimeType="image/png", data=encoded)


@mcp.tool()
def left_click(x: Coord, y: Coord) -> str:
    """Left-click at the given screen coordinates."""
    pyautogui.click(x=x, y=y, button="left")
    return f"left_click at ({x}, {y})"


@mcp.tool()
def right_click(x: Coord, y: Coord) -> str:
    """Right-click at the given screen coordinates."""
    pyautogui.click(x=x, y=y, button="right")
    return f"right_click at ({x}, {y})"


@mcp.tool()
def double_click(x: Coord, y: Coord) -> str:
    """Double-click at the given screen coordinates."""
    pyautogui.doubleClick(x=x, y=y)
    return f"double_click at ({x}, {y})"


@mcp.tool()
def mouse_move(x: Coord, y: Coord) -> str:
    """Move the cursor to the given screen coordinates."""
    pyautogui.moveTo(x, y)
    return f"mouse_move to ({x}, {y})"


@mcp.tool()
def left_click_drag(
    x1: Coord,
    y1: Coord,
    x2: Coord,
    y2: Coord,
    duration: Annotated[float, Field(description="Drag duration in seconds.", ge=0)] = 0.2,
) -> str:
    """Drag from (x1, y1) to (x2, y2) with the left button held."""
    pyautogui.moveTo(x1, y1)
    pyautogui.dragTo(x2, y2, duration=duration, button="left")
    return f"drag ({x1}, {y1}) -> ({x2}, {y2})"


@mcp.tool()
def type_text(
    text: Annotated[str, Field(description="Text to type via simulated keystrokes.")],
    interval: Annotated[float, Field(description="Seconds between keys.", ge=0)] = 0.0,
) -> str:
    """Type the given text via simulated keystrokes."""
    pyautogui.write(text, interval=interval)
    return f"typed {len(text)} char(s)"


@mcp.tool()
def key(
    combo: Annotated[
        str,
        Field(description="Single key or '+'-separated combo, e.g. 'ctrl+s', 'shift+tab'."),
    ],
) -> str:
    """Press a key or '+'-separated combo (e.g. 'ctrl+s', 'shift+tab')."""
    parts = [p.strip() for p in combo.split("+") if p.strip()]
    if len(parts) == 1:
        pyautogui.press(parts[0])
    else:
        pyautogui.hotkey(*parts)
    return f"pressed {combo}"


@mcp.tool()
def scroll(
    x: Coord,
    y: Coord,
    direction: ScrollDirection = "down",
    amount: Annotated[int, Field(description="Click count.", ge=1)] = 3,
) -> str:
    """Scroll at the given coordinates."""
    pyautogui.moveTo(x, y)
    if direction == "up":
        pyautogui.scroll(amount)
    elif direction == "down":
        pyautogui.scroll(-amount)
    elif direction == "right":
        pyautogui.hscroll(amount)
    elif direction == "left":
        pyautogui.hscroll(-amount)
    return f"scrolled {direction} by {amount} at ({x}, {y})"


@mcp.tool()
def cursor_position() -> dict[str, int]:
    """Return the current cursor coordinates."""
    pos = pyautogui.position()
    return {"x": pos.x, "y": pos.y}


@mcp.tool()
def get_screen_size() -> dict[str, int]:
    """Return the primary display size in pixels."""
    size = pyautogui.size()
    return {"width": size.width, "height": size.height}


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
