"""OCR + template matching tools.

Optional dependencies: pytesseract (needs the `tesseract` binary on PATH),
opencv-python, numpy. If any are missing the parent server skips this
module silently.
"""

from __future__ import annotations

import time
from typing import Annotated, Any

import cv2
import mss
import numpy as np
import pytesseract  # noqa: F401  ensures group is skipped if missing
from mcp.server.fastmcp import FastMCP
from PIL import Image
from pydantic import Field


def _capture(region: tuple[int, int, int, int] | None = None) -> np.ndarray:
    """Grab a screen region as an RGB ndarray. region = (x, y, w, h)."""
    with mss.mss() as sct:
        if region is None:
            monitor = sct.monitors[1]
        else:
            x, y, w, h = region
            monitor = {"left": x, "top": y, "width": w, "height": h}
        raw = sct.grab(monitor)
    img = np.array(Image.frombytes("RGB", raw.size, raw.rgb))
    return img


def register(mcp: FastMCP) -> None:
    @mcp.tool()
    def read_text_in_region(
        x: Annotated[int, Field(ge=0)] = 0,
        y: Annotated[int, Field(ge=0)] = 0,
        width: Annotated[int, Field(description="0 = full display width from x.", ge=0)] = 0,
        height: Annotated[int, Field(description="0 = full display height from y.", ge=0)] = 0,
        lang: Annotated[
            str, Field(description="Tesseract language code, e.g. 'eng', 'eng+jpn'.")
        ] = "eng",
    ) -> dict[str, Any]:
        """OCR a region of the screen. (0,0,0,0) means the whole display."""
        region = None if width == 0 or height == 0 else (x, y, width, height)
        img = _capture(region)
        try:
            text = pytesseract.image_to_string(img, lang=lang)
        except Exception as e:  # noqa: BLE001
            return {"ok": False, "error": str(e)}
        return {"ok": True, "text": text.strip(), "region": region}

    @mcp.tool()
    def find_on_screen(
        template_path: Annotated[str, Field(description="Path to a PNG/JPG to search for.")],
        threshold: Annotated[
            float, Field(description="0-1 confidence cutoff for cv2 matchTemplate.", ge=0.0, le=1.0)
        ] = 0.85,
        max_results: Annotated[int, Field(ge=1, le=100)] = 10,
    ) -> dict[str, Any]:
        """Locate every screen region that matches a template image.

        Returns center (x, y) coordinates of each match, sorted by confidence.
        """
        try:
            template = cv2.imread(template_path)
            if template is None:
                return {"ok": False, "error": f"failed to read template: {template_path}"}
        except Exception as e:  # noqa: BLE001
            return {"ok": False, "error": str(e)}
        screen_rgb = _capture()
        screen = cv2.cvtColor(screen_rgb, cv2.COLOR_RGB2BGR)
        result = cv2.matchTemplate(screen, template, cv2.TM_CCOEFF_NORMED)
        h, w = template.shape[:2]

        # Suppress overlapping detections by walking the result grid in descending score order.
        ys, xs = np.where(result >= threshold)
        scored = sorted(
            (
                {"x": int(x), "y": int(y), "score": float(result[y, x])}
                for y, x in zip(ys, xs, strict=False)
            ),
            key=lambda m: -m["score"],
        )
        matches: list[dict[str, Any]] = []
        used: list[tuple[int, int]] = []
        for m in scored:
            if any(abs(m["x"] - ux) < w // 2 and abs(m["y"] - uy) < h // 2 for ux, uy in used):
                continue
            used.append((m["x"], m["y"]))
            matches.append(
                {
                    "x": m["x"] + w // 2,
                    "y": m["y"] + h // 2,
                    "score": round(m["score"], 4),
                    "width": w,
                    "height": h,
                }
            )
            if len(matches) >= max_results:
                break
        return {"ok": True, "matches": matches, "threshold": threshold}

    @mcp.tool()
    def wait_until_text_appears(
        text: Annotated[str, Field(description="Substring to wait for (case-insensitive).")],
        timeout: Annotated[float, Field(description="Seconds before giving up.", gt=0)] = 15.0,
        poll_interval: Annotated[float, Field(description="Seconds between checks.", gt=0)] = 1.0,
        region: Annotated[
            list[int],
            Field(description="[x, y, w, h] of screen region to scan; empty = full display."),
        ] = [],  # noqa: B006  (FastMCP needs a JSON-schema-friendly default)
        lang: str = "eng",
    ) -> dict[str, Any]:
        """Poll OCR every `poll_interval` until the substring appears or timeout hits."""
        needle = text.lower()
        deadline = time.time() + timeout
        rect: tuple[int, int, int, int] | None = None
        if len(region) == 4:
            rect = (region[0], region[1], region[2], region[3])
        attempts = 0
        while time.time() < deadline:
            attempts += 1
            img = _capture(rect)
            try:
                seen = pytesseract.image_to_string(img, lang=lang).lower()
            except Exception as e:  # noqa: BLE001
                return {"ok": False, "error": str(e), "attempts": attempts}
            if needle in seen:
                return {"ok": True, "found": True, "attempts": attempts}
            time.sleep(poll_interval)
        return {"ok": True, "found": False, "attempts": attempts, "timed_out": True}

    @mcp.tool()
    def wait_until_pixel_color(
        x: Annotated[int, Field(ge=0)],
        y: Annotated[int, Field(ge=0)],
        rgb: Annotated[list[int], Field(description="Target color [r, g, b], each 0-255.")],
        tolerance: Annotated[int, Field(description="Per-channel ± tolerance.", ge=0, le=255)] = 5,
        timeout: Annotated[float, Field(gt=0)] = 10.0,
        poll_interval: Annotated[float, Field(gt=0)] = 0.2,
    ) -> dict[str, Any]:
        """Poll a single pixel until it matches the target RGB color (within tolerance)."""
        if len(rgb) != 3:
            return {"ok": False, "error": "rgb must be [r, g, b]"}
        target = np.array(rgb, dtype=np.int16)
        deadline = time.time() + timeout
        while time.time() < deadline:
            img = _capture((x, y, 1, 1))
            pix = img[0, 0].astype(np.int16)
            if int(np.max(np.abs(pix - target))) <= tolerance:
                return {"ok": True, "matched": True, "observed": pix.tolist()}
            time.sleep(poll_interval)
        return {"ok": True, "matched": False, "timed_out": True}
