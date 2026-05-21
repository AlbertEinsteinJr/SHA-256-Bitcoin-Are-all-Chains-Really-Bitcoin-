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
| `compare_blockchains(a, b)` | `'A' | 'B' | 'equal'` per longest-valid-chain. |

State is in-process: chains live in `_state.CHAINS` and disappear when the
server restarts.

## `computer-use`

Pure-Python equivalent of [`domdomegg/computer-use-mcp`](https://github.com/domdomegg/computer-use-mcp).
Uses `pyautogui` for input and `mss` for screenshots, so it runs anywhere
pyautogui does (macOS, Windows, X11).

| Tool | Description |
| --- | --- |
| `screenshot()` | PNG image of the primary display. |
| `left_click(x, y)`, `right_click`, `double_click` | Mouse buttons. |
| `mouse_move(x, y)` | Move cursor only. |
| `left_click_drag(x1, y1, x2, y2)` | Drag with left button held. |
| `type_text(text, interval=0)` | Simulated keystrokes. |
| `key(combo)` | Single key or `+`-separated combo (`ctrl+s`). |
| `scroll(x, y, direction, amount)` | Vertical or horizontal scroll. |
| `cursor_position()` / `get_screen_size()` | Read-only display info. |

**Security:** this server controls the real machine. `pyautogui.FAILSAFE` is
enabled — moving the mouse to the top-left corner aborts the current action.
Don't approve this server on a host with active sensitive sessions; prefer
a dedicated OS user or VM.

## Running locally

`.mcp.json` launches each server via `uv run --with .` (or
`--with .[computer-use]`), so users with [uv](https://docs.astral.sh/uv/)
installed get a hermetic env automatically. To run without uv:

```bash
pip install -e .                  # for sha256-chain only
pip install -e .[computer-use]    # adds pyautogui + mss + Pillow

python -m src.mcp_servers.sha256_chain_server
python -m src.mcp_servers.computer_use_server
```

To inspect the servers manually:

```bash
uv run --with mcp[cli] mcp dev src/mcp_servers/sha256_chain_server.py
```

Then open the MCP Inspector URL it prints.
