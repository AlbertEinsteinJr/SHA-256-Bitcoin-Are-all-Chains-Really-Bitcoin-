"""Tests for the computer-use MCP server using stub modules.

pyautogui needs a real display and mss needs X11, neither of which is
available in CI. We install dummy `pyautogui` and `mss` modules into
`sys.modules` before importing the server (so module-level
`pyautogui.FAILSAFE = True` succeeds), then per-test we monkeypatch the
server's bindings so each test gets a fresh call recorder.
"""

from __future__ import annotations

import sys
import types
from dataclasses import dataclass

import pytest

pytest.importorskip("mcp")


# --- Bootstrap stub modules so the server module can import at all ---------

if "pyautogui" not in sys.modules:
    sys.modules["pyautogui"] = types.SimpleNamespace(
        FAILSAFE=False,
        click=lambda *a, **kw: None,
        doubleClick=lambda *a, **kw: None,
        moveTo=lambda *a, **kw: None,
        dragTo=lambda *a, **kw: None,
        write=lambda *a, **kw: None,
        press=lambda *a, **kw: None,
        hotkey=lambda *a, **kw: None,
        scroll=lambda *a, **kw: None,
        hscroll=lambda *a, **kw: None,
        position=lambda: types.SimpleNamespace(x=0, y=0),
        size=lambda: types.SimpleNamespace(width=0, height=0),
    )

if "mss" not in sys.modules:

    class _Grab:
        size = (4, 4)
        rgb = b"\x00" * (4 * 4 * 3)

    class _MSS:
        monitors = [None, {"top": 0, "left": 0, "width": 4, "height": 4}]

        def grab(self, _mon):
            return _Grab()

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

    sys.modules["mss"] = types.SimpleNamespace(mss=lambda: _MSS())

from src.mcp_servers import computer_use_server as server  # noqa: E402


@dataclass
class _Call:
    name: str
    args: tuple
    kwargs: dict


@pytest.fixture
def calls(monkeypatch):
    """Per-test fresh recorder bound onto the server module's `pyautogui`."""
    recorded: list[_Call] = []

    def record(name, returns=None):
        def _fn(*args, **kwargs):
            recorded.append(_Call(name, args, kwargs))
            return returns() if callable(returns) else returns

        return _fn

    fake = types.SimpleNamespace(
        FAILSAFE=False,
        click=record("click"),
        doubleClick=record("doubleClick"),
        moveTo=record("moveTo"),
        dragTo=record("dragTo"),
        write=record("write"),
        press=record("press"),
        hotkey=record("hotkey"),
        scroll=record("scroll"),
        hscroll=record("hscroll"),
        position=record("position", returns=lambda: types.SimpleNamespace(x=100, y=200)),
        size=record("size", returns=lambda: types.SimpleNamespace(width=1920, height=1080)),
    )
    monkeypatch.setattr(server, "pyautogui", fake)
    return recorded


def _invoke(name, **kwargs):
    fn = getattr(server, name)
    return fn.fn(**kwargs) if hasattr(fn, "fn") else fn(**kwargs)


def test_left_click(calls):
    result = _invoke("left_click", x=10, y=20)
    assert "10" in result and "20" in result
    assert calls[-1] == _Call("click", (), {"x": 10, "y": 20, "button": "left"})


def test_right_click(calls):
    _invoke("right_click", x=5, y=6)
    assert calls[-1].kwargs["button"] == "right"


def test_double_click(calls):
    _invoke("double_click", x=1, y=2)
    assert calls[-1].name == "doubleClick"


def test_mouse_move(calls):
    _invoke("mouse_move", x=7, y=8)
    assert calls[-1] == _Call("moveTo", (7, 8), {})


def test_left_click_drag(calls):
    _invoke("left_click_drag", x1=0, y1=0, x2=100, y2=200)
    names = [c.name for c in calls]
    assert "moveTo" in names and "dragTo" in names


def test_type_text(calls):
    _invoke("type_text", text="hello")
    assert calls[-1].name == "write"
    assert calls[-1].args == ("hello",)


def test_key_single_uses_press(calls):
    _invoke("key", combo="enter")
    assert calls[-1].name == "press"
    assert calls[-1].args == ("enter",)


def test_key_combo_uses_hotkey(calls):
    _invoke("key", combo="ctrl+shift+s")
    assert calls[-1].name == "hotkey"
    assert calls[-1].args == ("ctrl", "shift", "s")


def test_scroll_down_negates_amount(calls):
    _invoke("scroll", x=0, y=0, direction="down", amount=5)
    scrolls = [c for c in calls if c.name == "scroll"]
    assert scrolls[-1].args == (-5,)


def test_scroll_up_passes_positive(calls):
    _invoke("scroll", x=0, y=0, direction="up", amount=4)
    scrolls = [c for c in calls if c.name == "scroll"]
    assert scrolls[-1].args == (4,)


def test_scroll_horizontal_uses_hscroll(calls):
    _invoke("scroll", x=0, y=0, direction="right", amount=2)
    assert any(c.name == "hscroll" for c in calls)


def test_cursor_position(calls):
    assert _invoke("cursor_position") == {"x": 100, "y": 200}


def test_get_screen_size(calls):
    assert _invoke("get_screen_size") == {"width": 1920, "height": 1080}


def test_screenshot_returns_png_image_content():
    result = _invoke("screenshot")
    assert result.type == "image"
    assert result.mimeType == "image/png"
    assert result.data


def test_all_tools_registered_with_fastmcp():
    import asyncio

    tools = asyncio.run(server.mcp.list_tools())
    names = {t.name for t in tools}
    assert names == {
        "screenshot",
        "left_click",
        "right_click",
        "double_click",
        "mouse_move",
        "left_click_drag",
        "type_text",
        "key",
        "scroll",
        "cursor_position",
        "get_screen_size",
    }
