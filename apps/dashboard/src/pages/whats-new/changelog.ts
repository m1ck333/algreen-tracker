/**
 * Source of truth for the in-app "Šta je novo" page. User-facing — keep
 * the language concrete and focused on what users can SEE / DO
 * differently after the change. Skip BE-only / dev-facing churn (those
 * belong in repo-root CHANGELOG.md).
 *
 * NO PROGRAMMER JARGON in LocaleText values. Sale/Bojan and friends
 * don't know what these words mean and shouldn't have to look them up:
 *   ❌ BE / FE / API / endpoint / token / JWT / refresh token
 *   ❌ tenant (use "firma" / "company")
 *   ❌ N+1 / query / cache / database / table / column
 *   ❌ wall-clock / timestamp / ISO / UUID
 *   ❌ μ / σ / sigma / outlier (use "ekstremne vrednosti" / "ekstremne vrijednosti" / plain prose)
 *   ❌ CreatedAt / UpdatedAt / column-style names
 *   ❌ audit trail (use "istorija izmena" / "change history")
 *   ❌ Sentry / monitoring service names — say "tehnička podrška" / "administrators"
 *   ❌ Sub-process is OK because it's how the table labels them; "pod-proces" is user-facing.
 * If you catch yourself typing one, rewrite the sentence in plain
 * business language. Rule of thumb: "would Sale or Bojan say this in
 * a meeting?" If no, rephrase.
 *
 * NEVER mention internal brand names (algreen / alblue / easy-mes /
 * etc.) in the user-visible text fields. The MES product is white-
 * labeled; the in-app changelog must read as if it belongs to whoever
 * is looking at it.
 *
 * Entries are newest-first. The page shows the first 5 expanded by
 * default; the rest are behind a "Stariji unosi" toggle. No automatic
 * "unread" tracking yet — add localStorage-based badge later if needed.
 *
 * To add an entry: prepend to the array. Write both sr + en — Serbian
 * is the production language, English keeps parity for other tenants
 * and for screenshots / docs.
 */

export type LocaleText = { sr: string; en: string };

export interface ChangelogEntry {
  /** Stable id for React keys + future read-tracking. Use the date + slug. */
  id: string;
  /** ISO date "YYYY-MM-DD". Page formats to DD.MM.YYYY. */
  date: string;
  title: LocaleText;
  bullets: LocaleText[];
}

export const changelog: ChangelogEntry[] = [
  {
    id: '2026-06-18-firma-naplata',
    date: '2026-06-18',
    title: {
      sr: 'Firma — pregled pretplate i istorija uplata',
      en: 'Company — subscription overview and payment history',
    },
    bullets: [
      {
        sr: 'Stranica „Firma" je sad podeljena na dva taba: „Podešavanja" (logo i rokovi narudžbina) i „Naplata" (pregled pretplate). U tabu „Naplata" odmah vidite do kada vam je pretplata aktivna i koliko dana je ostalo — više ne morate da računate sami sabirajući mesece iz pojedinačnih uplata.',
        en: 'The "Company" page is now split into two tabs: "Settings" (logo and order deadlines) and "Billing" (subscription overview). The Billing tab shows at a glance how long your subscription is active and how many days remain — no more manual math across stacked payments.',
      },
      {
        sr: 'Ispod pregleda je tabela istorije uplata sa kolonama: Datum uplate, Trajanje, Iznos, Faktura i Napomena. Možete sortirati po svakoj koloni i filtrirati po godini. Sve uplate su samo za čitanje — beleži ih tehnička podrška, a vi ovde proveravate da li je vaša poslednja uplata zavedena.',
        en: 'Below the overview is the payment history table with columns: Payment date, Duration, Amount, Invoice number and Notes. Sortable by each column and filterable by year. Entries are read-only — support records them; this tab lets you confirm your last payment is on file.',
      },
      {
        sr: 'Kada se pretplata bliži kraju (manje od 14 dana) ili je istekla, svako jutro vam stiže obaveštenje u zvoncetu (gore-levo u sidebaru). Klikom na obaveštenje otvarate Firma → Naplata tab — ne morate sami da pratite datume, sistem vas podseća.',
        en: 'When the subscription is close to expiring (under 14 days) or has lapsed, you receive a morning notification in the bell (bottom-left of the sidebar). Clicking the notification opens Company → Billing — no need to track dates yourself, the system reminds you.',
      },
    ],
  },
  {
    id: '2026-06-16-change-password',
    date: '2026-06-16',
    title: {
      sr: 'Promena sopstvene lozinke',
      en: 'Self-service password change',
    },
    bullets: [
      {
        sr: 'U profilu (klik na ime u donjem levom uglu) je dodato dugme „Promeni lozinku". Otvara panel sa desne strane sa tri polja: trenutna lozinka, nova, potvrda nove. Posle čuvanja ostajete prijavljeni na trenutnoj sesiji, ali sledeća prijava traži novu lozinku.',
        en: 'A "Change password" button has been added in the profile (click your name in the bottom-left corner). It opens a side panel with three fields: current password, new password, confirm new password. After saving, you stay signed in on the current session, but the next sign-in requires the new password.',
      },
      {
        sr: 'Svako menja samo svoju lozinku. Ako je neko zaboravio lozinku, administrator je resetuje na njegovom redu u listi Korisnika (akcija „Resetuj lozinku") — bez potrebe za starom lozinkom.',
        en: 'Each user can only change their own password. If someone has forgotten theirs, an admin resets it from their row in the Users list (action "Reset password") — no current password required.',
      },
    ],
  },
  {
    id: '2026-06-15-firma-logo',
    date: '2026-06-15',
    title: {
      sr: 'Firma — logo i objedinjene stranice',
      en: 'Company — logo upload and unified pages',
    },
    bullets: [
      {
        sr: 'Nova sidebar stavka „Firma" objedinjuje sve što se ranije zvalo „Profil firme" — podešavanja firme su sad na jednom mestu, jedan klik manje u meniju.',
        en: 'New sidebar item "Company" unifies what used to be "Company profile" — every firm-level setting is in one place, one fewer click in the menu.',
      },
      {
        sr: 'Nova sekcija „Logo firme" na stranici Firma — Admin može da otpremi logo (PNG, JPG ili SVG, do 2 MB). Otpremljeni logo se odmah prikazuje gore-levo u sidebaru kao zaglavlje aplikacije, umesto podrazumevanog. Slika se automatski smanjuje na razumnu veličinu, kliknom na pregled otvara se uvećani prikaz, a postoji i dugme „Ukloni logo".',
        en: 'New "Company logo" section on the Company page — Admin can upload a logo (PNG, JPG, or SVG, up to 2 MB). The uploaded logo immediately replaces the default mark at the top of the sidebar. The image is auto-compressed to a sensible size, clicking the preview opens a larger view, and there\'s a "Remove logo" button.',
      },
      {
        sr: 'Stranica Firma prikazuje pune vrednosti odmah po otvaranju (rokovi narudžbina, boje upozorenja) — više nema kratkog praznog stanja dok se podaci učitavaju.',
        en: 'The Company page shows full values immediately on open (order deadlines, warning colors) — no more brief empty state while data loads.',
      },
      {
        sr: 'Sitno: na listi firmi i u formama svuda gde je pisalo „Šifra" stoji „Kod" — „šifra" se u srpskom često meša sa lozinkom, „kod" je jasniji izraz.',
        en: 'Minor: across the Tenants list and forms, "Šifra" was renamed to "Kod" (Serbian for "code") — "šifra" was easily confused with "password".',
      },
    ],
  },
  {
    id: '2026-06-10-magacin-finishing-touches',
    date: '2026-06-10',
    title: {
      sr: 'Magacin — dorade i alarmi (po potvrdama)',
      en: 'Warehouse — finishing touches and alarms (per confirmations)',
    },
    bullets: [
      {
        sr: 'Stanje i Istorija sada prikazuju dimenzije materijala (Dim X, Dim Y, Dim Z) i Napomenu kao zasebne kolone — vidljive su sve karakteristike stavke iz Liste materijala bez otvaranja detalja.',
        en: 'Stock and History now expose Dim X, Dim Y, Dim Z, and Notes as standalone columns — every attribute from the Materials list is visible without opening details.',
      },
      {
        sr: 'Materijali (Administracija → Materijali): novo dugme „Dupliraj" u panelu materijala — otvara Novi materijal sa kopiranim podacima i praznim poljem Kod, što ubrzava unos serije sličnih artikala (npr. različite varijante istog profila).',
        en: 'Materials (Administration → Materials): a new "Duplicate" button in the material panel — opens New material with the data pre-filled and an empty Code, which speeds up entering series of near-identical items (e.g. variants of the same profile).',
      },
      {
        sr: 'Materijali (Administracija → Materijali): novo dugme „Uvoz iz Excela" — Excel sa zaglavljima Kod, Naziv, Jedinica mere, Kategorija, Min, Max, Dimenzija X/Y/Z, Pozicija, Napomena se može uvesti masovno. Pregled pre uvoza pokazuje koji su redovi validni, a koji imaju greške (prazan Kod, već postoji, duplikat u istom fajlu, Max ispod Min) — uvozi se samo ono što je ispravno, a rezime navodi koji su redovi propali sa razlogom.',
        en: 'Materials (Administration → Materials): a new "Import from Excel" button — bulk-import an .xlsx file with headers Code, Name, Unit, Category, Min, Max, Dim X/Y/Z, Location, Notes. The preview before import shows which rows are valid and which have errors (empty Code, already exists, duplicate in the same file, Max below Min) — only the valid ones get created, and the summary lists the failing rows with reasons.',
      },
      {
        sr: 'Ulaz materijala: u formi sada postoji dugme „Novi materijal" pored „Dodaj stavku" — ako materijal sa traženim kodom još ne postoji u sistemu, može se kreirati u toku unosa prijemnice. Sačuvani materijal se automatski dodaje kao izabrana stavka, pa korisnik samo unese količinu i cenu.',
        en: 'Receipt form: a "New material" button now sits next to "Add line" — if the code being entered doesn\'t exist in the system yet, the material can be created right inside the receipt. Once saved it becomes a pre-selected line, so the operator only fills in the quantity and price.',
      },
      {
        sr: 'Izlaz materijala: novo opciono polje „Proces" u zaglavlju — bira se sa liste procesa i pojavljuje se u Istoriji u koloni Proces za sve stavke tog izlaza. Korisno kada se materijal izdaje na konkretan proces (predkrojenje, plastifikacija itd.).',
        en: 'Issue form: a new optional "Process" field in the header — pick from the active process list, and it surfaces in History under the Process column for every line of the issue. Handy when material is being released to a specific production process (pre-cut, powder coating, etc.).',
      },
      {
        sr: 'Izlaz materijala: ako se traži veća količina nego što je na stanju, sistem odbija unos sa porukom „Nedovoljno na stanju za KOD — NAZIV: trenutno X JM, traženo Y JM" — stanje se ne može spustiti ispod nule.',
        en: 'Issue form: if the requested quantity exceeds the on-hand amount, the system rejects the entry with "Insufficient stock for CODE — NAME: currently X UoM, requested Y UoM" — stock cannot go below zero.',
      },
      {
        sr: 'Alarm za minimum zaliha (po potvrdi Saše): kada Izlaz prevede materijal iz stanja iznad minimuma u stanje ispod minimuma, na kontrolnoj tabli koordinatora pojavi se brojač „Materijali ispod min" (crveni broj klikom vodi na Stanje sa filterom „Ispod min"), a u zvoncetu se kreira obaveštenje „Materijal ispod minimuma: KOD — NAZIV" za sve menadžment uloge (Administrator, Menadžer, Koordinator). Ako je materijal već bio ispod min, dodatni Izlazi ne stvaraju nove notifikacije — tek kad se vrati iznad min i ponovo padne ispod.',
        en: 'Low-stock alarm (per Saša\'s confirmation): when an Issue brings a material from at-or-above min down to below min, the coordinator dashboard shows a "Materials below min" counter (the red number is clickable and navigates to Stock filtered to "Below min"), and a "Material below minimum: CODE — NAME" notification is created in the bell for every management user (Administrator, Manager, Coordinator). If the material was already below min, follow-up Issues don\'t create extra notifications — a new one fires only after the stock is restored above min and crosses back below.',
      },
      {
        sr: 'Obaveštenja prate jezik aplikacije: tekst „Materijal ispod minimuma…" se odmah prepravlja kada se jezik promeni u profilu, bez osvežavanja stranice.',
        en: 'Notifications follow the app language: the "Material below minimum…" text updates immediately when the language is switched in the profile, with no page reload.',
      },
      {
        sr: 'Uloga „Magacioner" se može kombinovati sa drugim ulogama (npr. korisnik može biti i Koordinator i Magacioner) — sve uloge se računaju zajedno kod provere prava pristupa.',
        en: 'The Warehouse worker role can be combined with other roles (e.g. a user can be both Coordinator and Warehouse worker) — all assigned roles are considered together for access checks.',
      },
      {
        sr: 'Detaljno: pogledati ažuriranu sekciju 3.11 Magacin u Uputstvu.',
        en: 'Full walkthrough: see the updated section 3.11 Warehouse in the Tutorial.',
      },
    ],
  },
  {
    id: '2026-06-09-magacin',
    date: '2026-06-09',
    title: {
      sr: 'Magacin — evidencija materijala, prijemnica i izdavanja',
      en: 'Warehouse — material catalog, receipts, and issues',
    },
    bullets: [
      {
        sr: 'Nova grupa u meniju "Magacin" sa stranicama Stanje, Ulaz, Izlaz i Istorija transakcija.',
        en: 'New "Warehouse" menu group with Stock, Inflow, Outflow, and Transaction History pages.',
      },
      {
        sr: 'Administracija → Materijali: lista svih materijala koji se vode u magacinu. Svaki materijal ima jedinstven kod, naziv, jedinicu mere, kategoriju, opcione dimenzije, min/max količinu, poziciju i napomenu. Pretraga po kodu/nazivu, filter po kategoriji i statusu, izvoz u Excel.',
        en: 'Administration → Materials: catalog of every material tracked in the warehouse. Each one has a unique code, name, unit of measure, category, optional dimensions, min/max quantity, location, and notes. Search by code/name, filter by category and status, Excel export.',
      },
      {
        sr: 'Magacin → Stanje: trenutne količine po materijalu, status zaliha (⚠ ISPOD MIN / U OKVIRU / PREKO MAX), poslednja unesena cena, ukupna vrednost. Sve kolone su sortabilne, kod i naziv ostaju zalepljeni levo pri skrolovanju.',
        en: 'Warehouse → Stock: per-material on-hand quantity, stock status (⚠ BELOW MIN / OK / ABOVE MAX), latest unit price, total value. All columns sortable, code and name stay pinned left when scrolling.',
      },
      {
        sr: 'Magacin → Ulaz (prijemnica): jedan dokument može sadržati više različitih materijala. Cena po jedinici mere je obavezna na Ulazu i postaje važeća cena tog materijala za buduće Izlaze.',
        en: 'Warehouse → Inflow (receipt): one document can hold multiple materials. Unit price is required and becomes the active price of that material for any later Outflow.',
      },
      {
        sr: 'Magacin → Izlaz (po narudžbenici): isto kao Ulaz, ali Cena po JM je opciona — sistem automatski preuzima poslednju unesenu cenu. Ako se traži više nego što ima na stanju, izdavanje se odbija sa porukom "Nedovoljno na stanju za KOD — NAZIV: trenutno X JM, traženo Y JM".',
        en: 'Warehouse → Outflow (by order number): same as Inflow, but unit price is optional — the system reuses the latest known price. If the requested quantity exceeds on-hand, the issue is rejected with "Insufficient stock for CODE — NAME: currently X UoM, requested Y UoM".',
      },
      {
        sr: 'Magacin → Istorija transakcija: pregled svih Ulaza i Izlaza sa filterima (tip, materijal, kategorija, broj prijemnice/narudžbenice, datumski opseg). Kolone sortabilne, izvoz u Excel.',
        en: 'Warehouse → Transaction History: every Inflow / Outflow with filters (type, material, category, receipt/order number, date range). Sortable columns, Excel export.',
      },
      {
        sr: 'Nova uloga "Magacioner" — može se dodeliti korisniku pored postojeće uloge (npr. koordinator + magacioner istovremeno). Magacioner ima pristup svim Magacin stranicama i može da unosi Ulaze i Izlaze, ali ne menja Listu materijala.',
        en: 'New "Warehouse worker" role — can be assigned alongside an existing role (e.g. coordinator + warehouse worker at once). The warehouse worker has access to every warehouse page and can record receipts and issues, but cannot edit the Materials list.',
      },
      {
        sr: 'Detaljno uputstvo: pogledati novu sekciju 3.11 Magacin u Uputstvu.',
        en: 'Full walkthrough: see the new section 3.11 Warehouse in the Tutorial.',
      },
    ],
  },
  {
    id: '2026-06-02-auto-logout',
    date: '2026-06-02',
    title: {
      sr: 'Automatska odjava radnika + obaveštenje koordinatoru',
      en: 'Automatic worker auto-logout + coordinator notification',
    },
    bullets: [
      {
        sr: 'Smene (Admin → Smene) imaju novo podešavanje "Auto-odjava redovan rad (h)" — vreme nakon koga se radnikova sesija automatski zatvara (npr. 8.5h za smenu 8h sa 30 min produžetka).',
        en: 'Shifts (Admin → Shifts) have a new setting "Auto-logout regular (h)" — the time after which a worker\'s session is automatically closed (e.g. 8.5h for an 8h shift with 30 min grace).',
      },
      {
        sr: 'Tablet: kada vreme istekne, sesija se automatski zatvara i prikazuje se ekran "Automatski ste odjavljeni" sa dugmetom za ponovnu prijavu (za prekovremeni rad).',
        en: 'Tablet: when the time expires, the session is automatically closed and a "You have been auto-logged-out" screen appears with a re-login button (for overtime work).',
      },
      {
        sr: 'Prekovremeni rad: ponovna prijava nakon auto-odjave koristi posebno vreme (npr. 2h po sesiji) umesto regularnog ograničenja.',
        en: 'Overtime: re-login after auto-logout uses a separate limit (e.g. 2h per session) instead of the regular cap.',
      },
      {
        sr: 'Ako tablet bude isključen ili offline, sistem će na sledeći upit ipak automatski zatvoriti zaboravljenu sesiju, sa pravim vremenom isteka.',
        en: 'If the tablet goes offline, the system still auto-closes the forgotten session on the next request, using the actual expiry time.',
      },
      {
        sr: 'Sati radnika: nova kolona "Auto-odjava" u dnevnom prikazu (DA ⚠ / Ne) — pokazuje dane u kojima je auto-odjava primenjena.',
        en: 'Worker Hours: new "Auto-logout" column in the daily view (YES ⚠ / No) — shows the days when auto-logout was applied.',
      },
      {
        sr: 'Ukupni prekovremeni rad po radniku više ne uračunava sitne dnevne prelaze (≤30 min) — kako se "10-ak min ranije ili kasnije" ne bi tretiralo kao prekovremeno.',
        en: 'Per-worker total overtime no longer counts tiny daily overruns (≤30 min) — so "10-ish min earlier or later" isn\'t treated as overtime.',
      },
      {
        sr: 'Koordinator/menadžer/administrator dobija obaveštenje "Auto-odjava — Radnik X automatski je odjavljen" čim se auto-odjava aktivira (vidljivo u listi obaveštenja).',
        en: 'Coordinator/manager/administrator receives an "Auto-logout — Worker X has been auto-logged-out" notification as soon as auto-logout fires (visible in the notification list).',
      },
    ],
  },
  {
    id: '2026-05-29-reports-refinements',
    date: '2026-05-29',
    title: {
      sr: 'Doterivanja izveštaja: vreme procesa, blokade i lista radnika',
      en: 'Report refinements: process time, blocks, and worker list',
    },
    bullets: [
      {
        sr: 'Tab "Trajanje izrade proizvoda": vreme procesa sada prikazuje stvarno aktivno vreme rada operatera, a ne ceo period od početka do kraja procesa.',
        en: 'Product Manufacturing Time tab: process duration now shows the operator’s actual active working time, not the whole span from process start to finish.',
      },
      {
        sr: 'Tab "Blokade po procesu": prosečno trajanje više ne uračunava blokade rešene u potpunosti van radnog vremena (0 radnih sati), pa je prosek realniji.',
        en: 'Blocks per Process tab: the average duration no longer counts blocks resolved entirely outside working hours (0 working hours), so the average is more realistic.',
      },
      {
        sr: 'Tabovi "Sati radnika" i "Efikasnost radnog vremena" sada prikazuju samo proizvodne radnike — administratori i rukovodstvo se više ne pojavljuju u listi.',
        en: 'The Worker Hours and Work Efficiency tabs now show only production workers — administrators and management no longer appear in the list.',
      },
    ],
  },
  {
    id: '2026-05-26-new-reports-and-shift-config',
    date: '2026-05-26',
    title: {
      sr: 'Tri nove analize na stranici Vremena procesa + podešavanja smena',
      en: 'Three new analyses on the Process Times page + shift settings',
    },
    bullets: [
      {
        sr: 'Nova kartica "Blokade po procesu" — pregled svih blokada po procesu sa prosečnim trajanjem u radnim satima (pauze i vikend se ne računaju).',
        en: 'New "Blocks per Process" tab — overview of all blocks per process with average duration in working hours (breaks and weekends excluded).',
      },
      {
        sr: 'Nova kartica "Trajanje izrade proizvoda" — vreme po procesu i pauze između procesa za svaku završenu narudžbinu, sa najzastupljenijom težinom.',
        en: 'New "Product Manufacturing Time" tab — per-process duration and inter-process gaps for each completed order, with the most common complexity.',
      },
      {
        sr: 'Nova kartica "Efikasnost radnog vremena" — po radniku i danu prikazuje pravo vreme rada, vreme aktivno na procesima, pauze i procenat efikasnosti (sa bojama: zeleno ≥80%, žuto 60–79%, crveno <60%).',
        en: 'New "Work Efficiency" tab — per worker and day, shows worked time, active-on-process time, breaks, and efficiency percentage (with color coding: green ≥80%, yellow 60–79%, red <60%).',
      },
      {
        sr: 'Smene (Admin → Smene) sada imaju nova podešavanja: trajanje pauze, maksimalno prekovremeno, automatska odjava i alarm pre odjave.',
        en: 'Shifts (Admin → Shifts) now have new settings: break duration, max overtime, auto-logout, and pre-logout alarm.',
      },
      {
        sr: 'Ako radnik zaboravi da se odjavi, sistem više ne računa višednevne sesije kao stvarno radno vreme — automatski se ograničava na trajanje smene + dozvoljeno prekovremeno.',
        en: 'If a worker forgets to check out, the system no longer counts multi-day sessions as actual work time — automatically capped at shift duration + allowed overtime.',
      },
      {
        sr: 'Tablet pokazuje upozorenje pred kraj smene da radnik ne zaboravi da se odjavi.',
        en: 'Tablet shows a warning near end of shift so the worker remembers to check out.',
      },
      {
        sr: 'Trend grafikon: ispravljene vrednosti MIN/MAX (sada se računaju isto kao u tabeli Vremena) i automatski se otvara sa prvim procesom + srednjom težinom umesto praznog izbora. Dodat izbor perioda (mesec / 3 meseca / 6 meseci / godina).',
        en: 'Trend chart: MIN/MAX values fixed (now computed the same way as in the Times table) and opens automatically with the first process + medium complexity instead of an empty selection. Added period selector (month / 3 months / 6 months / year).',
      },
    ],
  },
  {
    id: '2026-05-24-bugfixes-trend-and-ordertype',
    date: '2026-05-24',
    title: {
      sr: 'Ispravke: zelena zona na Trend grafikonu + Tip narudžbine u tabeli Praćenje vremena',
      en: 'Fixes: green zone on Trend chart + Order type in Time Tracking table',
    },
    bullets: [
      {
        sr: 'Zelena zona MIN/MAX se sada pravilno crta na grafikonu Trend prosečnog vremena (ranije nije bila vidljiva).',
        en: 'The MIN/MAX green zone now renders correctly on the Average Time Trend chart (previously invisible).',
      },
      {
        sr: 'Kolona Tip narudžbine u tabeli Praćenje vremena sada prikazuje ime koje ste podesili u Administracija → Tipovi narudžbina (ranije se ne prenosilo ispravno).',
        en: 'The Order Type column in the Time Tracking table now shows the name you configured in Administration → Order Types (previously not transferring correctly).',
      },
    ],
  },
  {
    id: '2026-05-24-docs-and-meta',
    date: '2026-05-24',
    title: {
      sr: 'Uputstvo dopunjeno + oznaka poslednje izmene',
      en: 'Tutorial updated + last-updated marker',
    },
    bullets: [
      {
        sr: 'Sekcija "Vremena procesa" u Uputstvu prepisana — sada pokriva sve nove izveštaje i grafikone (Realni prosek, St. devijacija, Trend, Analiza kašnjenja, Napredak aktivnih narudžbina, Uključi/Isključi prekidač sa server-side čuvanjem, drill-down pod-procesa, dvosheet XLSX izvoz).',
        en: 'The "Process times" section of the Tutorial was rewritten — now covers all the new reports and charts (Trimmed mean, Std. deviation, Trend, Delivery compliance, Active orders funnel, Include/Exclude switch with server-side persistence, sub-process drill-down, two-sheet XLSX export).',
      },
      {
        sr: 'Strana "Šta je novo" sada prikazuje datum poslednje izmene u zaglavlju — odmah znate koliko je sadržaj svež.',
        en: 'The "What\'s new" page now shows the last-updated date in the header — you immediately see how fresh the content is.',
      },
    ],
  },
  {
    id: '2026-05-24-polish',
    date: '2026-05-24',
    title: {
      sr: 'Tehničke ispravke i stabilnost',
      en: 'Polish and stability fixes',
    },
    bullets: [
      {
        sr: 'Uključi/Isključi prekidač na Praćenje vremena prikazuje znak učitavanja dok se promena čuva.',
        en: 'The Include/Exclude switch on Time Tracking now shows a loading spinner while the change is being saved.',
      },
      {
        sr: 'Greška se javlja ako čuvanje stanja prekidača ne uspe (umesto tihog vraćanja u prethodno stanje).',
        en: 'An error is shown if the save fails (instead of silently reverting).',
      },
    ],
  },
  {
    id: '2026-05-23-charts',
    date: '2026-05-23',
    title: {
      sr: 'Dva nova grafikona na strani Vremena procesa',
      en: 'Two new charts on the Process Times page',
    },
    bullets: [
      {
        sr: 'Trend prosečnog vremena po nedelji — sa filterima Proces, Kompleksnost i Granul (nedelja/mesec). Zelena zona pokazuje MIN/MAX po periodu, plava linija Realni prosek, crvena isprekidana ciljnu vrednost (85% Realnog proseka za ceo period).',
        en: 'Weekly average trend — with Process, Complexity and Granularity (week/month) filters. Green band shows MIN/MAX per period, blue line shows Trimmed mean, red dashed line shows the target (85% of trimmed mean across the whole period).',
      },
      {
        sr: 'Napredak aktivnih narudžbina — broj narudžbina po procesu, podeljeno na "U toku" (plavo), "Spreman za izvršavanje" (sivo) i "Blokirano" (crveno). Filteri: Tip narudžbine i Kompleksnost.',
        en: 'Active orders funnel — orders per process split into "In progress" (blue), "Ready to start" (gray) and "Blocked" (red). Filters: Order type and Complexity.',
      },
    ],
  },
  {
    id: '2026-05-22-reports-feedback',
    date: '2026-05-22',
    title: {
      sr: 'Ispravke na izveštajima prema vašem feedback-u',
      en: 'Reports fixes based on your feedback',
    },
    bullets: [
      {
        sr: 'MIN i MAX se sada računaju po formuli iz Excel-a — ekstremne vrednosti se odbacuju (npr. zaboravljen proces od 48 sati više ne pravi pogrešan MAX).',
        en: 'MIN and MAX now follow the Excel formula — extreme values are filtered out (e.g., an abandoned 48-hour process no longer skews the MAX).',
      },
      {
        sr: 'Vreme procesa sa pod-procesima sada je zbir vremena pod-procesa, umesto ukupnog vremena od početka do kraja koje je uračunavalo i prazne periode bez aktivnosti.',
        en: 'Process time for processes with sub-processes is now the sum of sub-process times, instead of total start-to-end time that included idle periods.',
      },
      {
        sr: 'Uključi/Isključi prekidač se sada čuva u bazi — utiče i na statistike na strani Vremena procesa i na izvoz, i preživljava refresh / promenu uređaja.',
        en: 'The Include/Exclude switch is now saved server-side — it affects statistics on the Process Times page and the export, and survives page refresh / device change.',
      },
      {
        sr: 'Tip narudžbine se sada čita iz vaše Admin → Tipovi narudžbine konfiguracije. Promena imena se pojavi svuda nakon refresh-a.',
        en: 'Order type now reads from your Admin → Order Types configuration. Renaming a type takes effect everywhere after a refresh.',
      },
      {
        sr: 'Boldirani ramovi oko grupa Teško / Srednje / Lako u tabeli — lakše praćenje podataka.',
        en: 'Bold borders frame the Heavy / Medium / Light column groups in the table — easier to scan.',
      },
      {
        sr: 'Novi grafikon: Analiza kašnjenja i poštovanja rokova (% narudžbina na vreme vs % koje kasne, po nedelji ili mesecu).',
        en: 'New chart: Delivery compliance & delay analysis (% of orders on time vs late, weekly or monthly).',
      },
    ],
  },
  {
    id: '2026-05-20-reports-rework',
    date: '2026-05-20',
    title: {
      sr: 'Prerada strane Vremena procesa',
      en: 'Process Times page rework',
    },
    bullets: [
      {
        sr: 'Tabela sa svim metrikama po kompleksnosti: Prosek, min, max, Realni prosek (skraćeni prosek), Standardna devijacija.',
        en: 'Table now shows all metrics per complexity: Average, min, max, Trimmed mean, Standard deviation.',
      },
      {
        sr: 'Pod-procesi su sada vidljivi klikom na strelicu pored reda u Praćenje vremena tabu.',
        en: 'Sub-processes are now visible by clicking the arrow next to each row in the Time Tracking tab.',
      },
      {
        sr: 'Filteri po datumu, kategoriji proizvoda i tipu narudžbine na obe tabele.',
        en: 'Date, product category and order type filters on both tables.',
      },
      {
        sr: 'Izvoz u XLSX sada koristi dva sheet-a (glavni + pod-procesi), CSV koristi jedan fajl sa kolonom "Tip reda".',
        en: 'XLSX export now uses two sheets (main + sub-processes); CSV uses a single file with a "Row type" column.',
      },
    ],
  },
  {
    id: '2026-05-18-security',
    date: '2026-05-18',
    title: {
      sr: 'Sigurnosna poboljšanja',
      en: 'Security improvements',
    },
    bullets: [
      {
        sr: 'Sprečeno brisanje poslednjeg Admin korisnika — firma ne može da ostane bez administratora.',
        en: 'Blocked deletion of the last Admin in a company — a company can never end up without an administrator.',
      },
      {
        sr: 'Prilikom promene uloge korisnika, njegove postojeće sesije se odjavljuju — stara prava ne mogu da nastave da važe.',
        en: 'When a user\'s role changes, their existing sessions are signed out — old privileges cannot remain in effect.',
      },
    ],
  },
  {
    id: '2026-05-16-performance',
    date: '2026-05-16',
    title: {
      sr: 'Optimizacije performansi',
      en: 'Performance improvements',
    },
    bullets: [
      {
        sr: 'Master pregled narudžbina značajno brži za firme sa puno aktivnih narudžbina.',
        en: 'The orders master view is significantly faster for companies with lots of active orders.',
      },
      {
        sr: 'Tablet ekrani (lista aktivnih + queue) brže učitavaju.',
        en: 'Tablet screens (active list + queue) load faster.',
      },
      {
        sr: 'Pauza stanice na tabletu sada pravilno čuva stanje pod-procesa pri odjavi i nastavlja pri sledećoj prijavi.',
        en: 'Station pause on the tablet now properly saves sub-process state on logout and resumes on the next login.',
      },
    ],
  },
  {
    id: '2026-05-15-infra',
    date: '2026-05-15',
    title: {
      sr: 'Infrastruktura',
      en: 'Infrastructure',
    },
    bullets: [
      {
        sr: 'Automatsko praćenje rada sistema — administratori i tehnička podrška vide da li sistem radi pre nego što korisnici primete problem.',
        en: 'Automatic system health monitoring — administrators and support can detect issues before users notice them.',
      },
      {
        sr: 'Svaka promena u sistemu (ko je kreirao, ko je poslednji menjao, kada) sada se automatski beleži — kompletna istorija izmena za sve podatke.',
        en: 'Every change (created by, last edited by, when) is now recorded automatically — full change history across all data.',
      },
    ],
  },
];

/** First N entries — what the page shows expanded by default. */
export const DEFAULT_VISIBLE_COUNT = 5;
