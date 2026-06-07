# loop/ — generator drop-zone

`loop/candidates/` is the drop-zone for the **manual / external** generation path:
place candidate variant files here and the loop can pick them up instead of (or in
addition to) the built-in generators. This is the seam where a human or an external
Claude Code session contributes variants.

The default offline generator (`prometheus/genes.py`) and the live Claude generator
(`prometheus/generator.py::ClaudeGenerator`) do not need this directory — it exists
for the human-in-the-loop workflow described in `docs/self-improvement-loop.md`.

Run the loop:
```bash
python -m prometheus improve --target blockchain-core            # offline (default)
PROMETHEUS_ONLINE=1 python -m prometheus improve --target blockchain-core --online   # live Claude
```
