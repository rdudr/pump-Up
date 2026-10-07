# Pump-Up

Field pump-testing app by Kisem IITGN. Engineers record each pump's readings
with a **Transit** or **Doppler** flow meter, and the app works out head,
flow, hydraulic power, shaft power, pump efficiency and pipe friction loss
using exactly the formulas of the *Pump Analysis* workbook. The finished
report is saved as Excel on the device and emailed to the team, and the same
Excel feeds the KISEM PostMan report generator.

Built on the same base as Fox Kisem: Next.js, offline-first storage on the
device (IndexedDB), offline login, Excel import/export, and an emailed
report with a retry queue.

## Screens

| Screen | What it does |
|---|---|
| Overview | KPIs, efficiency per pump, summary table, **Submit Report** / Resend / Download Excel |
| Company | Plant details that head the report |
| Pump Test — Transit | Transit-time meter: you enter the flow, velocity is calculated |
| Pump Test — Doppler | Doppler meter: you enter the velocity, flow is calculated |
| Friction Loss | Hazen-Williams loss with the C-value table and valves & fittings (L/D) list |

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 and sign in with one of the team IDs in
`lib/auth-store.ts`. To send email locally, copy `.env.example` to
`.env.local` and fill in the Gmail settings.

## Useful commands

| Command | What it does |
|---|---|
| `npm run test:calc -- "<Pump Analysis.xlsx>"` | Checks the app's maths against the workbook's formulas |
| `npm run build` | Production build (what Vercel runs) |
| `npm run build:mobile` | Static build into `out/` for the Android app (Capacitor) |
| `npm run icons` | Regenerates favicon and app icons from `APP logo.png` |

## How a report reaches the team

1. **Submit Report** saves the Excel file on the device first.
2. The report is put in a queue on the device, then posted to `/api/sync/queue`.
3. The server rebuilds the same Excel and emails it to the team over Gmail SMTP.
4. If sending fails (no signal, server down), the report stays queued and
   the red **Resend** button sends it later.

## Combining work from the team (Import Excel)

When several engineers test pumps at the same plant, each can send their
report, and one person presses **Import Excel** (top bar) to load the
others' files into their own app. The rules are the same as Fox Kisem's, so
nothing is duplicated:

- A pump is matched by **flow meter + pump tag** (capital letters and extra
  spaces are ignored). If it already exists it is **updated** with the
  file's readings and keeps its place; if not, it is **added**.
- Importing the same file twice changes nothing the second time.
- "Recorded By" keeps the original engineer's name.
- The company details are only filled in if this device has none yet.

So the team should agree on pump tags (e.g. `CT Pump-1`) — the tag is what
links the same pump across files.

See [DEPLOYMENT.md](DEPLOYMENT.md) for Vercel and Android, and
[docs/POSTMAN_IMPORT.md](docs/POSTMAN_IMPORT.md) for the Excel format.
