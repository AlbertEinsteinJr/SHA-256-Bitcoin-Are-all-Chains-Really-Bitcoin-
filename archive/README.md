# archive/ — evolutionary lineage (keep variants, not just HEAD)

The Darwin Gödel Machine principle: **keep the lineage, not only the latest.** An
archive of diverse variants is the asset that lets the search escape local optima
(MAP-Elites: one elite per behavior niche). History is never overwritten.

## Two archives, one principle
- **Structured archive** — `.prometheus/archive.db` (sqlite). Every evaluated variant with its
  score, behavior descriptor, parent, island, and generation. Queried via `prometheus/archive.py`
  and `python -m prometheus lineage --target <name> [--format dot|json]`.
- **Human-readable snapshots** — when a variant is promoted into the live tree, the previous
  version is copied here as `<name>.score<NN>.<timestamp>.py` before being overwritten
  (CLAUDE.md §5). These `.py` snapshots are **runtime artifacts** (git-ignored); this README is
  the only committed file in the directory.

## Promotion rule (CLAUDE.md §3, §5)
A variant is promoted only if it **beats the current best** AND **keeps the suite green**
(regression) AND **passes the reward-hacking guard**. On promotion, the previous version is
archived with its score and the lineage is extended (never replaced).

## Inspect the lineage
```bash
python -m prometheus lineage --target blockchain-core --format dot  > lineage.dot
python -m prometheus dashboard         # niches occupied, best score, coverage trend
```
