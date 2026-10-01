# Spinvincible – az app teljes leírása dizájn-generáláshoz

> Ez a dokumentum egy mobilapp (iOS + Android, Expo / React Native) **minden képernyőjét, elemét, állapotát és interakcióját** írja le, hogy egy AI (vagy dizájner) új vizuális dizájnt tervezhessen hozzá. A funkciók és a folyamat adottak – a **kinézet szabadon újragondolható**. A felületen lévő szövegek angolul vannak (az app nyelve angol), ezért azokat itt is eredeti formájukban, `idézőjelben` írom.

---

## 1. Mi ez az app?

**Spinvincible** egy futballos „draft” játék.

- A játékos egy **felállást (formációt)** pörget, majd poszthelyenként **pörgetőgépen (slot machine)** kisorsol egy **évtizedet + ligát + klubot**, és annak a klubnak az adott évtizedbeli **valódi keretéből** választ egy játékost.
- 11 játékosból összeáll egy **álomcsapat** különböző korokból (pl. Baresi a 80-as évek Milanjából, Messi a 2010-es évek Barcájából).
- A csapatnak van **Rating** (játékoserő) és **Chemistry** (összhang) értéke, ebből jön az **Overall**.
- A kész csapattal **tornákon/módokban** lehet játszani: egy **meccs** egy valódi klub ellen, vagy egy **teljes bajnoki szezon** szimulálása. A végső kérdés: *veretlenül megnyernéd-e a bajnokságot?*

**Adatok:** Top 5 európai liga (angol, spanyol, olasz, német, francia), 1960-tól napjainkig. Minden játékosnak valós statisztikái (meccsek, gólok), posztjai és 0–100-as **ratingje** van (Messi 2011/12 = 100).

**Célcsoport / hangulat:** focirajongók, nosztalgia + szerencsejáték-izgalom (pörgetés) + csapatépítés (FIFA Ultimate Team-szerű chemistry). Gyors, játékos, „még egy kör” érzés.

---

## 2. Navigáció és képernyő-térkép

Az app alul **natív tab bart** használ (iOS 26-on lebegő „liquid glass” tab bar), két füllel:

| Tab | Ikon | Tartalom |
|---|---|---|
| `Home` | ház | Maga a játék (minden lent leírt képernyő itt él, egymásra rétegzett lapokként/overlay-ekként) |
| `Explore` | explore ikon | Jelenleg az Expo sablon placeholder oldala – **tartalma még nincs**, dizájnban szabadon kitalálható (pl. statisztikák, korábbi csapatok, ranglisták, szabályok) |

A játék folyamata a `Home` tabon (egy képernyő, állapotok és rárétegzett lapok):

```
[1] Kezdőképernyő ("Regular game")
        │
        ▼
[2] Formáció-pörgetés (slot reel)
        │
        ▼
[3] Pálya / csapatépítés  ◄───────────────┐
        │  "Spin"                          │ (játékos kiválasztva →
        ▼                                  │  lerakás a pályán)
[4] Játékos-pörgetés lap (3 henger +       │
    keretlista) ───────────────────────────┘
        │  (11/11 játékos után) "Complete"
        ▼
[5] Összesítő ("Squad complete")
        │  "Start tournament"          "New game" → vissza [2]-re
        ▼
[6] Tornaválasztó ("Start tournament")
        ├── "Match"          → [7] Meccs mód
        ├── "League"         → [8] Liga mód (dropdownok)
        ├── "Random League"  → [9] Random liga mód (pörgetők)
        └── Coming soon: Champions League, Random Champions League,
                         World Cup, Random World Cup (nem nyomható)
```

Minden játék közbeni képernyőn a bal felső sarokban egy **kerek `✕` gomb** van (visszalépés a kezdőképernyőre, a játék eldobása).

---

## 3. Képernyők részletesen

### [1] Kezdőképernyő

- **Állapot:** a játék még nem indult.
- **Elemek:**
  - Egyetlen elsődleges gomb középen: `Regular game` (kék, fehér félkövér szöveg).
- **Dizájn-lehetőség:** jelenleg nagyon üres. Ide jól illene: logó / „Spinvincible” felirat, rövid tagline (pl. „Build an all-time XI. Go unbeaten.”), háttérillusztráció (stadion, pálya), esetleg későbbi módok (pl. „Daily challenge”) helye. A `Regular game` a fő CTA.

### [2] Formáció-pörgetés

- **Mi történik:** a `Regular game` megnyomása után automatikusan elindul egy **függőleges pörgetőhenger (slot reel)**, ami ~90 formáció közül sorsol egyet (pl. `4-3-3`, `4-4-2 diamond`, `3-5-2`, `2-3-5`, `5-4-1`, `4-3-3 false nine` …).
- **Elemek:**
  - **Slot reel:** sötét keret (`#11181C`, lekerekített 20px), benne fehér „ablak”, 5 látható sor (56px/sor), a középső sor a „nyerő sor” sárga (`#F5B800`) felső-alsó vonallal (payline), a szélső sorok sötétítve (árnyék a mélység érzetéhez). A szöveg nagy, extra félkövér, sötét.
  - A henger alatt a kisorsolt formáció neve nagy felirattal (pörgés alatt üres).
  - Bal felül `✕`.
- **Animáció:** gyors pörgés, lassuló megállás (easing), megállás után ~0,8 mp szünet, majd átúszik a pálya nézetbe.

### [3] Pálya / csapatépítés (fő játékképernyő)

Ez az app szíve, itt tölti a legtöbb időt a játékos.

**Fejléc (a pálya felett, középre zárva):**
- Formáció neve nagy betűvel (pl. `4-3-3`).
- Statisztika-sor: `Total rating 612 · 7/11 players · Chemistry 54` (a számok kiemelve).
- Ha van chemistry-bónusz, alatta csillagos sorok, pl. `★ Dynasty: 3 players from Milan`, `★ Golden generation: 4 Italy players of one era`.

**Pálya (FormationPitch):**
- Felülnézeti, függőleges focipálya valós arányokkal (68×105), zöld fűcsíkokkal (`#2E8B3D` / `#277A35` váltakozva), fehér félig átlátszó vonalakkal (felezővonal, kezdőkör, tizenhatosok, ötösök), lekerekített sarkok.
- **Játékoshelyek (spotok):** 11 kör a formáció szerint elhelyezve (kapus alul).
  - **Üres spot:** a poszt kódja látszik benne (`GK`, `CB`, `LB`, `RB`, `DM`, `CM`, `AM`, `LM`, `RM`, `LW`, `RW`, `SS`, `CF`, `SW`). A kapus spot eltérő stílusú.
  - **Betöltött spot:** a mez sorszáma (1–11) a körben, alatta a játékos **vezetékneve** kis címkén.
  - **Chemistry jelvény:** a betöltött spot sarkában kis kerek badge 0–3 ponttal; színe: 0 szürke `#8B8D98`, 1 sárga `#F5B800`, 2 világoszöld `#7FC97F`, 3 zöld `#30A46C`, negatív (rossz poszton) piros `#E5484D`.
  - **Chemistry-kapcsolatvonalak (links):** a szomszédos betöltött spotok között vonalak a játékosok **alatt**, színük/vastagságuk az erősség szerint: nincs kapcsolat = halvány fehér; honfitárs / azonos liga-korszak = sárga; azonos klub / korabeli honfitárs = sárga; csapattársak = zöld; „legendák” (5+ szezon együtt) = aranysárga, vastagabb.
- **Kiemelési állapotok a pályán:**
  - **Lerakás közben** (van kiválasztott, de még le nem rakott játékos): azok a spotok, ahova mehet, **zöld** (fő posztja) vagy **sárga** (másodlagos posztja) kiemelést kapnak; a nem megfelelő üres spotok **elhalványulnak**. Minden alkalmas spot felett kis szám mutatja, **mennyi chemistryt hozna ott** (`+3`, `+0`, `−1`).
  - **Csere közben** (megérintett egy lerakott játékost): a kiválasztott spot **gyűrűt** kap; a többi lerakott játékos spotja zöld/sárga/**piros** (piros = rossz posztra kerülne, chemistry-levonással); felettük a chemistry-változás (`+2` / `−4`). A kapus sosem cserélhető, üres helyre nem lehet cserélni.
- **Animációk:** a spotok egymás után „kipattannak” (zoom-in, kis késleltetéssel), a vonalak beúsznak.

**Akciósor (a pálya alatt) – állapottól függően egy dolog látszik:**
1. **Alap:** két gomb egymás mellett:
   - `Spin` (elsődleges, kék) → megnyitja a [4] játékos-pörgetés lapot.
   - `Autocomplete` (másodlagos, szürke háttér) → az összes üres helyet automatikusan kitölti véletlen, szabályos húzásokkal; közben a felirata `Filling…` és mindkét gomb le van tiltva.
2. **Lerakásra váró játékos:** magyarázó szöveg, pl. `Place Maldini (Defender · Rtg 91) on a green (main position) or yellow (other position) spot · up to +6 chemistry`.
3. **Csere folyamatban:** `Swap Pirlo: tap another player. Red = out of position (−1 chemistry). Tap him again to cancel.`
4. **Mind a 11 hely betelt:** egy nagy `Complete` gomb → [5] összesítő.

### [4] Játékos-pörgetés lap (DraftSpin) – overlay

- **Megjelenés:** a pálya fölé sötét áttetsző háttér (`rgba(0,0,0,0.55)`), középen egy lekerekített (24px) lap. Címe: `Spin for a player`. **Nem zárható be** kívülre koppintással – egy pörgetésnek választással kell végződnie.
- **Három slot reel egymás mellett** (sorban pörögnek, balról jobbra):
  1. **Évtized:** `60`, `70`, `80`, `90`, `00`, `10`, `20`
  2. **Liga:** `Spanish`, `Italian`, `English`, `German`, `French`
  3. **Klub:** az adott liga + évtized klubjai (az adatbázisból töltődik; két soros szöveg is lehet)
- **Még nem pörgetett henger:** sötét fedőlap nagy sárga `?` jellel. A klubhenger fedőlapján állapotszöveg: `…` (tölt), `No clubs`, `Offline`.
- Minden henger felett egy `↻ Respin` gomb (csak ha már minden megállt): **egyszeri újrapörgetés** az adott oszlopra (évtized újrapörgetése a klubot megtartja; liga újrapörgetése a klubot is újrapörgeti).
- Minden henger alatt a kisorsolt érték félkövéren.
- **Állapotüzenetek:** `Loading players…`; ha a klub abban az évtizedben nem volt abban a ligában (piros szöveg): `AC Milan didn't play in the Spanish league in the 80s. Respin to get a club from that decade.`
- **Keretlista (miután minden megállt):**
  - Felirat: `Barcelona squad, 10s · 34 players` (vagy ha nincs adat: `Demo players – no squad imported for this club and decade yet`).
  - Görgethető, szekciókra bontott lista (max ~260px magas): `Goalkeepers`, `Defenders`, `Midfielders`, `Forwards`. A szekciócím halványabb, ha abból a posztból már nincs üres hely.
  - **Játékossor:** bal oldalt posztszerep (`GK`/`DF`/`MF`/`FW`), középen név + alatta kis szürke részletsor (`CB/LB · Italy · 245 apps · 12 goals`), jobb oldalt két kis négyzetes badge:
    - **CHEM badge:** `+3` / `CHEM` – mennyi chemistryt adna a legjobb szabad helyén (zöld, ha pozitív; szürke, ha 0).
    - **RTG badge:** a rating (`94` / `RTG`), háttérszíne a rating szerint: ≥85 kék `#208AEF`, ≥70 zöld `#30A46C`, ≥55 sárga `#F5B800`, alatta szürke `#8B8D98`.
  - Nem választható (már a csapatban van, vagy nincs neki szabad helye) játékos halványítva, nem nyomható.
- Választás után a lap bezárul, és a játékos „lerakásra vár” a pályán (lásd [3]).

### [5] Összesítő – „Squad complete” (overlay lap)

- Sötét háttér előtt középen lap, **görgethető tartalommal**, alul fix gombsorral.
- **Tartalom felülről lefelé:**
  1. Cím: `Squad complete`, alatta a formáció.
  2. **Három nagy csempe (tile) egymás mellett:** `Rating` (átlagos játékos-rating), `Chemistry` (0–100), `Overall` (a kettőből számolt végső erő). A számok színkódoltak (rating: kék/zöld/sárga/szürke skála; chemistry: ≥70 zöld, ≥40 sárga, alatta piros).
  3. Magyarázó sor: `Overall = rating × chemistry (+5%)`.
  4. Bónuszok csillaggal (`★ Dynasty: …`).
  5. **Sorok kártya:** `Attack`, `Midfield`, `Defence`, `Goal` – mindegyik sor átlagos ratingje színezve.
  6. **„Best partnerships” kártya:** max. 4 legerősebb páros, pl. `★ Baresi & Maldini` + alatta `Legends: 9 seasons together at Milan`.
  7. Ha van: piros figyelmeztetés `Out of position (−1 chemistry each): Pirlo, Kaká`.
  8. **„Players” kártya:** mind a 11 játékos: posztkód, név, alatta `Klub · 80s`, jobbra chemistry pont badge + rating badge.
- **Alsó gombok:** `New game` (másodlagos) és `Start tournament` (elsődleges, kék).

### [6] Tornaválasztó – „Start tournament” (overlay lap)

- Cím: `Start tournament`, alatta `Overall 84 · Chemistry 67`.
- **Játszható módok (felül, nagy nyomható sorok, jobbra `›` nyíl):**
  1. `Match`
  2. `League`
  3. `Random League`
- **Elválasztó:** vékony vonalak között `🔒 Coming soon`.
- **Készülő módok (nem nyomhatók, kedvcsinálónak):** szaggatott keretes kártyák, halvány üveg/áttetsző háttérrel, bal oldalt ikon, középen cím + rövid leírás, jobb oldalt sárga `SOON` pirula:
  - 🎲 `Random Champions League` – *A random European Cup season – can you lift the trophy?*
  - 🏆 `Champions League` – *Europe's elite, from the group stage to the final*
  - 🎲 `Random World Cup` – *A random World Cup year, groups to final*
  - 🌍 `World Cup` – *Take on the national teams of a World Cup you pick*
- Alul: `Back to summary` gomb.

### [7] Meccs mód – „Match”

Egy meccs a saját XI ellen egy valódi klub valódi szezonbeli csapata ellen.

- **Kiválasztás (három legördülő / dropdown, egymás alatt, címkével):**
  - `League` – pl. `ITA · Serie A` (5 liga)
  - `Season` – pl. `2008/09` (1960/61-től az utolsó befejezett szezonig; Bundesliga 1963-tól)
  - `Club` – az adott szezon tabellájának csapatai, helyezéssel: `Inter Milan (1.)`. Betöltéskor `Loading…`, hibánál `Offline`.
  - A dropdown lenyitva a lapon belül listát mutat, az aktív elem kiemelve.
- `🎲 Random opponent` gomb: véletlen liga + szezon + klub.
- **„Versus” kártya** (ha van kiválasztott ellenfél és még nem volt meccs): két doboz egymás mellett, köztük `vs`:
  - Bal: `Your XI` (kék háttér, fehér szöveg): `Overall 84`, `Chemistry 67`.
  - Jobb: az ellenfél neve + `ITA 2008/09`, `1. · 84 pts`, `25-9-4 · 70:32`, `Elo 1850`.
- **`▶ Play match`** elsődleges gomb (töltés alatt spinner).
- **Eredménykártya (Scoreboard)** a meccs után:
  - Felül kicsi: `You play at home · ITA 2008/09` (a hazai/vendég pályát minden meccsnél véletlenül sorsolja).
  - Középen nagy eredmény: `Your XI  3 – 1  Inter Milan` (hazai csapat balra).
  - Verdikt színezve: `You win!` (zöld) / `Draw` (sárga) / `You lose` (piros).
  - **Gólszerzők listája** időrendben: `⚽ 14' Zlatan Ibrahimović` – a hazai gólok balra, a vendégek jobbra igazítva; **a saját csapat góljai kékkel kiemelve**.
  - Alul szürkén: `Before kick-off: win 62% · draw 21% · loss 17%` és `Expected goals 1.84 – 0.92 (you – them)`.
- A gomb ezután `↻ Play again` – minden újrajátszás új véletlen eredmény és új pályaválasztás.
- Alul `Back`.
- **Dizájn-ötlet:** az eredménykártya lehet látványosabb (eredményjelző tábla, csapatcímer-helyőrzők, gól-idővonal 0–90 percig, esélysáv win/draw/loss arányban).

### [8] Liga mód – „League” (választós)

A saját XI egy valódi bajnoki szezonba kerül, az **utolsó helyezett csapat helyére**, és a teljes szezon leszimulálható.

- **Kiválasztás:** `League` és `Season` dropdown, alatta két gomb egymás mellett: `🎲 Random` és `Show table` (elsődleges).
- **Valódi tabella nézet (szimuláció előtt):**
  - Cím: `Serie A 2008/09`, alatta: `Your XI (Overall 84 · Chemistry 67) replaces Reggina, who finished last`.
  - Tabella fejléc: `#`, `Club`, `P`, `W`, `D`, `L`, `GD`, `Pts`.
  - Sorok: helyezés, klubnév, számok. **A kiesett csapat sora helyén `Your XI` kék kiemelt sorban** (`–` értékekkel).
  - Alatta: `The real final table of that season. Simulate it with your XI in the league.`
- **`▶ Simulate season`** gomb: minden csapat minden csapat ellen játszik **egy hazai és egy idegenbeli** meccset (20 csapatnál 38 forduló, 380 meccs), mindegyik szimulálva.
- **Szimulált szezon nézet:**
  - **Verdikt-kártya:** `Simulated Serie A 2008/09`, nagy felirat a végeredménnyel:
    - `Perfect season! 38-0 🏆` (minden meccs megnyerve – ez a játék „szent grálja”)
    - `Champions – unbeaten! 🏆`
    - `Champions! 🏆`
    - `Unbeaten, but 3rd`
    - `18th – relegation zone`
    - `Finished 7th`
  - Alatta: `27W 7D 4L · 81:32 · 88 pts`, a saját 3 legjobb góllövő `⚽ Messi 31 · Henry 18 · Kaká 9`, és `Top scorer: Ibrahimović (Inter Milan) 26`.
  - **Szimulált tabella** (ugyanaz a formátum, `Your XI` kékkel kiemelve a valós helyén).
  - Lábjegyzet: `Every club played every other club home and away · 3 points for a win` (1990-es évek közepe előtt 2 pont).
  - **`Your matches`** gomb: a tabella helyett a saját 38 meccs listája: forduló száma, `vs Juventus` (hazai) vagy `@ Juventus` (idegen), eredmény `2–1`, és színes `W`/`D`/`L` betű. Ekkor a gomb felirata `Hide matches`.
  - **`↻ Simulate again`**: új szezon, új eredmények.
- Alul `Back`.

### [9] Random liga mód – „Random League”

Ugyanaz, mint a [8], csak a liga és a szezon **pörgetővel** dől el:
- Két slot reel egymás mellett: **liga** (`Spanish`, `Italian`, …) és **szezon** (`2008/09` formátum). Először a liga pörög, a szezon henger addig sötét fedőlap alatt van sárga `?`-lel, majd az is lepörög.
- Megállás után automatikusan betölt a valódi tabella (ugyanaz a nézet, mint [8]-ban), majd `▶ Simulate season`.
- Extra gomb: `Spin again` – új liga + szezon pörgetése.

### [10] Explore tab

- Jelenleg Expo sablon-tartalom (nem végleges). Dizájnban javasolt új tartalom: szabályok / „How to play”, chemistry-magyarázat, legjobb eredmények (pl. legjobb szezon), mentett csapatok, statisztikák. **Szabadon kitalálható.**

---

## 4. Játékszabályok és számítások (hogy a dizájn jól kommunikálja őket)

### Posztok
- Szerepkörök (4 sor): `GK` kapus, `DF` védő, `MF` középpályás, `FW` támadó.
- Részletes posztkódok: `GK`, `SW`, `CB`, `LB`, `RB`, `DM`, `CM`, `AM`, `LM`, `RM`, `LW`, `RW`, `SS`, `CF`.
- Minden játékosnak van **fő posztja** és lehetnek **egyéb posztjai** (pl. Raphinha: RW fő, RM / LW / CF egyéb).
- Illeszkedés egy helyre: **fő poszt (zöld)**, **egyéb poszt (sárga)**, **rossz poszt (piros, csak cserével, −1 chemistry)**.

### Rating (0–100)
- Játékosonként egy klub + évtized szerinti érték; Messi 2011/12 = 100, egy átlagos alapember ~60.
- Színskála: **≥85 kék** (elit), **≥70 zöld** (erős), **≥55 sárga** (közepes), **alatta szürke**.

### Chemistry
- **Kapcsolatok (links)** a pályán szomszédos játékosok között, erősség szerint:
  - **Legends** (4) – legalább 5 szezont játszottak együtt egy klubban
  - **Team-mates** (3) – egy klubban játszottak ugyanabban a szezonban
  - **Same club** (2) – ugyanaz a klub, más korszak
  - **Compatriots of the same era** (2) – honfitársak, átfedő karrierrel
  - **Compatriots** (1) – honfitársak
  - **Same league & decade** (1)
- **Játékos-chemistry 0–3:** +1 fő poszton, +1 ha a kapcsolatai átlaga ≥ 1,5, +1 ha van legalább egy csapattárs-kapcsolata; rossz poszton −1.
- **Csapat-chemistry 0–100:** a pontokból skálázva 90-ig, + 5 pont bónuszonként:
  - **Dynasty:** 3+ játékos ugyanabból a klubból
  - **Golden generation:** 4+ azonos nemzetiségű, azonos korszakbeli játékos
- **Hatás:** az erő ±8%-ig módosul (`Overall = rating × (0,92 + 0,16 × chemistry/100)`).

### Meccs-szimuláció
- Valós statisztikai modell (113 ezer valódi meccsből illesztve): a csapatok sorainak (kapus, védelem, középpálya, támadás) átlagos ratingje határozza meg a várható gólokat; hazai pálya előny ~1,5×.
- **Minden meccs véletlenszerű** – az erősebb csapat nem mindig nyer (85-ös vs 60-as csapat otthon kb. 85%-ban nyer).
- Gólszerzőt a valós gól/meccs arány és a poszt alapján sorsol.

---

## 5. Jelenlegi vizuális rendszer (kiindulópont, felülírható)

- **Témák:** világos és sötét mód is (rendszer szerint automatikus).
- **Színek:**

| Token | Világos | Sötét |
|---|---|---|
| text | `#000000` | `#ffffff` |
| background | `#ffffff` | `#000000` |
| backgroundElement (kártyák, másodlagos gombok) | `#F0F0F3` | `#212225` |
| backgroundSelected (lenyomott) | `#E0E1E6` | `#2E3135` |
| textSecondary | `#60646C` | `#B0B4BA` |

- **Akcentusok:** elsődleges kék `#208AEF` (fő gombok, saját csapat kiemelése, splash háttér), sárga `#F5B800` (pörgetők, payline, `?`, SOON), zöld `#30A46C` (siker, fő poszt, győzelem), piros `#E5484D` (hiba, rossz poszt, vereség), szürke `#8B8D98`, sötét pörgetőkeret `#11181C`, pálya zöld `#2E8B3D` / `#277A35`.
- **Tipográfia:** rendszer-betűtípus (iOS: SF). Szintek: cím („subtitle”, nagy félkövér), normál, `small`, `smallBold`.
- **Térközök:** 2 / 4 / 8 / 16 / 24 / 32 / 64 px. Lapok lekerekítése 24px, kártyák/gombok 16px, pirulák teljesen kerekek.
- **Overlay-ek:** a lapok (pörgetés, összesítő, tornák) sötét áttetsző háttér fölött középen jelennek meg, max. szélesség ~360px, a tab bar felett.
- **Animációk:** Reanimated – beúszás (fade-in), spotok zoom-in, pörgetőhenger lassuló megállással.

---

## 6. Mit kérünk a dizájntól

1. **Egységes, karakteres vizuális identitás** (logó, színvilág, tipográfia) – focis, prémium, kicsit „kaszinós” izgalom a pörgetéseknél, de tiszta és olvasható.
2. **Minden fenti képernyő** megtervezése, **mindkét témában (világos + sötét)**, telefonra (portré, kb. 390×844 pt), az összes felsorolt **állapottal** (üres / töltés / hiba / kiválasztva / letiltva / eredmény).
3. Kiemelten fontos: a **pálya-nézet** (spotok, chemistry-vonalak és badge-ek jól olvashatók), a **slot reel** (izgalmas, „jackpot” érzés), az **összesítő csempék**, a **meccs-eredménykártya** és a **szimulált szezon verdiktje** (a `Perfect season! 38-0 🏆` legyen igazi ünnepi pillanat).
4. **Kezdőképernyő és Explore tab** koncepciója (most szinte üresek).
5. Komponenskönyvtár: gombok (elsődleges / másodlagos / letiltott), badge-ek (RTG, CHEM, chemistry-pont, SOON), kártyák, dropdown, tabella-sor, játékoslista-sor, overlay lap.

**Technikai korlátok:** React Native (Expo), natív tab bar alul (iOS 26 liquid glass), képek/ikonok lehetnek, klubcímerek és valódi játékosfotók **nincsenek** (licenc) – helyettük absztrakt jelölés (kezdőbetű, színes pajzs-helyőrző) használható. Minden szöveg angol.
