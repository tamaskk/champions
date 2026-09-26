# Engagement-hiányok: mi tartja vissza a visszatérést és a megosztást

Átnézés: 2026-09-26, az `engagement-research.md` kutatás alapján, a kódban ellenőrizve
(`apps/mobile/src`, `apps/web/src`, `packages/shared/src`). A sorszámok az átnézés idején érvényesek.

Jelmagyarázat (ráfordítás): 🟢 gyors (≤ 1 nap) · 🟡 közepes (2–5 nap) · 🔴 nagy (1+ hét) ·
✅ kész. A **Hatás** oszlop: ⬆⬆ nagy, ⬆ közepes hatás a visszatérésre / terjedésre.

---

## 0. Mérés (enélkül nem tudjuk, mi működik)

| # | Hol | Elem | Probléma | Javaslat | Hatás |
|---|---|---|---|---|---|
| 1 🟢 | `apps/mobile/package.json` | Analytics SDK | Nincs semmilyen mérés: nem tudjuk, hol lépnek ki a draftból, hányan jönnek vissza másnap (D1/D7) | PostHog vagy Amplitude, eseménytölcsér: `app_open → draft_start → draft_done → tournament_done → share / save` | ⬆⬆ |
| 2 🟢 | `game/share.ts`, `app/s/[id]/page.tsx` | Megosztás-forrás mérése | Nem tudjuk, melyik megosztás hoz új telepítést | `?ref=<userId>&src=image\|emoji\|link` a linkekben, a web oldalon naplózva | ⬆ |

## 1. A fő hurok: túl hosszú, túl kevés tét

| # | Hol | Elem | Probléma | Javaslat | Hatás |
|---|---|---|---|---|---|
| 3 ✅ | `components/draft-settings.tsx` | Fast spins | A tárcsák egymás után forognak (`slot-reel.tsx` 5000 ms, `draft-spin.tsx` `SPIN_DURATION` 2600 ms) – egy draft percekig tart | **Kész:** Fast spins beállítás, fele idő | – |
| 4 🟢 | `slot-reel.tsx:11`, `draft-spin.tsx:47` | Alapértelmezett pörgési idő | A Fast spins ki van kapcsolva alapból, az új játékos a lassút kapja | A gyors legyen az alap, a lassú opció („drámai”); koppintásra a tárcsa azonnal megálljon | ⬆ |
| 5 ✅ | `app/index.tsx:330`, `economy.ts:124` | Re-spin keret | Korlátlan re-spin = nincs döntés, nincs tét | **Kész:** draftonként 3 ingyenes (`FREE_RESPINS_PER_DRAFT`), utána vett | – |
| 6 ✅ | `app/index.tsx:68` | `BENCH_MIN = 3` | A kispad kötelező kitöltése még 3 pörgetés, amit a legtöbben átugranának | **Kész:** kispad opcionális (`BENCH_MIN = 0`), kész XI után „Auto-bench” egy koppintással kitölti, vagy „Spin a sub” | – |
| 7 ✅ | `app/index.tsx:113`, `:339` | Egy csapat = egy torna | A kész csapat egy torna után elveszik | **Kész:** Second chance (bolti tétel) | – |
| 8 🟡 | `app/index.tsx` (`finished`), `tournament-shell.tsx` | „Még egyet” hurok | Torna végén csak vissza lehet lépni; nincs „Új draft ugyanezzel a formációval” vagy „Ugyanez a csapat a másik módban” | EndBar-on 2 gomb: „Draft again” (egy koppintás) és „Play in another mode” | ⬆⬆ |
| 9 🟡 | `components/league-tournament.tsx` (SeasonCard), `cup-tournament.tsx` | Nincs „miért” | Az eredmény csak számok; a játékos nem tudja, mitől lett 31-4-3 | 1–2 soros magyarázat: „A védelmed 71-es – ez vitte el a pontokat”, legjobb/leggyengébb poszt, MOTM a szezonban | ⬆⬆ |
| 10 🟡 | `packages/shared/src/match.ts` (MATCH_MODEL), `progress.ts` | 38-0 gyakorlatilag elérhetetlen | A névadó cél (82-0 / 38-0) szinte soha nem jön össze → nincs „majdnem megvolt” élmény | Közbenső célok: „30+ win”, „veretlen”, „100 gól”; a szezon közben élő „38-0 még él!” jelzés, ami izgalmat ad | ⬆ |
| 11 🟢 | `components/draft-spin.tsx` (`showDummies`), `game/autofill.ts` | Demó játékosok | Hálózati hibánál kitalált játékos kerül a pályára, jelöletlenül – rontja a bizalmat | „DEMO” jelölés vagy újrapróbálás (lásd `ui-gaps.md` 17.) | ⬆ |

## 2. Visszatérés (retention)

| # | Hol | Elem | Probléma | Javaslat | Hatás |
|---|---|---|---|---|---|
| 12 🔴 | `apps/mobile/package.json`, `app.json` | Push értesítés | Nincs `expo-notifications`; a csengő (`game/notifications.ts`) csak appon belüli. Semmi nem hívja vissza a játékost | `expo-notifications` + szerver oldali küldés: napi Daily (19:00, helyi idő), „valaki megverte a csapatodat”, H2H meccs kész. Max 1 / nap, kikapcsolható | ⬆⬆ |
| 13 🟢 | `game/daily.ts:46` (`dailyStreak`) | Streak csak sikerre | Egy elrontott Daily nullázza a sorozatot → büntet, és a PEGI 2026 szerint a kihagyást büntető napi mechanika 12+ | A streak a **részvételt** számolja; + 1 „streak freeze” hetente ingyen | ⬆⬆ |
| 14 🟢 | `app/index.tsx:203` (`startDailyAttempt`) | Kilépés = elégett próba | A Daily draftból kilépve (hívás, app-váltás) elvész a napi próba | A próba csak az első meccs lejátszásakor égjen el; a draft állapota mentődjön | ⬆ |
| 15 🟢 | `components/daily-card.tsx` | Visszaszámláló | Nem látszik, mikor jön a következő kihívás | „Next challenge in 05:12:40” a kártyán, a lejátszott Daily után | ⬆ |
| 16 🟡 | `daily-card.tsx`, `daily-result.tsx`, `server/daily-data.ts` | Napi ranglista | Mindenki ugyanazt kapja, mégsem látszik, hogy a többiekhez képest hogy teljesítettem | Napi top 50 + „a játékosok 23%-a teljesítette”, percentilis a result oldalon és a megosztásban | ⬆⬆ |
| 17 🟡 | `components/home-landing.tsx` (STEPS) | Onboarding | Nincs első-indítás vezetés; a draft szabályai (kémia, posztok) nem derülnek ki | 3 lépéses interaktív első draft („pörgess → válassz → nézd a kémiát”), utána azonnal egy meccs | ⬆⬆ |
| 18 ✅ | `game/wallet.ts`, `economy.ts` | Szerver oldali pénztárca, H2H rangok, meghívókód | – | **Kész** (a coin a szerveren él, `H2H_RANKS`, `redeemInviteCode`) | – |
| 19 🟡 | `game/user.ts` | Fiók / helyreállítás | A userId csak a telefonon van: új telefon = elveszett szint, coin, streak | Sign in with Apple / Google, vagy legalább helyreállító kód | ⬆ |
| 20 🟡 | `progress.ts` | Napi / heti küldetések | Az XP-nek nincs rövid távú célja | 3 napi küldetés („Nyerj 2 H2H-t”, „Draftolj 80+ csapatot”), heti nagyobb jutalommal – coin, nem játékos | ⬆ |

## 3. Megosztás és terjedés

| # | Hol | Elem | Probléma | Javaslat | Hatás |
|---|---|---|---|---|---|
| 21 🔴 | `app.json` (`scheme: champion`), `app/s/[id]/page.tsx` | `champion://` zsákutca | App nélkül a link nem nyílik meg; a web oldal nem visz a store-ba. A megosztás így nem hoz új játékost | Universal Links / App Links (`associatedDomains`, `intentFilters`) + a web oldalon store-gombok; ideálisan **web-es draft demó** telepítés nélkül | ⬆⬆ |
| 22 🟡 | `game/challenge.ts` | Challenge csak memóriában | A `pending` kihívás app-újraindításkor elveszik; a kihívott rögtön egy teljes draftba kerül | A kihívás mentődjön (`storage.ts`); „Gyors válasz” opció: egy korábbi mentett XI-vel is el lehessen fogadni | ⬆ |
| 23 🟢 | `components/share-sheet.tsx:86-126` | Megosztó kártya főcím | A kártyán OVR / rating / CHEM van, de nincs egy nagy „hűha” szám vagy kihívó mondat | Egy kiemelt eredmény: „34-2-2 · 108 pont” vagy „Daily: top 4%”; a Daily-hez spoiler nélküli emoji-rács (Wordle-minta) | ⬆⬆ |
| 24 🟡 | `app/ranks.tsx`, `server/leaderboard-data.ts:124` | Ranglista overall szerint | `sort({ overall: -1 })` – a legszerencsésebb pörgetés nyer, nem a legjobb draft | Több lista: eredmény szerint (pont, gól), „underdog” (legjobb eredmény legalacsonyabb OVR-rel), heti reset | ⬆ |
| 25 🔴 | – | Mini-ligák barátokkal | Nincs zárt csoport, ahol a haverok egymás ellen mennek | Privát liga meghívókóddal: heti közös Daily-pontszám, csoport-ranglista | ⬆⬆ |
| 26 🟡 | `packages/shared/src/draft.ts`, ranglista | Ritkaság-pontszám | Egy „ritka” húzás (pl. 60-as évek Honvéd) nem ér többet | „Rarity score” a kártyán és a ranglistán – beszédtéma, megosztási ok | ⬆ |

## 4. Tartalom és változatosság

| # | Hol | Elem | Probléma | Javaslat | Hatás |
|---|---|---|---|---|---|
| 27 🟢 | `DraftRules` (`draft-spin.tsx`), `daily.ts` | Témás kihívások | A `DraftRules` (évtized, liga) már tud szűrni, de csak a Daily használja | Heti témás mód: „Csak Serie A”, „Csak 90-es évek”, „Max 80 OVR csapat” (SBC-jelleg) | ⬆ |
| 28 🟡 | `tournament-picker.tsx`, `legends.ts` | Gauntlet | Egy torna, egy meccs – nincs „meddig bírod” mód | Egymás utáni legendás ellenfelek egyre erősebben, vereségig; ranglista a körszámra | ⬆⬆ |
| 29 🟡 | admin `daily`, `daily.ts` | Valós időhöz kötött események | Nincs kapcsolódás a valódi futballnaptárhoz | Derbi-napok, „On this day” (pl. egy híres döntő évfordulója), BL-hét témás Daily | ⬆ |
| 30 🔴 | `tournaments.ts` (World Cup „coming soon”) | Nations XI / World Cup | Válogatott-draft nincs, pedig a legismertebb formátum | Nemzet szerinti draft + VB-torna (`ui-gaps.md` 18.) | ⬆ |
| 31 🔴 | admin, `daily.ts` (`validateDaily`) | UGC kihívás | A játékosok nem készíthetnek kihívást egymásnak | Kihívás-szerkesztő (szabályok + formáció), megosztható linkkel, a meglévő validátorral | ⬆ |
| 32 🟡 | – | „Football IQ” mód | Csak draft van; a tudás nem számít | Rövid kvíz a húzott játékosokról (melyik klub, melyik év) – bónusz XP, nem rating | ⬆ |
| 33 🟡 | `match-play.tsx` | Meccsélmény | Hang, minimap, statisztika, MOTM hiányzik – a meccs átugorható „loading” | Kulcspillanatok, MOTM, rövid statisztika; „Skip” mindig legyen ott | ⬆ |

## 5. Korlátok (ezek nem feladatok, hanem határok)

| # | Hol | Szabály | Miért |
|---|---|---|---|
| 34 ✅ | `store.ts`, `CLAUDE.md` | Coinért soha nem vehető játékos, rating, meccsbeli előny | Fair verseny + licenckockázat |
| 35 ✅ | `store.ts` (`BOOSTS_ALLOWED`) | Daily, H2H, ranglista: nincs boost | Összehasonlítható eredmények |
| 36 ⚪ | – | Nincs fizetős véletlen tárgy (loot box) | PEGI 2026: fizetős random = 16+ |
| 37 ⚪ | #13, #20 | Napi mechanika ne büntessen kihagyást | PEGI 2026: kihagyást büntető napi visszatérés = 12+ |
| 38 ⚪ | #12 | Push max napi 1, könnyen kikapcsolható | Store-szabályok, uninstall-kockázat |

---

## Javasolt sorrend

0. **Mérés (1 nap):** analytics tölcsér és megosztás-forrás (1, 2). Minden további lépés ezen mérődik.
1. **Gyors nyerések (1 hét):** gyors pörgetés alapból (4), részvétel-alapú streak + freeze (13), a
   Daily próba ne égjen el kilépéskor (14), visszaszámláló (15), kiemelt szám a megosztó kártyán (23),
   demó jelölés (11), témás kihívások a meglévő `DraftRules`-ra (27).
2. **A hurok bezárása (1–2 hét):** „Draft again” a torna végén (8), „miért” magyarázat (9),
   opcionális kispad (6), közbenső célok (10), onboarding (17).
3. **Terjedés (2–3 hét):** Universal Links + store-gombok a web oldalon (21), mentett kihívás és gyors
   válasz (22), napi ranglista + percentilis (16), több ranglista (24).
4. **Visszahívás (2 hét):** push értesítések (12), fiók / helyreállítás (19), napi küldetések (20).
5. **Tartalom (folyamatos):** Gauntlet (28), események (29), mini-ligák (25), ritkaság (26),
   meccsélmény (33), majd World Cup (30), UGC (31), IQ mód (32).
