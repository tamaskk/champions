# UI-hiányok: ami látszik, de nem működik

Átnézés: 2026-09-26, az egész mobilapp (`apps/mobile/src`) és az admin (`apps/web/src/app/admin`).
Minden tétel a kódban ellenőrizve. A sorszámok az átnézés idején érvényesek.

Jelmagyarázat: 🔴 halott gomb (koppintásra semmi) · 🟠 kamu / beégetett adat valódinak álcázva ·
🟡 félrevezető szöveg vagy részleges működés · ⚪ szándékosan szimulált / „coming soon”.

---

## 1. Halott gombok (a felhasználó rákoppint, semmi nem történik)

| # | Hol | Elem | Mit várna a felhasználó | Mi történik | Javaslat |
|---|---|---|---|---|---|
| 1 ✅ | `design/ui.tsx` (`Avatar`), minden fejlécben | Zöld kör jobb fent | Profil / fiók megnyitása | **Kész:** a felhasználónév monogramja, koppintásra a Profil fül. A Profil oldalon kiemelt (aktuális oldal). Teljes képernyős folyamatokban (draft, összesítő, torna) nem jelenik meg, mert onnan nincs visszaút a fülsorra. | – |
| 2 ✅ | `components/notification-bell.tsx`, minden fejléc vissza-gomb nélkül | Csengő | Értesítések | **Kész:** piros számláló az olvasatlanokkal; koppintásra lista: achievementek, szintlépések, coinok (a telefonon mentve, max. 50), és kitűzve a még le nem játszott mai Daily Challenge (koppintásra Home). Megnyitáskor olvasottá válnak, „Clear all” törli. | – |
| 3 🔴 | `app/index.tsx:497`, draft képernyő jobb felső sarka | „tune” kerek gomb, 0.6 átlátszósággal | Beállítások / taktika | Semmi – `View`, tartósan „letiltottnak” látszik | Kivenni, vagy draft-beállítások (pl. hang, gyorsaság, re-spin info) |
| 4 🔴 | `app/index.tsx:489-494` | Formáció neve + „expand_more” nyíl az „ACTIVE TACTIC” alatt | Formáció-választó / részletek | Semmi – a formáció a pörgetés után nem változtatható | Kivenni a nyilat, vagy formáció-infó lap |
| 5 🔴 | `app/explore.tsx:112-114` | Kereső ikon (kerek gomb) | Játékos / klub / csapat keresése | Semmi – nincs keresés | Keresés a `/api/player` + klublista alapján, vagy kivenni |
| 6 🔴 | `app/explore.tsx:337-339` | „See All” zöld link a formációknál | Összes formáció listája | Semmi – sima szöveg | Formáció-lista (a `FORMATIONS` mind a ~90 elemével) |
| 7 🔴 | `app/explore.tsx:343-366` | 4 formációkártya jobbra mutató nyíllal | Formáció részletei | Semmi – `View`-k | Részletek lap (pálya-rajz, posztkódok) vagy nyíl nélkül |
| 8 🔴 | `components/squad-summary.tsx:111-113` | Trófea ikon doboz a jobb felső sarokban (a bezárás gomb mellett, ugyanolyan stílusban) | Valami trófea/eredmény nézet | Semmi | Kivenni, vagy a tornaválasztóra vinni |
| 9 🟡 | `app/explore.tsx:246-282` | Hall of Fame kártyák | A mentett csapat XI-ének megnyitása | Semmi (nem is annyira gombnak látszik) | Koppintásra csapat-részletek, mint a Ranks-on |

## 2. Kamu vagy beégetett adat, ami valódinak látszik

| # | Hol | Elem | Probléma | Javaslat |
|---|---|---|---|---|
| 10 🟠 | `app/explore.tsx:41-46`, `:286-327` | „Global 38-0 Vault” ranglista: `@ZizouMaster`, `@SanSiroKing`, `@CruyffVision` | Kitalált játékosok, „ONLINE SOON” jelzéssel – közben a **Ranks fülön már van valódi online ranglista**, így ez elavult és ellentmond neki | Lecserélni a valódi top csapatokra (`/api/squads`) vagy „Open Ranks” linkre |
| 11 🟠 | `app/explore.tsx:155-171` | „LINK TOPOLOGY / ACTIVE PITCH HARMONY”: Ronaldo 94 ST, Zidane 93 CAM, Pirlo 91 CM, „+4 PERFECT DUO” | Beégetett demó; az „ACTIVE” szó azt sugallja, hogy a saját pályád | „Example” feliratot kapjon, vagy a legutóbbi saját csapatból számolja |
| 12 🟠 | `app/explore.tsx:48-81` | Formációkártyák: „4-3-3 Attack”, „5★ Chem”, „Diff: Easy/Pro/Med” | Kitalált értékek; a kémia-szintek ugyanezen az oldalon csak 4★-ig mennek, és a nevek nem egyeznek a `FORMATIONS` azonosítóival | Valódi formációk, kitalált értékelés nélkül |
| 13 🟠 | `app/explore.tsx:103-110` | „V1.4 DATABASE” chip | Nincs mögötte verziózás | Kivenni, vagy a valódi adatbázis-méret (pl. „184k player seasons”) |
| 14 🟠 | `components/home-landing.tsx:73-78` | „SEASON 04 ACTIVE” zöld „élő” ponttal | Nincs szezon-rendszer mögötte (a Season Pass hónapja más) | A valódi Season Pass hónapra kötni (pl. „SEASON 2026-09”) vagy kivenni |
| 15 🟠 | `components/squad-summary.tsx:134` | „Ready for Cup” chip | Mindig látszik, a napi kihívásnál is, ahol nincs kupa | Csak ha tényleg kupa jön, vagy kivenni |
| 16 🟠 | `components/squad-summary.tsx:91-98` | „LOCKED” chip | Nincs zár/feloldás funkció | Kivenni vagy „SQUAD COMPLETE” |
| 17 🟠 | `game/autofill.ts:42-48`, `mocks/players.ts` | Autocomplete tartalék-játékosai | Ha 8 húzás sem sikerül vagy nincs net, **kitalált játékos** kerül a pályára („Paolo Zidane” jellegű nevekkel, „Demo club” klubbal), és a pályán semmi nem jelzi, hogy nem valódi | „DEMO” jelölés a korongon / a lapon, vagy újrapróbálás hiba helyett |

## 3. Nem implementált funkciók („coming soon”)

| # | Hol | Elem | Állapot |
|---|---|---|---|
| 18 ⚪ | `components/tournament-picker.tsx:111-141`, `packages/shared/src/tournaments.ts:5-16` | **World Cup**, **Random World Cup** | Szaggatott kártya „SOON” chippel; nincs mögötte játékmód |
| 19 ⚪ | `app/index.tsx:897-905` | „Coming soon” tartalék-képernyő | Jelenleg nem érhető el (a picker nem engedi), halott kód |
| 20 ⚪ | `components/legends-tournament.tsx:191-223` | Legendák „NO SQUAD YET” jelzéssel | Kilistázva, de nem játszható, amíg nincs importált keret |
| 21 ⚪ | `packages/shared/src/store.ts` | „Ultras stadium sounds” | „SOON”, nem vehető meg (hangfájlok kellenek) |

## 4. Félrevezető szöveg, apróbb hibák

| # | Hol | Probléma | Javaslat |
|---|---|---|---|
| 22 🟡 | `components/league-tournament.tsx:362` | „Your 38 Fixtures” beégetve – 18 csapatos ligában (pl. Bundesliga) 34 meccs van; az alatta lévő gomb már a valódi számot írja | A valódi meccsszámot kiírni |
| 23 🟡 | `app/index.tsx:584` | Pálya-címke „ARCADE 80S” – csak az első lerakott játékos évtizedéből, vegyes XI-nél is | „ARCADE MODE” vagy az évtizedek száma |
| 24 🟡 | `components/draft-spin.tsx:161-183`, `:462-466` | Hálózati hibánál is ezt írja: „No squad imported for this club and decade yet” | Külön üzenet offline / szerverhiba esetén |
| 25 🟡 | `app/explore.tsx:13`, `:116-127` | A „Leaderboard” szűrő-chip csak a kamu előnézetet (10.) mutatja, nem a valódi ranglistát | A 10. javításával együtt |
| 26 🟡 | `components/home-landing.tsx:22` | „90 verified tactical formations” – a listában vicc-formációk is vannak (5-5-0, 1-1-4-4) | „~90 formations” |
| 27 🟡 | `components/home-landing.tsx:79-84` | „ARCADE MODE” villám ikonnal – mód-jelvénynek látszik, de nincs másik mód, amire váltani lehetne | Rendben, ha csak felirat; esetleg halványabb stílus |
| 28 🟡 | `components/daily-card.tsx:89-93` | Szabály-chipek (Locked 4-3-3, ligák, CHEM 70+) szűrőnek látszanak | Csak információ – elfogadható |
| 29 🟡 | `components/tournament-picker.tsx:46-47` | `TEASERS`: „coming soon” szöveg a már játszható Champions League-hez | Nem jelenik meg, de törölhető |
| 30 🟡 | `components/shop.tsx:347`, `:259` | „⭐ most popular” és „CHANGE · 200” beégetve (az ár most egyezik) | Az árat a katalógusból olvasni |

## 5. Szimulált vagy kikapcsolt monetizáció (tudatos, lásd `monetization.md`)

| # | Hol | Elem | Állapot |
|---|---|---|---|
| 31 ⚪ | `components/shop.tsx:51-55`, `:304-420` | Coin-csomagok, Starter pack, Champion Club „JOIN”, „PREMIUM PASS” | Fejlesztői buildben szimulált vásárlás (pénz nem mozog); éles buildben tartósan letiltva. A **Pass fülön nincs magyarázat**, miért szürke a gomb (a Coins fülön van) |
| 32 ⚪ | `components/shop.tsx:472-531` | „Watch & earn” reklám | Fejlesztőben 5 mp-es kamu visszaszámlálás; élesben mindig letiltva |
| 33 ⚪ | `components/shop.tsx:371` | Champion Club „no ads” | Olyan reklámot ígér levenni, ami nincs |

## 6. Admin (web)

| # | Hol | Elem | Probléma | Javaslat |
|---|---|---|---|---|
| 34 🟡 | `apps/web/src/app/admin/daily/daily-editor.tsx:250-252` | „Generate with Claude CLI” | Élesben is látszik, de csak ezt adja: „Local Claude is only available in development.” (a klub oldalon ugyanez helyesen el van rejtve) | Elrejteni élesben |
| 35 🟡 | `daily-editor.tsx:253-259` | „Copy prompt” | Működik, de nincs „Copied” visszajelzés (a többi másoló gombnál van) | Visszajelzés |
| 36 🟡 | `admin/clubs/page.tsx:164-172`, `admin/clubs/[id]/page.tsx:136-144`, `admin/daily/page.tsx:60-68` | Törlés gombok | Egy kattintásra törölnek, megerősítés nélkül | Megerősítő kérdés |
| 37 ⚪ | `components/admin/sidebar.tsx:23` | „82” jelvény a logónál | Csak logó, nem statisztika – rendben |

## 7. Az Expo sablonból maradt, nem használt fájlok

`hint-row.tsx`, `web-badge.tsx`, `themed-text.tsx`, `themed-view.tsx`, `external-link.tsx`
(`apps/mobile/src/components/`) – nem látszanak az appban, törölhetők.

---

## Javasolt sorrend

1. **Gyors javítások (1–2 óra):** avatar → Profil (1), csengő, tune, formáció-nyíl, trófea-doboz kivétele
   vagy bekötése (2–4, 8), „Your 38 Fixtures” (22), „Ready for Cup” / „LOCKED” / „SEASON 04” (14–16).
2. **Explore rendbetétele:** a kamu ranglista helyett valódi top csapatok (10, 25), „See All” és a
   formációkártyák valódi adattal (6, 7, 12), kereső vagy kivétel (5), a demó kiemelése (11, 13).
3. **Demó játékosok jelölése** (17, 24).
4. **Admin csiszolás** (34–36).
5. **World Cup mód** (18) – nagyobb munka, a `features.md` szerint.
