---
description: Typecheck and lint the whole monorepo, fix what fails
---

Run `pnpm typecheck` and `pnpm lint` from the repo root. If anything fails, fix the root cause (not by disabling rules or adding `any`), then re-run until both pass. Report what you changed.
