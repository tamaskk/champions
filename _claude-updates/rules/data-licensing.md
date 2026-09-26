---
paths:
  - "data/**"
  - "scripts/**"
  - "packages/**/pipeline/**"
---

# Data licensing

- worldfootball.net: personal, non-commercial use only without permission. Do not bulk-import.
- historical-lineups.com: license unclear. Store facts only, with source attribution.
- Transfermarkt: terms forbid automated access. Used for the private dev database only (decision 2026-09-25); licence or replace before launch. Keep `source` URL and `tmPlayerId` on every record.
- Wikidata: CC0, safe for anything.
- Never commit raw scraped files (`data/raw/` is gitignored).
- Every curated record keeps a `source` field.
