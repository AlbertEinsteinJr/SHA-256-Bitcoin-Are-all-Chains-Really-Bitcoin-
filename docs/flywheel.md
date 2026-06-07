# The Flywheel — Bootstrap §5 (operator-OS scope)

The Operator OS spec's §5 describes a **Breakdown/Repair Graph**: a shared dataset
where three products each emit proprietary data that improves the others. This is
trucking-business domain data with **no analog in a SHA-256/blockchain repository**,
so it is documented here as a pattern rather than fabricated as unused tables. Flag
the maintainer if you'd rather stub the schema anyway.

## The pattern (for the operator OS)
Each product emits proprietary data into one shared graph:

- **Breakdown directory** (programmatic-SEO pages) — top-of-funnel demand sensor; captures
  *where/what* breakdowns are searched for. Feeds real outcomes back to rank/expand pages
  (a programmatic-SEO version of an eval loop).
- **AI dispatch marketplace** — the highest-value proprietary data: actual dispatches,
  response times, parts used, repair durations, pricing, ratings, geographic demand. The
  fleet-learning equivalent no scraper can get.
- **DOT pre-trip inspection SaaS** — predictive data: defect frequencies by make/model/mileage;
  which inspection failures precede which roadside breakdowns. The leading indicator that makes
  dispatch smarter and the directory more authoritative.

**The loop:** inspection data predicts breakdowns → directory captures the search demand →
dispatch fulfills and records the true outcome → outcomes retrain the prediction and re-rank the
directory → better predictions/rankings attract more fleets and drivers → more proprietary data.
Every turn widens a gap a larger incumbent (who lacks the integrated loop) cannot close by
spending.

## Why it's a moat (and why data alone isn't)
Incremental data has diminishing returns. The durable, compounding asset is **inference quality
built on proprietary data over time, plus the trust relationship that generates more zero-party
data**. Layer the moats: proprietary data + switching costs (embedded workflows, historical
operational data fleets won't want to lose) + network economies (more mechanics → faster
response → more drivers).

## This repo's real flywheel
In PROMETHEUS, the analog of the Breakdown/Repair Graph is the **eval suite + evolutionary
archive + skill library**:
- Every improvement run enriches the archive (lineage of what worked) and the skill library.
- The eval suite is the shared scoring spine that gates every promotion.
- Captured adversarial traces become permanent regression cases — the corpus compounds.

This is the same flywheel shape — usage improves the shared spine, which gates and accelerates
the next improvement — applied to the engine's own capability rather than to a trucking
marketplace.
