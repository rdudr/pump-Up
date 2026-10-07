# Pump-Up → PostMan (KISEM report generator)

**Why this note exists.** Pump-Up's Excel export is meant to be read by
PostMan — the IIT Gandhinagar / KISEM energy-assessment report builder
(https://github.com/rdudr/PostMAN) — for the *pump performance* section of
the report, the same way it reads the FOX KISEM export for the electrical
distribution chapter. Nothing should be retyped. This page records what the
export contains so PostMan and Pump-Up stay in step.

> **Status:** PostMan does not read these sheets yet. Its FOX reader
> (`src/p19_pq.js`) is the model to copy: a `PUMP_SHEETS` list, a row reader
> keyed on the header text below, and the same merge / upload-stamp rules.

## The workbook

Built by `buildWorkbook()` in `lib/export-offline.ts`. The same function makes
the file saved on the device and the file attached to the team email, so
they are always identical. PostMan can recognise a Pump-Up file by the
`Company Profile` row **Source App = Pump-Up**, or by the presence of at
least one of `Pump Tests Transit` / `Pump Tests Doppler`.

| Sheet | What it is | Header row |
|---|---|---|
| `Company Profile` | Company Name, Area / Zone, District, State, Pincode, **Reported By**, Export Date, Source App (key / value rows) | — |
| `Pump Summary` | One row per pump, both meters: Pump Tag, Flow Meter, Location, Input Power Pe (kW), Flow (m3/h), Head (m), Hydraulic Power Ph (kW), Shaft Power Ps (kW), Pump Efficiency (%), Friction Loss hf (m), Recorded By, Date | row 1 |
| `Pump Tests Transit` | Every reading and every calculated value for Transit-meter pumps | row 1 |
| `Pump Tests Doppler` | Same for Doppler-meter pumps | row 1 |
| `PUMPS_Transit` | The original *Pump Analysis* layout — parameters down the rows, one pump per column from C, **live Excel formulas** with cached values | — |
| `PUMPS_Doppler` | Same for Doppler | — |

PostMan should read the flat `Pump Tests …` / `Pump Summary` sheets (header
text, case- and space-insensitive). The `PUMPS_…` sheets are for people who
open the file in Excel and want the familiar layout; their row numbers match
the original workbook, so its formulas are the same text.

### Columns of `Pump Tests Transit` / `Pump Tests Doppler`

Description: Pump Tag, Location, Type/Size, Make, Rated Head (m), Rated Flow
(m3/h), Impeller Dia (mm), Rated Power (HP).

Transit only: Transducer Type/Model, Pipe Material, Transducer Mounting,
Transducer Spacing (mm), Measured Flow (m3/h).
Doppler only: Measured Velocity (m/s).

Readings: Pipe Periphery (mm), Discharge Pressure (kg/cm2), Suction Pressure
(kg/cm2), Pipe Thickness (mm), Water Density (kg/m3), Gravity (m/s2), Input
Power Pe (kW), Frequency (Hz), Motor Efficiency (%), Valve Open (%).

Calculated: Velocity (m/s) *(Transit)*, Head (m), Pipe OD (mm), Pipe ID (mm),
Flow (m3/h) *(Doppler)*, Flow (m3/min), Flow (m3/s), Flow (LPM), Hydraulic
Power Ph (kW), Shaft Power Ps (kW), Pump Efficiency (%), Flow vs Rated (%),
Head vs Rated (%).

Friction: Pipe Type, H-W Coefficient C, Straight Length (m), Fittings (text,
`<fitting> xN; …`), Equivalent Length L (m), Friction Loss hf (m).

Meta: Description, Photo Path, Recorded By, Date (`en-IN` locale string).

## Formulas (must stay identical in both apps)

All from `lib/pump-calc.ts`, copied from the original workbook (π is 3.14 there):

| Value | Formula |
|---|---|
| Head (m) | (Pd − Ps) × 10 |
| Pipe OD (mm) | periphery / 3.14 |
| Pipe ID (mm) | OD − 2 × thickness |
| Transit velocity (m/s) | Q(m³/h) × 10⁶ × 4 / (3.14 × ID² × 3600) |
| Doppler flow (m³/s) | v × 3.14 × ID² / (10⁶ × 4) |
| Hydraulic power Ph (kW) | Q(m³/s) × g × ρ × H / 1000 |
| Shaft power Ps (kW) | Pe × motor efficiency / 100 |
| Pump efficiency (%) | Ph × 100 / Ps |
| Friction loss hf (m) | (6.1961×10⁸ / 100) × L × (Q_LPM / C)^1.852 / ID^4.87 |
| Equivalent length L (m) | straight length + Σ count × (L/D) × ID / 1000 |

`npm run test:calc -- "<path to Pump Analysis.xlsx>"` checks the app against
the workbook's own formulas.

## Merge rules (same idea as FOX)

Pumps merge by **flow meter + pump tag**: a pump in the file replaces its
earlier copy in the report, the rest stay — so the same export twice, or two
engineers' partial exports, never duplicate a row. Pump-Up's own *Import
Excel* button follows the same rule.

## Upload stamp

The person comes from the `Reported By` row of `Company Profile` (and the
per-row `Recorded By` column). Print it as PostMan does for FOX:

> Last uploaded data on 15/09/2026, 17:28:58 from Rishabh (Demo_Textiles_PumpUp_0710.xlsx)

## Keeping the two in step

1. **A change here is a change there.** A sheet or column added, renamed or
   re-unitised in `lib/export-offline.ts`, or a change to a formula in
   `lib/pump-calc.ts`, is matched in PostMan in the same sitting, and this
   page updated. A verdict wording PostMan improves (e.g. efficiency bands)
   is carried back into this app's screens.
2. **Push every repository touched** (Pump-Up and `rdudr/PostMAN`) before the
   work is called done, each commit naming the other.
