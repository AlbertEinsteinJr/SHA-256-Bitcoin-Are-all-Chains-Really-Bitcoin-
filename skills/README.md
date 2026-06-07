# skills/ — the Voyager skill library

A growing, retrieval-indexed library of **verified, executable** skills. The
backing store is stdlib sqlite (`.prometheus/skills.db`); `index.json` is a
human-readable registry of notable skills. Implemented in `prometheus/skills.py`.

## Admission rule (non-negotiable)
A skill is admitted **only after self-verification AND a passing eval**
(`add_skill` refuses unless `verified=True` AND `eval_score` is present). Voyager's
ablation: removing self-verification dropped performance ~73%. The library
compounds late — so it is built now.

## Lifecycle
- `add_skill(name, description, code, *, verified, eval_score)` — admit (refuses if unverified).
- `search_skills(query, k)` — top-k by similarity. Offline embedder = token overlap; pluggable
  to a real embedding API.
- `promote_skill(parent_id, ...)` — new version, `parent_id` set (lineage preserved).
- `archive_skill(id)` — soft-archive. **Never deletes** (CLAUDE.md §1).

## How skills are born here
When the engine promotes a winning variant, it admits the winning strategy as a verified skill
(`engine.py::_admit_skill`) — so each improvement run enriches the library that informs the next.

## Registry
See `index.json` for seeded/notable skills. The live source of truth is the sqlite store.
