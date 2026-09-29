# Spinvincible – launch oldal: tartalmi brief

Ez a leírás azt rögzíti, **minek kell megjelennie** a weboldal főoldalán (`/`), amíg az app még nem jelent meg. A cél egyetlen dolog: minél több látogató iratkozzon fel a launch-értesítőre. A kinézet (elrendezés, betűk, formák) szabadon tervezhető; a színekre csak az oldal végén lévő két szabály vonatkozik.

---

## 1. Mi az oldal feladata

- **Egy mondatban megérteni a játékot.** A látogató 5 másodperc alatt tudja meg, hogy ez egy futballos draft-játék: tárcsákat pörget, valódi játékosokból csapatot rak össze, és egy szezonon át kiderül, mennyire jó a csapata.
- **Feliratkozás.** Az email-mező az oldal tetején, görgetés nélkül látszódjon, és az oldal alján még egyszer szerepeljen.
- **Hitelesség.** Látsszon, hogy ez egy valódi, hamarosan megjelenő mobilapp (iOS és Android), nem egy félkész ötlet.

**Célközönség:** futballrajongók, akik szeretik a „ki volt a jobb” vitákat, a klubtörténetet és a gyors, megosztható játékokat. Többségük telefonról érkezik (közösségi médiából, egy megosztott linkről), ezért **a telefonos nézet az elsődleges**.

---

## 2. Kötelező elemek, felülről lefelé

### 2.1 Fejléc
- **Logó** (`apps/web/public/logo.png`, négyzetes app-ikon) és mellette a név: **Spinvincible**.
- Egy rövid státuszsor: *„iOS & Android · launching soon”* (ez telefonon elhagyható).
- Nincs menü. Az oldal egyetlen hosszú, görgethető lap.

### 2.2 Főrész (hero) – ez a legfontosabb
- **Főcím**, a játék három lépése, ütősen: *„Spin. Draft. Unbeaten.”* (vagy ennek egy változata; a lényeg a pörgetés → draft → veretlen szezon).
- **Egy felső címke** a főcím fölött: *„The all-time draft · 1960 – today”*.
- **Magyarázó bekezdés** (2–3 mondat): *„Spin a decade, a league and a club. Draft a real player from that squad. Eleven picks later you have an all-time XI – and one question: could it get through a whole season without losing?”*
- **Email-feliratkozás** (részletek a 3. pontban).
- **Várólista-számláló** a mező alatt: *„1 204 already in the queue”*. Csak **25 feliratkozó fölött** jelenjen meg, alatta rejtve marad.
- **A játék bemutatása mint élmény:** egy kipróbálható mini nyerőgép három tárcsával (**Decade · League · Position**) és egy **SPIN** gombbal. A tárcsák egymás után állnak meg, alattuk kiírva az eredmény, például *„Your pick: striker from an Italian club of the 90s.”*
  - A tárcsák tartalma: évtizedek (60s–20s), bajnokságok rövidítéssel (ENG, ESP, ITA, GER, FRA), posztok (GK, CB, FB, DM, CM, AM, W, ST).
  - Megnyomás előtti szöveg: *„Press spin – this is how every pick starts.”*

### 2.3 Futó sáv (opcionális, de erősíti a hangulatot)
- Stadion-kijelzőszerű, folyamatosan gördülő sor: *60s / ENG / 70s / ESP / 80s / ITA / … / 38 matchdays / 0 defeats*.
- Díszítő elem, a képernyőolvasók elől rejtve.

### 2.4 „How a draft works” – három lépés
| # | Cím | Szöveg | Kiegészítő adat |
|---|---|---|---|
| 01 | **Spin** | Three reels land one after the other: a decade, one of Europe's big five leagues, and a club that really played in it. | 3 reels |
| 02 | **Draft** | Pick one player from that club's real squad of the decade and put him where he fits. Chemistry decides how well your XI clicks. | 11 picks |
| 03 | **Play the season** | Your XI takes the place of a real club and plays a whole season, matchday by matchday – live, fast, or straight to the table. | 38 matchdays |

### 2.5 „A tökéletes szezon” – a nagy cél
- Kiemelt, óriási szám: **38–0** (38 győzelem, 0 vereség).
- Cím: **„The perfect season”**.
- Szöveg: *„Every match is simulated by an engine fitted on 113,000 real league games. Great squads win titles. Winning all 38 is another story – most drafts never get close.”*
- Három adat: **5** leagues · **7** decades · **113k** real matches.

### 2.6 Záró feliratkozás
- Második email-mező, más megfogalmazással. Jelenleg ez egy „belépőjegy”: *„Admit one · launch day”*, a címe *„Get your ticket to kick-off”*.
- Opcionális díszítés: a logó és egy sorszám (*„No. 1 205”*, a várólista következő helye).

### 2.7 Lábléc
- *„© [év] Spinvincible”*
- **Kötelező jogi szöveg** (pontosan így, a `DISCLAIMER_SHORT` a `@champion/shared`-ből): *„Unofficial fan game. Not affiliated with or endorsed by any club, league or player.”*
- Ha lesz adatkezelési tájékoztató, ide kerül a linkje (és a feliratkozó mező alá is).

---

## 3. A feliratkozó űrlap viselkedése

A logika már kész (`joinWaitlistAction`, `server/waitlist-data.ts`), a dizájnnak ezeket az állapotokat kell lefednie:

| Állapot | Mit lát a látogató |
|---|---|
| Alap | Címke: *„Email for launch day”*, mező (`you@example.com`), gomb: *„Join the waitlist”*, alatta: *„No spam. We only use your address to tell you when it's out.”* |
| Küldés közben | A gomb szövege *„Joining…”*, a gomb nem nyomható. |
| Siker | *„You're in”* + *„Number 128 in the queue. One email, on launch day.”* |
| Már feliratkozott | *„Already on the list”* (ugyanaz a sorszám). |
| Hibás email | *„That doesn't look like an email address.”* közvetlenül a mező alatt. |
| Szerverhiba | *„We couldn't save that right now – please try again.”* |

- Egy email-címet csak egyszer ment el a rendszer (kisbetűsítve).
- Robotok ellen rejtett csapdamező és minimális kitöltési idő véd; ezekhez a dizájnnak nincs teendője, csak ne tüntesse el őket.
- Minden mezőnek legyen látható címkéje (nem elég a placeholder), és a hibaüzenet a mezőhöz tartozzon.

---

## 4. Tilos és kerülendő

- **Nem hivatkozunk más játékra** inspirációként vagy összehasonlításként (semmilyen formában).
- **Nincs klublogó, címer, mez vagy játékosfotó.** Klubnév és játékosnév sem kell a marketingoldalra.
- **A bajnokságokat nem a márkanevükön** („Premier League”, „La Liga” stb.) nevezzük meg, hanem országgal vagy rövidítéssel (England, ENG).
- **Semmi nem utalhat hivatalos partnerségre** (klubbal, ligával, szövetséggel).
- Nem ígérünk olyat, ami az appban nincs benne. Minden bemutatott funkció létezik.
- Nem használunk emojit ikonként.

---

## 5. Technikai minimum

- **Telefon először:** 375 px-től asztali szélességig működjön, vízszintes görgetés nélkül; a gombok legalább 44 px magasak.
- **Mozgás:** minden animáció (tárcsák, futó sáv) álljon meg, ha a látogató a rendszerében csökkentett mozgást kért.
- **Akadálymentesség:** billentyűzettel is végig lehessen menni rajta, és a fókusz legyen jól látható. A díszítő elemek rejtve a képernyőolvasók elől, a nyerőgép eredménye viszont felolvasható (`aria-live`).
- **Megosztási előnézet:** cím *„Spinvincible – spin, draft, go unbeaten”*, leírás a játékról, kép a logó (`/logo.png`).
- **Adminban:** a feliratkozók az **Admin → Waitlist** oldalon láthatók, és CSV-be exportálhatók.

---

## 6. Színek – két alapszabály

1. **Csak a logó színeit használjuk:** sötét tengerészkék (`#0d141e`, a „tinta”), arany (`#ffc72c`) és pályazöld (`#1f6b3a`), világos, meleg papírszín háttérrel (`#f3efe6`). Más élénk színt, színátmenetes fényudvart vagy neont nem vezetünk be.
2. **Az arany a cselekvésé:** arany a fő gomb (SPIN, feliratkozás) és a kiemelés (a nyerő sor, a legfontosabb szó). Más elem nem kap aranyat, így a szem mindig odatalál, ahol kattintani kell. A szöveg és a háttér között mindig legyen legalább 4.5:1 kontraszt.
