# Tradewind — Downstream Transportation Carbon Decisioning

> *Steer every shipment to its lowest-carbon lane.*

A **frontend-only, mock-data** decision-support product for **Terova** — a global spice
exporter — built to reduce **Scope 3 downstream transportation emissions**. No backend, no CRM:
a deterministic synthetic dataset (grounded in the customer's real lanes, products and GHG
methodology) is generated and served entirely in the browser.

Built on the architecture and data-loading patterns of the reference `ntt_data_salesforce` app
(**React + TypeScript + Vite + MUI v6 + Redux Toolkit + Recharts + Zod**), following the same
mock-first analytics template.

## Quick start

```bash
npm install
npm run mock:gen     # (re)generate the synthetic dataset into public/mock-data
npm run dev          # http://localhost:5174
```

Other scripts: `npm run build`, `npm run preview`, `npm run typecheck`, `npm run lint`.

## What it does

A focused engine that turns Terova's existing shipment + GHG data into **practical reduction
actions** across route, mode, port, consolidation, air-avoidance and partner choices — and proves
measurable CO₂e reduction with report-ready evidence.

| View | Agent | Highlights |
|------|-------|-----------|
| **Command Center** | Orchestrator | Persona-aware landing · prompt-to-action copilot · focus KPIs · network pulse · priority lanes |
| **Baseline & Hotspots** | Footprint & Hotspot | Top emitters by product, customer, market, port, mode, vendor, LSP · concentration |
| **Route & Mode Decisioning** | Route & Mode | **Interactive world map** of lanes (ship/plane/train/truck icons) + **Optimal / Balanced / Best-for-CO₂** scenarios per lane |
| **Product–Customer Lanes** | — | Emissions by product × customer × market, sortable lane table |
| **Partner Influence** | Partner Influence | Vendor / processor / LSP contribution + influenceable saving |
| **Action Center** | Tracker | Prioritized actions · execute / delegate / snooze · log a lane decision · audit trail |
| **Recommendations** | Reduction Engine | Every action ranked by CO₂e saving × confidence, filterable by type |
| **Air Watch & Exceptions** | Mode Governance | Air shipments classified avoidable / justified · data-quality flags |
| **ESG Evidence Pack** | Evidence & Reporting | Baseline → realized → ambition, monthly trend, methodology, assumptions |
| **Methodology & Factors** | — | The transparent distance-based formula + emission-factor table |

Extras: **persona switcher** (CSO / Logistics Lead / Program Owner / Procurement) that re-lenses
every view; global **filter bar**; **Lane 360** and **Shipment 360** drawers with leg-by-leg
calculation transparency; light/dark themes.

## CO₂e methodology (from the customer's calc + architect call)

```
CO₂e (kg) = Weight (tonnes) × Distance (km) × Emission Factor (kg CO₂e / tonne-km)
```

- **Distance** — straight-line Haversine between validated coordinates, **+20% buffer** for
  indirect routes (matches the customer's Bing-Maps route dictionary).
- **Allocation** — consolidated containers attribute CO₂e by the shipment's **weight share**.
- **Emission factors** — mode- and distance-tiered. **Air** uses the client's screenshot tiers
  (2.136 / 1.323 / 1.191); **ocean / rail / road** use global container / rail / full-truck factors
  so modes compare on CO₂e per tonne-km (air ≫ road > rail > ocean). All factors are surfaced on the
  Methodology page.

The three decisioning approaches mirror `route_mode_decision.png`:
**Optimal** (multimodal / air-heavy — fastest, highest CO₂) · **Balanced** (road + ocean, ~2–3 weeks)
· **Best for CO₂** (ocean-heavy + rail inland + consolidation — lowest CO₂).

## Architecture

UI components **never read data directly** — they depend on a single `CarbonDataSource` interface
(`src/services/dataSource.ts`). Swapping mock ↔ real API is a registry change, not a UI rewrite.

```
src/
  app/            config (theme, chartColors), providers, routes, store (persona/filters/actions/ui)
  components/     layout (shell, sidebar, topbar, drawer host), cards, charts, map, tables, filters, shared
  constants/      app, agents, nav, personas
  hooks/          useDataSource, useAsync, useDebouncedValue
  modules/decarbonization/  pages/ + components/ (ScenarioCard, RecommendationCard, LegTimeline, drawers, copilot)
  services/
    dataSource.ts                 the contract every screen talks to
    dataSourceRegistry.ts         env-selected singleton (mock | api), safe fallback
    adapters/data-sources/        mockDataSource.ts (reads JSON) · apiDataSource.ts (drop-in REST stub)
    mappers/                      shipmentQuery, footprint, hotspots, focus, copilot
  types/          backend-style domain contracts (the "frozen" source of truth)
scripts/generate-mock-data.mjs    deterministic generator (mulberry32, frozen as-of 2025-01-08)
public/mock-data/                 committed JSON (shipment & lane indexes + lazy per-id chunks + aggregates)
```

Configure via `.env` (see `.env.example`): `VITE_DASHBOARD_DATA_SOURCE` (mock|api),
`VITE_ENABLE_MOCKS`, `VITE_MOCK_LATENCY` (off|fast|normal|slow). An unknown source key safely falls
back to `mock`.

> No backend is connected — executed actions and adopted decisions are recorded in-app (Redux) with a
> visible audit trail. The dataset is seeded and committed, so the demo is stable across reloads.
> Numbers are illustrative pending the customer's real distance & emissions data.
