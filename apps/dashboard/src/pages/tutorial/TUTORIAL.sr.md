# Korisničko uputstvo

## 1. Uvod

Ovaj sistem za upravljanje proizvodnjom (Manufacturing Execution
System) povezuje menadžment kancelarije sa radnicima u proizvodnom
pogonu u realnom vremenu. Sastoji se iz dva dela koji funkcionišu
zajedno:

- **Kontrolna tabla (desktop):** za menadžere, koordinatore, prodajne
  timove i administraciju. Otvara se u web pretraživaču na računaru.
- **Tablet aplikacija (PWA):** za radnike u pogonu. Otvara se u
  pretraživaču na tabletu/telefonu i može se "instalirati" kao prava
  aplikacija (offline podrška, push obaveštenja).

Više firmi može da koristi isti sistem nezavisno jedna od druge
(multi-tenant) — svaka ima svoju izolovanu bazu podataka, korisnike i
podešavanja.

---

## 2. Početak rada

### 2.1 Prijava

| Aplikacija | URL |
|---|---|
| Kontrolna tabla | URL koji vam je dao administrator vaše firme |
| Tablet | URL tablet aplikacije koji vam je dao administrator |

Polja prilikom prijave:

- **Kod firme** — dobijate od administratora svoje firme.
- **Email**
- **Lozinka**

Posle uspešne prijave sistem automatski preusmerava na odgovarajuću
početnu stranicu (zavisi od uloge korisnika).

### 2.2 Uloge korisnika

| Uloga | Šta može |
|---|---|
| **Admin** | Administracija sopstvene firme: korisnici, procesi, kategorije, šifarnici. |
| **Manager** | Sve što ima Koordinator + administracija. |
| **Coordinator** | Kreiranje/aktiviranje narudžbina, praćenje proizvodnje, odobravanje zahteva. |
| **SalesManager** | Prodaja: kreira narudžbine, traži izmene, prati svoje narudžbine. |
| **Department** | Radnik u pogonu. Koristi samo tablet aplikaciju. |

### 2.3 Profil, jezik i tema

Klik na avatar u donjem levom uglu otvara profil:

- **Tema:** Svetla / Tamna.
- **Jezik:** Srpski / Engleski. Promena je trenutna; izbor se pamti.
- **Promena lozinke** — otvara panel sa desne strane. Unosi se trenutna
  lozinka, pa nova, pa potvrda nove. Posle čuvanja ostajete prijavljeni
  na trenutnoj sesiji, ali za sledeću prijavu (ili posle neaktivnosti)
  treba nova lozinka. Menja se samo sopstvena lozinka — administrator
  ne može menjati tuđu kroz ovaj panel; ako je korisnik zaboravio
  lozinku, koristi se „Resetuj lozinku" na njegovom redu u Korisnicima.
- **Odjava**.

Na javnim stranicama (prijava, *O aplikaciji*) jezik se može promeniti
i preko prekidača u gornjem desnom uglu.

---

## 3. Kontrolna tabla (Dashboard)

### 3.1 Glavne strane

Sidebar prikazuje samo one stavke koje uloga korisnika može da otvori.

- **Kontrolna tabla koordinatora** — pregled svih aktivnih narudžbina
  u realnom vremenu, radnici na mreži, statistika dana, kritični rokovi,
  zahtevi na čekanju. Detaljnije u 3.9.
- **Narudžbine** — lista svih narudžbina (master tabela), kreiranje
  novih, izmena postojećih.
- **Prodaja** — kontrolna tabla za prodajne menadžere (videti pregled
  svojih narudžbina i zahteva za izmenu).
- **Zahtevi za blokadu** — radnici prijavljuju probleme; menadžer
  odobrava ili odbija.
- **Zahtevi za izmenu** — prodaja traži izmene na postojećim
  narudžbinama; menadžer odobrava.
- **Vremena procesa** — izveštaji o trajanju procesa i radnim satima.
- **Administracija** — korisnici, procesi, kategorije proizvoda, tipovi
  narudžbina, specijalni zahtevi, smene.
- **Uputstvo** (ovaj dokument) — u footeru sidebar-a.

U levom donjem uglu su i:
- **Obaveštenja** (zvonce sa brojem nepročitanih) — videti 3.9.
- **Profil** — promena teme/jezika, odjava.

### 3.2 Kreiranje narudžbine

1. Otvori **Narudžbine** → **Kreiraj narudžbinu**.
2. Popuni osnovne podatke:
   - **Broj narudžbine** (jedinstven u okviru firme)
   - **Tip narudžbine** (Standardna, Reklamacija, ...)
   - **Prioritet** (manji broj = viši prioritet)
   - **Rok isporuke**
3. Opciono: napomena, prilagođeni dani upozorenja/kritičnosti, prilozi
   (PDF, slike).
4. **Dodaj stavku** za svaku stavku narudžbine:
   - **Kategorija proizvoda** — određuje listu procesa koji se primenjuju.
   - **Naziv proizvoda**
   - **Količina**
   - Opciono: napomena, prilozi po stavki.
5. **Sačuvaj**. Narudžbina je sada u statusu **Nacrt** — može se
   neograničeno menjati.
6. Kada je sve spremno: **Aktiviraj narudžbinu**. Od tog trenutka
   narudžbina ulazi u proizvodnju i pojavljuje se u redu čekanja
   radnika.

#### Ručni izbor procesa

Ako tip narudžbine ima uključen prekidač **Ručni izbor procesa**
(podešava se u *Administracija → Tipovi narudžbine*), prilikom
kreiranja se pojavljuje dodatna sekcija:

- **Multiselect** procesa — biraš procese koji se primenjuju.
- **Redosled** je redosled biranja u multiselect-u (možeš ukloniti i
  ponovo dodati ako želiš da promeniš redosled).
- **Kompleksnost po procesu** — opciono (Lako / Srednje / Teško).
- **Zavisi od** — za svaki proces možeš podesiti od kojih drugih
  procesa zavisi (depends on).

Sistem **ne dozvoljava kružne zavisnosti** — opcija koja bi stvorila
ciklus (npr. A zavisi od B, a B zavisi od A) biće zasivljena sa
napomenom "stvara kružnu zavisnost".

Ručno izabrani procesi **pregaze** procese iz kategorije proizvoda za
sve stavke u toj narudžbini.

### 3.3 Master tabela narudžbina

Glavni pregled svih narudžbina kao matrica:

- **Redovi:** narudžbine
- **Kolone:** procesi (A, B, C, ... — abeceda procesa iz šifarnika)
- **Ćelije:** mali kvadratić sa bojom koja označava agregirano stanje
  tog procesa za tu narudžbinu (preko svih njenih stavki).

Boje:

| Boja | Značenje |
|---|---|
| 🟢 zelena | Završeno |
| 🔵 plava | U toku |
| 🟠 narandžasta | Pauzirano / zaustavljeno |
| 🔴 crvena | Blokirano |
| ⚪ siva | Na čekanju |
| ⬜ bela | Proces nije primenjiv na ovu narudžbinu |
| 🟩 *debela zelena ivica* | Spreman za izvršavanje (sve zavisnosti su završene) |

**Filteri iznad tabele:**

- Pretraga po broju narudžbine
- Status (Nacrt, Aktivna, Pauzirana, Otkazana, Završena)
- Tip narudžbine
- Fakturisano (Da / Ne)
- Opseg datuma rok isporuke

**Izvoz:** dugme **Izvoz** → Excel ili CSV. U zaglavlju izvezenog
fajla pišu primenjeni filteri i vreme generisanja.

### 3.4 Detalji narudžbine (desni panel)

Klik na red u tabeli otvara desni panel sa svim detaljima narudžbine i
mogućnostima izmene.

#### Zaglavlje

- **Tip narudžbine** (obojeno) i **Status** (Nacrt / Aktivna /
  Pauzirana / Otkazana / Završena).
- **Broj narudžbine** — klik na olovku omogućuje inline izmenu i
  trenutno čuvanje (radi i za aktivnu narudžbinu).
- **Rok isporuke** — isto, klik na olovku → odaberi datum → čuva se
  odmah.
- **Prioritet** — direktno polje u zaglavlju; klik na **Sačuvaj** primeni
  izmenu (za aktivnu narudžbinu mora preko Zahteva za izmenu).
- **Završenost** — procenat završenih procesa.
- **Dani upozorenja / Kritični dani** — koliko dana pre roka isporuke
  narudžbina ulazi u "upozorenje" odnosno "kritično" stanje.

#### Tok procesa (Process Timeline)

Krugovi prikazuju agregirano stanje svakog procesa preko svih stavki
narudžbine:

- Boje iste kao u master tabeli.
- **Debela zelena ivica** = bar jedna stavka ima taj proces spreman za
  rad (sve zavisnosti za tu stavku su završene).
- Hover na krug → tooltip sa imenom procesa, statusom i ukupnim
  vremenom.

Ispod krugova nalazi se i **Legenda** (klikabilna) sa značenjima boja.

#### Stavke (Items)

Svaka stavka prikazana je kao kartica:

- **Naziv proizvoda**, **Kol. (količina)**, kategorija proizvoda.
- **Kvadratići procesa** — isti sistem boja, plus debela ivica kada je
  spreman za izvršavanje. Klik na završeni kvadratić omogućuje
  **Ponovno pokretanje procesa** (vidi dole).
- **Specijalni zahtevi** — labele se prikazuju pored stavke. Klik **+**
  → bira se tip specijalnog zahteva → on može da modifikuje listu
  procesa za tu stavku (dodaje, uklanja ili ograničava na samo
  navedene).
- **Kompleksnost** — padajući za svaki proces stavke (Lako / Srednje /
  Teško). Default dolazi iz kategorije proizvoda; može se prebrisati za
  konkretnu stavku.
- **Dokumenti** — prilozi vezani za tu stavku.

#### Manuelni procesi (samo za tipove sa uključenim ručnim izborom)

Ako narudžbina ima ručno izabrane procese, prikazuje se i sažeti
spisak tih procesa sa zavisnostima u zasebnoj kartici — samo za
pregled (ne menja se posle kreiranja).

#### Dokumenti narudžbine

Prilozi (PDF, slike) vezani za celu narudžbinu, nezavisno od stavki.

#### Napomena

Slobodno tekstualno polje.

#### Akcije u zaglavlju

- **Sačuvaj** — primeni sve nepročuvane izmene (kompleksnost,
  prioritet, specijalni zahtevi, napomena).
- **Aktiviraj narudžbinu** (kada je Nacrt).
- **Pauziraj** / **Nastavi** — privremeno zaustavlja sve procese
  narudžbine. Kada se nastavi, dolazi prompt sa izborom za svaki
  zaustavljeni proces:
  - **Zadrži vreme** — tajmer kreće od prethodnog trajanja.
  - **Resetuj vreme** — tajmer kreće od nule.
- **Otkaži narudžbinu** — narudžbina se vraća u status Otkazana. Iz
  Otkazane se može **Ponovo otvoriti** (vraća u Nacrt).
- **Dupliraj** — kreira novu narudžbinu na osnovu ove (kopira stavke,
  kategorije, kompleksnost). Nova ima status Nacrt.
- **Fakturisano** (kada je Završena) — toggle. Prikazuje se u filteru
  Fakturisano i u izvozu.

#### Ponovno pokretanje procesa

Klik na već završeni kvadratić procesa stavke otvara izbor:

- **Ponovo pokreni (zadrži vreme)** — proces ide u Pending, vreme
  ostaje sabrano.
- **Ponovo pokreni (resetuj vreme)** — proces ide u Pending, vreme se
  resetuje na 0.

Korisno kada se proces vraća na doradu.

### 3.5 Zahtevi za blokadu

Radnik kroz tablet aplikaciju prijavljuje da ne može da nastavi rad
(npr. nedostaje materijal, oštećen proizvod). Zahtev odmah pristiže u
dashboard sa zvonom obaveštenja.

#### Tok rada

1. Radnik klikne **Zahtev za blokadu** na tabletu i unese razlog →
   zahtev je u statusu **Na čekanju**.
2. Koordinator / Manager otvara **Zahtevi za blokadu** u sidebaru.
   Lista filtrira po statusu (Na čekanju / Odobreno / Odbijeno /
   Rešeno).
3. Klik na zahtev otvara detalje: koja narudžbina, koja stavka, koji
   proces, ko je tražio, kada, razlog.
4. **Odobri** — otvara formu sa obaveznim poljem **Odgovor** (npr.
   razlog blokade). Proces ulazi u status **Blokiran** (crveni
   kvadratić u tabeli). Tajmer staje.
5. **Odbij** — opciono polje **Napomena**. Radnik može nastaviti rad,
   proces se vraća u prethodno stanje.

#### Odblokiranje

Kada se rešenje stigne (npr. stigao materijal):

- Iz detalja narudžbine ili iz liste zahteva → **Odblokiraj**.
- Dolazi pitanje: **Zadrži vreme** ili **Resetuj vreme** (isto kao kod
  pauze narudžbine).
- Proces se vraća u Pending, dostupan je radnicima.

#### Brojač zahteva

U zaglavlju sidebar stavke **Zahtevi za blokadu** prikazuje se brojač
nepročitanih zahteva na čekanju, da koordinator vidi koliko ih ima.

### 3.6 Zahtevi za izmenu

Prodajni manager traži izmene na već aktiviranoj narudžbini:

- Izmena podataka (rok, prioritet, stavke)
- Povlačenje
- Otkazivanje
- Pauziranje / Nastavak
- Izmena prioriteta

Manager / Coordinator odobrava ili odbija. Ako se odobri, sistem
sprovodi traženu akciju.

### 3.7 Vremena procesa (izveštaji)

Stranica `Vremena procesa` sadrži šest tabova: **Vremena po procesu**,
**Praćenje vremena**, **Sati radnika**, **Blokade po procesu**,
**Trajanje izrade proizvoda** i **Efikasnost radnog vremena**. Svi
podaci se računaju na osnovu podataka u izabranom periodu.

#### Tab "Vremena po procesu"

Pregled statistike po procesu i kompleksnosti, plus tri grafikona.

**Tabela** — jedan red po procesu. Kolone:

- **Šifra** i **Proces** — kod i naziv procesa (npr. `A — Krojenje`)
- **Kategorija proizvoda** i **Tip narudžbine** — vrednost aktivnog
  filtera (ili "Sve" ako filter nije postavljen)
- Po kompleksnosti (Teško / Srednje / Lako) pet metrika:
  - **Prosek** — aritmetička sredina svih završenih vremena
  - **min** i **max** — najmanja i najveća vrednost *unutar μ±σ prozora*
    (vrednosti van prozora se odbacuju kao outlier-i — npr. zaboravljen
    proces od 48 sati neće pokvariti MAX)
  - **Realni prosek** — prosek vrednosti unutar μ±σ prozora (skraćeni
    prosek). Ovo je pošteniji broj kad postoje outlier-i.
  - **St. devijacija** — koliko su vrednosti rasute oko proseka

Grupe kolona Teško / Srednje / Lako su uokvirene boldiranim ramovima
radi lakšeg praćenja.

**Filteri** — datum (od/do), kategorija proizvoda (multi-select), tip
narudžbine (multi-select, koristi vašu konfiguraciju iz Admin → Tipovi
narudžbina). Promena imena tipa u Admin-u se vidi svuda nakon refresh-a.

**Tri grafikona ispod tabele:**

1. **Prosečno vreme po procesu** — gruba bar grafikon, jedan blok po
   procesu, tri stuba po kompleksnosti. Prikazuje **Realni prosek**
   po procesu i kompleksnosti.
2. **Trend prosečnog vremena po nedelji** — linijski grafikon kretanja
   Realnog proseka kroz period. Filteri: Proces, Kompleksnost, Granul
   (Nedelja / Mesec). Zelena zona pokazuje raspon MIN/MAX po periodu;
   crvena isprekidana linija je **Normativ (cilj) = 85% Realnog
   proseka za ceo izabrani period**. Grafikon ostaje prazan dok ne
   izaberete i Proces i Kompleksnost.
3. **Analiza kašnjenja i poštovanja rokova** — 100% stacked bar po
   nedelji ili mesecu. Zelena = % narudžbina završenih na vreme
   (`Završetak ≤ Rok isporuke`), crvena = % koje kasne. Filter po
   tipu narudžbine.

**Izvoz** — dugme `Izvezi` u gornjem desnom uglu. XLSX i CSV
podržani; sve aktivne filtere prati i izvoz.

#### Tab "Praćenje vremena"

Detaljan red-po-red pregled svih završenih procesa u izabranom
periodu, sa drill-down-om na pod-procese.

**Kolone:** Br. narudžbine, Kategorija proizvoda, Tip narudžbine,
Proces, Kompleksnost, Početak, Završetak, Trajanje (`h:mm:ss`),
Uključi (prekidač).

**Drill-down pod-procesa** — kod procesa koji imaju pod-procese,
strelica `+` levo od reda otvara pod-tabelu sa naziom i trajanjem
svakog pod-procesa. Vreme parent procesa = zbir vremena pod-procesa
(vreme između pod-procesa kad niko ne radi se *ne* uračunava).

**Filteri** — datum, broj narudžbine (pretraga), proces, kompleksnost,
kategorija proizvoda, tip narudžbine. Broj stavki po strani: 10 / 20 /
50 / 100.

**Uključi / Isključi prekidač** (kolona desno) — manualno isključite
red ako ne želite da se računa u statistike. Promena se **čuva u
bazi**: vidljiva svim korisnicima istog tenant-a, preživi refresh i
promenu uređaja. Isključeni redovi:
- ne ulaze u proračun na tabu **Vremena po procesu** (Prosek, min,
  max, Realni prosek, St. devijacija ih ignorišu)
- ne ulaze u grafikone (Trend, Analiza kašnjenja)
- ne ulaze u **izvoz** (XLSX/CSV)
- ostaju vidljivi u Praćenje vremena tabeli, ali su zatamnjeni —
  pošto bilo kada možete da ih vratite uključujući prekidač

Postoji i **bulk prekidač u zaglavlju kolone** — jedan klik uključi
ili isključi sve trenutno učitane stavke. Ikonica `?` pored objašnjava
funkcionalnost.

**Izvoz** — Izvezi u XLSX (dva sheet-a: glavni red-po-red + posebni
"Pod-procesi" sa linkom natrag na glavni preko `Br. narudžbine` +
`Šifra`) ili CSV (jedan fajl sa kolonom **"Tip reda"** koja razlikuje
`Proces` od `Pod-proces`). Trajanja se izvoze kao `h:mm:ss`, datumi
kao `DD.MM.YYYY HH:mm`. Isključeni redovi se preskaču.

#### Tab "Sati radnika"

Rad po radniku za izabran period — prikazuju se **samo proizvodni
radnici** (administratori i rukovodstvo se ne prikazuju). Kolone:

- **Radnik** — ime i prezime
- **Redovni sati** — radno vreme do trajanja smene
- **Prekovremeni** — radno vreme preko trajanja smene. U **ukupnom zbiru po
  radniku** sitni dnevni prelazi (≤30 min) se ne uračunavaju (npr. 10-ak min
  ranije ili kasnije ne ulaze u zbirne prekovremene sate), ali se prikazuju
  u dnevnom prikazu.
- **Ukupno** — ukupno prijavljeno radno vreme (zbir svih prijava u danu;
  zaboravljena odjava se automatski ograničava na trajanje smene +
  dozvoljeno prekovremeno)
- **Efektivno** — Ukupno minus propisana pauza (iz podešavanja smene)
- **Aktivno na procesima** — vreme koje je radnik stvarno radio na
  procesima (paralelan rad na više procesa se računa jednom)
- **Nepokriveno** — Efektivno minus Aktivno (vreme koje sistem ne vidi —
  npr. priprema, čišćenje, pomoć)
- **Efikasnost (%)** — Aktivno / Efektivno × 100 (obojeno)

Klik na strelicu ▸ otvara dnevni prikaz za tog radnika: Datum, Prijava,
Odjava, iste kolone po danu, i kolona **"Auto-odjava"** (DA ⚠ / Ne) koja
pokazuje dane u kojima je sistem automatski zatvorio sesiju (radnik nije
ručno odjavio se pre vremena za auto-odjavu — podešava se po smeni).

Filter po radniku, datum opseg. Izvoz u XLSX/CSV daje sve dnevne redove,
a zatim red "UKUPNO" po radniku.

#### Tab "Blokade po procesu"

Zbirni pregled svih zahteva za blokadu po procesu za izabran period.
Kolone: Proces, Podneto, Odobreno (odobrene + rešene), Rešeno, Odbijeno,
i **Prosečno trajanje** blokade u **radnim satima** — računaju se samo
aktivni sati smene, noć i vikend se ne uračunavaju. Blokade rešene u
potpunosti van radnog vremena (0 radnih sati) ne ulaze u prosek.

Dva grafikona: prosečno trajanje po procesu i broj podnetih / odobrenih /
odbijenih po procesu. Filter: datum opseg. Izvoz u XLSX/CSV.

#### Tab "Trajanje izrade proizvoda"

Za svaku završenu narudžbinu, jedan red po stavci, sa vremenom po procesu
i pauzom između procesa. **Vreme procesa je stvarno aktivno vreme rada
operatera** — ne ceo period od početka do kraja procesa. Pored toga:
najzastupljenija težina i zastupljenost težina po stavci.

Ispod tabele je tabela proseka (sa i bez vremena između procesa) i
grafikon. Filteri: datum, težina, kategorija proizvoda. Izvoz u XLSX/CSV.

#### Tab "Efikasnost radnog vremena"

Jedan red po radniku za izabran period (**samo proizvodni radnici**).
Kolone: Radnik, Prijavljeno (ukupno), Efektivno, Aktivno na procesima,
Nepokriveno, Efikasnost (%) i Status.

**Status** prema efikasnosti: ≥80% Odlično, 60–79% Prihvatljivo, 40–59%
Ispod norme, <40% Neprihvatljivo (boje: zeleno ≥80%, žuto 60–79%, crveno
<60%).

Dva grafikona: "Raspodela radnog vremena po radniku" (aktivno +
nepokriveno) i "Efikasnost po radniku (%)". Filter po radniku, datum
opseg. Izvoz u XLSX/CSV.

### 3.8 Administracija

Otvoreno za uloge Admin i Manager.

| Stranica | Sadržaj |
|---|---|
| **Korisnici** | CRUD korisnika; dodela uloga i procesa za koje su zaduženi. |
| **Procesi** | Proizvodne operacije (krojenje, CNC, brusenje...). Svaki može imati pod-procese. |
| **Kategorije proizvoda** | Kombinacije procesa sa zavisnostima tipičnim za tip proizvoda. |
| **Tipovi narudžbina** | Standardna, Reklamacija itd. Prekidač "Ručni izbor procesa". |
| **Tipovi specijalnih zahteva** | Modifikatori procesa po stavki (dodaj/ukloni/samo navedene). |
| **Smene** | Definisanje radnih smena. Podešavanja po smeni: pauza, max prekovremeno, **auto-odjava prekovremeno** (po sesiji), alarm pre odjave, i **auto-odjava redovan rad (h)** — vreme posle koga sistem automatski zatvara radnikovu sesiju (npr. 8.5h za smenu od 8h sa 30 min produžetka). |
| **Firma** | Podešavanja sopstvene firme i pregled pretplate, podeljeni u dva taba: **Podešavanja** (logo, rokovi narudžbina i boje upozorenja) i **Naplata** (pregled trenutne pretplate i istorija uplata). Logo se otprema klikom na „Otpremi logo" (ili „Zameni logo" ako već postoji), a klik na pregled otvara uvećani prikaz. U tabu Naplata gore vidite kartu sa datumom do kog je pretplata aktivna i koliko vam dana ostaje (zeleno ako je sve u redu, narandžasto ispod 14 dana, crveno ako je istekla). Ispod karte je tabela istorije uplata — datum uplate, trajanje pretplate, iznos, broj fakture i napomena. Sortirate kolone klikom na zaglavlje i filtrirate po godini. Uplate beleži tehnička podrška; ovde ih samo pregledate. Kada se pretplata bliži kraju (manje od 14 dana) ili je istekla, svako jutro stiže obaveštenje u zvoncetu Admin korisnicima firme — klikom se otvara direktno Naplata tab. |

### 3.9 Kontrolna tabla koordinatora

Početna stranica za koordinatora / menadžera. Sva polja se osvežavaju
preko WebSocket veze (SignalR) — bez ručnog refresh-a.

- **Statistika dana** — broj završenih narudžbina, aktivnih
  narudžbina, završenih procesa, prosečno vreme procesa, broj
  kritičnih upozorenja, zahtevi na čekanju.
- **Upozorenja o rokovima** — narudžbine koje su u zoni upozorenja
  (žuto) ili kritičnoj zoni (crveno). Klik vodi na narudžbinu.
- **Pregled uživo (Live View)** — po procesima: za svaki proces vidi
  koji radnik trenutno radi, koliko stavki je u redu, koliko je u
  toku. Klikabilne stavke vode na narudžbinu.
- **Radnici na mreži** — ko je trenutno prijavljen i na kom procesu.
- **Zahtevi na čekanju** — sažet pregled, klik vodi na **Zahtevi za
  blokadu** stranu.
- **Zahtevi za izmenu na čekanju** — isto, vodi na **Zahtevi za
  izmenu**.

### 3.10 Obaveštenja

Zvonce u donjem levom uglu pokazuje broj nepročitanih obaveštenja.
Klik otvara popover sa listom.

Vrste obaveštenja:
- Kreirana nova narudžbina (za koordinatore)
- Aktivirana narudžbina
- Proces blokiran / odblokiran
- Zahtev za blokadu kreiran / odobren / odbijen
- Zahtev za izmenu kreiran / obrađen
- Upozorenje o roku (žuto / kritično)
- Završena narudžbina

Akcije:
- Klik na obaveštenje vodi na povezanu narudžbinu/zahtev.
- **Obeleži kao pročitano / nepročitano** (oka ikonica).
- **Obriši** (kanta).
- **Označi sve kao pročitano** ili **Obriši sve**.

Push obaveštenja (browser i mobile) se podešavaju automatski kod prve
prijave (sistem traži dozvolu).

### 3.11 Magacin

Otvoreno za uloge Administrator, Menadžer, Koordinator i
**Magacioner**. Magacioner je posebna uloga koja se može dodeliti
nekom korisniku pored njegove glavne uloge (npr. koordinator + magacioner
istovremeno). Magacioner ima pristup svim stranicama Magacina i može da
unosi Ulaze i Izlaze, ali ne menja Listu materijala.

Magacin pokriva osnovnu evidenciju materijala — definisanje šta sve
ima u magacinu, kolika je trenutna količina, ko je šta primio, ko je
šta izdao, sa kojom cenom. Automatsko rezervisanje materijala po
narudžbenicama dolazi u kasnijoj fazi.

#### Materijali (Administracija → Materijali)

Lista svih materijala koji se vode u magacinu. Svaki materijal ima:

- **Kod** — jedinstveni identifikator (npr. `100`, `AL-1234`). Mora biti
  jedinstven u okviru firme.
- **Naziv** — opisni naziv (npr. „Profil AL 6 komora").
- **Jedinica mere (JM)** — kom, m, m2, kg…
- **Kategorija** — slobodan tekst za grupisanje (Profil, Lim, Staklo,
  Štok…). Koristi se kao filter na svim Magacin stranama.
- **Dimenzije X / Y / Z** — opcione, u milimetrima.
- **Min količina** — donja granica zaliha. Kad stanje padne ispod,
  pojavi se crveno upozorenje **⚠ ISPOD MIN**.
- **Max količina** — gornja granica. Kad stanje pređe, pojavi se
  upozorenje **PREKO MAX**. Mora biti ≥ Min (sistem to proverava).
- **Pozicija** — slobodan tekst za fizičko mesto u magacinu (npr.
  `R1-P3`).
- **Napomena** — slobodan tekst.

Akcije:
- **Novi materijal** (gore desno) otvara desni panel za unos. Dugme
  Sačuvaj je u zaglavlju panela, tako da je uvek vidljivo bez
  skrolovanja kroz polja.
- **Klik na red** otvara desni panel za izmenu, sa popunjenim poljima.
  U gornjem delu tela panela su **Dupliraj** (otvara Novi materijal
  sa kopiranim podacima, samo Kod ostaje prazan — korisno za seriju
  sličnih artikala) i **Deaktiviraj** / **Aktiviraj** — deaktiviran
  materijal nestaje sa Stanja i ne može da se izabere u Ulaz/Izlaz
  formama, ali postojeća istorija ostaje vidljiva.
- **Pretraga** po kodu ili nazivu, filter po kategoriji i statusu
  (aktivan / neaktivan), filter po datumu kreiranja.
- **Izvezi** (gore desno) — preuzima Excel sa trenutnim filterima.
- **Uvoz iz Excela** — Excel fajl sa zaglavljima _Kod, Naziv,
  Jedinica mere, Kategorija, Min, Max, Dimenzija X/Y/Z, Pozicija,
  Napomena_ se može uvesti masovno. Otvara se pregled gde su validni
  redovi obeleženi i prikazani sa svim poljima, a problematični
  (prazan Kod, već postoji kod, duplikat u istom fajlu, Max < Min)
  obojeni crvenim. Klik na **Uvezi (N)** kreira samo validne, a u
  rezimeu se vidi koliko je uvezeno i koji redovi nisu prošli sa
  razlogom.

#### Stanje magacina (Magacin → Stanje)

Tabela sa svim aktivnim materijalima i njihovim trenutnim količinama.
Kolone su sortabilne klikom na zaglavlje. Kod i Naziv ostaju zalepljeni
levo pri horizontalnom skrolovanju.

| Kolona | Sadržaj |
|---|---|
| Kod / Naziv | Iz Liste materijala. |
| Status | **⚠ ISPOD MIN** (crveno) / **U OKVIRU** (zeleno) / **PREKO MAX** (narandžasto). |
| Količina | Trenutno stanje (sve Ulaze minus svi Izlazi za taj materijal). |
| Min / Max | Iz Liste materijala. |
| Cena po JM | Cena iz poslednje Ulazne prijemnice. |
| Ukupna cena | Količina × Cena po JM. |
| Pozicija | Iz Liste materijala. |
| Dim X / Y / Z | Iz Liste materijala (u milimetrima). |
| Napomena | Iz Liste materijala. |

Sve kolone su sortabilne. Filteri iznad tabele: pretraga po
kodu/nazivu, kategorija, status zaliha. **Izvezi** preuzima Excel sa
trenutnim prikazom.

#### Ulaz materijala — prijemnica (Magacin → Ulaz)

Forma za prijem novih količina u magacin. Jedna prijemnica može da
sadrži više različitih materijala.

Polja u zaglavlju:
- **Broj prijemnice** — slobodan tekst (npr. `2026/043`).
- **Datum** — podrazumevano danas.

Stavke materijala (tabela ispod, **Dodaj stavku** za novi red,
**Novi materijal** za inline kreiranje):
- **Naziv** — bira se iz Liste materijala. Kucanje filtrira po kodu ili
  nazivu.
- **Količina** — obavezna, pozitivan broj.
- **Cena po JM** — obavezna na Ulazu. Postaje važeća cena tog
  materijala za sve naredne izlaze.
- **Napomena** — opciona, po stavci.
- Crveno dugme **kanta** uklanja stavku (disabled kad ima samo jedan
  red — mora postojati bar jedna stavka).

**Novi materijal** dugme pored **Dodaj stavku** otvara prozor sa svim
poljima materijala. Ako kod ne postoji u sistemu, može se kreirati
odmah u toku unosa prijemnice — sačuvani materijal se automatski
postavlja kao izabrana stavka u tabeli, pa korisnik samo unese
količinu i cenu.

**Sačuvaj prijemnicu** snima sve stavke odjednom. Nakon snimanja:
- Stanje se uvećava za unete količine.
- Status se preračunava (npr. iz **⚠ ISPOD MIN** u **U OKVIRU**).
- U Istoriji se pojavi po jedan red **Ulaz** za svaku stavku.

#### Izlaz materijala — po narudžbenici (Magacin → Izlaz)

Isto kao Ulaz, ali sa razlikama:
- **Broj narudžbenice** umesto Broja prijemnice — slobodan tekst
  referenca na MES narudžbinu (npr. `ORD-2026-006`).
- **Proces** — opciono polje u zaglavlju, bira se sa liste procesa.
  Ako je izabran, prikazuje se u Istoriji u koloni „Proces" za
  svaku stavku tog izlaza. Korisno kada se materijal izdaje na
  konkretan proces (npr. predkrojenje, plastifikacija).
- **Cena po JM** je **opciona**. Ako se ne unese, sistem automatski
  preuzima poslednju unesenu cenu za taj materijal sa prethodnih
  Ulaza. Ako materijal nikada nije imao Ulaz, traži cenu obavezno.
- Nema **Novi materijal** dugmeta — Izlaz pretpostavlja da materijal
  već postoji sa stanjem; novi materijali se uvode kroz Ulaz.
- Sistem proverava da li ima dovoljno na stanju. Ako se traži
  količina veća od trenutne, javlja grešku „Nedovoljno na stanju za
  'KOD — NAZIV': trenutno X JM, traženo Y JM." i ništa se ne snima.

Nakon snimanja:
- Stanje se umanjuje za unete količine.
- Status se ažurira.
- U Istoriji se pojavi po jedan red **Izlaz** za svaku stavku, sa
  negativnom količinom (npr. -4 kom).
- Ako je ovaj Izlaz prešao iz stanja iznad minimuma u stanje ispod
  minimuma, automatski se kreira obaveštenje **Materijal ispod
  minimuma** za sve menadžment uloge u firmi (vidi 3.10
  Obaveštenja i niže odeljak „Alarm za minimum zaliha").

#### Istorija transakcija (Magacin → Istorija)

Hronološki pregled svih Ulaza i Izlaza. Kolone su sortabilne.

Filteri iznad tabele:
- **Tip** — Ulaz / Izlaz.
- **Materijal** — sa svim Ulazima/Izlazima jednog materijala.
- **Kategorija** — kategorija materijala.
- **Broj prijemnice/narudžbenice** — pretraga po dokumentu.
- **Datumski opseg**.

Pored osnovnih, prikazane su i kolone **Proces** (iz Izlaza),
**Dim X / Y / Z** i **Napomena**.

**Izvezi** preuzima Excel sa svim redovima koji odgovaraju filteru
(do 10.000 redova), sa zaglavljem koje navodi koji su filteri bili
primenjeni.

#### Alarm za minimum zaliha

Kada se Izlazom materijal prevede iz stanja iznad minimuma u stanje
ispod minimuma, sistem automatski obaveštava menadžment:

- **Brojač na kontrolnoj tabli koordinatora** — kartica „Statistika"
  ima ćeliju **Materijali ispod min** koja pokazuje broj svih
  materijala koji su trenutno ispod svog minimuma. Crveni broj
  klikom vodi na Stanje magacina sa već primenjenim filterom „Ispod
  min".
- **Obaveštenje u zvoncetu** — svaki korisnik sa ulogom
  Administrator, Menadžer ili Koordinator (uključujući kombinacije sa
  Magacioner ulogom) dobija obaveštenje „**Materijal ispod
  minimuma: KOD — NAZIV**" sa detaljima trenutnog stanja, minimuma
  i jedinice mere. Tekst obaveštenja prati izabrani jezik aplikacije
  i ažurira se odmah kada se promeni jezik bez osvežavanja.
- **Bez ponavljanja** — ako se materijal već nalazi ispod minimuma,
  dodatni Izlazi neće generisati nova obaveštenja. Tek kada se
  stanje vrati iznad minimuma (Ulazom) pa ponovo padne ispod, šalje
  se sledeće.
- **Magacioner**, **Menadžer prodaje**, **Odeljenje** i ostale uloge
  van menadžment grupe ne primaju ova obaveštenja.

---

## 4. Tablet aplikacija

### 4.1 Instalacija

1. Otvori URL tablet aplikacije (koji vam je dao administrator) u
   Chrome (Android) ili Safari (iOS).
2. Meni pretraživača → **Add to Home screen** / **Dodaj na početni
   ekran**.
3. Ikona se pojavljuje na home screen-u. Aplikacija se ponaša kao
   native app (offline, push obaveštenja).

### 4.2 Prijava i check-in

1. Prijavi se istim podacima kao na desktopu (Kod firme + email +
   lozinka).
2. **Check-in** — bira se proces na kome ćeš danas raditi (npr.
   PRESOVANJE). Vide se samo procesi za koje si registrovan u sistemu.
3. Od trenutka check-in-a sistem prati vreme tvoje smene.

#### Auto-odjava i prekovremeni rad

Kada istekne dozvoljeno vreme rada (podešava se po smeni, npr. 8.5h),
tablet automatski zatvara sesiju i prikazuje ekran **"Automatski ste
odjavljeni"** sa dugmetom **"Prijavi se ponovo"**.

- Pritiskom na dugme vraćaš se na ekran za prijavu.
- Za **prekovremeni rad** prijavi se ponovo — sistem koristi posebno
  vreme do sledeće auto-odjave (npr. 2h po ulasku u prekovremeni).
- Pre auto-odjave, na vrhu tableta se pojavljuje **upozorenje** ("Vaša
  smena ističe za X min. Odjavite se.") nekoliko minuta ranije.
- Ako iz bilo kog razloga tablet bude isključen ili offline, sistem će
  ipak automatski zatvoriti sesiju kada se sledeći put obrati serveru —
  vreme odjave odgovara stvarnom isteku, ne trenutku kada je sistem
  primetio.

Koordinator vidi obaveštenje "Auto-odjava — Radnik X automatski je
odjavljen" čim se desi.

### 4.3 Red čekanja (Queue)

Lista stavki spremnih za rad, sortiranih po **prioritetu** (manji broj
= viši prioritet) i **roku isporuke**:

- Broj narudžbine, naziv proizvoda, količina
- Specijalni zahtevi (ako postoje)
- Tap → otvara se ekran za rad.

### 4.4 Aktivan rad (Active Work)

Ekran prikazuje sve podatke potrebne radniku da uradi posao na jednoj
stavki. Otvara se kada se na queue ekranu klikne na neku stavku i
proces se startuje.

#### Zaglavlje stavke

- **Broj narudžbine**, **naziv proizvoda**, **količina**.
- **Kategorija proizvoda**.
- **Prioritet** i **rok isporuke** (crveno ako su blizu / prešli rok).
- **Specijalni zahtevi** (labele) — ako su pripadajući stavki.
- **Napomena narudžbine** i **napomena stavke** (ako postoje).
- **Završenost** — koliko od ukupnih procesa na stavki je već gotovo.

#### Tajmer (proces bez pod-procesa)

- **Veliki tajmer** počinje da broji od trenutka **Start** klika.
- **Pauziraj** — tajmer staje. Korisno za pauzu, ručak, prekid.
- **Nastavi** — tajmer kreće dalje, ukupno vreme je zbir svih perioda.
- Vreme se kontinuirano prikazuje (sat:minut:sekunda).

#### Pod-procesi (sub-processes)

Ako proces ima definisane pod-procese u administraciji (npr.
SAMONOSEĆI / PISMO / KOMPLET kao podkategorije procesa MONTAŽA), oni
se prikazuju kao zasebne kartice:

- Svaki pod-proces ima svoj tajmer.
- Pod-procesi se rade redom (sledeći postaje aktivan tek kada se
  prethodni završi).
- Klik na **Start** pokreće trenutno aktivni pod-proces.
- **Pauziraj** / **Nastavi** rade nad aktivnim pod-procesom.
- **Završi** zatvori aktivni pod-proces i otvori sledeći. Kada se i
  poslednji završi → ceo proces je gotov.
- Ukupno vreme procesa = zbir vremena svih pod-procesa.

#### Akcije

- **Pauziraj / Nastavi** — kao gore.
- **Zahtev za blokadu** — kliknite, unesite razlog, pošaljite. Proces
  ulazi u red zahteva u dashboard-u, vaš tajmer staje dok se ne reši.
- **Završi proces** — kada je sav rad gotov. Sledeći proces (po
  zavisnostima u kategoriji ili u ručnoj listi) postaje **Spreman** i
  pojavljuje se kod radnika koji je za njega registrovan.

#### Šta se dešava paralelno

- Ako koordinator iz dashboard-a klikne **Pauziraj narudžbinu**, tvoj
  tajmer se zaustavlja i ekran prikazuje da je narudžbina pauzirana.
- Ako koordinator odobri zahtev za blokadu na drugom procesu, to ne
  utiče direktno na tvoj rad, samo ako je tvoj proces povezan
  zavisnostima.
- Ako u međuvremenu stigne push obaveštenje, tablet ga prikaže.

### 4.5 Dolazeće narudžbine (Incoming)

Pokazuje narudžbine koje će **uskoro biti spremne** za tebe — proces
od kog ti zavisiš još traje. Korisno za pripremu.

### 4.6 Zahtev za blokadu

1. Klik **Zahtev za blokadu** u Active Work ekranu.
2. Upiši razlog (npr. "nema lima u boji 7016").
3. Pošalji. Proces se zaustavlja; čeka odluku iz dashboarda.

### 4.7 Odjava (Checkout)

Na kraju smene → **Odjavi se**. Sistem zapisuje radne sate koji se
pojavljuju u izveštaju *Sati rada radnika*.

---

## 5. Komplet primer

Tipičan tok narudžbine od kreiranja do završetka:

1. **Prodajni menadžer** kreira narudžbinu "Pivot vrata" za firmu X
   sa 2 stavke, dodaje skicu kao prilog. Status: Nacrt.
2. **Koordinator** dodatno proverava narudžbinu, postavlja prioritet
   30, klikne **Aktiviraj**. Status: Aktivna.
3. Stavke se pojavljuju u redu čekanja prvog procesa — npr. KROJENJE.
4. **Radnik A** koji je danas na KROJENJU vidi narudžbinu u svom
   tablet redu čekanja. Tap → Start. Tajmer kreće.
5. Posle 1h Radnik A klikne **Završi proces**. KROJENJE je sada
   Završen → sledeći proces (npr. CNC OBRADA) je sada **spreman**.
6. **Radnik B** koji je na CNC-u vidi narudžbinu u svom redu, kreće
   sa radom.
7. ... i tako redom kroz sve procese po zavisnostima koje su definisane
   u kategoriji proizvoda (ili u ručnom spisku, ako je ručni izbor
   uključen).
8. Kada je poslednji proces završen, narudžbina automatski prelazi u
   status **Završena**.
9. Menadžer (kada dobije fakturu) može označiti narudžbinu kao
   **Fakturisano**, što je vidljivo u filteru i u izveštajima.

Tokom celog procesa kontrolna tabla koordinatora i master tabela
osvežavaju se **u realnom vremenu** — ne treba ručno osvežavanje
stranice.

---

## 6. Pitanja i odgovori

**Šta ako narudžbina mora privremeno da se prekine?**
Koordinator / Manager → **Pauziraj narudžbinu**. Svi trenutni procesi
se pauziraju i tajmeri staju. Kasnije: **Nastavi** vrati narudžbinu u
rad.

**Šta ako se napravi greška pri kreiranju narudžbine?**
Dok je u statusu **Nacrt** može se neograničeno menjati. Kada je
narudžbina aktivirana, prodaja podnosi **Zahtev za izmenu** koji
manager odobrava. Otkazivanje vraća narudžbinu u Nacrt, posle čega se
može ponovo izmeniti.

**Mogu li dva radnika da rade isti proces na istoj narudžbini?**
Sistem ne sprečava paralelan rad — ako su oba prijavljena na isti
proces, oba vide narudžbinu u redu. Faktički paralelizam zavisi od
prirode procesa (često nema smisla).

**Kako koordinator vidi šta se trenutno dešava u proizvodnji?**
**Kontrolna tabla koordinatora** prikazuje sve aktivne procese,
radnike na mreži, kritične rokove i zahteve na čekanju. Sve se
osvežava preko WebSocket veze (SignalR) bez potrebe da se ručno
osvežava stranica.

**Funkcioniše li tablet bez interneta?**
Tablet aplikacija je PWA — kešira poslednje stanje i može se otvoriti
offline. Akcije koje su urađene offline sinhronizuju se kada se
internet vrati.

**Kako se rešava brza promena prioriteta?**
Kroz **Zahtev za izmenu → Izmena prioriteta**, ili direktno iz
detalja narudžbine ako manager ima ovlašćenja.

**Kako se prati profitabilnost / utrošeno vreme?**
Izveštaji **Vremena procesa** daju prosečna vremena po procesu i
kategoriji proizvoda + sate rada po radniku. Excel izvoz se može dalje
obraditi.

**Da li sistem podržava više jezika?**
Da — srpski i engleski. Jezik se bira u profilu ili na javnim
stranicama u gornjem desnom uglu. Na prvi dolazak jezik se određuje
prema podešavanju pretraživača posetioca.

---

*Za sva pitanja i komentare obratite se administratoru vaše firme.*
