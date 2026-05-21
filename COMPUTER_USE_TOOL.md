# Computer Use Tool — Reference Notes

Source: <https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool>

The computer use tool lets Claude see and control a desktop environment via
screenshots, mouse, and keyboard. It's a beta feature — you must send the
appropriate beta header on every request.

## Tool versions and beta headers

| Tool `type`          | Beta header                | Models                                                                                   |
| -------------------- | -------------------------- | ---------------------------------------------------------------------------------------- |
| `computer_20251124`  | `computer-use-2025-11-24`  | Claude Opus 4.7, Opus 4.6, Sonnet 4.6, Opus 4.5                                          |
| `computer_20250124`  | `computer-use-2025-01-24`  | Claude Sonnet 4.5, Haiku 4.5, Opus 4.1 (Sonnet 4 and Opus 4 are deprecated)              |

`computer_20251124` adds the `zoom` action (opt-in via `enable_zoom: true`).

## Tool parameters

| Parameter           | Required | Description                                                            |
| ------------------- | -------- | ---------------------------------------------------------------------- |
| `type`              | yes      | Tool version string (see table above)                                  |
| `name`              | yes      | Must be `"computer"`                                                   |
| `display_width_px`  | yes      | Virtual display width in pixels                                        |
| `display_height_px` | yes      | Virtual display height in pixels                                       |
| `display_number`    | no       | X11 display number (Linux only)                                        |
| `enable_zoom`       | no       | `computer_20251124` only — set `true` to allow the `zoom` action       |

## Actions

Basic (all versions):

- `screenshot` — capture the current display
- `left_click` — click at `coordinate: [x, y]`
- `type` — type the string in `text`
- `key` — press a key or combo (e.g. `"ctrl+s"`)
- `mouse_move` — move cursor to `coordinate`

Enhanced (`computer_20250124` and later):

- `scroll` — `scroll_direction` (up/down/left/right) + `scroll_amount`
- `left_click_drag` — start/end coordinates
- `right_click`, `middle_click`, `double_click`, `triple_click`
- `left_mouse_down`, `left_mouse_up` — fine-grained click control
- `hold_key` — hold a key for `duration` seconds
- `wait` — pause between actions

`computer_20251124` adds:

- `zoom` — `region: [x1, y1, x2, y2]` for full-resolution inspection

Modifier keys (`shift`, `ctrl`, `alt`, `super`) are passed as `text` on `left_click`
or `scroll`. This is distinct from `hold_key`, which holds a key for a duration
without performing another action.

## Minimal request

```python
import anthropic

client = anthropic.Anthropic()

response = client.beta.messages.create(
    model="claude-opus-4-7",
    max_tokens=1024,
    tools=[
        {
            "type": "computer_20251124",
            "name": "computer",
            "display_width_px": 1024,
            "display_height_px": 768,
            "display_number": 1,
        },
        {"type": "text_editor_20250728", "name": "str_replace_based_edit_tool"},
        {"type": "bash_20250124", "name": "bash"},
    ],
    messages=[{"role": "user", "content": "Save a picture of a cat to my desktop."}],
    betas=["computer-use-2025-11-24"],
)
```

## Agent loop

The tool only describes *what* Claude wants to do; your application has to do
it. The pattern is:

1. Send the user prompt with the `computer` tool defined.
2. If `stop_reason == "tool_use"`, run the requested action(s) in your sandbox.
3. Return a `tool_result` block for each `tool_use` block, keyed by `tool_use_id`.
4. Repeat until Claude stops requesting tools or you hit an iteration cap.

A runnable stub is in [`examples/computer_use_demo.py`](examples/computer_use_demo.py).
The official reference implementation (Docker container, Xvfb, real action
handlers) lives at
<https://github.com/anthropics/anthropic-quickstarts/tree/main/computer-use-demo>.

## Related: computer-use-mcp (community MCP server)

[`domdomegg/computer-use-mcp`](https://github.com/domdomegg/computer-use-mcp)
wraps screenshot + nut.js-driven mouse/keyboard as an MCP server, so Claude
Desktop, Claude Code, Cursor, and Cline can drive the host machine without you
writing an agent loop.

This repo's [`.mcp.json`](.mcp.json) registers it at project scope:

```json
{
  "mcpServers": {
    "computer-use": {
      "command": "npx",
      "args": ["-y", "computer-use-mcp"]
    }
  }
}
```

When you next open this repo in Claude Code, it will prompt for approval before
loading the server.

**This is fundamentally different from the API tool above.** The Anthropic
computer use tool expects you to provide a sandboxed environment; the MCP
server drives *your real machine*. The author's own warning is to treat it
"like giving a hyperactive toddler access" — use a sandboxed OS user, watch
what it does, and don't leave it unattended on a machine with sensitive data
or active sessions.

## Prompting tips from the docs

- Keep tasks small and explicit.
- Ask Claude to take a screenshot and verify each step before moving on.
- Prefer keyboard shortcuts for fiddly widgets (dropdowns, scrollbars).
- Put instruction text *before* the screenshot in a user turn — improves click accuracy.
- Provide login credentials inside XML tags (e.g. `<robot_credentials>`) if needed,
  and review the prompt-injection guidance first.

## Extended thinking effort settings

- Opus 4.7: `high` by default, `low` for cost-sensitive loops.
- Sonnet 4.6 / Opus 4.6: `medium` is the best accuracy-to-cost ratio. Avoid `max`.
  `low` can use fewer output tokens than disabling thinking entirely.

## Security

Computer use widens the blast radius compared to plain tool use. The docs
recommend:

- Run inside a dedicated VM or container with minimal privileges.
- Don't hand it real credentials or sensitive data if you can avoid it.
- Restrict outbound network access to an allowlist.
- Keep a human in the loop for irreversible actions (purchases, ToS, cookies).

Anthropic runs prompt-injection classifiers on screenshots and will steer the
model to ask for confirmation when they fire. You can opt out via support; don't
do that without a deliberate reason.
