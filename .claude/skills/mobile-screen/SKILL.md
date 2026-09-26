---
name: mobile-screen
description: How to build screens and UI in apps/mobile (Expo Router, React Native) for the draft game (spin club+decade, pick player, build XI, see simulation result). Use when creating or changing screens, components, navigation, or API calls in the mobile app.
---

# Mobile screen (apps/mobile)

First read `apps/mobile/AGENTS.md` – Expo changes every SDK; use versioned docs, not memory. The `vercel-react-native-skills` skill has performance patterns.

## Layout

- Routes: `apps/mobile/src/app/**` (every file is a screen, `_layout.tsx` = navigator).
- Components: `src/components/`, hooks: `src/hooks/`, API client: `src/api/`.
- Domain types from `@champion/shared` – never redefine.

## Rules

- Add deps only with `npx expo install <pkg>` inside `apps/mobile`.
- All data via the `apps/web` HTTP API. Base URL from `EXPO_PUBLIC_API_URL`. No secrets in the app.
- Game state (current spin, re-spins left, drafted XI) lives in one place (hook/store), not scattered across screens.
- Lists of players: use a virtualized list.
- Verify: `pnpm --filter @champion/mobile typecheck` and `npx expo lint` in `apps/mobile`.
