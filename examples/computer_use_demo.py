"""
Minimal computer use agent loop.

Sends a task to Claude with the computer use tool plus the bash and text editor
tools, then iterates the standard tool_use / tool_result loop until Claude
finishes or the iteration limit is hit.

The action handlers here are stubs that just echo back what Claude requested.
In a real deployment they would drive a sandboxed VM or container (see
https://github.com/anthropics/anthropic-quickstarts/tree/main/computer-use-demo
for a working reference).

Usage:
    export ANTHROPIC_API_KEY=sk-ant-...
    pip install anthropic
    python examples/computer_use_demo.py "Open Firefox and search for 'bitcoin'"
"""

from __future__ import annotations

import os
import sys
from typing import Any

import anthropic


MODEL = "claude-opus-4-7"
BETA_HEADER = "computer-use-2025-11-24"
DISPLAY_WIDTH_PX = 1024
DISPLAY_HEIGHT_PX = 768
DISPLAY_NUMBER = 1
MAX_ITERATIONS = 10

TOOLS: list[dict[str, Any]] = [
    {
        "type": "computer_20251124",
        "name": "computer",
        "display_width_px": DISPLAY_WIDTH_PX,
        "display_height_px": DISPLAY_HEIGHT_PX,
        "display_number": DISPLAY_NUMBER,
    },
    {"type": "text_editor_20250728", "name": "str_replace_based_edit_tool"},
    {"type": "bash_20250124", "name": "bash"},
]


def handle_computer_action(action: str, params: dict[str, Any]) -> str:
    """Stub action runner. Replace with a real sandbox driver."""
    if action == "screenshot":
        return "<screenshot-data-placeholder>"
    if action == "left_click":
        x, y = params["coordinate"]
        return f"clicked at ({x}, {y})"
    if action == "type":
        return f"typed: {params['text']}"
    if action == "key":
        return f"pressed key: {params['text']}"
    if action == "scroll":
        return (
            f"scrolled {params.get('scroll_direction')} "
            f"by {params.get('scroll_amount')} at {params.get('coordinate')}"
        )
    if action == "wait":
        return f"waited {params.get('duration', 1)}s"
    return f"unhandled action: {action}"


def handle_bash(params: dict[str, Any]) -> str:
    return f"ran bash: {params.get('command', '')!r}"


def handle_text_editor(params: dict[str, Any]) -> str:
    return f"text editor command: {params.get('command', '')}"


def process_tool_calls(response: anthropic.types.beta.BetaMessage) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for block in response.content:
        if block.type != "tool_use":
            continue
        if block.name == "computer":
            content = handle_computer_action(block.input["action"], block.input)
        elif block.name == "bash":
            content = handle_bash(block.input)
        else:
            content = handle_text_editor(block.input)
        results.append(
            {
                "type": "tool_result",
                "tool_use_id": block.id,
                "content": content,
            }
        )
    return results


def sampling_loop(
    client: anthropic.Anthropic,
    user_prompt: str,
    max_iterations: int = MAX_ITERATIONS,
) -> list[dict[str, Any]]:
    messages: list[dict[str, Any]] = [{"role": "user", "content": user_prompt}]

    for iteration in range(max_iterations):
        response = client.beta.messages.create(
            model=MODEL,
            max_tokens=4096,
            messages=messages,
            tools=TOOLS,
            betas=[BETA_HEADER],
        )

        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason != "tool_use":
            print(f"[iter {iteration}] stop_reason={response.stop_reason}, done.")
            return messages

        tool_results = process_tool_calls(response)
        if not tool_results:
            return messages

        print(f"[iter {iteration}] ran {len(tool_results)} tool call(s)")
        messages.append({"role": "user", "content": tool_results})

    print(f"hit max_iterations={max_iterations}")
    return messages


def main() -> None:
    if "ANTHROPIC_API_KEY" not in os.environ:
        sys.exit("ANTHROPIC_API_KEY is not set")

    prompt = (
        " ".join(sys.argv[1:])
        or "Take a screenshot, then describe what you see in one sentence."
    )

    client = anthropic.Anthropic()
    messages = sampling_loop(client, prompt)

    final = messages[-1]
    print("\n--- final message ---")
    print(f"role: {final['role']}")
    print(f"content: {final['content']}")


if __name__ == "__main__":
    main()
