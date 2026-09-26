# Football 82-0 – projekt kontextus

> Átadó dokumentum egy claude.ai-os kutató beszélgetésből (2026-09-25). A nyelv magyar, a technikai kifejezések angolul maradnak.

## A projekt

A virális NBA-s **82-0** (82-0.com) játék futballos változata.

**Az eredeti mechanika:**
- A játékos pörget egy random csapatot + évtizedet (pl. "1960s Warriors"), választ egy játékost abból a keretből, beteszi a kezdőcsapatába, ismétli.
- Csapatot és évtizedet egyszer lehet újrapörgetni.
- Minden évtizedből pontosan egy játékos kell (era diversity).
- A kész keretet egy szimulációs engine értékeli a játékos adott évtizedbeli csúcsformájának statisztikái alapján, és megmondja, hány meccset nyerne a szezonban.

**A futballos változat:**
- Top 5 európai liga: Premier League / korábbi First Division, La Liga, Serie A, Bundesliga, Ligue 1 (Division 1).
- Időtáv: az 1960-as évektől napjainkig.
- Cél: all-time kezdőcsapat, ami veretlenül megnyerné a bajnokságot.

## Stack (fejlesztő preferenciája)

TypeScript end-to-end: React Native frontend Expoval, NextJS backend, MongoDB. Deploy: Vercel.

## Kutatási eredmények – adatforrások

**Kulcsmegállapítás:** nincs egyetlen olyan adatbázis vagy API, ami mind az 5 ligát teljes kerettel lefedi az 1960-as évektől, szabad licenccel. Kombinálni kell.

### Történelmi keretek (1960–1988)

| Forrás | Lefedettség | Adat | Licenc |
|---|---|---|---|
| **worldfootball.net** | Mind az 5 liga, 60-as évekig | Keret, poszt, nemzetiség, születési dátum | ÁSZF: csak személyes, nem kereskedelmi használat engedély nélkül |
| **historical-lineups.com** | ENG First Div 1949–92, Serie A 1960–99, Bundesliga 1963–99, Primera División 1949–99, FRA 1949–89 (cél) | Meccsszám + gól szezononként, teljes keret; PDF player guide-ok | Hobbiprojekt, licenc nem tisztázott. **Work in progress**, Franciaországból jelenleg csak 1949–50 érhető el |
| **Francia szétszórt források** | pari-et-gagne.com (bajnokcsapat kerete), asse-stats.com (Saint-Étienne), fr.wikipedia szezonoldalak | Meccsszám + gól | Vegyes |

**Franciaország a leggyengébb pont** – nincs egységes forrás.

### Modern korszak

| Forrás | Lefedettség | Megjegyzés |
|---|---|---|
| **FBref** | Top 5 liga 1988–89-től | Részletes statok, csak weboldal |
| **Transfermarkt** | Modern korra gazdag, régi korszak hiányos | Scraping; kereskedelmi használat jogilag kockázatos (ÁSZF nincs részletesen ellenőrizve) |

### API-k

| API | Meddig vissza | Szerep |
|---|---|---|
| **API-Football** (api-sports) | ~2008-tól | Current + közelmúlt. `/players` végpont: profil + szezonstatok. Szezononként `coverage` objektum jelzi, mi érhető el. Van ingyenes szint. |
| **Sportmonks** | 2000-től, egyes ligáknál | Alternatíva, fizetős |
| **felipeall/transfermarkt-api** | Amennyire a Transfermarkt ismeri | Nem hivatalos, open source FastAPI (Python) scraping-wrapper. Current + teljes karrier egy hívással. Saját hostolás ajánlott (Docker). Csak fejlesztési adatgyűjtésre, nem élő függőségnek. |
| **ClubElo API** | 1939-től (1960 előtt provisional) | **Ingyenes CSV.** `api.clubelo.com/YYYY-MM-DD` = egy nap teljes rangsora, `api.clubelo.com/CLUBNAME` = egy klub teljes Elo-története. **A szimuláció erősségi alapja.** |
| **Wikidata SPARQL** | All-time | CC0 licenc (kereskedelmi is OK). Játékos–klub tagság kezdő/záró évvel, szezonstatok nélkül. **Lefedettség még nem tesztelve.** |

## Javasolt architektúra

1. **Statikus, saját történelmi adatbázis (MongoDB)** az 1960–2008 közötti csapat-évtizedekre. Egyszeri, kurált adatgyűjtés a fenti forrásokból + Wikidata. Saját adatbázis, nem scrape-elt másolat (jogilag tisztább: a nyers tények nem védettek, más adatbázis tömeges átvétele igen).
2. **API-Football** a 2008 utáni és aktuális szezonokra, cache-elve.
3. **ClubElo** mindkettőhöz, a szimuláció erősségi szorzójaként.

### Tervezési egyszerűsítés

Nem kell teljes keret. Az eredeti 82-0 is csak a csapat-évtized legjobb játékosait kínálja. Klubonként és évtizedenként a **top 8–15 játékos** elég.
Nagyságrend: 5 liga × ~20 klub × 7 évtized ≈ **700 csapat-évtized** – kurált adatbázisként összerakható.

### A szimuláció problémája

A 60-as, 70-es évekből játékosszinten jellemzően csak meccsszám és gól létezik, a modern korból részletes statok. Kell egy korszakfüggetlen erősségi modell. Ötlet: a játékos értékét a csapat adott szezonbeli ClubElo-ja, a játékos szerepe (meccsszám, gól) és a poszt kombinációjából számolni.

## Nyitott kérdések

- Franciaország 1960–1988 lefedettsége – honnan és milyen minőségben.
- Licenc: ha kereskedelmi lesz (reklám, app), engedély kell a worldfootball.net üzemeltetőjétől (HEIM:SPIEL Medien GmbH & Co. KG) és a historical-lineups szerzőjétől.
- Wikidata lefedettség a régi keretekre – mintalekérdezéssel ellenőrizni.
- A szimulációs engine erősségi modellje.
- Játékszabályok: hány poszt (11 vagy kevesebb), évtizedkényszer, formáció.

## Következő lépések

1. Adatmodell tervezése (Player, Club, ClubSeason / ClubDecade, EloSnapshot).
2. Script: ClubElo-ból a top 5 liga klubjainak szezonvégi Elo-értékei.
3. Wikidata SPARQL mintalekérdezés (pl. Bayern München, 1970-es évek) a lefedettség teszteléséhez.
4. Adatgyűjtési pipeline egy ligára (javaslat: Bundesliga, mert ott a legjobbak a források).

## Források

- historical-lineups.com – https://www.historical-lineups.com/
- Bundesliga Player Guide 1963–2023 (PDF) – https://www.historical-lineups.com/wp-content/uploads/2024/07/Bundesliga-Player-Guide-1963-2023.pdf
- worldfootball.net ÁSZF – https://www.worldfootball.net/terms/content_terms/
- FBref competitions – https://fbref.com/en/comps/
- ClubElo API – http://clubelo.com/API
- API-Football guide – https://www.api-football.com/news/post/how-to-get-started-with-api-football-the-complete-beginners-guide
- felipeall/transfermarkt-api – https://github.com/felipeall/transfermarkt-api
- Eredeti játék – https://www.82-0.com

## Frissítés (2026-09-25): játékos-import forrása – Transfermarkt

- A Transfermarkt klub-statisztika oldala (`/leistungsdaten/verein/<id>/reldata/<liga>%26<év>/plus/1`) klub-szezononként egy lekéréssel adja a teljes keretet: bajnoki meccs, gól, gólpassz, perc, poszt, nemzetiség, stabil játékos ID. Mind az 5 ligára ellenőrizve a 60-as évekig (GER 65/66, ITA 65/66, ESP 64/65, ENG 70/71 `EFD1`, FRA 61/62) – ez a francia lyukat is megoldja.
- Letöltés az Apify `apify/web-fetch` Actoron át (~$0.0015/oldal, teljes DB ≈ $10). Megvalósítás: `packages/pipeline` (`tm:clubs`, `tm:squads`, `coverage`).
- A historical-lineups.com kiesett: nincs meccs/gól összesítés (csak meccsenkénti felállás PDF-ben), Spanyolország és Franciaország hiányzik.
- **Licenc:** a Transfermarkt ÁSZF §11.1 tiltja az automatizált hozzáférést és kizárja a TDM-kivételt. Döntés: csak a privát fejlesztési adatbázishoz; publikus/kereskedelmi indulás előtt licenc vagy csere. Minden rekord `source` URL-t és `tmPlayerId`-t kap, így célzottan cserélhető.
