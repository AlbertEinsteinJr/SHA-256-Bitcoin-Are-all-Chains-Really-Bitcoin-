"""Playwright-backed browser automation tools.

The server owns a single Chromium instance (headed by default so the user
can see what's happening). Tools target the *active* page, identified by
its tab id. `browser_open` launches the browser lazily; subsequent tools
reuse the session until `browser_close` is called.

Optional dependency: playwright. Install with `pip install -e .[browser]`
and `playwright install chromium`. If Playwright is not importable, the
parent server skips this module silently.
"""

from __future__ import annotations

import asyncio
import base64
import threading
from typing import Annotated, Any

from mcp.server.fastmcp import FastMCP
from mcp.types import ImageContent
from playwright.sync_api import (  # noqa: F401  ensures group is skipped if missing
    Browser,
    Page,
    Playwright,
    sync_playwright,
)
from pydantic import Field

_state: dict[str, Any] = {
    "pw": None,  # Playwright instance
    "browser": None,  # Browser
    "context": None,  # BrowserContext
    "pages": {},  # tab_id -> Page
    "active": None,  # current tab_id
    "next_id": 1,
    "lock": threading.Lock(),
}


def _ensure_browser(headless: bool) -> None:
    """Lazily launch Chromium. Idempotent."""
    if _state["browser"] is not None:
        return
    pw = sync_playwright().start()
    browser = pw.chromium.launch(headless=headless)
    context = browser.new_context()
    _state["pw"] = pw
    _state["browser"] = browser
    _state["context"] = context


def _new_tab_id() -> str:
    tid = f"tab-{_state['next_id']}"
    _state["next_id"] += 1
    return tid


def _get_page(tab_id: str | None) -> tuple[str, Page] | None:
    if not _state["pages"]:
        return None
    tid = tab_id or _state["active"]
    page = _state["pages"].get(tid)
    if page is None:
        return None
    return tid, page


def register(mcp: FastMCP) -> None:
    @mcp.tool()
    def browser_open(
        url: Annotated[str, Field(description="Initial URL.")] = "about:blank",
        headless: Annotated[bool, Field(description="Run without a visible window.")] = False,
    ) -> dict[str, Any]:
        """Launch (or reuse) Chromium and open a new tab."""
        with _state["lock"]:
            _ensure_browser(headless=headless)
            page = _state["context"].new_page()
            page.goto(url)
            tid = _new_tab_id()
            _state["pages"][tid] = page
            _state["active"] = tid
        return {"ok": True, "tab_id": tid, "url": page.url, "title": page.title()}

    @mcp.tool()
    def browser_close(
        tab_id: Annotated[str, Field(description="Close only this tab; omit to close all.")] = "",
    ) -> dict[str, Any]:
        """Close a tab or shut the whole browser if no tab given."""
        with _state["lock"]:
            if tab_id:
                page = _state["pages"].pop(tab_id, None)
                if page is None:
                    return {"ok": False, "error": "unknown tab_id"}
                page.close()
                if _state["active"] == tab_id:
                    _state["active"] = next(iter(_state["pages"]), None)
                return {"ok": True, "closed": tab_id}
            for page in list(_state["pages"].values()):
                page.close()
            _state["pages"].clear()
            _state["active"] = None
            if _state["browser"] is not None:
                _state["browser"].close()
                _state["browser"] = None
            if _state["pw"] is not None:
                _state["pw"].stop()
                _state["pw"] = None
            _state["context"] = None
        return {"ok": True, "closed": "all"}

    @mcp.tool()
    def browser_list_tabs() -> list[dict[str, str]]:
        """List open tabs with their ids, URLs, and titles."""
        out: list[dict[str, str]] = []
        for tid, page in _state["pages"].items():
            try:
                out.append(
                    {
                        "tab_id": tid,
                        "url": page.url,
                        "title": page.title(),
                        "active": str(tid == _state["active"]),
                    }
                )
            except Exception as e:  # noqa: BLE001
                out.append({"tab_id": tid, "error": str(e)})
        return out

    @mcp.tool()
    def browser_switch_tab(tab_id: str) -> dict[str, Any]:
        """Make the given tab the active target for subsequent browser_* calls."""
        if tab_id not in _state["pages"]:
            return {"ok": False, "error": "unknown tab_id"}
        _state["active"] = tab_id
        return {"ok": True, "active": tab_id}

    @mcp.tool()
    def browser_navigate(
        url: str,
        tab_id: Annotated[str, Field(description="Target tab; defaults to active.")] = "",
        wait_until: Annotated[
            str, Field(description="'load', 'domcontentloaded', or 'networkidle'.")
        ] = "load",
    ) -> dict[str, Any]:
        """Navigate the target tab to a URL."""
        entry = _get_page(tab_id or None)
        if entry is None:
            return {"ok": False, "error": "no open tab; call browser_open first"}
        tid, page = entry
        try:
            page.goto(url, wait_until=wait_until)
        except Exception as e:  # noqa: BLE001
            return {"ok": False, "error": str(e)}
        return {"ok": True, "tab_id": tid, "url": page.url, "title": page.title()}

    @mcp.tool()
    def browser_click(
        selector: Annotated[str, Field(description="CSS selector for the element to click.")],
        tab_id: str = "",
        timeout: Annotated[
            float, Field(description="Selector wait timeout in seconds.", gt=0)
        ] = 10.0,
    ) -> dict[str, Any]:
        """Click an element by CSS selector."""
        entry = _get_page(tab_id or None)
        if entry is None:
            return {"ok": False, "error": "no open tab"}
        tid, page = entry
        try:
            page.click(selector, timeout=int(timeout * 1000))
        except Exception as e:  # noqa: BLE001
            return {"ok": False, "error": str(e)}
        return {"ok": True, "tab_id": tid, "selector": selector}

    @mcp.tool()
    def browser_type(
        selector: str,
        text: str,
        tab_id: str = "",
        clear_first: Annotated[bool, Field(description="Clear the field before typing.")] = True,
    ) -> dict[str, Any]:
        """Type text into a form field selected by CSS."""
        entry = _get_page(tab_id or None)
        if entry is None:
            return {"ok": False, "error": "no open tab"}
        tid, page = entry
        try:
            if clear_first:
                page.fill(selector, text)
            else:
                page.type(selector, text)
        except Exception as e:  # noqa: BLE001
            return {"ok": False, "error": str(e)}
        return {"ok": True, "tab_id": tid, "selector": selector, "chars": len(text)}

    @mcp.tool()
    def browser_screenshot(
        tab_id: str = "",
        full_page: Annotated[bool, Field(description="Capture full scroll height.")] = False,
    ) -> ImageContent | dict[str, str]:
        """Return a PNG screenshot of the current page."""
        entry = _get_page(tab_id or None)
        if entry is None:
            return {"error": "no open tab"}
        _, page = entry
        png = page.screenshot(full_page=full_page)
        return ImageContent(
            type="image",
            mimeType="image/png",
            data=base64.b64encode(png).decode("ascii"),
        )

    @mcp.tool()
    def browser_eval(
        expression: Annotated[
            str, Field(description="JavaScript expression evaluated in the page context.")
        ],
        tab_id: str = "",
    ) -> dict[str, Any]:
        """Evaluate JavaScript in the page and return its JSON-serialised result."""
        entry = _get_page(tab_id or None)
        if entry is None:
            return {"ok": False, "error": "no open tab"}
        tid, page = entry
        try:
            value = page.evaluate(expression)
        except Exception as e:  # noqa: BLE001
            return {"ok": False, "error": str(e)}
        return {"ok": True, "tab_id": tid, "value": value}

    @mcp.tool()
    def browser_content(
        tab_id: str = "",
        max_chars: Annotated[
            int, Field(description="Cap on returned HTML length.", ge=1)
        ] = 200_000,
    ) -> dict[str, Any]:
        """Return the active page's HTML."""
        entry = _get_page(tab_id or None)
        if entry is None:
            return {"ok": False, "error": "no open tab"}
        _, page = entry
        html = page.content()
        truncated = len(html) > max_chars
        return {"ok": True, "html": html[:max_chars], "truncated": truncated, "url": page.url}

    @mcp.tool()
    def browser_text(
        selector: Annotated[str, Field(description="CSS selector; defaults to body.")] = "body",
        tab_id: str = "",
    ) -> dict[str, Any]:
        """Return the visible text of an element."""
        entry = _get_page(tab_id or None)
        if entry is None:
            return {"ok": False, "error": "no open tab"}
        _, page = entry
        try:
            text = page.inner_text(selector)
        except Exception as e:  # noqa: BLE001
            return {"ok": False, "error": str(e)}
        return {"ok": True, "text": text}

    @mcp.tool()
    def browser_wait_for(
        selector: str,
        tab_id: str = "",
        timeout: Annotated[float, Field(gt=0)] = 10.0,
        state: Annotated[
            str, Field(description="'attached', 'visible', 'hidden', 'detached'.")
        ] = "visible",
    ) -> dict[str, Any]:
        """Block until a selector reaches the given state."""
        entry = _get_page(tab_id or None)
        if entry is None:
            return {"ok": False, "error": "no open tab"}
        _, page = entry
        try:
            page.wait_for_selector(selector, timeout=int(timeout * 1000), state=state)
        except Exception as e:  # noqa: BLE001
            return {"ok": False, "error": str(e)}
        return {"ok": True}


# Hint for `asyncio` import to keep linters happy when nothing else uses it.
_ = asyncio
