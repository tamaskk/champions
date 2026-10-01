# Spinvincible – funkciók és ötletek

Két rész: **mi van már kész** az appban, és **mit tennék még bele**, prioritás szerint. Az ötletek mellett ott van, mire épülnek a meglévő adatokból / kódból, és nagyjából mekkora munka (S / M / L).

---

## 1. Ami már kész

**Draft**
- Formáció-pörgetés (~90 formáció), majd poszthelyenként évtized + liga + klub pörgetés, valódi keretből választás.
- Respin oszloponként, Autocomplete (véletlen, szabályos húzás minden üres helyre).
- Csere a pályán (kapus fix, rossz poszt −1 chem).

**Értékelés**
- Játékos rating 0–100 (Messi 2011/12 = 100), klub-évtized rating.
- Chemistry: linkek (legends / team-mates / club / compatriots / league-era), játékosonként 0–3 pont, csapat 0–100, Dynasty és Golden generation bónusz, ±8% erő.
- Összesítő: Rating, Chemistry, Overall, sorátlagok, legjobb párosok.

**Játékmódok**
- **Match:** a te XI-ed egy valódi klubszezon ellen, random hazai/vendég, Poisson + Dixon–Coles modell (113 ezer valódi meccsre illesztve), gólszerzők, xG, esélyek.
- **League / Random League:** valódi bajnoki szezon, a te XI-ed az utolsó helyén, teljes oda-visszavágós szezon szimulálva, tabella, 38 meccsed, gólkirály.
- **Champions League / Random Champions League:** a szezon 31 legerősebb top 5 ligás klubja (Elo szerint) + a te XI-ed, 4 kalap, 8 csoport (azonos liga lehetőleg nem kerül egy csoportba), oda-visszavágós kieséses szakasz hosszabbítással és tizenegyesekkel, semleges pályás döntő.

**Egyéb**
- Home: rekordok (session), Explore: chemistry útmutató, Hall of Fame (session).
- Coming soon: World Cup, Random World Cup.

---

## 2. Játékmódok, amiket beletennék

### 2.1 Champions League / Random Champions League (M–L) – ✅ kész (2026-09-26)
- A te XI-ed beül egy valódi BEK/BL-szezon mezőnyébe (a top 5 liga klubjai, akiket ismerünk).
- **Egyszerű változat:** 32 csapatos csoportkör (8×4, oda-vissza) + egyenes kiesés (oda-vissza, döntő egy meccs, semleges pálya = nincs hazai előny a modellben).
- Hosszabbítás + tizenegyesek kiesésnél (a modellben 30 perc = λ × 1/3, tizenegyes 50–50 vagy kapus-rating alapján).
- **Random:** pörgetés évre, a mezőny az adott szezon ligáinak top 4–8 csapata.
- Megjelenítés: csoporttabella, ágrajz (bracket), döntő külön „ünnep” képernyő.
- *Adat:* a top 5 ligán kívüli klubok (Ajax, Porto, Celtic…) nincsenek bent – vagy kihagyjuk őket, vagy csak top 5 ligás „Super League” formátum.

### 2.2 World Cup / Random World Cup (L)
- Válogatott mód: nemzetiség szerint csak **egy ország** játékosaiból draftolsz (pl. „Minden idők brazil XI”), vagy a te vegyes XI-ed egy kitalált „World XI” csapatként indul.
- Ellenfelek: az adott ország minden idők legjobb XI-e az adatbázisból (top 5 ligás játékosok nemzetiség szerint) – ezt teljesen a meglévő adatból lehet számolni.
- 32 csapat, 8 csoport, egyenes kiesés.

### 2.3 Gauntlet / Survival (S–M) – szerintem a legjobb ár/érték
- Sorozatban játszol egyre erősebb valódi csapatok ellen (Elo szerint rendezve), addig, amíg ki nem kapsz.
- Pontszám: hány meccset nyertél sorban. Nagyon „még egy kör” érzés, és teljesen a meglévő Match motorra épül.

### 2.4 Legendás csapatok kihívás (S)
- „Verd meg a legendákat”: kurált lista a legendás szezonokról (Milan 1988/89, Barça 2010/11, Bayern 2012/13, Arsenal 2003/04, Real 2016/17…), mindegyik egy-egy boss.
- Egy meccs vagy oda-vissza párharc; a legyőzött legendák kipipálódnak (gyűjtögetés).
- A Home „Daily Challenge” kártyája ebből is táplálkozhat.

### 2.5 Daily Challenge (M) – a dizájnban már benne van
- Mindenki ugyanazt a fix seedet kapja (formáció + pörgetések sorrendje a nap dátumából), így összehasonlítható.
- Feltétel pl. „Locked: 3-5-2, Target: 86+ CHEM” vagy „csak 1980-as évek”.
- Egy próbálkozás naponta, eredmény megosztható (Wordle-szerű emoji-kártya: ⚽🟩🟨…).

### 2.6 Téma-draftok (S)
Ugyanaz a draft, szűkített pörgetéssel:
- **Egy klub legendái:** csak Milan (bármely évtized) → „Milan minden idők XI-e”.
- **Egy évtized:** csak 90-es évek.
- **Egy liga:** csak Bundesliga.
- **Honfitársak:** csak olaszok.
- **Budget / cap mód:** összesen max X rating-pont (pl. 850), vagyis nem lehet mindenki 95-ös → taktikázás.

### 2.7 Head-to-head két játékos között (M, backend kell)
- **Pass & play:** két ember felváltva draftol ugyanazon a telefonon, a végén meccs egymás ellen.
- **Online:** megosztható kód / link, a másik draftol, és a szerver lejátssza a meccset.
- Később: aszinkron liga barátokkal (mindenki draftol, körmérkőzés).

### 2.8 Karrier / Season mód (L)
- Több szezonon át viszed a csapatot: szezonok között 2–3 játékost cserélhetsz (új pörgetés), kiesés / feljutás, kupák.
- Hosszabb távú cél, ha a rövid módok beváltak.

---

## 3. Extra funkciók

### 3.1 Megtartás és motiváció
- **Mentés eszközön (S):** a rekordok, Hall of Fame most csak memóriában vannak – `expo-sqlite` vagy AsyncStorage kell, hogy az app újraindítás után is megmaradjanak. *Ezt csinálnám meg legelőször.*
- **Achievementek / trófeák (S–M):** „Első 38-0”, „100 chemistry”, „Dynasty 5 játékossal”, „Megverted a 88/89-es Milant”, „Egy csapat csak 60-as évekbeli játékosokkal”. A dizájnban már van trophy nyelvezet.
- **XP és szintek (M):** a dizájnban lévő „+1,200 XP”, „+100 XP DRAFT” jelvények – draft, győzelem, 38-0 ad XP-t; szintek kozmetikai jutalommal (mezszín, címer).
- **Statisztika oldal (S):** összes draft, győzelmi arány, legtöbbet draftolt játékos, kedvenc formáció.

### 3.2 Megosztás (S–M) – a virális növekedés kulcsa
- **Share kártya képként:** felállás a pályán + Overall + Chemistry + szezon-eredmény („38-0 🏆 Serie A 08/09”), `react-native-view-shot`-tal kép, natív share sheet.
- **Emoji-összefoglaló** szövegként (Wordle-stílus) a Daily Challenge-hez.
- **Link a csapathoz:** a megosztott link megnyitja ugyanazt a XI-t, a másik kipróbálhatja ellene.

### 3.3 Játékélmény a meccseken
- **Élő meccs-animáció (M):** a gólok percről percre jelennek meg (gyorsított óra 0→90'), pálya-mini-térkép, hazai közönség-hang (a DJ/producer háttér itt jól jöhet 🙂).
- **Meccs-statisztikák (M):** lövések, birtoklás, sárga lap – a modell λ-jából becsülve (nem valós, de hihető).
- **Man of the Match (S):** gólszerző vagy legmagasabb rating a győztes csapatban.
- **Taktika gomb (M):** a pálya-képernyő „tune” gombja – támadó / kiegyensúlyozott / védekező stílus, ami a modellben a saját és az ellenfél λ-ját tolja (több gól mindkét oldalon vs. kevesebb).
- **Sérülés / eltiltás a szezon-szimulációban (M):** véletlenszerűen kiesik egy játékos pár meccsre → a cserepad értelmet kap.

### 3.4 Keret
- **Cserepad (M):** 11 helyett 11 + 3–5 cserejátékos, a szezon-szimulációban rotáció.
- **Csapatkapitány (S):** kiválasztott játékos +1 chemistry a szomszédainak.
- **Játékos-adatlap (M):** koppintásra karrier (klubok, szezonok, gólok, rating-idősor), linkek a draftolt csapattársakhoz.
- **Mezszín és címer (S):** saját csapatnév, szín, emblémagenerátor – a „Your XI” helyett.

### 3.5 Explore / tartalom
- **Klub-lexikon (M):** minden klub évtizedenkénti legjobb XI-e (az adatból számolható), legnagyobb szezonjai.
- **„Ki volt jobb?” összehasonlító (S):** két játékos vagy két legendás csapat egymás mellett, akár szimulált meccs is.
- **Formációk (S):** a dizájn „Tactical Formations” kártyái valódi leírással, és „draft csak ezzel” gombbal.

### 3.6 Online (backend kell, L)
- Globális ranglista (a dizájnban „Global 38-0 Vault”): legjobb szezonok, leggyorsabb 38-0, napi challenge ranglista.
- Fiók (Apple / Google login) – csak akkor, ha már van online funkció.

---

## 4. Javasolt sorrend

| # | Funkció | Miért | Méret |
|---|---|---|---|
| 1 | Mentés eszközön | a rekordok / Hall of Fame most elvesznek | S |
| 2 | Share kártya | virális növekedés | S–M |
| 3 | Gauntlet (Survival) | új mód szinte csak a meglévő motorral | S–M |
| 4 | Daily Challenge | napi visszatérés, a dizájnban már kész a helye | M |
| 5 | Achievementek + XP | hosszú távú motiváció | M |
| 6 | Champions League | a legjobban várt, már bejelentett mód | M–L |
| 7 | Élő meccs-animáció + Man of the Match | a meccs izgalmasabb, mint egy statikus eredmény | M |
| 8 | Téma-draftok, cap mód | olcsó változatosság a meglévő draftra | S |
| 9 | Pass & play 1v1 | közösségi játék backend nélkül | M |
| 10 | World Cup, online, karrier | nagyobb, backend- vagy adatigényes lépések | L |
