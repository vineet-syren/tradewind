# Tradewind — Downstream Transportation Carbon Decisioning

> *Every route option, priced in carbon, from your own shipment records.*

A frontend-only decision-support product for **Terova** — a global spice exporter — that turns the
customer's own transport inventory into route decisions. **Every number in the app comes from
`Transport Downstream- V02.xlsx`.** There is no synthetic data and no random number generator:
weights, distances, emission factors, fuel volumes, container sizes, products, ports and CO₂e are
read straight from the workbook, and each leg carries the cell range it was read from.

**React + TypeScript + Vite + MUI v6 + Redux Toolkit + Recharts + Leaflet.**

## Quick start

```bash
npm install
python3 scripts/extract-workbook.py   # xlsx → scripts/source/transport-downstream.json
npm run mock:gen                      # that JSON → public/mock-data
npm run dev                           # http://localhost:5174
```

The extractor needs `openpyxl` (`pip3 install openpyxl`). Both outputs are committed, so a plain
`npm run dev` works without re-running either step. Other scripts: `npm run build`,
`npm run preview`, `npm run typecheck`, `npm run lint`.

## The data

The workbook holds three sequential reporting years (Jul → Jun), each on its own tab, each split
into five modal blocks: first-mile collection road, export road, rail, ocean and air. The ocean
block is the shipment spine — every ocean row rejoins its inland legs on (date, item, quantity), so
whole journeys are reconstructed: factory → inland depot → gateway port → destination port.

| | |
|---|---|
| Movements | 290 recorded (238 export chains + 68 first-mile collection runs) + 16 rolled forward |
| Window | 1 Jul 2021 → 30 Jun 2024, so the app's "today" is **1 Jul 2024** |
| Reporting years | FY21-22 · 245.83 t · FY22-23 · 172.15 t · FY23-24 · 146.60 t |
| Lanes | 30 (destination port × product category) |

Each year is reconciled line by line to the total the workbook itself prints in cell D53. FY23-24
ties to the last decimal. Two tabs annotate their export road block *"handled by external SP, not
valid as this is for the Ocean shipment"* and leave it out of that printed total; the
**Footprint & Evidence** page shows the full bridge from their figure to the app's.

### Emission factors, as the workbook states them

| Mode | Factor | Charged |
|---|---|---|
| Road | 0.5928 kg CO₂e / km | **per truck run** — a 400 kg load costs what a 25 t one does |
| Rail | 0.00996 kg CO₂e / tonne-km | per tonne carried |
| Ocean | 0.0084 kg CO₂e / tonne-km | per tonne carried |
| Air | 1.58 kg CO₂e / tonne-km | per tonne carried — 188× ocean |

That road basis is the single most important fact in the dataset: it is what makes the gateway
choice and truck sharing worth real tonnes, and why a 60 kg parcel on a 703 km road run to Chennai
emits more than the 6,384 km sailing that follows it.

### Route options

An option is only offered when the workbook records **every leg it uses**, so each one reports how
many shipments already moved that way:

- **Different gateway** — leave India through another port, on the inland chain that port already
  uses. Chennai is ~703 km of road; Nhava Sheva is 51 km of road plus 702 km of rail.
- **Shorter sailing** — the same port pair at the shorter sea distance the workbook also records
  (Chennai → Laem Chabang appears at both 5,002 km and 6,384 km).
- **Sea instead of air** — the ocean routing already used to that destination country.
- **Share the truck** — same-day loads through one gateway that fit inside the heaviest single load
  the workbook records.

Options are priced from the **FY23-24** inland network: it is the latest year, it reconciles exactly,
and it is the only tab whose depot labels are internally consistent (earlier tabs record the same run
as both 21 km and 645 km to "Hyderabad"). Earlier tabs are read for history, not for pricing
alternatives.

### What the workbook does not contain

The app shows no dimension the workbook has no column for, so nothing on any screen is inferred
about these — they are listed on the Evidence page too:

- **Customer / consignee** — it records destination ports, not who buys.
- **Vendor, processor, carrier, forwarder** — no partner is named anywhere in it.
- **Freight cost** — there is no monetary column, so options compare on CO₂e and transit, not money.
- **Arrival dates** — dispatch is the only date recorded.

Transit days are the sole figure not in the workbook. They are estimated from its distances
(road 450 / rail 400 / ocean 480 / air 3,000 km per day, plus 3 days port dwell), always marked
"est.", and no CO₂e figure depends on one.

### To-be-planned shipments

The forward book is the FY23-24 July–September quarter rolled forward 366 days. Product, weight,
gateway, container and every distance are unchanged from the real shipment — only the dates move,
and each planned row carries a `derivedFromRef` pointing at the workbook cell it came from.

## The screens

| Page | Who | What it does |
|---|---|---|
| **Control Tower** | Logistics lead | The network map over the full shipment register, split by a draggable divider. Selecting a shipment or lane shows every route option the workbook evidences — compare chart, option cards, and the leg-by-leg CO₂e maths with each figure's source cell. |
| **Emission Hotspots** | All | Year-over-year total against intensity (click a year to drill into its months), the same CO₂e re-sliced by product, port, gateway, market and mode, seasonality, the gateway→mode→region flow, and first-mile collection kept separate. |
| **Product & Destination Lanes** | All | Treemap by product or port, destination × mode, region × mode mekko, a lane-priority bubble chart, and the full lane table. |
| **ESG Reporting** | CSO / analyst | The reported total, its reconciliation bridge to the workbook (as a table *and* a waterfall), actual against the best proven route, the factor table, the methodology, the stated assumptions, and the rows in the source that contradict themselves. |

Plus a **persona switcher** (Logistics Lead / CSO / Analyst), a global **filter bar** limited to
dimensions the workbook holds, an **exceptions inbox** (air freight, part-load truck runs,
duplicated rows), and **Ask Tradewind** — a keyword-routed assistant that answers only from the
figures in view and says so when it cannot.

There is no **Carrier & Vendor Performance** page and no procurement persona: the workbook names no
vendor, processor or carrier, so there would be nothing real to rank. The Control Tower also loads
unscoped — an earlier build gated it behind "apply a filter first", which meant arriving at an
empty screen.

## Architecture

UI components **never read data directly** — they depend on a single `CarbonDataSource` interface
(`src/services/dataSource.ts`). Swapping mock ↔ real API is a registry change, not a UI rewrite.

```
scripts/
  extract-workbook.py             the ONLY place the .xlsx is read; verifies the shipment
                                  rejoin and exits non-zero if a tab stops reconciling
  source/transport-downstream.json  committed, provenance-carrying dump of every row
  generate-mock-data.mjs          that JSON → public/mock-data, no RNG
src/
  app/            theme, chart colours, providers, routes, store (persona / filters / ui)
  components/     layout, cards, charts, map, tables, filters, shared
  constants/      app, agents, nav, personas, actionTypes
  hooks/          useDataSource, useAsync, useDebouncedValue
  modules/decarbonization/  pages/ (ControlTower, Hotspots, ProductCustomerLanes, EvidencePack)
                            components/ (ShipmentsPanel, ScenarioCard, ShipmentLedgerSection,
                                         LegTimeline, LaneDetailContent, …)
  services/
    dataSource.ts                 the contract every screen talks to
    dataSourceRegistry.ts         env-selected singleton (mock | api), safe fallback
    adapters/data-sources/        mockDataSource.ts (reads JSON) · apiDataSource.ts (REST stub)
    mappers/                      shipmentQuery, footprint, hotspots, focus, copilot
  types/          domain contracts — the source of truth both scripts and UI honour
public/mock-data/                 committed JSON (indexes + lazy per-id chunks + aggregates)
```

Configure via `.env` (see `.env.example`): `VITE_DASHBOARD_DATA_SOURCE` (mock|api),
`VITE_API_BASE_URL`, `VITE_ENABLE_MOCKS`, `VITE_MOCK_LATENCY` (off|fast|normal|slow). An unknown
source key safely falls back to `mock`.

> Bookings stay in Terova's own systems. Tradewind prices the options and shows the source cell
> behind every figure; it does not execute anything.
