# MCP servers

Two local Python MCP servers, both built on the official
[`mcp` SDK](https://github.com/modelcontextprotocol/python-sdk)'s `FastMCP`
decorator API. Wired up at project scope in [`../../.mcp.json`](../../.mcp.json) — Claude
Code prompts for approval the first time it opens this repo.

## `sha256-chain`

Exposes this repo's SHA-256 / blockchain primitives as MCP tools.

| Tool | Description |
| --- | --- |
| `hash_sha256(data_hex)` | SHA-256 of hex-decoded bytes. |
| `hash_double_sha256(data_hex)` | Bitcoin-style double SHA-256. |
| `compute_merkle_root(leaf_hashes)` | Merkle root over a list of leaf hex hashes. |
| `mine_header(version, prev_hash, merkle_root, timestamp, difficulty_target, max_nonce=2**24)` | Find a nonce that meets difficulty. |
| `validate_header(...)` | Check whether a header with its nonce meets difficulty. |
| `create_blockchain(difficulty=8)` | Spin up a fresh in-memory chain with a genesis block, returns a `chain_id`. |
| `add_block(chain_id, txs)` | Mine and append a block. `txs` is a list of `{sender, recipient, amount}`. |
| `validate_blockchain(chain_id)` | PoW + linkage + Merkle root checks across the whole chain. |
| `get_chain_info(chain_id)` | `{length, difficulty, latest_hash}`. |
| `get_block(chain_id, index)` | Full block details (header fields + transactions). |
| `list_transactions(chain_id, block_index)` | Transactions in a block, with `tx_id`. |
| `compare_blockchains(a, b)` | `'A' \| 'B' \| 'equal'` per longest-valid-chain. |
| `fork_chain(chain_id)` | Deep-copy a chain — useful to demonstrate the longest-valid-chain rule. |
| `tamper_block(chain_id, block_index, tx_index, new_recipient)` | Demo: mutate a tx after mining, returns `{valid_before, valid_after, tampered_tx_id}`. |

All argument and return shapes use pydantic models, so MCP clients see
rich JSON-schema tool definitions (descriptions, constraints, enums).
State is in-process: chains live in `_state.CHAINS` and disappear when
the server restarts.

## `computer-use`

The "ultimate" computer-use server: full desktop control, native macOS
integration, shell + filesystem, headed Playwright browser, vision (OCR
+ template matching), and tool-call recording. Built as a composition of
sub-modules — each registers tools on the same FastMCP instance, and
optional groups are skipped silently if their deps aren't installed.

Loaded groups (32 mandatory + ~15 optional tools):

### `_input` (always loaded — pyautogui + mss)

| Tool | Description |
| --- | --- |
| `screenshot()` | PNG of the primary display. |
| `left_click` / `right_click` / `double_click(x, y)` | Mouse buttons. |
| `mouse_move(x, y)` | Move cursor only. |
| `left_click_drag(x1, y1, x2, y2, duration)` | Drag with left button. |
| `type_text(text, interval)` | Simulated keystrokes. |
| `key(combo)` | Single key or `+`-separated combo. |
| `scroll(x, y, direction, amount)` | Vertical or horizontal scroll. |
| `cursor_position()` / `get_screen_size()` | Read-only display info. |

### `_macos` (always loaded — macOS-only at runtime)

| Tool | Description |
| --- | --- |
| `osascript(script, language='AppleScript', timeout)` | Run AppleScript or JXA. |
| `list_windows()` | Every visible window across every app. |
| `get_active_window()` | Frontmost app + window title. |
| `focus_window(app)` | Bring an app to the foreground. |
| `move_window(app, x, y, window_index=1)` / `resize_window(app, width, height, ...)` | Window geometry. |
| `open_app(name)` / `quit_app(name)` | App lifecycle. |
| `clipboard_read()` / `clipboard_write(text)` | macOS pasteboard. |
| `notification(title, message, sound='')` | Display a Notification Center alert. |

On non-macOS hosts each tool returns `{"error": "macOS only"}` instead of raising.

### `_shell` (always loaded — stdlib only)

| Tool | Description |
| --- | --- |
| `run_command(command, cwd='', timeout=60, shell=True)` | Run a shell command. |
| `read_file(path, max_bytes=1_000_000)` / `write_file(path, content, append, make_parents)` | File I/O. |
| `list_directory(path='.', include_hidden=False)` | `ls`-style listing with sizes. |
| `list_processes(filter_name='', limit=100)` / `kill_process(pid, signal_name='TERM')` | Process control. |
| `env()` | Server process environment variables. |

### `_recording` (always loaded — stdlib only)

| Tool | Description |
| --- | --- |
| `start_recording(path)` / `stop_recording()` / `recording_status()` | JSONL audit log of every tool call. |

### `_browser` (optional — `pip install -e .[browser]` + `playwright install chromium`)

| Tool | Description |
| --- | --- |
| `browser_open(url, headless)` / `browser_close(tab_id='')` | Launch / shut Chromium. |
| `browser_list_tabs()` / `browser_switch_tab(tab_id)` | Multi-tab. |
| `browser_navigate(url, tab_id, wait_until)` | Go to a URL. |
| `browser_click(selector, tab_id, timeout)` / `browser_type(selector, text, ...)` | Form filling. |
| `browser_screenshot(tab_id, full_page)` | PNG of the page. |
| `browser_eval(expression, tab_id)` | Run JS, return JSON. |
| `browser_content(tab_id, max_chars)` / `browser_text(selector, tab_id)` | HTML / visible text. |
| `browser_wait_for(selector, tab_id, timeout, state)` | Selector wait. |

### `_vision` (optional — `pip install -e .[vision]` + `tesseract` binary on PATH)

| Tool | Description |
| --- | --- |
| `read_text_in_region(x, y, width, height, lang)` | OCR via pytesseract. |
| `find_on_screen(template_path, threshold, max_results)` | OpenCV template matching with NMS. |
| `wait_until_text_appears(text, timeout, poll_interval, region, lang)` | Poll OCR until a substring shows. |
| `wait_until_pixel_color(x, y, rgb, tolerance, timeout, poll_interval)` | Wait for a pixel to hit a color. |

**Security:** this server controls the real machine, the browser, the
shell, and the filesystem. No sandbox, no per-app allowlist. The only
guardrail is `pyautogui.FAILSAFE` (mouse to top-left corner aborts the
current action). Run inside a dedicated user or VM.

## Running locally

`.mcp.json` launches each server via `uv run --with .[all]`, so users
with [uv](https://docs.astral.sh/uv/) installed get a hermetic env
automatically. To run without uv:

```bash
pip install -e .                  # sha256-chain only
pip install -e .[computer-use]    # base computer-use (input only)
pip install -e .[all]             # input + browser + vision
playwright install chromium       # for the browser group

python -m src.mcp_servers.sha256_chain_server
python -m src.mcp_servers.computer_use_server   # prints group status on stderr
```

To inspect the servers manually:

```bash
uv run --with mcp[cli] mcp dev src/mcp_servers/sha256_chain_server.py
```

Then open the MCP Inspector URL it prints.
