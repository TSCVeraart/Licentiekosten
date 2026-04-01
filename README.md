# Licentiekosten — Van den Elzen Plants

Interne webapplicatie voor het beheren en berekenen van licentiekosten op de verkoop van aardbeien, frambozen en bramen.

## Wat doet het?

Van den Elzen Plants verkoopt plantenrassen waarvoor licentiekosten worden afgedragen aan licentiehouders. Deze app maakt het mogelijk om:

- Verkooptransacties te importeren vanuit Excel
- Automatisch licentiekosten te berekenen per transactie op basis van ras, land en codegroep
- Overzichten en exportjes te maken voor de maandelijkse afrekening
- Debiteuren, rassen, licentiehouders en tarieven te beheren

## Stack

| | |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Backend | Supabase (PostgreSQL + Auth) |
| Routing | React Router |
| UI | Lucide React, React Hot Toast |

## Pagina's

| Pagina | Omschrijving |
|---|---|
| Dashboard | Grafieken en pivot per licentiehouder, ras en land |
| Debiteuren | Klantbeheer, import vanuit Excel |
| Licentiehouders | Beheer van licentiehouders en gekoppelde rassen |
| Rassen | Plantrassen per soort en land |
| Artikelen | Artikelcodes gekoppeld aan codegroepen |
| Omzetrekeningen | Import verkooptransacties + licentiekostberekening |
| Licentiekosten | Tarievenmatrix per codegroep en land |
| Ontbrekende kosten | Transacties zonder berekende licentiekosten |
| Maandchecklist | Stap-voor-stap controle aan het einde van de maand |
| Gebruikers | Beheer van toegang en rechten per gebruiker |

## Lokaal draaien

```bash
npm install
npm run dev
```

Vereist een `.env` bestand met:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Wijzigingen

Zie [CHANGELOG.md](./CHANGELOG.md) voor een overzicht van alle updates per dag.
