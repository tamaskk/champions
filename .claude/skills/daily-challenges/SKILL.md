---
name: daily-challenges
description: Generate new Daily Challenges for Champion (themed rule sets, one per day) as validated JSON and schedule them via the admin. Use when asked to create, plan or fill the daily challenge calendar.
---

# Daily challenges

A daily challenge is a rule set everyone plays on the same day with the same reel draws (seeded
from the date). Types, the built-in pool (100) and the validator live in
`packages/shared/src/daily.ts`; legends (opponents) in `packages/shared/src/legends.ts`.
Days without a scheduled challenge take the pool in turn.

## Shape

```json
{
  "id": "lowercase-with-dashes",
  "date": "YYYY-MM-DD",
  "title": "max 24 chars",
  "description": "one sentence with the rules",
  "tier": "SILVER | GOLD | LEGEND",
  "xp": 400 | 700 | 1200,
  "rules": {
    "formation": "one of FORMATIONS (packages/shared/src/formations.ts)",
    "decades": [1960, 1970, 1980, 1990, 2000, 2010, 2020],
    "leagues": ["ENG", "ESP", "ITA", "GER", "FRA"],
    "targetChemistry": 40-100,
    "targetOverall": 65-90,
    "opponentLegend": "id from LEGENDS",
    "maxRespins": 0-3
  }
}
```

Every challenge needs at least one target (`targetChemistry`, `targetOverall` or `opponentLegend`).

## Steps

1. Find the first free day: `/admin/daily` shows the next 14 days (scheduled vs pool).
2. Write the batch to `data/daily/<first-date>.json` as `{"challenges": [...]}`. Mix ~40 % SILVER,
   ~40 % GOLD, ~20 % LEGEND; themed (eras, leagues, rivalries, famous tactics). Don't reuse ids of
   `DAILY_POOL`. Keep narrow rules realistic: no Bundesliga before 1963; chemistry 60–80 is already
   hard with one league + one decade; overall 85+ is elite.
3. Validate:
   ```bash
   npx tsx -e "import {validateDaily} from './packages/shared/src/index'; import f from './data/daily/<file>.json' with {type:'json'}; for (const c of f.challenges) { const p = validateDaily(c); if (p.length) console.log(c.id, p) }"
   ```
4. Import: `/admin/daily` → "JSON / import" → paste → Save (the server validates again and upserts
   by date). The same tab can generate a batch with the local Claude CLI ("Generate with Claude
   CLI") or copy the prompt (`buildDailyPrompt`) for Claude chat.
