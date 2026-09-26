---
paths:
  - "data/**"
  - "scripts/**"
  - "packages/**/pipeline/**"
---

# Data licensing

- worldfootball.net: personal, non-commercial use only without permission. Do not bulk-import.
- historical-lineups.com: license unclear. Store facts only, with source attribution.
- Wikidata: CC0, safe for anything.
- Never commit raw scraped files (`data/raw/` is gitignored).
- Every curated record keeps a `source` field.
