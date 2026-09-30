# Reklám a Spinvincible-ben – hogyan, mivel, mennyiért

Állapot: 2026-09-30. Terv + a meglévő kód felmérése. A bevételi számok **becslések**, a források
alul. Kapcsolódó: `monetization.md` (coin-gazdaság, bolt, Club), `packages/shared/src/economy.ts`,
`apps/web/src/server/wallet-data.ts`.

---

## 0. TL;DR – javaslat erre a játékra

1. **Rewarded videó először, és (egyelőre) csak az.** Önkéntes „nézz meg egy videót → 20 coin”,
   napi max 5 (ez már benne van a gazdaságban: `AD_COINS = 20`, `ADS_PER_DAY = 5`). Ez a formátum
   hozza a legtöbbet ezer megjelenésenként, és nem rontja az élményt. A `monetization.md` meglévő
   döntése is ez: „csak rewarded videó, önkéntes, kényszerített reklám nincs”.
2. **A coint a szerver adja, nem az app.** Élesben a Google a saját szerveréről hívja meg a
   backendet (SSV – server-side verification), a backend ellenőrzi az aláírást, és a meglévő
   `wallet-data.ts` ledgeren keresztül, idempotensen (kulcs = a Google `transaction_id`-je) írja jóvá.
   Az `ADS_SIMULATED` élesben kikapcsolva marad.
3. **Google AdMob-bal indulj** (`react-native-google-mobile-ads`, Expo config plugin, EAS dev build).
   Ha a napi aktív játékos (DAU) tartósan néhány ezer fölé megy, jöhet mediáció: **AppLovin MAX**
   (a piacvezető) vagy AdMob-mediáció (AppLovin, Unity Ads, Meta bidding) – ez 20–40%-kal is
   emelheti az eCPM-et (becslés), de több SDK, több adatvédelmi nyilatkozat.
4. **Interstitial (teljes képernyős) csak később, csak ha kell, és szigorú korláttal** – pl. torna
   eredménye után, legfeljebb 1 / 3 perc és 3–4 / nap, soha a draft közben és soha a Daily-ben.
   Ez a meglévő „nincs kényszerített reklám” döntés megváltoztatása lenne → tulajdonosi döntés.
   **Bannert nem javaslok** (kevés pénz, rontja a dizájnt, rossz helyen véletlen kattintást okoz).
5. **A Spinvincible Club** már most „no ads”-t ígér. Ha csak rewarded van, ez az ígéret triviálisan
   igaz; ha jön interstitial, a Club tagoknak (és opcionálisan egy egyszeri „Remove ads” vásárlásnak)
   ki kell kapcsolnia.
6. **Élesítés előtt kötelező:** GDPR-hozzájárulás (Google UMP vagy más Google-tanúsított CMP) az
   EGT/UK/Svájc felhasználóknak, iOS-en ATT döntés, `app-ads.txt` a weboldalon, **frissített
   adatvédelmi tájékoztató** (a mostani kifejezetten azt írja, hogy nincs reklám-SDK), Play Data
   safety és App Store privacy label frissítés, szerencsejáték-reklámok letiltása.

---

## 1. Mi van már meg a repóban és mi hiányzik

### Megvan

| Hol | Mi |
|---|---|
| `packages/shared/src/economy.ts` | `AD_COINS = 20`, `ADS_PER_DAY = 5`, `ClaimSource` tartalmazza a `'rewarded-ad'`-et, a `WalletResponse`-ban `adsToday`. |
| `apps/web/src/server/wallet-data.ts` | `claim()` → `case "rewarded-ad"`: ha `adsEnabled()` (fejlesztői mód, vagy élesben `ADS_SIMULATED=1`), akkor a kliens által küldött kulccsal (`rewarded-ad:<key>`) jóváír 20 coint. Napi limit a `DAILY_CAPS`-ben. Ledger + wallet egy tranzakcióban, unique (userId, key) → idempotens. A kommentben már ott van: élesben SSV kell. |
| `apps/web/src/server/wallet-data.ts` | `export const adsEnabled = () => process.env.NODE_ENV !== "production" \|\| process.env.ADS_SIMULATED === "1";` |
| `apps/mobile/src/components/shop.tsx` | „Free” fül → „Watch & earn” szekció: szimulált 5 mp-es visszaszámláló, utána `claim('rewarded-ad', requestId())`. `EXPO_PUBLIC_ADS_LIVE=1` esetén a gomb „Coming soon” és letiltva. |
| `apps/mobile/src/components/shop.tsx` | Spinvincible Club leírás: „… coins every day, **no ads**, a monthly exclusive frame”. |
| `apps/mobile/eas.json` | Van `development` profil (`developmentClient: true`) – dev buildhez. |

### Hiányzik

- **Reklám SDK** – nincs a `apps/mobile/package.json`-ban (és `expo-dev-client` sincs még telepítve,
  pedig a `development` profil erre épít).
- **`app.json` plugin config** – AdMob app ID-k, iOS `NSUserTrackingUsageDescription`, SKAdNetwork lista.
- **SSV végpont** a `apps/web`-ben (pl. `/api/ads/ssv`), aláírás-ellenőrzéssel.
- **Hozzájárulás-kezelés** (UMP / CMP) és **ATT** kérés.
- **`app-ads.txt`** a weboldal gyökerében.
- **Jogi szövegek:** `apps/web/src/app/privacy/page.tsx` jelenleg ezt állítja:
  „we don't use advertising trackers or analytics tools” és „No advertising or third-party
  analytics SDKs, no tracking across apps or websites”, a feldolgozók listájában pedig nincs Google
  (AdMob). **Ez az első reklámos build előtt kötelezően módosítandó** (lásd 7. fejezet).
- **Fontos biztonsági pont:** élesben a mostani `claim('rewarded-ad', <kliens kulcs>)` út **nem
  fizethet** – a kliens bármikor küldhet tetszőleges kulcsot. Élesben csak az SSV-callback írhat jóvá.

---

## 2. Reklámformátumok – mi mire jó, és hová illene a játékban

| Formátum | Mi ez | eCPM (nagyságrend, becslés) | Előny | Hátrány | Hely a Spinvincible-ben |
|---|---|---|---|---|---|
| **Rewarded videó** | A játékos maga indítja, 15–30 mp, a végén jutalom | a legmagasabb (USA 15–20 $, Ny-Európa kb. 3–10 $, HU alacsonyabb) | Önkéntes, a játékosok kedvelik, a coin-gazdaságba beköthető, nem rontja a retenciót | Csak annyit hoz, amennyit a jutalom motivál | **Bolt → Free → Watch & earn** (megvan a UI). Később: torna után „dupla coin videóért”, „+1 re-spin videóért” casual draftban (Daily-ben NEM). |
| **Interstitial** | Teljes képernyős, természetes szünetben, 5 mp után bezárható | közepes (USA ~14 $, UK 8–10 $, EU többi része kevesebb) | Jó bevétel passzív játékosoktól is | Bosszantó, rontja a megtartást, szigorú Google-szabályok az elhelyezésre | Ha egyáltalán: **torna / H2H eredményképernyő után**, gyakoriságkorláttal. Soha: draft közben, pörgetés előtt/után, Daily-ben, app indításkor. |
| **Rewarded interstitial** | Interstitial, de előtte bezárható ajánlat + jutalom | rewarded és interstitial között | Kevésbé tolakodó | Előtte kötelező bevezető képernyő (opt-out) | Torna után: „Nézd meg és dupla XP / coin” – alternatíva a sima interstitial helyett. |
| **App open** | App indításakor / előtérbe hozáskor | közepes | Egyszerű | Nagyon rontja az első benyomást | **Nem javaslom.** |
| **Banner** | Kis sáv a képernyő alján/tetején | nagyon alacsony (Tier-1 kb. 0,5–1,5 $) | Mindig fut | Kevés pénz, rontja a Figma-dizájnt, a pill tab bar mellett véletlen kattintás = policy-kockázat | **Nem javaslom.** Legfeljebb Explore / Hall of Fame lista alján, soha a draft képernyőn. |
| **Native** | A tartalomba simuló reklámkártya | alacsony–közepes | Szép, ha jól van megcsinálva | Sok UI munka, jelölni kell „Ad”-ként | Később esetleg Explore listában. Nem prioritás. |

**Miért rewarded először?** A játékban már van coin-gazdaság és bolt – a rewarded videó ennek a
természetes „faucetje”. Az iparági tapasztalat szerint a rewarded videó a játékosok által
leginkább elfogadott formátum, és az In-App Purchase-t sem kannibalizálja érdemben (a nem fizető
többségből csinál bevételt).

---

## 3. Hálózatok és mediáció – mit használnak a legtöbben

**Mediáció** = egy SDK, ami több hirdetési hálózatot versenyeztet minden egyes megjelenésért
(bidding / aukció). Minél több hálózat licitál, annál magasabb az eCPM és a kitöltési arány (fill rate).

| Platform | Mi | Előny | Hátrány | React Native / Expo |
|---|---|---|---|---|
| **Google AdMob** | Hálózat + saját mediáció | Legegyszerűbb indulás, Google hirdetői kereslet, ingyenes UMP consent SDK, jó dokumentáció | Egyedül nem mindig a legmagasabb eCPM játékokra | `react-native-google-mobile-ads` (Invertase), **van Expo config plugin**, Expo Go-ban nem fut, dev build kell |
| **AppLovin MAX** | Független mediáció, piacvezető | A legtöbb játékfejlesztő ezt használja; erős játékos-hirdetői kereslet; 25+ hálózat; AdMob is beköthető alá | Több beállítás; a hivatalos RN pluginhoz Expo-ban config plugin / prebuild munka kell | `react-native-applovin-max` (hivatalos), Expo-ban nem „out of the box” |
| **Unity LevelPlay (ex-ironSource)** | Mediáció + Unity Ads | Erős top-grossing játékoknál, Unity-motoros játékokhoz ideális | Unity-központú, piacrészt veszít | Van RN plugin, de kevésbé elterjedt RN-ben |
| **Meta Audience Network** | Hálózat, **csak bidding** (waterfall már nincs) | Jó eCPM, ha van hozzájárulás / tracking | Önállóan nem használható, csak mediáció alatt | Mediációs adapterként |
| Unity Ads, Liftoff/Vungle, Mintegral, Pangle, InMobi | Hálózatok | Játékos videóhirdetések | Csak mediáció alatt érdemes | Adapterként |

**Mit használnak a legtöbben (2025–2026 adatok szerint):** a mediációs piac >90%-át az AppLovin
MAX, a Unity LevelPlay és az AdMob adja; a legtöbbet letöltött játékokban a MAX kb. 70%+, az AdMob
kb. 11%, a LevelPlay kb. 6% (Global Games Forum / Gamebiz). **Indie / kis csapatnál a tipikus út:
AdMob-bal indulni, és MAX-ra (vagy AdMob-mediációra) váltani/bővíteni, amikor van forgalom**, mert
kevés DAU mellett a mediáció extra munkája nem térül meg.

**Javaslat:** 1. fázis AdMob egyedül → 2. fázis (DAU > ~3–5 ezer): AdMob-mediáció AppLovin + Unity +
Meta bidding adapterekkel **vagy** átállás AppLovin MAX-ra, AdMob-bal alatta. A kettőt egyszerre
ne (két mediációs réteg egymás alatt csak zavart okoz).

---

## 4. Bevételbecslés (csak becslés!)

Képlet:

```
napi bevétel = DAU × megjelenés / DAU × eCPM / 1000
havi ≈ napi × 30
```

Feltevések: a közönség nagy része EU (HU + Nyugat-Európa keverék), a rewarded eCPM ezért
óvatosan 4–10 $ (USA-ban 15–20 $ lenne, Magyarországon inkább a sáv alja). Fill rate kb. 90%.

### Csak rewarded (a javasolt indulás)

| Forgatókönyv | DAU | Videó / DAU / nap | eCPM | Havi bevétel (kb.) |
|---|---|---|---|---|
| Kicsi | 500 | 1,0 | 4 $ | ~60 $ |
| Közepes (a `monetization.md` feltevése) | 2 500 | 1,5 | 7 $ | ~790 $ |
| Jó | 10 000 | 2,0 | 10 $ | ~6 000 $ |

(2 500 × 1,5 × 7 / 1000 = 26,25 $/nap ≈ 790 $/hó. A `monetization.md` 750–1 500 $/hó sávja ezzel összhangban van.)

### + interstitial torna után (ha valaha bekapcsolod)

| DAU | Interstitial / DAU / nap | eCPM | Havi plusz (kb.) |
|---|---|---|---|
| 2 500 | 1,5 | 4 $ | ~450 $ |

Megjegyzések:

- **A DAU a döntő tényező**, nem a hálózat. 500 DAU mellett a reklám zsebpénz; a növekedés
  (megosztás, meghívás, Daily) a nagyobb kar.
- A rewarded nézések száma azon múlik, mennyire hasznos a coin. Ha a boltban van mire költeni
  (re-spin, Scout, kozmetika), több a nézés.
- Az AdMob a nettó bevételt mutatja (a Google része már le van vonva); ebből még adó jön le.
- Első hónapokban az eCPM gyakran alacsonyabb (új app, kevés adat); a hozzájárulás nélküli
  (nem perszonalizált / „limited ads”) EU-forgalom is kevesebbet hoz.

---

## 5. Megvalósítási terv – lépésről lépésre, erre a repóra szabva

### 5.1 Fiókok és adminisztráció

1. **AdMob fiók** (admob.google.com) a tulajdonos Google-fiókjával. Egy személy/cég = egy AdMob
   fiók (többet nyitni tilos).
2. **Payments profile** (Google Payments): név, cím, **adóadatok** (nem USA-beli magánszemély /
   cég esetén az AdMob-ban kitöltendő US adóinformáció – jellemzően W-8BEN / W-8BEN-E), bankszámla.
   A kifizető a Google Ireland; a magyar adózást (egyéni vállalkozó / cég, ÁFA, fordított adózás)
   **könyvelővel egyeztesd**.
3. **Kifizetés:** havonta, ha az egyenleg eléri a küszöböt (**70 € / 100 $**), a hónap 21-e körül,
   banki átutalással. Előtte egy PIN-es levelet küldenek postán a cím igazolására (egy bizonyos
   egyenleg után), és egy kis teszt-utalással ellenőrzik a bankszámlát.
4. **App regisztráció az AdMob-ban:** iOS és Android külön app (bundle id: `com.spinvincible.app`).
   Érdemes a store-ban már publikált apphoz kötni (store linkkel), hogy az `app-ads.txt` ellenőrzés
   működjön. → Kapsz két **App ID**-t (`ca-app-pub-XXXX~YYYY`).
5. **Ad unitok:** platformonként egy **Rewarded** („Watch & earn”, jutalom: 20 coin –
   a szerver úgyis a saját táblájából dönt), később egy Interstitial / Rewarded interstitial.
6. **Blocking controls:** tiltsd a **szerencsejáték / fogadás** kategóriát (focis közönségnél ez
   gyakori hirdető, és 16 éves korhatár mellett erősen kerülendő), továbbá dating, politika stb.
   `maxAdContentRating`: `T` (Teen) vagy szigorúbb.

### 5.2 SDK telepítés (mobile)

A `CLAUDE.md` szabály szerint mobil függőség csak `expo install`-lal:

```bash
cd apps/mobile
npx expo install react-native-google-mobile-ads expo-dev-client
npx expo install expo-tracking-transparency   # ha iOS-en ATT-t kérsz (lásd 5.4)
```

`apps/mobile/app.json` → `plugins` kiegészítése (a valós ID-kkal):

```json
[
  "react-native-google-mobile-ads",
  {
    "androidAppId": "ca-app-pub-XXXXXXXXXXXXXXXX~AAAAAAAAAA",
    "iosAppId": "ca-app-pub-XXXXXXXXXXXXXXXX~BBBBBBBBBB",
    "userTrackingUsageDescription": "This lets us show ads that are more relevant to you. Ads help keep Spinvincible free.",
    "skAdNetworkItems": ["cstr6suwn9.skadnetwork", "…a Google által ajánlott teljes lista…"]
  }
]
```

- Az App ID nem titok (a bundle-be kerül), de az ad unit ID-kat is érdemes `EXPO_PUBLIC_*` env-ből
  vagy egy config fájlból venni, fejlesztésben pedig a `TestIds.REWARDED` teszt ID-t használni.
- **Expo Go-ban nem fut** (natív kód): kell egy dev build:
  `eas build --profile development --platform ios|android`, majd `npx expo start --dev-client`.
  Minden plugin-/natív változás után új build kell.
- Az `app.json` `android.blockedPermissions` listájába **ne** kerüljön be a
  `com.google.android.gms.permission.AD_ID` (az SDK hozzáadja; e nélkül Android 13+ alatt nincs
  hirdetési azonosító → alacsonyabb eCPM).
- A Next.js és Expo verziók újabbak a tanult tudásnál: az API-kat a telepített verzió doksijából
  ellenőrizd (`CLAUDE.md`).

### 5.3 Hozzájárulás (GDPR) – első indításkor, reklám előtt

- EGT + UK (és 2024 óta Svájc) felhasználóknak **Google-tanúsított, IAB TCF v2.2-re épülő CMP**
  kell; ennek hiányában csak „Limited Ads” megy (sokkal kevesebb bevétel).
- A legegyszerűbb: **Google UMP** – a `react-native-google-mobile-ads` `AdsConsent` API-ja ezt
  csomagolja. Az üzenetet az AdMob felületén (Privacy & messaging) állítod össze.
- Folyamat:
  1. App induláskor: `AdsConsent.requestInfoUpdate()` → ha kell, `loadAndShowConsentFormIfRequired()`.
  2. Csak utána `mobileAds().initialize()` és az első reklám betöltése.
  3. A Profil/Settings képernyőre kell egy „Privacy options / Hirdetési beállítások” gomb
     (`showPrivacyOptionsForm()`), ha a UMP szerint kötelező – a felhasználónak vissza kell tudnia
     vonni a hozzájárulást.
- A hozzájárulás nélküli felhasználó is nézhet rewarded videót (nem perszonalizált reklám) – a
  coin ugyanúgy jár.

### 5.4 iOS: App Tracking Transparency (ATT) + SKAdNetwork

- Az IDFA (perszonalizált reklám iOS-en) csak ATT-engedéllyel használható. Két út:
  - **A) ATT-t kérsz** (`expo-tracking-transparency`, vagy az AdMob UMP „IDFA explainer”
    üzenete): a GDPR-üzenet **után**, és ideálisan nem az első másodpercben, hanem az első
    reklám előtt. Kicsit magasabb eCPM azoknál, akik engedik (tipikusan kisebbség).
  - **B) Nem kérsz ATT-t:** egyszerűbb, a reklám nem perszonalizált iOS-en. Ilyenkor a
    `userTrackingUsageDescription` sem kell, és az App Store-ban nem jelölsz „tracking”-et.
- Javaslat: indulásnál **B**, és ha az iOS-forgalom jelentős, mérd ki az A-t.
- **SKAdNetwork** azonosítók: a plugin `skAdNetworkItems` listájával kerülnek az Info.plist-be
  (a Google és mediáció esetén a partnerek listája) – ez a hirdetők konverziómérése, ATT nélkül is kell.

### 5.5 Rewarded SSV – a coin a szerverről jön

Cél: **az app soha nem mondja meg, hogy „megnéztem, fizess”**; a Google szervere mondja meg a
mi szerverünknek, aláírva. A `CLAUDE.md` szabályai (ne a kliens mondja meg a userId-t, ne kerüljön
userId URL-be) miatt a userId helyett egy egyszer használatos **ad ticket** megy a Google-nek.

**Folyamat:**

```
App                         apps/web                               Google AdMob
 │ POST /api/ads/ticket  ──▶ (bearer token → userId)
 │                           napi limit ellenőrzés (adsToday < 5)
 │ ◀── { ticket }            ads_tickets: {ticket, userId, exp: +1h, used:false}
 │ RewardedAd.load(unitId, { serverSideVerificationOptions:
 │                            { customData: ticket } })
 │ ad.show() ─────────────────────────────────────────────────────────▶ (reklám lefut)
 │                           GET /api/ads/ssv?...&custom_data=<ticket>
 │                           &transaction_id=..&signature=..&key_id=.. ◀──
 │                           1. aláírás ellenőrzés (ECDSA, Google kulcsok)
 │                           2. ticket → userId, nem lejárt, nem használt
 │                           3. wallet-data: move(userId, "rewarded-ad:<transaction_id>", 20)
 │                              tranzakcióban, napi cap (DAILY_CAPS)
 │                           4. 200 OK (duplikált hívásra is 200)
 │ EARNED_REWARD / CLOSED után: GET /api/wallet (pár mp-ig pollozva) → új egyenleg
```

**Szerver oldali részletek (`apps/web`):**

- Új route: `apps/web/src/app/api/ads/ssv/route.ts` (GET), logika a `src/server/ads-data.ts`-ben
  (Mongo csak `src/server/**`-ban – `CLAUDE.md`). Ezt a végpontot a Google hívja, **nincs bearer
  token**: a hitelesítés az aláírás. Kövesd az `api-endpoint` skill konvencióit.
- **Aláírás ellenőrzése** Node `crypto`-val:
  - Kulcsok: `https://www.gstatic.com/admob/reward/verifier-keys.json` (`keyId` → PEM), cache-eld
    (pl. 24 óra), és ismeretlen `key_id` esetén töltsd újra.
  - Az aláírt tartalom: a query string a `signature` paraméter előtti része (az `&signature=` előtt,
    változatlan sorrendben és kódolásban); a `signature` web-safe base64 (DER ECDSA), SHA-256.
  - `crypto.verify('sha256', Buffer.from(message), publicKeyPem, signatureBuffer)`.
- **Idempotencia:** ledger kulcs = `rewarded-ad:<transaction_id>` – a meglévő `move()` unique
  (userId, key) indexe garantálja, hogy egy nézés csak egyszer fizet (a Google újrapróbálkozhat).
- **Napi limit** marad a szerveren (`ADS_PER_DAY`), a ticket kiadásakor és a jóváíráskor is.
- A `claim()` `case "rewarded-ad"` ága: élesben maradjon letiltva (`adsEnabled()` = false, azaz
  `ADS_SIMULATED` **nincs beállítva** production-ben). Fejlesztésben a szimulált út maradhat.
- Az AdMob felületén az ad unitnál add meg az SSV callback URL-t
  (`https://<domain>/api/ads/ssv`). A mentéskor a Google egy teszt-hívást küld (paraméterek
  nélkül / teszt adattal) – erre 200-at kell adni, de coint nem.
- Naplózd a sikertelen aláírás-ellenőrzéseket (a meglévő crash/analytics csatornán vagy külön).

**Mobil oldali részletek (`apps/mobile`):**

- `shop.tsx` „Watch & earn”: a szimulált visszaszámláló helyett valódi `RewardedAd`; a
  `EXPO_PUBLIC_ADS_LIVE=1` flag már létezik erre.
- Az appban **ne** hívd a `claim('rewarded-ad')`-et élesben; a `EARNED_REWARD` esemény után csak
  frissítsd a pénztárcát (a szerver pár másodpercen belül jóváír; ha nem, „Your coins are on the way”).
- Előtöltés: a reklámot a Free fül megnyitásakor töltsd be, ne a gombnyomáskor (különben
  3–10 mp várakozás). Ha nincs reklám (no fill), a gomb legyen letiltva „No video right now” felirattal.

### 5.6 Gyakoriságkorlátok (frequency cap)

- Rewarded: napi 5 (szerveren). Nem kell más korlát, mert önkéntes.
- Interstitial (ha lesz): az AdMob ad unit szintű frequency cappel **és** kliensen is, pl.
  legalább 3 perc két interstitial között, max 3–4 / nap, az első munkamenetben / első napon
  egy sem, soha Daily-ben, soha Club tagnak.

### 5.7 Teszt

- Fejlesztés alatt **mindig teszt ad unit ID** (`TestIds.REWARDED`) vagy teszt-eszköz
  (`setRequestConfiguration({ testDeviceIdentifiers: [...] })`; a device ID-t a log kiírja).
- **Soha ne kattints / nézz saját éles reklámot, és ne kérd erre a barátaidat** – ez „invalid
  traffic”, az AdMob fiók felfüggesztéséhez / tiltásához vezethet, és a fiókot nem lehet újranyitni.
- Az SSV-t teszt reklámmal is ki lehet próbálni (a teszt rewarded reklám is küld callbacket, ha
  be van állítva). Vercel preview-ban a callback URL-nek publikusnak kell lennie.
- UMP tesztelése: `AdsConsent` debug beállítással EEA-földrajzot szimulálva, `reset()`-tel.

### 5.8 `app-ads.txt` a weboldalon

- Az AdMob a store listingben megadott **developer website** hostnevén keresi:
  `https://<host>/app-ads.txt`. Egy aldomain-szintet is megnéz; a `www.` és `m.` nem számít.
- Tartalom (a saját publisher ID-val):
  ```
  google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0
  ```
  (mediációnál a többi hálózat sorai is bekerülnek.)
- Legegyszerűbb: statikus fájl `apps/web/public/app-ads.txt`. (Vagy route handler
  `apps/web/src/app/app-ads.txt/route.ts`, `text/plain`-nel, ha env-ből akarod generálni.)
  Ellenőrizd, hogy a `src/proxy.ts` matcher (csak `/admin`) nem érinti.
- Most a web a `champions-web-amber.vercel.app` címen fut (az `app.json` associated domain is ez),
  az operátor e-mail még helyőrző (`your-domain.com`). **Javaslat: saját domain** a store listing
  „website” mezőjébe, és ott legyen az `app-ads.txt`. A `vercel.app` aldomain technikailag
  működhet, de egy saját domain hosszú távon biztonságosabb (a store listingben is az kell).
- A crawl akár 24 óráig tart; ellenőrzés nélkül az AdMob figyelmeztet, és a hirdetők egy része
  alacsonyabb áron vagy egyáltalán nem licitál.

### 5.9 Élesítés sorrendje

1. AdMob fiók + payments profile + adóadatok.
2. SDK + plugin + dev build; rewarded teszt ID-val a Free fülön.
3. UMP consent flow (+ privacy options gomb), ATT döntés.
4. `/api/ads/ticket` + `/api/ads/ssv` + ledger, tesztekkel (aláírás-ellenőrzés egységteszt a Google
   dokumentált példájával).
5. `app-ads.txt` élesen a store listing domainjén.
6. Jogi szövegek + store nyilatkozatok frissítése (7. fejezet).
7. Store build: `EXPO_PUBLIC_ADS_LIVE=1`, éles ad unit ID-k; production-ben `ADS_SIMULATED`
   **nincs** beállítva.
8. Első hét: eCPM, fill rate, nézés / DAU, retenció figyelése; interstitialről csak ezután dönts.

---

## 6. Mediáció később (2. fázis)

- **AdMob mediáció:** az AdMob felületén „Mediation group” → bidding partnerek (AppLovin, Unity
  Ads, Meta Audience Network, Liftoff, Mintegral, Pangle…). Mobilon partnerenként egy adapter
  (natív függőség, Expo-ban config plugin / `expo-build-properties` + podok/gradle) → új build.
- **AppLovin MAX:** ha a MAX-ra állsz át, az AdMob egy hálózat lesz alatta. A SSV-t a MAX saját
  S2S reward callbackje adja (más formátum) – a `/api/ads/ssv` végpontot hálózatfüggetlenre érdemes
  tervezni (külön handler / ellenőrző hálózatonként, közös jóváírás).
- Minden új hálózat: `app-ads.txt` sor, SKAdNetwork ID-k, adatvédelmi tájékoztató (feldolgozók
  listája), Data safety / privacy label frissítés.
- Küszöb, ami felett megéri: kb. néhány ezer DAU (becslés) – alatta a plusz bevétel nem fedezi a
  plusz munkát és a nagyobb app-méretet.

---

## 7. Jogi és store megfelelőség – checklista

- [ ] **Adatvédelmi tájékoztató (`apps/web/src/app/privacy/page.tsx`)** – most azt állítja, hogy
  nincs reklám-SDK és követés. Módosítani kell: reklámok (Google AdMob, később mediációs partnerek)
  mint címzettek; milyen adat megy (hirdetési azonosító, IP / hozzávetőleges hely, eszközadatok,
  reklám-interakciók); jogalap (perszonalizált reklám: hozzájárulás, Art. 6(1)(a); nem
  perszonalizált: jogos érdek / szerződés – jogászzal egyeztetve); a hozzájárulás visszavonása
  (Privacy options gomb); adattovábbítás az USA-ba. A bevezető és a „What we don't do” rész átírandó.
- [ ] **Feltételek (`terms`)**: rewarded jutalom szabályai (napi limit, visszaélés esetén elvonás).
- [ ] **Google Play:** Play Console → App content → „Contains ads: Yes”; **Data safety** frissítése
  (Device or other IDs, App interactions, Diagnostics, Approximate location – „shared” a Google
  felé reklám céljára; a Google AdMob-hoz kiadott Data safety útmutatója szerint).
- [ ] **Advertising ID nyilatkozat** a Play Console-ban (Android 13+ `AD_ID` jogosultság).
- [ ] **App Store:** App Privacy (nutrition label) frissítése: Identifiers (Device ID), Usage Data,
  Diagnostics, „Third-Party Advertising”; ha ATT-t kérsz, akkor „Used to Track You” is. A Google
  Mobile Ads SDK saját privacy manifestet hoz, de a label kitöltése a te felelősséged.
- [ ] **ATT** csak akkor, ha tényleg IDFA-t használsz; ATT nélkül nem szabad követni.
- [ ] **UMP / TCF** consent EGT/UK/CH-ban az első reklám előtt; privacy options elérhető.
- [ ] **Korhatár / gyerekek:** az app 16+ (`OPERATOR.minimumAge = 16`). A Play Console „Target
  audience”-ben **ne** jelölj 13 év alatti korosztályt – akkor a Families policy és a „Families
  self-certified” SDK-követelmények nem vonatkoznak rád. Ettől függetlenül: `maxAdContentRating`
  `T`, szerencsejáték-reklámok tiltva. A GDPR digitális hozzájárulási korhatár Magyarországon 16 év
  – ez összhangban van a 16+ korhatárral.
- [ ] **Loot box szabályok:** a rewarded reklám nem véletlen húzás pénzért, **erre nem vonatkoznak**
  (azok a draft boostokra vonatkoznak, lásd `monetization.md`). A rewarded jutalom fix (20 coin),
  ne legyen véletlenszerű („nézz reklámot → pörgess egy szerencsekereket” formát kerüld).
- [ ] **„Nem hivatalos fan game” szabály:** a reklámok nem használhatnak klublogót, és a játék
  saját reklámjaiban (kreatívjaiban) sem; a `DISCLAIMER` továbbra is látszik. Reklám sosem takarhatja
  el a disclaimert. A reklámozó hirdetések (pl. egy valódi klub hirdetése) tartalmára nincs
  befolyásod – ezért a kategória-tiltás.
- [ ] **EU fogyasztóvédelem:** a rewarded ajánlat legyen átlátható (mennyi coin, hány videó / nap).
- [ ] **Könyvelés / adó:** AdMob bevétel mint szolgáltatásnyújtás EU-n belüli cégnek (Google
  Ireland) – könyvelővel.

---

## 8. Amit kerülni kell (policy-sértések, fiókbukás)

- **Saját reklám nézése / kattintása**, barátok megkérése kattintásra, bármilyen „kattints a
  reklámra” szöveg → invalid traffic, fiókfelfüggesztés.
- **Kattintásért jutalom** (incentivized clicks) – tilos. Jutalom csak a *megnézésért* jár, és csak
  rewarded formátumban.
- **Véletlen kattintás kiprovokálása:** reklám a gombok, a tab bar, a pörgetés gombja mellett;
  interstitial, ami váratlanul jön fel, amikor a játékos épp koppint (pl. a draft „pick” gomb
  után azonnal).
- **Interstitial rossz helyen:** app indításkor, draft közben, képernyőváltásonként, Daily-ben,
  kilépéskor. A Google külön tiltja a „váratlan” és a túl gyakori interstitialt.
- **Reklám a Daily flow-ban:** a Daily a mindenkinek egyforma, tiszta mód (`BOOSTS_ALLOWED`
  logikája szerint is). Ott ne legyen se interstitial, se „videóért extra próbálkozás”.
- **Rewarded, ami valójában nem opcionális** (pl. a torna csak videó után folytatható) → az már
  nem rewarded, és rontja a megtartást.
- **Kliens által jóváírt coin** élesben (a mostani szimulált út). Csak SSV.
- **Reklám betöltése hozzájárulás előtt** az EGT-ben.
- **Több AdMob fiók** nyitása egy személynek, vagy az app ID-k keverése iOS/Android között.

---

## 9. Nyitott döntések a tulajdonosnak

1. **Csak rewarded, vagy később interstitial is?** (A meglévő döntés: csak rewarded. Javaslat:
   ennél maradni, amíg nincs retenciós adat.)
2. **„Remove ads” egyszeri vásárlás** (a `monetization.md` 3,99 €-t említ) – csak akkor van
   értelme, ha lesz kényszerített reklám. A Club „no ads” ígérete ilyenkor az interstitialekre
   vonatkozik; rewarded maradjon elérhető Club tagoknak is (coinért)?
3. **Rewarded jutalmak bővítése:** csak coin (most), vagy torna után „dupla coin”, casual draftban
   „+1 re-spin” videóért? (Daily-ben semmiképp.) Ez a gazdasági egyensúlyt érinti (napi coin-cél
   100–150).
4. **ATT iOS-en:** kérjük (több pénz, több jogi teher) vagy nem (egyszerűbb)?
5. **Hálózat:** AdMob önmagában indulásra – és mikor / melyik mediáció (AdMob-mediáció vs. AppLovin MAX)?
6. **Saját domain** a store listinghez és az `app-ads.txt`-hez (most `vercel.app`).
7. **Ki a számlázó fél** (magánszemély, egyéni vállalkozó, cég) – az AdMob payments profile és az
   adózás ettől függ.

---

## 10. Források

- AdMob – rewarded SSV (Android): https://developers.google.com/admob/android/ssv
- AdMob – fizetési küszöbök: https://support.google.com/admob/answer/2772208?hl=en
- AdMob – kifizetés lépései: https://support.google.com/admob/checklist/2998383?hl=en
- AdMob – fizetések és tranzakciók: https://support.google.com/admob/answer/2772140?hl=en
- AdMob – app-ads.txt beállítás: https://support.google.com/admob/answer/9363762?hl=en
- AdMob – app-ads.txt (fejlesztői doksi): https://developers.google.com/admob/android/app-ads
- AdMob – EGT felhasználók / GDPR (UMP): https://developers.google.com/admob/android/privacy/gdpr
- Google – CMP követelmények EGT/UK/CH: https://support.google.com/admanager/answer/13554116?hl=en
- react-native-google-mobile-ads – Expo telepítés: https://docs.page/invertase/react-native-google-mobile-ads/installation/expo
- AppLovin MAX React Native: https://support.axon.ai/en/max/react-native/overview/integration
- AppLovin MAX RN – adatvédelem: https://developers.axon.ai/en/max/react-native/overview/privacy/
- Meta adapter changelog (waterfall megszűnt): https://github.com/AppLovin/AppLovin-MAX-SDK-Android/blob/master/Facebook/CHANGELOG.md
- Mediációs piaci részesedés (MAX vs LevelPlay vs AdMob): https://www.globalgamesforum.com/news/max-vs-levelplay-9-facts-about-the-mediation-space-in-2025
- Gamebiz – Max vs LevelPlay 2025: https://www.gamebizconsulting.com/newsletter/newsletter-may25
- eCPM benchmarkok (becslések): https://www.monetizemore.com/blog/how-much-ad-revenue-can-apps-generate/ ,
  https://tenjin.com/blog/ad-mon-gaming-2026/ ,
  https://bidlogic.io/2026/07/31/q2-2026-ecpm-growth-interstitial-rewarded-video-and-banner-trends/ ,
  https://www.playwire.com/blog/admob-ecpm-benchmarks-what-publishers-should-expect ,
  https://appodeal.com/blog/mobile-ecpm-report-app-ad-monetization-worldwide-performance/
- Interstitial jó gyakorlatok: https://adapty.io/blog/mobile-interstitial-ads/

A bevételi és eCPM számok iparági átlagok és becslések; a valós értéket az első 2–4 hét AdMob
adatai adják meg.
