# Gamifikáció, XP, coin és vásárlás

Terv + ami már kész. A számok kiinduló értékek, élő adatokkal hangolandók.
Kód: XP/szintek/achievementek – `apps/mobile/src/game/progress.ts`; bolt, coin-csomagok, szabályok,
jogi szöveg – `packages/shared/src/store.ts`.

---

## 1. Alapelvek (nem alku tárgya)

1. **Két pénznem.** Az **XP** csak játékból jön és nem vehető meg. A **coin** játékból is jön, és
   pénzért is vehető.
2. **Pénzért nincs közvetlenül jobb csapat.** Coinért soha nem vehető játékos, játékoskártya,
   rating vagy chemistry. Valódi ember vagy klub soha nem lehet a termék.
   - **Kivétel (tulajdonosi döntés, 2026-09-27): draft boostok.** A Star boost (400 coin) és a
     Legend boost (1200 coin) egy draftra a klub-tárcsát gyakrabban viszi olyan klubra, ahol a
     kipörgetett évtizedben 80+ / 90+ ratingű játékos van (`DRAFT_BOOSTS` súlyai: kb. 2–4×
     gyakrabban, valós adaton pl. Serie A 90-es évek 90+ klub 14% → 51%). Játékos nem garantált,
     a valódi keretből kell választani, az esélyek a boltban látszanak. Daily-ben nem használható.
     **Jogi kockázat:** fizetős esélymódosítás véletlen húzásra = loot box-jellegű mechanika
     (Belgium tiltja, Hollandia korlátozza, PEGI „véletlen elemek” jelölés, magasabb korhatár) –
     bolti kiadás előtt ellenőrizni.
   - Típus szinten: a `StoreEffect` kozmetikai (`CosmeticEffect`), kényelmi
     (`ConvenienceEffect`) vagy draft boost (`DraftBoostEffect`) hatás lehet.
   - `validateStoreItem()` elutasít minden mást, és azt is, ha a név/id játékosra, ratingre vagy
     eredményre utal.
   - `CLAUDE.md` szabály, hogy később se kerüljön be.
3. **A Daily tiszta.** A Daily Challenge-ben boost nem használható (`BOOSTS_ALLOWED`): mindenki
   ugyanazokat a tárcsákat kapja. Boostolt casual csapat mehet Head-to-headbe és a ranglistára
   (tulajdonosi döntés, 2026-09-27).
4. **Nincs coinos fogadás.** A draft boostokon kívül minden megvásárolható dolog előre látható. Coint
   feltenni meccsre és nyerni rajta nem lehet.
5. **Nem hivatalos fan game.** A `DISCLAIMER` / `DISCLAIMER_SHORT` szöveg látszik a Home, Explore,
   Ranks oldalak alján, a megosztó kártyán, a nyilvános csapatoldalon (`/s/:id`) és a bolti
   leírásban (`docs/store-listing.md`). Logót, címert, mezt, játékosfotót nem használunk.

---

## 2. XP és szintek (kész)

| Esemény | XP |
|---|---|
| Befejezett draft | 100 |
| Meccs: győzelem / döntetlen / vereség | 150 / 60 / 25 |
| Liga-szezon | 5 / pont |
| Bajnoki cím / veretlen / tökéletes szezon | +500 / +400 / +1 200 |
| Champions League: győztes / döntő-elődöntő / kiesés / csoportkör | 800 / 300 / 150 / 50 |
| Legenda: győzelem / vereség | 400 / 50 |
| Daily Challenge: siker / próbálkozás | 300 / 60 |
| Achievement | 250 |

- **Szint:** a következő szinthez `250 + szint × 250` XP kell (500, 750, 1 000, …).
- **Szintjutalmak (kész):** mezszínek (8 db, 1–15. szint) és címerek (6 db, 1–14. szint).
- **Achievementek (kész, 19 db):** pl. Kick-off, Off the mark, Champions, Invincibles,
  First 38-0, Big-ear cup, Perfect harmony, Dynasty, Swinging Sixties, Sacchi slayer,
  Legend hunter, Every day, World class.

### Tervezett bővítés

- **Coin minden szintlépésnél:** `50 × szint`. Minden 5. szint: exkluzív kozmetika vagy egy
  Legends szint korábbi feloldása.
- **Első napi győzelem ×2 XP.** Visszahoz naponta, de nem tart órákig bent.
- **Daily streak szorzó:** 3 nap ×1.2, 7 nap ×1.5 (a streak számláló már megvan:
  `dailyStreak`).
- **Szezon XP:** havi nullázás, erre épül a Season Pass. Az örök XP (szint) marad.
- **Prestige:** max szint után újraindítható, jutalma exkluzív kártyakeret.
- **Head-to-head rangok:** Bronz → Ezüst → Arany → Legenda, havi reset, rang szerinti jutalom.

---

## 3. Coin szerzése (faucetek)

Cél: egy aktív ingyenes játékos kb. **100–150 coint gyűjt naponta**.

| Forrás | Coin |
|---|---|
| Napi belépés (7 napos ciklus, 7. nap bónusz) | 10 → 100 |
| Daily Challenge (Silver / Gold / Legend) | 30 / 50 / 100 |
| Legenda begyűjtése (Immortals) | 50 (150) |
| Head-to-head győzelem | 20 |
| Szintlépés | 50 × szint |
| Achievement | 25–500 |
| Rewarded videó (max 5 / nap) | 20 |
| Megosztás (naponta 1×) | 15 |
| **Meghívás** – a barát telepít a linkedről | 300 mindkettőnek |

A meghívás a legfontosabb: a megosztás virális hurkát jutalmazza.

---

## 4. Mire költhető (bolt – `STORE_ITEMS`)

### Kényelem – csak a sima játékban

| Tétel | Coin |
|---|---|
| Extra re-spin | 30 |
| Reel lock: egy tárcsa marad, a többi újrapörög | 40 |
| Scout: két véletlen klub közül választhatsz | 60 |
| Második esély: ugyanaz a csapat még egy tornát játszhat | 100 |
| Daily gyakorló próbálkozás (nem kerül a ranglistára) | 150 |
| Legends Immortals szint korábbi feloldása | 500 |

⚠️ **Előfeltétel:** a sima játékban most korlátlan és ingyenes a re-spin. Coinért csak akkor van
értelme árulni, ha van ingyenes keret, például **draftonként 3 re-spin**. Ez a draft szabályainak
módosítása, külön kell eldönteni.

A kényelem sosem ad jobb játékost: a re-spin és a scout is véletlenből húz.

### Kozmetika

| Tétel | Coin |
|---|---|
| Keret a megosztó kártyára (retró / arany / neon) | 300 / 500 / 800 |
| Mez- és címercsomagok | 200–600 |
| Pálya-skin (pl. 70s) | 700 |
| Tárcsa-skin („Casino”) | 1 200 |
| Gólöröm-animáció | 400 |
| Stadionhang-csomag („Ultras”) | 500 |
| Username csere | 200 |

A megosztó kártya kerete különösen értékes: amit megvesznek, azt ki is posztolják.

---

## 5. Vásárlás valódi pénzért

### Coin-csomagok (`COIN_PACKS`)

Kiindulás: **1 € ≈ 100 coin**, a nagyobb csomagokban bónusz. A forint ár az App Store / Google
Play ársávjából jön, ezért ezek csak közelítések.

| Csomag | Ár | Coin | Bónusz |
|---|---|---|---|
| Marék | 0,99 € (~399 Ft) | 100 | – |
| Zsák | 4,99 € (~1 990 Ft) | 550 | +10% |
| Láda ⭐ legnépszerűbb | 9,99 € (~3 990 Ft) | 1 200 | +20% |
| Kincstár | 19,99 € (~7 990 Ft) | 2 600 | +30% |
| Klubtulaj | 49,99 € (~19 990 Ft) | 7 000 | +40% |

- **Starter pack:** 1,99 € → 500 coin + exkluzív kártyakeret. Egyszer vehető meg, az első
  napokban ajánlva. Tipikusan ez konvertál a legjobban.

### Nem coinos bevételek

- **Season Pass (havi):** 3,99–4,99 €. Ingyenes és prémium sáv, szezon XP-vel lehet haladni. A
  prémium sáv végigjátszva kb. 1 000 coint + kozmetikát ad vissza.
- **Spinvincible Club előfizetés:** 2,99 €/hó. Napi 50 coin, reklámmentes, napi +1 Daily gyakorló
  próba, havi exkluzív keret.
- **Reklám:** csak rewarded videó, önkéntes. Kényszerített reklám nincs. Ha mégis lenne,
  reklámmentesség egyszeri 3,99 €-ért.

### Durva bevételbecslés

Feltevés: 10 000 havi aktív játékos (MAU), ebből 2 500 napi aktív (DAU).

- **Vásárlás:** 2–4% fizet, átlagosan havi 6–8 € → **kb. 1 200–3 200 €/hó**.
- **Rewarded reklám:** napi 2 megnézés fejenként, magyar/EU közönségnél 5–10 $ ezer
  megtekintésenként → **kb. 750–1 500 $/hó**.
- **Levonások:** a store 15%-ot visz (Small Business Program, évi 1M $ alatt), plusz ÁFA.

A bevétel szinte teljesen a játékosszámon múlik: előbb növekedés (megosztás, meghívás, Daily),
utána a monetizáció.

---

## 6. Technikai feltételek – fizetés előtt kötelező

1. **Szerver oldali pénztárca.** Az XP most a telefonon van (csalható). A coin csak szerveren
   lehet: `wallets` collection egyenleggel, `coinLedger` minden mozgással (forrás, összeg,
   időpont, idempotencia-kulcs), és minden költés szerver oldali ellenőrzéssel.
2. **Fiók.** Most a userId csak a telefonon van; ha elvész a telefon, elvesznek a megvett coinok.
   Fizetés előtt kell Sign in with Apple / Google.
3. **IAP:** RevenueCat (`react-native-purchases`, Expo dev builddel), a nyugták ellenőrzése
   szerveren, webhookkal jóváírva.
4. **EU fogyasztóvédelem:**
   - A coinos ár mellett a valódi pénzbeli érték is látsszon (`eurPerCoin`).
   - A csomagok ne úgy legyenek méretezve, hogy mindig maradjon felhasználatlan coin.
   - Kiskorúakra fokozott figyelem.

## 7. Jogi kockázat

- **Nevek.** Játékos- és klubnevek szövegként, tényként: alacsony kockázat. Nevek mint megvehető
  termék: magas kockázat. Ezért tiltja az 1. alapelv.
- **Adatforrás.** A Transfermarktról átvett adat csak a privát fejlesztői adatbázisba való.
  Fizetős appban licencelt vagy saját adatforrás kell.
- **Licenc.** Az aktív játékosok nevét tipikusan a FIFPRO-n keresztül lehet licencelni.
- **Első fizetős verzió előtt:** egy óra szellemi tulajdonra szakosodott ügyvéddel.

---

## 8. Sorrend

1. ✅ Szabályok és típusok (`store.ts`, `CLAUDE.md`), jogi szöveg az appban, a nyilvános oldalon
   és a bolti leírásban.
2. ✅ XP-bővítés + ingyenes coin + kozmetikai bolt.
   - Szerver oldali pénztárca: `wallets` + `coinLedger`, tranzakcióban, idempotencia-kulccsal
     (`apps/web/src/server/wallet-data.ts`, `/api/wallet/*`). A kliens sosem mond összeget.
   - Faucetek: napi belépés (7 napos ciklus), Daily (a tier a szerverről), legenda, H2H győzelem
     (a szerver ellenőrzi a jegyet), szintlépés, achievement, megosztás; napi korlátokkal.
   - XP: a nap első győzelme ×2, Daily streak ×1.2 / ×1.5, havi Season XP, prestige (50. szint).
   - Bolt (`apps/mobile/src/components/shop.tsx`): kártyakeretek, mezek, címerek, 70s pálya,
     Casino tárcsa, username csere. A még nem működő tételek „Soon”, nem vehetők meg.
   - H2H rangok havi (szerver által ellenőrzött) győzelmek alapján: Silver 100, Gold 250,
     Legend 500 coin + keret, havonta egyszer.
   - Minden 5. szint exkluzív kozmetikát ad (keret / mez / címer, visszamenőleg is).
   - Starter pack ajánlat a Home-on az első 3 napban (`STARTER_OFFER_DAYS`).
3. ✅ Re-spin keret: **draftonként 3 ingyenes** (`FREE_RESPINS_PER_DRAFT`), utána vett re-spin.
   Kész kényelmi tételek: extra re-spin, Scout, Second chance, Daily gyakorló próba.
   Kivéve a katalógusból: Reel lock (a mi re-spin szabályainknál nincs értelme: a liga újrapörgetése
   mindig a klubot is viszi) és Immortals korai feloldás (a legendák nincsenek szinthez zárva).
   Kozmetika kész: gólöröm („Fireworks”). „Soon”: stadionhang-csomag (hangfájlok kellenek).
4. ✅ Meghívás (kód, 300–300 coin, csak az első 7 napban). ✅ Reklám: Google AdMob
   (`apps/mobile/src/game/ads.ts`, részletek: `docs/ads.md`).
   - Rewarded (Shop → Watch & earn): a coint a szerver adja az AdMob aláírt SSV-hívására
     (`/api/ads/ticket` + `/api/ads/ssv`); `ADS_SIMULATED` élesben nincs beállítva.
   - **Interstitial minden befejezett torna után** – a tulajdonos döntése, 2026-09-30 (felülírja a
     korábbi „csak rewarded, nincs kényszerreklám” elvet). Kivétel: Daily, Club-tagok („no ads”
     ígéret), draft és meccs közben soha; két reklám között legalább 30 mp. Élő ad unit ID-k:
     `INTERSTITIAL_UNITS` (amíg üres, élesben nincs interstitial).
5. ⚠️ Részben: RevenueCat webhook kész (`/api/iap/revenuecat`, `REVENUECAT_WEBHOOK_AUTH`),
   coin-csomagok, starter pack, Season Pass és Spinvincible Club jóváírása. Hiányzik: a
   `react-native-purchases` SDK (Expo dev build kell), a termékek felvétele az App Store /
   Play Console-ban és a RevenueCatben, valamint a Sign in with Apple / Google. Addig a vásárlás
   fejlesztői módban szimulált (`/api/wallet/simulate-purchase`, élesben 404), a fiók pedig
   mentési kóddal vihető át másik telefonra (Profil → Account backup).
6. ✅ Season Pass (30 fokozat, havi, ingyenes + prémium sáv) és Spinvincible Club (napi 50 coin +
   napi 1 Daily gyakorló próba + Club keret) a szerveren; a vásárlásuk az 5. ponton múlik.
   Reklámmentesség: nincs kényszerített reklám, így külön reklámmentes vásárlás sem kell.

### Csomagméretek (EU: ne maradjon kényszerből elkölthetetlen coin)

- A legkisebb csomag (100) kisebb a legtöbb tétel áránál, így a maradék bármikor kiegészíthető, és
  a tételek ára 30–1 200 coin között szórt, 10-zel osztható – a maradék jellemzően elkölthető.
- Minden coin-ár mellett látszik a valódi érték (`eurPerCoin`), a boltban és a pénztárcában is.
- Nyitott: kiskorúak (korellenőrzés, költési limit) – a valódi fizetés bekapcsolása előtt dönteni.
