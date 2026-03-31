# Licentiekosten — CLAUDE.md

## Project

**Van den Elzen Plants** — interne applicatie voor het beheren van licentiekosten op plantenverkoop (aardbeien, frambozen, bramen).

**Stack:** React 18 + TypeScript, Vite, Supabase (PostgreSQL), React Router, Lucide React, React Hot Toast.

## Projectstructuur

```
src/
  lib/
    supabase.ts         # Supabase client + alle TypeScript interfaces
    MultiSelect.tsx     # Herbruikbaar multi-select component
  pages/
    Dashboard.tsx       # Analytisch dashboard met pivot-filters
    Debiteuren.tsx      # Klantbeheer (import uit Excel)
    Licentiehouders.tsx # Licentiehouders + gekoppelde rassen
    Rassen.tsx          # Plantrassen + landen
    Artikelen.tsx       # Artikelcodes → codegroepen
    Grootboek.tsx       # Grootboek 1955 (NTOF-transacties)
    Omzetrekeningen.tsx # Importeren verkooptransacties + licentiekostberekening
    Licentiekosten.tsx  # Tarievenmatrix per codegroep × land
```

## Datamodel (kernentiteiten)

| Tabel | Doel |
|---|---|
| `debiteuren` | Klanten/debiteuren |
| `licentiehouders` | Licentiehouders |
| `rassen` | Plantrassen (gekoppeld aan licentiehouder) |
| `ras_landen` | Junction: ras × land |
| `artikel_codes` | Artikelcodes met codegroep |
| `code_groep_config` | Koppeling codegroep → ras |
| `licentiekosten` | Tarieven per codegroep × land |
| `transacties` | Verkooptransacties (uit Omzetrekeningen) |
| `grootboek_1955` | Grootboekregels NTOF |

## Ontwikkelrichtlijnen

- **Taal:** UI en communicatie volledig in het **Nederlands**.
- **Supabase queries:** gebruik altijd `.throwOnError()` of check `.error`; bij grote datasets pagineer met `.range()`.
- **Data importeren:** paste-parsing is tab-gescheiden (Excel-kopie); valideer en dedupliceer vóór upsert.
- **Filters:** client-side filteren na ophalen; gebruik `useMemo`/`useCallback` voor performance.
- **LocalStorage:** kolomvolgorde en collapse-state worden opgeslagen in localStorage (Omzetrekeningen, Licentiekosten).
- **Toast:** gebruik `react-hot-toast` voor gebruikersfeedback bij mutaties.
- Voeg geen onnodige abstracties of helpers toe voor eenmalige operaties.

## Git-workflow

Na elke voltooide wijziging: stage gewijzigde bestanden, commit met beschrijvende boodschap, push naar `origin main`.
