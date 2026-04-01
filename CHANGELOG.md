# Changelog — Licentiekosten

Bijgehouden per dag. Elke sectie beschrijft wat er is aangepast en hoe het technisch is opgelost.

---

## 2026-04-01

### Beveiliging — Supabase RLS ingeschakeld
- **Wat:** Row Level Security (RLS) ingeschakeld op alle tabellen in Supabase.
- **Waarom:** De `anon` key zat in de frontend-bundle (publiek leesbaar), waardoor iedereen zonder login de database kon bevragen via de Supabase REST API.
- **Hoe:** RLS ingeschakeld via Supabase dashboard, daarna SQL-policies aangemaakt die alleen `authenticated` gebruikers toegang geven. `user_profiles` heeft een eigen policy zodat gebruikers alleen hun eigen rij kunnen lezen/schrijven.

### Fix — Excel export kommagetallen
- **Wat:** Bedragen zoals `-43,20` werden in Excel weergegeven als `-43.199.999.999.999.999`.
- **Waarom:** Twee oorzaken: (1) floating point ruis (`-43.2` werd opgeslagen als `-43.19999999999999...`), (2) JavaScript gebruikt een punt als decimaalteken maar Excel (NL) leest een punt als duizendtalsscheider.
- **Hoe:** In `src/lib/exportCsv.ts` — getallen worden eerst afgerond met `toFixed(10)` om floating point ruis te verwijderen, daarna wordt de punt vervangen door een komma zodat Excel (NL) het correct parseert.

### Fix — TypeScript strict errors in Admin.tsx
- **Wat:** Build faalde door strict TS-fouten na toevoegen van het admin panel.
- **Hoe:** `auth.tsx` hernoemd naar `auth.ts` (geen JSX in het bestand), type-annotaties gecorrigeerd in `Admin.tsx`.

### Feat — Admin panel (gebruikersbeheer)
- **Wat:** Nieuwe `/admin` pagina waar de beheerder gebruikers kan goedkeuren, afwijzen en paginarechten per gebruiker kan instellen.
- **Hoe:** Tabel `user_profiles` in Supabase met kolommen `status` (`pending`/`active`/`rejected`), `is_admin`, en `permissions` (JSON). Admin-email hardcoded als `thom@greann.com` krijgt altijd volledige rechten zonder DB-rij.

### Feat — Authenticatie via Supabase Auth
- **Wat:** Login-pagina toegevoegd; de app is alleen toegankelijk na inloggen.
- **Hoe:** `supabase.auth` voor sessie-beheer. Nieuwe gebruikers worden automatisch aangemeld als `pending` en uitgelogd totdat de beheerder ze goedkeurt. Paginarechten worden per gebruiker opgeslagen in `user_profiles.permissions`.

### Debug — Foutmelding bij mislukte omzetrekeningen query
- **Wat:** Bij een fout in de Supabase-query voor omzetrekeningen werd niets getoond.
- **Hoe:** `.throwOnError()` toegevoegd zodat fouten zichtbaar worden als toast-melding.

### Fix — Licentiekosten secties standaard dichtgeklapt
- **Wat:** Alle secties in de Licentiekosten-pagina stonden standaard open, wat traag laadde.
- **Hoe:** Initiële collapse-state in localStorage/state gezet op `true` (dicht) voor alle secties.

---

## 2026-03-31

### Feat — Excel export op alle tabbladen
- **Wat:** Exportknop toegevoegd op Omzetrekeningen, Ontbrekende kosten en andere pagina's.
- **Hoe:** Generieke `src/lib/exportCsv.ts` helper aangemaakt die een semicolon-gescheiden CSV genereert met UTF-8 BOM (voor correcte NL Excel-compatibiliteit).

### Feat — Checklist gegroepeerd met deadline-badge
- **Wat:** Maandchecklist geherstructureerd met groepen, actief vanaf de 10e van de maand, badge in navigatie bij openstaande punten.
- **Hoe:** Tabel `checklist_maand` in Supabase, badge telt onafgevinkte items voor de vorige maand.

### Fix — Nederlandse duizendtallenpunten strippen bij artikelimport
- **Wat:** Artikelcodes met punten als duizendtalsscheider (bijv. `1.234`) werden verkeerd geïmporteerd.
- **Hoe:** Punten worden gestript uit numerieke artikelcodes tijdens paste-parsing.

### Feat — Paginering artikelen + grootboek verwijderd
- **Wat:** Artikelenpagina pagineert nu grote datasets; aparte Grootboek-pagina verwijderd.
- **Hoe:** `.range()` paginering in Supabase-query; Grootboek-route en navigatielink verwijderd.

### Feat — Rode badge op Debiteuren bij ontbrekende landen
- **Wat:** Navigatiebadge toont het aantal debiteuren in omzetrekeningen zonder gekoppeld land.
- **Hoe:** Query op `omzetrekeningen` waar `land_debiteur IS NULL`, telt unieke debiteursnummers.

---

## 2026-03-30

### Feat — Multi-select filters (Dashboard + Omzetrekeningen)
- **Wat:** Dropdownfilters met meervoudige selectie voor ras, licentiehouder, soort, land etc.
- **Hoe:** Herbruikbaar `src/lib/MultiSelect.tsx` component; filtering client-side via `useMemo`.

### Feat — Dashboard herbouwd met charts en pivot
- **Wat:** Dashboard volledig opnieuw gebouwd met staafdiagrammen per licentiehouder/ras/land en een aparte tab "Afloop licentiehouders".
- **Hoe:** Eigen SVG-charts zonder externe library; pivot-logica via `useMemo` op `omzetrekeningen`-data.

### Feat — Drag-and-drop kolomvolgorde in Omzetrekeningen
- **Wat:** Gebruiker kan kolommen herordenen via slepen; volgorde wordt onthouden.
- **Hoe:** HTML5 drag events op `<th>`; volgorde opgeslagen in `localStorage`.

### Feat — Licentiekosten matrix (codegroep × land × tarief)
- **Wat:** Nieuwe pagina met tarievenmatrix per artikelcodegroep en land, inklapbaar per groep.
- **Hoe:** Tabel `licentiekosten` in Supabase; collapse-state per groep in `localStorage`.

### Feat — Artikelen pagina met Excel-import en codegroep
- **Wat:** Artikelpagina toegevoegd; artikelcodes importeren via plakken vanuit Excel, inclusief codegroep-koppeling.
- **Hoe:** Tab-gescheiden paste-parsing; upsert naar `artikel_codes`; inline bewerken van `code_groep`.

### Feat — Sticky headers + volledige schermbreedte
- **Wat:** Tabelheaders blijven zichtbaar bij scrollen; app gebruikt volledige breedte.
- **Hoe:** `position: sticky; top: 0` op `<thead>`; `overflow: clip` op de kaart-container zodat sticky werkt binnen de scroll-context.

### Feat — Omzetrekeningen pagina met Excel-import
- **Wat:** Verkooptransacties importeren via plakken vanuit Excel; automatische koppeling aan debiteur, ras, licentiehouder en berekening licentiekosten.
- **Hoe:** 11 kolommen tab-parsing; lookup via `artikel_codes` → `code_groep_config` → `rassen` → `licentiekosten`; upsert naar `omzetrekeningen`.

### Feat — Rassen met landen en licentiehouders
- **Wat:** Rassen pagina met koppeling aan licentiehouder en selectie van landen waarvoor het ras geldig is.
- **Hoe:** Junction-tabel `ras_landen`; landen worden één voor één ingevoegd om batch-insert fouten te vermijden.

---

## 2026-03-27

### Initieel project
- **Wat:** Projectframework opgezet: React 18 + TypeScript + Vite + Supabase + React Router.
- **Hoe:** `npm create vite`, Supabase client geconfigureerd via `.env`, basisstructuur pagina's aangemaakt.
