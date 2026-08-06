/**
 * Data builder for Tradewind — Downstream Transportation Carbon Decisioning.
 *
 * Reads `scripts/source/transport-downstream.json` (produced by
 * `scripts/extract-workbook.py` from the customer's `Transport Downstream-
 * V02.xlsx`) and writes `public/mock-data/` in the shapes declared in
 * `src/types`.
 *
 * The rule this file exists to enforce: **every emitted number comes from the
 * workbook.** There is no random number generator. Weights, distances,
 * emission factors, fuel volumes, container sizes, products, ports and CO₂e are
 * read straight from the sheet, and each leg keeps the cell range it came from.
 *
 * Three kinds of derivation are allowed, and each is labelled in the output:
 *
 *  1. Classification — region / market / product form / Scoville, parsed out of
 *     the workbook's own destination and item-description text.
 *  2. Route options — priced by re-costing a shipment through a leg chain the
 *     workbook records for *other* shipments, using the workbook's own distance
 *     and emission factor. An option is only offered when every leg it needs
 *     appears in the sheet, so `timesUsedInWorkbook` is never zero.
 *  3. To-be-planned shipments — real FY23-24 shipments rolled forward one year
 *     to sit just after the workbook's last dispatch date. Nothing about them is
 *     invented; `derivedFromRef` points at the row each came from.
 *
 * Transit days are the sole exception and are always shown as estimates: the
 * workbook records no date beyond dispatch, so they are computed from its
 * distances using the speeds in ASSUMPTIONS.transitEstimate. No CO₂e figure
 * depends on them.
 *
 * Run with: `npm run mock:gen` (after `python3 scripts/extract-workbook.py`).
 */

import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'mock-data');
const SOURCE = join(__dirname, 'source', 'transport-downstream.json');

const src = JSON.parse(readFileSync(SOURCE, 'utf8'));

/** Tab name → reporting year, so a cell range can name its own year. */
const TABS_BY_NAME = Object.fromEntries(src.years.map((y) => [y.tab, y.reportingYear]));

// ── Emission factors, read back off the workbook rows ──────────────────────
// Road is charged per truck-kilometre (so a 400 kg run costs what a 25 t run
// does); rail, ocean and air are charged per tonne-kilometre.
const EF = { road: 0.5928, rail: 0.00996, ocean: 0.0084, air: 1.58 };
const EF_UNIT = { road: 'kg CO₂e / km', rail: 'kg CO₂e / tonne-km', ocean: 'kg CO₂e / tonne-km', air: 'kg CO₂e / tonne-km' };
const EF_BASIS = { road: 'per-truck-km', rail: 'per-tonne-km', ocean: 'per-tonne-km', air: 'per-tonne-km' };
/** Diesel burn implied by the workbook's road rows: 0.0153 kL ÷ 51 km = 0.3 L/km. */
const ROAD_LITRES_PER_KM = 0.3;

/** Transit estimates — the only figures not in the workbook. Disclosed in the UI. */
const TRANSIT = { kmPerDay: { road: 450, rail: 400, ocean: 480, air: 3000 }, portDwellDays: 3 };

// ── Geography ──────────────────────────────────────────────────────────────
// Coordinates for every place the workbook names. Real-world locations, used
// only to draw the map; the build throws if a workbook place is missing here.
const GEO = {
  'VKS Factory':    { lat: 17.4126, lon: 78.4071, kind: 'origin', country: 'India', state: 'Telangana' },
  'VKS Hyderabad':  { lat: 17.4126, lon: 78.4071, kind: 'origin', country: 'India', state: 'Telangana' },
  Factory:          { lat: 17.4126, lon: 78.4071, kind: 'origin', country: 'India', state: 'Telangana' },
  'ICD Hyderabad':  { lat: 17.4569, lon: 78.438,  kind: 'icd', country: 'India', state: 'Telangana' },
  'ICD Marripalem': { lat: 17.7286, lon: 83.253,  kind: 'icd', country: 'India', state: 'Andhra Pradesh' },
  Hyderabad:        { lat: 17.385,  lon: 78.4867, kind: 'icd', country: 'India', state: 'Telangana' },
  CCS:              { lat: 17.4126, lon: 78.4071, kind: 'icd', country: 'India', state: 'Telangana' },
  'Nhava Sheva':    { lat: 18.949,  lon: 72.949,  kind: 'gateway', country: 'India', state: 'Maharashtra' },
  Chennai:          { lat: 13.1,    lon: 80.3,    kind: 'gateway', country: 'India', state: 'Tamil Nadu' },
  'New York':       { lat: 40.67,   lon: -74.04,  kind: 'dest', country: 'United States', region: 'Americas' },
  Antwerp:          { lat: 51.26,   lon: 4.4,     kind: 'dest', country: 'Belgium', region: 'Europe' },
  Felixstowe:       { lat: 51.95,   lon: 1.32,    kind: 'dest', country: 'United Kingdom', region: 'Europe' },
  'Laem Chabang':   { lat: 13.08,   lon: 100.89,  kind: 'dest', country: 'Thailand', region: 'APAC' },
  Tokyo:            { lat: 35.62,   lon: 139.78,  kind: 'dest', country: 'Japan', region: 'APAC' },
  Konan:            { lat: 35.09,   lon: 136.88,  kind: 'dest', country: 'Japan', region: 'APAC' },
  Guangzhou:        { lat: 23.1,    lon: 113.25,  kind: 'dest', country: 'China', region: 'APAC' },
  Ballary:          { lat: 15.1394, lon: 76.9214, kind: 'growing-region', country: 'India', state: 'Karnataka' },
  Vatsavai:         { lat: 16.73,   lon: 80.49,   kind: 'growing-region', country: 'India', state: 'Andhra Pradesh' },
  Khammam:          { lat: 17.2473, lon: 80.1514, kind: 'growing-region', country: 'India', state: 'Telangana' },
  Warangal:         { lat: 17.9689, lon: 79.5941, kind: 'growing-region', country: 'India', state: 'Telangana' },
  Karnataka:        { lat: 15.3173, lon: 75.7139, kind: 'growing-region', country: 'India', state: 'Karnataka' },
};

/** Destination country, from the workbook's own port names. */
const DEST_MARKET = {
  'New York': 'United States', Antwerp: 'Belgium', Felixstowe: 'United Kingdom',
  'Laem Chabang': 'Thailand', Tokyo: 'Japan', Konan: 'Japan', Guangzhou: 'China',
};

// ── Small helpers ──────────────────────────────────────────────────────────
const r3 = (n) => Math.round(n * 1000) / 1000;
const r4 = (n) => Math.round(n * 10000) / 10000;
const r6 = (n) => Math.round(n * 1e6) / 1e6;
const sum = (arr, f) => arr.reduce((a, b) => a + f(b), 0);
const uniq = (arr) => [...new Set(arr)];
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const byDesc = (f) => (a, b) => f(b) - f(a);
const nf = (n) => Math.round(n).toLocaleString('en-US');

/**
 * CO₂e for prose. Most shipments here sit well below a tonne, so anything under
 * one is written in kilograms — "34 kg" instead of "0.03 t", which reads as
 * nothing. Mirrors `formatTonnes` in src/utils/format.ts.
 */
const fmtCo2e = (t) => {
  const abs = Math.abs(t);
  if (abs >= 100) return `${nf(t)} t`;
  if (abs >= 10) return `${t.toFixed(1)} t`;
  if (abs >= 1) return `${t.toFixed(2)} t`;
  if (abs === 0) return '0 kg';
  if (abs >= 0.001) return `${nf(t * 1000)} kg`;
  return `${(t * 1000).toFixed(2)} kg`;
};
/** Load weight for prose — kilograms below a tonne. */
const wt = (t) => (Math.abs(t) >= 1 ? `${t.toFixed(1)} t` : `${nf(t * 1000)} kg`);

/** Most frequent value first, ties broken alphabetically so output is stable. */
function rank(values) {
  const c = new Map();
  for (const v of values) c.set(v, (c.get(v) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))).map(([v]) => v);
}
function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// ── Product classification, parsed from the workbook's item descriptions ───
function classifyProduct(itemRaw) {
  const item = String(itemRaw).replace(/\s+/g, ' ').trim();
  const U = item.toUpperCase();

  const form = /CRUSH|MINCED/.test(U) ? 'Crushed'
    : /GRND|GROUND|GRD|POWDER/.test(U) ? 'Ground'
      : 'Whole';

  const base = /CAPSICUM/.test(U) ? 'Capsicum'
    : /CUMIN/.test(U) ? 'Cumin'
      : /PEPPER/.test(U) ? 'Red Pepper'
        : 'Chilli';

  // Scoville, written as "35000 SHU", "25,000 SHU", "35K-40K SHU", "60-000 SCU",
  // "10-20K" or "35-40 K". Ranges take the midpoint.
  let shu = null;
  const bandK = U.match(/(\d{1,3})\s*K?\s*[-–]\s*(\d{1,3})\s*K/);
  const flat = U.match(/(\d{1,3}[,\s-]\d{3}|\d{4,6})\s*(?:SHU|SCU)/);
  const soloK = U.match(/(\d{1,3})\s*K\s*(?:SHU|SCU)/);
  if (bandK) shu = ((Number(bandK[1]) + Number(bandK[2])) / 2) * 1000;
  else if (flat) shu = Number(flat[1].replace(/[,\s-]/g, ''));
  else if (soloK) shu = Number(soloK[1]) * 1000;
  if (shu !== null && (shu < 500 || shu > 200000)) shu = null;

  return {
    productName: item,
    productForm: form,
    category: `${base} · ${form}`,
    shu,
    productSku: `SKU-${slug(item).slice(0, 34).toUpperCase()}`,
  };
}

function place(name) {
  const g = GEO[name];
  if (!g) throw new Error(`No coordinates for workbook place "${name}" — add it to GEO in generate-mock-data.mjs`);
  return g;
}
const coord = (name) => ({ lat: place(name).lat, lon: place(name).lon });

function transitDays(mode, km) {
  const base = km / TRANSIT.kmPerDay[mode];
  return mode === 'ocean' || mode === 'air' ? base + TRANSIT.portDwellDays : base;
}

/** Which mode an inland row belongs to — told by its own emission factor. */
const modeOfInlandRow = (row) => (row.ef === EF.rail ? 'rail' : 'road');

/** Turn one workbook row (or a re-costed catalogue leg) into a Leg. */
function makeLeg(row, mode, seq, weightTonnes) {
  const km = row.distanceKm;
  return {
    seq,
    mode,
    modeLabel: mode[0].toUpperCase() + mode.slice(1),
    from: row.source,
    to: row.dest,
    fromCoord: coord(row.source),
    toCoord: coord(row.dest),
    distanceKm: r3(km),
    distanceNm: row.distanceNm ?? null,
    emissionFactor: row.ef,
    efUnit: EF_UNIT[mode],
    efBasis: EF_BASIS[mode],
    weightTonnes: r4(weightTonnes),
    co2eTonnes: r6(row.co2e),
    fuelLitres: mode === 'road'
      ? Math.round(row.fuelKl != null ? row.fuelKl * 1000 : km * ROAD_LITRES_PER_KM)
      : null,
    fuelType: row.fuelType ?? (mode === 'road' ? 'Diesel' : null),
    transitDaysEst: r3(transitDays(mode, km)),
    sourceRef: row.sourceRef,
  };
}

// ══════════════════════════════════════════════════════════════════════════
// 1. Leg catalogue — what routings the workbook actually evidences
// ══════════════════════════════════════════════════════════════════════════

const inlandCatalogue = new Map(); // "src→dst|km|mode" -> leg + count + refs
const oceanCatalogue = new Map(); // "gateway→dest|km"  -> leg + count + refs
const airCatalogue = new Map();

function catalogue(map, key, seed) {
  const hit = map.get(key);
  if (hit) {
    hit.count += 1;
    if (hit.refs.length < 4) hit.refs.push(seed.ref);
    return hit;
  }
  map.set(key, { ...seed, count: 1, refs: [seed.ref] });
  return map.get(key);
}

const inlandKey = (l) => `${l.source}→${l.dest}|${l.distanceKm}|${modeOfInlandRow(l)}`;

for (const year of src.years) {
  for (const sh of year.exportShipments) {
    for (const leg of sh.inland) {
      catalogue(inlandCatalogue, inlandKey(leg), {
        source: leg.source, dest: leg.dest, distanceKm: leg.distanceKm, mode: modeOfInlandRow(leg),
        ef: leg.ef, fuelKl: leg.fuelKl ?? null, fuelType: leg.fuelType ?? null, ref: leg.sourceRef,
      });
    }
    const o = sh.ocean;
    catalogue(oceanCatalogue, `${o.source}→${o.dest}|${o.distanceKm}`, {
      source: o.source, dest: o.dest, distanceKm: o.distanceKm, distanceNm: o.distanceNm ?? null,
      ef: o.ef, ref: o.sourceRef,
    });
  }
  for (const sh of year.airShipments) {
    const a = sh.air;
    catalogue(airCatalogue, `${a.source}→${a.dest}|${a.distanceKm}`, {
      source: a.source, dest: a.dest, distanceKm: a.distanceKm, ef: a.ef, ref: a.sourceRef,
    });
  }
}

/**
 * Every inland chain the workbook records for each gateway — the factory-to-port
 * routings a shipment could actually be put on, because other shipments were.
 *
 * All three tabs contribute, and that is deliberate: the tabs disagree about the
 * same movement. "VKS Factory → Hyderabad" is 645 km on 69 FY21-22 rows, 21 km
 * on 62 others, and 51 km to "ICD Hyderabad" on FY23-24. That disagreement is
 * the single largest first-mile opportunity in the book (26.4 t CO₂e), so each
 * chain carries the reporting years that evidence it and the option text names
 * both distances rather than quietly picking one.
 */
const INLAND_ROUTINGS = (() => {
  const byGateway = new Map();
  for (const year of src.years) {
    for (const sh of year.exportShipments) {
      if (!sh.inland.length) continue;
      const gw = sh.ocean.source;
      const chain = sh.inland.map(inlandKey);
      const bucket = byGateway.get(gw) ?? new Map();
      const key = chain.join(' + ');
      const hit = bucket.get(key) ?? { gateway: gw, chain, count: 0, years: new Set() };
      hit.count += 1;
      hit.years.add(year.reportingYear);
      bucket.set(key, hit);
      byGateway.set(gw, bucket);
    }
  }
  return new Map([...byGateway].map(([gw, b]) => [
    gw,
    [...b.values()].map((r) => ({ ...r, years: [...r.years].sort() })).sort(byDesc((r) => r.count)),
  ]));
})();

/** Road + rail kilometres of a leg chain — how the first mile is described. */
const inlandKmOf = (legs) => sum(legs.filter((l) => l.mode === 'road' || l.mode === 'rail'), (l) => l.distanceKm);

/**
 * Compare two leg chains mode by mode.
 *
 * Every "why this works" sentence has to account for the CO₂e it claims, and a
 * chain change almost never moves all four modes. Quoting a blended inland
 * distance — "1,347 km against 723 km" — hides that the whole saving is on the
 * road leg and that the 702 km rail leg beside it did not move at all, at a
 * factor sixty times smaller. So the modes are separated and only the ones that
 * actually change get described.
 */
function compareChains(fromLegs, toLegs) {
  const modes = ['road', 'rail', 'ocean', 'air'];
  const of = (legs, m, f) => sum(legs.filter((l) => l.mode === m), f);
  return modes
    .map((mode) => ({
      mode,
      fromKm: r3(of(fromLegs, mode, (l) => l.distanceKm)),
      toKm: r3(of(toLegs, mode, (l) => l.distanceKm)),
      fromCo2e: of(fromLegs, mode, (l) => l.co2eTonnes),
      toCo2e: of(toLegs, mode, (l) => l.co2eTonnes),
    }))
    .map((d) => ({ ...d, deltaKm: r3(d.toKm - d.fromKm), deltaCo2e: r6(d.toCo2e - d.fromCo2e) }))
    .filter((d) => d.fromKm > 0 || d.toKm > 0);
}

/** "saves 370 kg" / "adds 12 kg" — the direction stated, not left to a sign. */
const savingPhrase = (deltaCo2e) =>
  deltaCo2e < 0 ? `saving ${fmtCo2e(-deltaCo2e)}` : `adding ${fmtCo2e(deltaCo2e)}`;
/** Identity of a routing, so "the same chain as today" can be recognised. */
const chainSig = (legs) => legs.map((l) => `${l.from}→${l.to}|${r3(l.distanceKm)}|${l.mode}`).join(' + ');

/** Re-cost an inland routing for a weight, using the catalogue's own numbers. */
function costInlandRouting(routing, weightTonnes, seqStart = 1) {
  return routing.chain.map((key, i) => {
    const leg = inlandCatalogue.get(key);
    if (!leg) throw new Error(`Inland leg ${key} missing from catalogue`);
    const co2e = leg.mode === 'road'
      ? (leg.distanceKm * leg.ef) / 1000
      : (weightTonnes * leg.distanceKm * leg.ef) / 1000;
    return makeLeg({ ...leg, co2e, sourceRef: leg.refs[0] }, leg.mode, seqStart + i, weightTonnes);
  });
}

const costPerTonneKmLeg = (entry, mode, weightTonnes, seq) =>
  makeLeg(
    { ...entry, co2e: (weightTonnes * entry.distanceKm * entry.ef) / 1000, sourceRef: entry.refs[0] },
    mode, seq, weightTonnes,
  );

/** Sailings to a destination that the workbook records, shortest sea leg first. */
const oceanOptionsTo = (destPort) =>
  [...oceanCatalogue.values()].filter((e) => e.dest === destPort).sort((a, b) => a.distanceKm - b.distanceKm);

// ══════════════════════════════════════════════════════════════════════════
// 2. Flatten the workbook into shipments
// ══════════════════════════════════════════════════════════════════════════

const raw = [];
let seqNo = 0;

for (const year of src.years) {
  const fyTag = year.reportingYear.replace(/[^0-9]/g, '');

  // Export chain: the inland legs plus the ocean spine.
  for (const sh of year.exportShipments) {
    const o = sh.ocean;
    const weight = o.qtyKg / 1000;
    raw.push({
      shipmentId: `SHP-${fyTag}-${String(++seqNo).padStart(3, '0')}`,
      stream: 'export',
      reportingYear: year.reportingYear,
      date: o.date,
      status: 'Delivered',
      ...classifyProduct(o.item),
      weightTonnes: weight,
      gateway: o.source,
      destPort: o.dest,
      containerType: o.container ?? null,
      legs: [
        ...sh.inland.map((l, i) => makeLeg(l, modeOfInlandRow(l), i + 1, weight)),
        makeLeg(o, 'ocean', sh.inland.length + 1, weight),
      ],
      sourceRef: o.sourceRef,
      derivedFromRef: null,
    });
  }

  // Air freight: the road run to the airport plus the flight.
  for (const sh of year.airShipments) {
    const a = sh.air;
    const weight = a.qtyKg / 1000;
    raw.push({
      shipmentId: `SHP-${fyTag}-AIR-${String(a.sl ?? 1).padStart(2, '0')}`,
      stream: 'export',
      reportingYear: year.reportingYear,
      date: a.date,
      status: 'Delivered',
      ...classifyProduct(a.item),
      weightTonnes: weight,
      gateway: null,
      destPort: a.dest,
      containerType: null,
      legs: [
        ...sh.inland.map((l, i) => makeLeg(l, modeOfInlandRow(l), i + 1, weight)),
        makeLeg(a, 'air', sh.inland.length + 1, weight),
      ],
      sourceRef: a.sourceRef,
      derivedFromRef: null,
    });
  }

  // First-mile collection: one road run per row, carrying a monthly trip count,
  // so the workbook's CO₂e for the row already covers all of those trips.
  let colNo = 0;
  for (const row of year.collectionMovements) {
    const weight = row.qtyKg / 1000;
    raw.push({
      shipmentId: `COL-${fyTag}-${String(++colNo).padStart(3, '0')}`,
      stream: 'collection',
      reportingYear: year.reportingYear,
      date: row.date,
      status: 'Delivered',
      ...classifyProduct(row.item),
      weightTonnes: weight,
      gateway: null,
      destPort: row.dest,
      containerType: null,
      truckTrips: row.trips ?? 1,
      legs: [makeLeg(row, 'road', 1, weight)],
      sourceRef: row.sourceRef,
      derivedFromRef: null,
    });
  }
}

// ══════════════════════════════════════════════════════════════════════════
// 2b. The forward book — the only rows that are not from the workbook
// ══════════════════════════════════════════════════════════════════════════
//
// The workbook is a closed record: it stops on 30 Jun 2024 and every row in it
// has already shipped. There is nothing left to decide about any of them, so on
// its own the application can only ever explain history.
//
// The forward book fixes that with the smallest possible addition: the FY23-24
// export shipments dispatched between August and December, rolled forward three
// years so they land in the Aug–Dec 2026 planning window. That is it. No
// synthetic history, no filled-in years between the workbook and today — the
// reported footprint stays exactly the workbook's own, and the only synthetic
// rows in the whole dataset are ones a planner could still act on.
//
// Each is a real workbook shipment: product, weight, gateway, container, every
// distance and every emission factor are the recorded shipment's, and each row
// carries the cell range it came from. Only the dates move. Nothing is
// modelled, forecast or randomly generated.
const APP_TODAY = '2026-08-01';
const LAST_WORKBOOK_DISPATCH = raw.map((s) => s.date).sort().at(-1);

/** Same calendar date, `n` years on. 29 Feb clamps to 28 Feb in a common year. */
function addYears(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(Date.UTC(y + n, m - 1, d));
  if (target.getUTCMonth() !== m - 1) target.setUTCDate(0); // 29 Feb → 28 Feb
  return target.toISOString().slice(0, 10);
}

const ROLL_YEARS = 3;
const PLAN_SOURCE_YEAR = 'FY23-24'; // the latest recorded year — the current network
const PLAN_MONTHS = [8, 9, 10, 11, 12]; // August to December
const PLAN_REPORTING_YEAR = 'FY26-27';
/** Ceiling on the forward book, so the planning queue stays reviewable. */
const PLAN_MAX = 30;

for (const s of raw) s.dataOrigin = 'workbook';

const plannedSeeds = raw
  .filter(
    (s) =>
      s.dataOrigin === 'workbook' &&
      s.reportingYear === PLAN_SOURCE_YEAR &&
      s.stream === 'export' &&
      PLAN_MONTHS.includes(Number(s.date.slice(5, 7))),
  )
  .sort((a, b) => a.date.localeCompare(b.date) || a.shipmentId.localeCompare(b.shipmentId))
  .slice(0, PLAN_MAX);

plannedSeeds.forEach((s, i) => {
  raw.push({
    ...s,
    shipmentId: `PLN-${String(i + 1).padStart(3, '0')}`,
    status: 'Planned',
    reportingYear: PLAN_REPORTING_YEAR,
    date: addYears(s.date, ROLL_YEARS),
    legs: s.legs.map((l) => ({ ...l })),
    dataOrigin: 'synthetic',
    derivedFromRef: s.sourceRef,
    mirrorsReportingYear: PLAN_SOURCE_YEAR,
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 3. Per-shipment rollups
// ══════════════════════════════════════════════════════════════════════════

function rollup(s) {
  const legs = s.legs;
  const co2eOf = (mode) => sum(legs.filter((l) => l.mode === mode), (l) => l.co2eTonnes);
  const kmOf = (mode) => sum(legs.filter((l) => l.mode === mode), (l) => l.distanceKm);
  const co2e = sum(legs, (l) => l.co2eTonnes);
  const totalKm = sum(legs, (l) => l.distanceKm);
  const destPort = s.destPort;
  const g = place(destPort);
  return {
    ...s,
    truckTrips: s.truckTrips ?? 1,
    period: s.date.slice(0, 7),
    year: Number(s.date.slice(0, 4)),
    origin: legs[0].from,
    icd: legs.map((l) => l.to).find((p) => place(p).kind === 'icd') ?? null,
    destCountry: DEST_MARKET[destPort] ?? g.country,
    market: DEST_MARKET[destPort] ?? g.country,
    region: g.region ?? 'APAC',
    modePath: uniq(legs.map((l) => l.modeLabel)),
    primaryMode: [...legs].sort(byDesc((l) => l.co2eTonnes))[0].modeLabel,
    roadKm: r3(kmOf('road')),
    railKm: r3(kmOf('rail')),
    oceanKm: r3(kmOf('ocean')),
    airKm: r3(kmOf('air')),
    totalDistanceKm: r3(totalKm),
    fuelLitres: sum(legs, (l) => l.fuelLitres ?? 0),
    co2eTonnes: r6(co2e),
    roadCo2eTonnes: r6(co2eOf('road')),
    railCo2eTonnes: r6(co2eOf('rail')),
    oceanCo2eTonnes: r6(co2eOf('ocean')),
    airCo2eTonnes: r6(co2eOf('air')),
    co2ePerTonne: s.weightTonnes > 0 ? r4(co2e / s.weightTonnes) : 0,
    co2ePerTonneKm: s.weightTonnes > 0 && totalKm > 0 ? r3((co2e * 1e6) / (s.weightTonnes * totalKm)) : 0,
    transitDaysEst: Math.round(sum(legs, (l) => l.transitDaysEst)),
    // Derived, like transit itself — the workbook records no arrival date.
    eta: addDays(s.date, Math.round(sum(legs, (l) => l.transitDaysEst))),
    dataConfidence: 'High',
    isAirFreight: legs.some((l) => l.mode === 'air'),
  };
}

/** The order the export chain physically runs in: inland first, long haul last. */
const TRAVEL_ORDER = ['Road', 'Rail', 'Ocean', 'Air'];

/** Lane = destination port × product category (collection keeps its own lanes). */
const laneIdOf = (s) => (s.stream === 'collection'
  ? `LN-COL-${slug(s.origin)}-${slug(s.destPort)}`
  : `LN-${slug(s.destPort)}-${slug(s.category)}`);

let enriched = raw.map(rollup).map((s) => ({ ...s, laneId: laneIdOf(s) }));

// ══════════════════════════════════════════════════════════════════════════
// 4. Route options — re-cost each shipment through evidenced chains
// ══════════════════════════════════════════════════════════════════════════

/**
 * What each card is *called*, and what it *says*.
 *
 * The label names the kind of decision, nothing more — "Different gateway", not
 * "Rail to Nhava Sheva". A reader scanning the cards should be able to see which
 * levers exist for this shipment before reading a single number, and a label
 * that already states the answer ("Shorter sea routing") is a finding dressed up
 * as a category. The finding belongs in `detail`, which the bar chart shows on
 * hover and the card prints underneath.
 *
 * `current` has no fixed label because "as booked" is only true of freight that
 * has already moved. Nothing in the forward book is booked yet — that is the
 * entire point of it — so the label is chosen per shipment below.
 */
const OPTION_META = {
  current: { label: 'Route as shipped', tagline: 'The routing this shipment actually ran' },
  'shorter-first-mile': { label: 'Different inland route', tagline: 'Same gateway and sailing, a different run to the port' },
  'gateway-swap': { label: 'Different gateway', tagline: 'Leave India through another port' },
  'shorter-sea': { label: 'Different sailing', tagline: 'Same two ports, a different recorded sea route' },
  'sea-instead-of-air': { label: 'Different mode', tagline: 'Ocean routing instead of the flight' },
  consolidate: { label: 'Combined truck load', tagline: 'One truck run shared with the same-day shipments' },
};

/** The booked route reads differently depending on whether it has happened. */
const CURRENT_META = {
  Delivered: { label: 'Route as shipped', tagline: 'The routing this shipment actually ran' },
  Planned: { label: 'Usual routing', tagline: 'How this lane normally runs — nothing is booked yet' },
};

/**
 * Which lever each option pulls, in the order the cards are read. One card per
 * lever: a shipment never shows two gateway swaps, it shows the best one.
 */
const OPTION_ORDER = ['shorter-first-mile', 'shorter-sea', 'gateway-swap', 'sea-instead-of-air', 'consolidate'];

function finishOption(kind, legs, gateway, current, extra) {
  const co2e = sum(legs, (l) => l.co2eTonnes);
  const days = Math.round(sum(legs, (l) => l.transitDaysEst));
  const delta = current ? co2e - current.co2eTonnes : 0;
  const modes = uniq(legs.map((l) => l.modeLabel));
  // The specific finding — what this option concretely does. It is named after
  // what actually changes inland, so it can never claim rail on an all-road
  // routing. Shown on hover and beneath the card's general label.
  const detail = kind === 'gateway-swap'
    ? `${modes.includes('Rail') ? 'Rail' : 'Road'} to ${gateway}`
    : (extra?.detail ?? OPTION_META[kind].tagline);
  const label = kind === 'current' ? (CURRENT_META[extra?.status]?.label ?? OPTION_META.current.label) : OPTION_META[kind].label;
  const tagline = kind === 'current'
    ? (CURRENT_META[extra?.status]?.tagline ?? OPTION_META.current.tagline)
    : OPTION_META[kind].tagline;
  const seaKm = sum(legs.filter((l) => l.mode === 'ocean' || l.mode === 'air'), (l) => l.distanceKm);
  return {
    // Two options can share a kind (two gateways, two recorded sailings for one
    // port pair, or two inland chains to one gateway), so the id carries the
    // gateway plus both the long-haul and the inland distance.
    id: `${kind}:${slug(gateway ?? 'none')}:${Math.round(seaKm)}:${Math.round(inlandKmOf(legs))}`,
    kind,
    label,
    detail,
    tagline,
    legs: legs.map((l, i) => ({ ...l, seq: i + 1 })),
    modePath: uniq(legs.map((l) => l.modeLabel)),
    gateway,
    co2eTonnes: r6(co2e),
    distanceKm: r3(sum(legs, (l) => l.distanceKm)),
    transitDaysEst: days,
    co2eDeltaTonnes: r6(delta),
    co2eDeltaPct: current && current.co2eTonnes > 0 ? r3((delta / current.co2eTonnes) * 100) : 0,
    transitDeltaDays: current ? days - current.transitDaysEst : 0,
    isCurrent: kind === 'current',
    /** Set once the whole candidate set is ranked — the lowest-CO₂e route. */
    isOptimised: false,
    ...extra,
  };
}

/** Heaviest single export load in the workbook — the truck capacity it evidences. */
const MAX_TRUCK_TONNES = Math.max(...enriched.filter((s) => s.stream === 'export').map((s) => s.weightTonnes));

/** Same-day, same-gateway shipments that could share one truck run. */
const truckGroups = new Map();
for (const s of enriched) {
  if (s.stream !== 'export' || !s.gateway) continue;
  const key = `${s.date}|${s.gateway}|${s.status}`;
  truckGroups.set(key, [...(truckGroups.get(key) ?? []), s]);
}

/**
 * Price every routing the workbook evidences for one shipment.
 *
 * Each lever is isolated so a card only ever claims the change it makes: a
 * "shorter sailing" keeps the shipment's own first mile, a "shorter first mile"
 * keeps its own sailing, and only a gateway swap changes both — because it has
 * to. Every candidate is priced, then the best instance of each lever survives,
 * so a shipment shows at most one card per lever and never two gateway swaps.
 *
 * Returns `{ options, considered }`: the cards to show, and how many distinct
 * routings were priced and rejected as no better. That count is what lets the
 * app say "already the optimised route" instead of just showing nothing.
 */
function buildOptions(s) {
  const weight = s.weightTonnes;
  const current = finishOption('current', s.legs, s.gateway, null, {
    status: s.status,
    detail: `${uniq(s.legs.map((l) => l.modeLabel)).join(' → ')}${s.gateway ? ` via ${s.gateway}` : ''}`,
    timesUsedInWorkbook: 1,
    evidence: `Recorded on tab ${s.sourceRef.split('!')[0]} of the workbook.`,
    evidenceRefs: [s.sourceRef],
  });
  if (s.stream === 'collection') {
    // A collection run is a single road movement from a growing region — there
    // is no gateway, sailing or mode to change, so the route it took is by
    // definition the optimised one. It still has to carry the flag, or the UI
    // reads "no optimised route" on a third of the register.
    current.isOptimised = true;
    return { options: [current], considered: 0 };
  }

  const candidates = [];
  const add = (opt) => candidates.push(opt);
  const inlandLegs = s.legs.filter((l) => l.mode === 'road' || l.mode === 'rail');
  const oceanLeg = s.legs.find((l) => l.mode === 'ocean');
  const currentSig = chainSig(s.legs);

  // (a) Air → sea, where the workbook records a sailing to the same country.
  if (s.isAirFreight) {
    const country = DEST_MARKET[s.destPort];
    const best = [...oceanCatalogue.values()]
      .filter((e) => DEST_MARKET[e.dest] === country)
      .sort((a, b) => a.distanceKm - b.distanceKm)[0];
    // One candidate per inland chain to that gateway; the cheapest survives
    // ranking. Taking the most-used chain instead would price the sea option on
    // the 645 km first mile the tabs themselves contradict.
    for (const routing of best ? (INLAND_ROUTINGS.get(best.source) ?? []) : []) {
      const legs = [...costInlandRouting(routing, weight), costPerTonneKmLeg(best, 'ocean', weight, 99)];
      add(finishOption('sea-instead-of-air', legs, best.source, current, {
        detail: `Send by sea — ${best.source} → ${best.dest}, ${nf(best.distanceKm)} km`,
        timesUsedInWorkbook: best.count,
        // The mode swap is the headline, but it is not always the whole story:
        // reaching a seaport can mean a completely different inland run from the
        // one to the airport, and on a light shipment that road change can carry
        // more of the saving than the flight does. Both are stated, largest first.
        evidence: (() => {
          const diff = compareChains(s.legs, legs).filter((d) => Math.abs(d.deltaCo2e) > 1e-9);
          const ranked = [...diff].sort((a, b) => Math.abs(b.deltaCo2e) - Math.abs(a.deltaCo2e));
          const air = diff.find((d) => d.mode === 'air');
          const inland = ranked.filter((d) => d.mode === 'road' || d.mode === 'rail');
          return (
            `Air is charged at ${EF.air} kg CO₂e per tonne-km against ${EF.ocean} at sea — `
            + `${Math.round(EF.air / EF.ocean)}× more for every tonne carried. Taking this ${wt(weight)} off the plane `
            + `and onto the ${nf(best.distanceKm)} km ${best.source} → ${best.dest} sailing `
            + `${air
              ? `cuts the long haul alone from ${fmtCo2e(air.fromCo2e)} to `
                + `${fmtCo2e(diff.find((d) => d.mode === 'ocean')?.toCo2e ?? 0)}. `
              : '. '}`
            + (inland.length
              ? `Reaching a seaport also changes the inland run — `
                + `${inland.map((d) => `${d.mode} ${nf(d.fromKm)} km → ${nf(d.toKm)} km, ${savingPhrase(d.deltaCo2e)}`).join('; ')}`
                + `${inland.some((d) => d.mode === 'road') ? ', road being charged per truck run rather than per tonne' : ''}. `
              : '')
            + `The workbook already ships to ${country} by sea (${best.count} shipment${best.count === 1 ? '' : 's'}) and `
            + `reaches ${best.source} overland on ${routing.count} shipment${routing.count === 1 ? '' : 's'} `
            + `(${routing.years.join(', ')}). The trade is time: sea takes weeks where the flight took days, so this only `
            + `works where the delivery date allows it.`
          );
        })(),
        evidenceRefs: uniq([...best.refs, ...routing.chain.map((k) => inlandCatalogue.get(k).refs[0])]),
      }));
    }
    return rankOptions(current, candidates);
  }

  // (b) Shorter first mile — same gateway, same sailing, a different inland
  //     chain the workbook records for that gateway. This is where the tabs'
  //     disagreement about the factory-to-depot run turns into real tonnes.
  if (s.gateway && oceanLeg) {
    for (const routing of INLAND_ROUTINGS.get(s.gateway) ?? []) {
      const legs = [...costInlandRouting(routing, weight), { ...oceanLeg }];
      if (chainSig(legs) === currentSig) continue; // that is the current first mile
      // Name the modes that actually move, and the one that does not — the rail
      // haul is usually identical, and saying so is what makes the road figure
      // beside it mean something.
      const diff = compareChains(s.legs, legs);
      const moved = diff.filter((d) => d.mode !== 'ocean' && Math.abs(d.deltaKm) > 0.5);
      const unchanged = diff.filter((d) => d.mode !== 'ocean' && Math.abs(d.deltaKm) <= 0.5 && d.fromKm > 0);
      add(finishOption('shorter-first-mile', legs, s.gateway, current, {
        detail: moved.length
          ? `Shorter first mile — ${moved.map((d) => `${d.mode} ${nf(d.fromKm)} → ${nf(d.toKm)} km`).join(', ')}`
          : 'Shorter first mile',
        timesUsedInWorkbook: routing.count,
        evidence: `Same gateway, same sailing — only the run to ${s.gateway} changes. `
          + moved
            .map(
              (d) => `The ${d.mode} leg goes from ${nf(d.fromKm)} km to ${nf(d.toKm)} km, ${savingPhrase(d.deltaCo2e)}`
                + ` at ${EF[d.mode]} kg CO₂e per ${d.mode === 'road' ? 'km whatever the load' : 'tonne-km'}.`,
            )
            .join(' ')
          + (unchanged.length
            ? ` The ${unchanged.map((d) => `${d.mode} leg (${nf(d.fromKm)} km)`).join(' and ')} `
              + `${unchanged.length === 1 ? 'is' : 'are'} unchanged.`
            : '')
          + ` The workbook runs this shorter chain on ${routing.count} shipment${routing.count === 1 ? '' : 's'} `
          + `(${routing.years.join(', ')}), so it is a route the business has already used, not a proposal.`,
        evidenceRefs: routing.chain.map((k) => inlandCatalogue.get(k).refs[0]),
      }));
    }
  }

  // (c) Shorter sailing — same gateway, a different sea distance the workbook
  //     records for the same port pair. The first mile is left exactly as booked.
  if (oceanLeg) {
    for (const oceanEntry of oceanOptionsTo(s.destPort)) {
      if (oceanEntry.source !== s.gateway) continue;
      if (Math.abs(oceanEntry.distanceKm - oceanLeg.distanceKm) < 0.5) continue;
      const legs = [...inlandLegs.map((l) => ({ ...l })), costPerTonneKmLeg(oceanEntry, 'ocean', weight, 99)];
      const seaDelta = oceanLeg.distanceKm - oceanEntry.distanceKm;
      const seaSaving = oceanLeg.co2eTonnes - legs[legs.length - 1].co2eTonnes;
      add(finishOption('shorter-sea', legs, s.gateway, current, {
        detail: `${seaDelta > 0 ? 'Shorter' : 'Longer'} sea routing — ${nf(oceanEntry.distanceKm)} km instead of ${nf(oceanLeg.distanceKm)} km`,
        timesUsedInWorkbook: oceanEntry.count,
        evidence: `The workbook records two different sailing distances for ${oceanEntry.source} → ${oceanEntry.dest}: `
          + `${nf(oceanEntry.distanceKm)} km on ${oceanEntry.count} shipment${oceanEntry.count === 1 ? '' : 's'}, against `
          + `${nf(oceanLeg.distanceKm)} km on this one — ${nf(Math.abs(seaDelta))} km `
          + `${seaDelta > 0 ? 'less' : 'more'} at sea. The whole change is the ocean leg: at ${EF.ocean} kg CO₂e per `
          + `tonne-km on ${wt(weight)}, that is ${fmtCo2e(Math.abs(seaSaving))} ${seaSaving > 0 ? 'saved' : 'added'}. `
          + `Same two ports, same gateway, and the inland run is untouched.`,
        evidenceRefs: oceanEntry.refs.slice(0, 3),
      }));
    }
  }

  // (d) Gateway swap — leave India through another port, on an inland chain
  //     that port already uses. Both the inland run and the sailing change.
  for (const oceanEntry of oceanOptionsTo(s.destPort)) {
    if (oceanEntry.source === s.gateway) continue;
    for (const routing of INLAND_ROUTINGS.get(oceanEntry.source) ?? []) {
      const legs = [...costInlandRouting(routing, weight), costPerTonneKmLeg(oceanEntry, 'ocean', weight, 99)];
      // Attribute the change leg by leg. A gateway swap moves the inland run and
      // the sailing at once, and which of the two carries the saving flips with
      // the load: on a light shipment the road leg dominates because it is
      // charged per truck, on a heavy one the sea distance does.
      const diff = compareChains(s.legs, legs);
      const changed = diff.filter((d) => Math.abs(d.deltaCo2e) > 1e-9);
      const dominant = [...changed].sort((a, b) => Math.abs(b.deltaCo2e) - Math.abs(a.deltaCo2e))[0];
      const describe = (d) => {
        if (d.fromKm === 0) return `${nf(d.toKm)} km of ${d.mode} is added, ${savingPhrase(d.deltaCo2e)}`;
        if (d.toKm === 0) return `the ${nf(d.fromKm)} km ${d.mode} leg goes away, ${savingPhrase(d.deltaCo2e)}`;
        return `${d.mode} goes from ${nf(d.fromKm)} km to ${nf(d.toKm)} km, ${savingPhrase(d.deltaCo2e)}`;
      };
      add(finishOption('gateway-swap', legs, oceanEntry.source, current, {
        timesUsedInWorkbook: Math.min(oceanEntry.count, routing.count),
        evidence: `Leaving through ${oceanEntry.source} instead of ${s.gateway ?? 'the current gateway'} changes both the `
          + `inland run and the sailing: ${changed.map(describe).join('; ')}. `
          + (dominant
            ? `Most of the difference is the ${dominant.mode} leg${dominant.mode === 'road' ? ', which is charged per truck run rather than per tonne, so the distance driven is the whole of it' : ` at ${EF[dominant.mode]} kg CO₂e per tonne-km on ${wt(weight)}`}. `
            : '')
          + `The workbook already sails ${oceanEntry.source} → ${oceanEntry.dest} ${oceanEntry.count} `
          + `time${oceanEntry.count === 1 ? '' : 's'} and runs that inland chain on ${routing.count} `
          + `shipment${routing.count === 1 ? '' : 's'}, so both halves of this route are ones it has already used.`,
        evidenceRefs: uniq([
          ...oceanEntry.refs.slice(0, 2),
          ...routing.chain.map((k) => inlandCatalogue.get(k).refs[0]),
        ]),
      }));
    }
  }

  // (e) Consolidation — the workbook's road factor is per truck run, so
  //     same-day shipments through one gateway that fit one load can share it.
  const group = truckGroups.get(`${s.date}|${s.gateway}|${s.status}`) ?? [];
  const groupWeight = sum(group, (g) => g.weightTonnes);
  if (group.length > 1 && groupWeight <= MAX_TRUCK_TONNES && s.roadCo2eTonnes > 0) {
    const share = 1 / group.length;
    const legs = s.legs.map((l) => (l.mode === 'road'
      ? { ...l, co2eTonnes: r6(l.co2eTonnes * share), fuelLitres: Math.round((l.fuelLitres ?? 0) * share) }
      : { ...l }));
    add(finishOption('consolidate', legs, s.gateway, current, {
      detail: `Share one truck with the ${group.length - 1} other same-day ${s.gateway} load${group.length === 2 ? '' : 's'}`,
      timesUsedInWorkbook: group.length,
      evidence: `${group.length} shipments leave through ${s.gateway} on ${s.date} and together weigh `
        + `${groupWeight.toFixed(2)} t, which fits the ${MAX_TRUCK_TONNES.toFixed(2)} t heaviest single load the workbook `
        + `records — so one truck can carry all ${group.length}. Road CO₂e is charged per truck run and not per tonne `
        + `carried, so running one instead of ${group.length} divides this shipment's ${fmtCo2e(s.roadCo2eTonnes)} of road `
        + `CO₂e by ${group.length}. Nothing else about the route changes, and the sailing is untouched.`,
      evidenceRefs: group.map((g) => g.sourceRef).slice(0, 4),
    }));
  }

  return rankOptions(current, candidates);
}

/**
 * Rank the priced candidates into the cards a user sees.
 *
 * One card per lever — the lowest-CO₂e instance of it — and only levers that
 * actually beat what is booked today. A routing that costs more is not offered;
 * it is counted in `considered`, which is how the app can say the current route
 * is already the optimised one and how many alternatives that claim rests on.
 */
function rankOptions(current, candidates) {
  const bestPerKind = new Map();
  for (const c of candidates) {
    const held = bestPerKind.get(c.kind);
    if (!held || c.co2eTonnes < held.co2eTonnes) bestPerKind.set(c.kind, c);
  }
  const ranked = OPTION_ORDER.map((k) => bestPerKind.get(k)).filter(Boolean);
  const better = ranked.filter((o) => o.co2eDeltaTonnes < -1e-9).sort((a, b) => a.co2eTonnes - b.co2eTonnes);

  // The optimised route is the lowest-CO₂e routing on the table — which is the
  // current one whenever nothing beats it.
  (better[0] ?? current).isOptimised = true;

  return {
    options: [current, ...better],
    considered: uniq(candidates.map((c) => c.id)).length,
  };
}

const optionsById = new Map();
enriched = enriched.map((s) => {
  const { options, considered } = buildOptions(s);
  optionsById.set(s.shipmentId, options);
  const best = options.find((o) => o.isOptimised && !o.isCurrent);
  const avoidable = best ? -best.co2eDeltaTonnes : 0;
  return {
    ...s,
    avoidableTonnes: r6(avoidable),
    avoidablePct: s.co2eTonnes > 0 ? r3((avoidable / s.co2eTonnes) * 100) : 0,
    bestOptionKind: best?.kind ?? null,
    bestOptionLabel: best?.label ?? null,
    // Distinct routings the workbook evidences for this shipment that were
    // priced. Lets the app distinguish "already the lowest of 3 routings" from
    // "the workbook records no other way to move this".
    alternativesConsidered: considered,
  };
});

// ══════════════════════════════════════════════════════════════════════════
// 5. Recommendations — one per shipment with a better evidenced option
// ══════════════════════════════════════════════════════════════════════════

const COMPLEXITY = {
  'shorter-first-mile': 'Low', 'gateway-swap': 'Medium', 'shorter-sea': 'Low',
  'sea-instead-of-air': 'Medium', consolidate: 'Low',
};
const TITLE = {
  'shorter-first-mile': (s, o) => `Run the shorter first mile to ${o.gateway}`,
  'gateway-swap': (s, o) => (o.modePath.includes('Rail')
    ? `Rail it out through ${o.gateway} instead of trucking to ${s.gateway}`
    : `Route through ${o.gateway} instead of ${s.gateway}`),
  'shorter-sea': (s, o) => `Book the shorter ${o.gateway} → ${s.destPort} sailing`,
  'sea-instead-of-air': (s, o) => `Send this by sea through ${o.gateway} instead of flying`,
  consolidate: (s) => `Put the ${s.date} ${s.gateway} loads on one truck`,
};

const recommendations = [];
for (const s of enriched) {
  const best = (optionsById.get(s.shipmentId) ?? []).find((o) => o.isOptimised && !o.isCurrent);
  if (!best) continue;
  const saving = -best.co2eDeltaTonnes;
  const transitPhrase = best.transitDeltaDays === 0
    ? 'no change to estimated transit'
    : `about ${Math.abs(best.transitDeltaDays)} day${Math.abs(best.transitDeltaDays) === 1 ? '' : 's'} ${best.transitDeltaDays > 0 ? 'slower' : 'faster'}`;
  recommendations.push({
    id: `REC-${s.shipmentId}`,
    laneId: s.laneId,
    shipmentId: s.shipmentId,
    laneLabel: `${s.origin} → ${s.destPort}`,
    origin: s.origin,
    gateway: s.gateway,
    destPort: s.destPort,
    region: s.region,
    category: s.category,
    type: best.kind,
    optionKind: best.kind,
    optionId: best.id,
    title: TITLE[best.kind](s, best),
    rationale: `${fmtCo2e(s.co2eTonnes)} → ${fmtCo2e(best.co2eTonnes)} CO₂e, saving ${fmtCo2e(saving)} `
      + `(${Math.abs(best.co2eDeltaPct).toFixed(0)}%), with ${transitPhrase}.`,
    proof: best.evidence,
    proofRefs: best.evidenceRefs,
    estCo2eSavingTonnes: r6(saving),
    estCo2eSavingPct: r3(Math.abs(best.co2eDeltaPct)),
    transitImpactDays: best.transitDeltaDays,
    fromModePath: s.modePath,
    toModePath: best.modePath,
    complexity: COMPLEXITY[best.kind],
    ownerPersona: 'logistics',
    priorityScore: r6(saving),
    status: 'suggested',
    shipmentDate: s.date,
    evidence: [
      { label: 'CO₂e today', value: fmtCo2e(s.co2eTonnes) },
      { label: 'On this option', value: fmtCo2e(best.co2eTonnes), comparison: `${fmtCo2e(saving)} saved` },
      { label: 'Transit (est.)', value: `${best.transitDaysEst} days`, comparison: `${s.transitDaysEst} days today` },
      { label: 'Already used on', value: `${best.timesUsedInWorkbook} shipment${best.timesUsedInWorkbook === 1 ? '' : 's'}` },
    ],
  });
}
recommendations.sort(byDesc((r) => r.priorityScore));

// ══════════════════════════════════════════════════════════════════════════
// 6. Lanes
// ══════════════════════════════════════════════════════════════════════════

const laneGroups = new Map();
for (const s of enriched) laneGroups.set(s.laneId, [...(laneGroups.get(s.laneId) ?? []), s]);

const lanes = [...laneGroups.entries()].map(([laneId, rows]) => {
  const first = rows[0];
  const laneCo2e = sum(rows, (r) => r.co2eTonnes);
  const weight = sum(rows, (r) => r.weightTonnes);
  const tkm = sum(rows, (r) => r.totalDistanceKm * r.weightTonnes);
  const years = uniq(rows.map((r) => r.reportingYear)).length;
  const planned = rows.filter((r) => r.status === 'Planned');
  const avoidable = sum(rows, (r) => r.avoidableTonnes);
  const gateways = rank(rows.map((r) => r.gateway).filter(Boolean));
  const gatewayName = gateways[0] ?? first.icd ?? first.origin;
  const best = [...rows].sort(byDesc((r) => r.avoidableTonnes))[0];
  return {
    laneId,
    label: first.stream === 'collection'
      ? `${first.origin} → ${first.destPort} · first-mile collection`
      : `${first.origin} → ${first.destPort} · ${first.category}`,
    origin: first.origin,
    destPort: first.destPort,
    destCountry: first.destCountry,
    market: first.market,
    region: first.region,
    category: first.category,
    productForm: first.productForm,
    gateways,
    primaryGateway: gatewayName,
    primaryMode: rank(rows.map((r) => r.primaryMode))[0],
    // The most common *whole* path, kept in travel order. Ranking individual
    // modes would emit nonsense like "Ocean → Road → Rail".
    modePath: rank(rows.map((r) => r.modePath.join('>')))[0].split('>'),
    hasAirFreight: rows.some((r) => r.isAirFreight),
    airShipmentCount: rows.filter((r) => r.isAirFreight).length,
    airSharePct: laneCo2e > 0 ? r3((sum(rows.filter((r) => r.isAirFreight), (r) => r.co2eTonnes) / laneCo2e) * 100) : 0,
    shipmentCount: rows.length,
    annualFrequency: r3(rows.length / Math.max(1, years)),
    plannedShipmentCount: planned.length,
    workbookShipmentCount: rows.filter((r) => r.dataOrigin === 'workbook').length,
    syntheticShipmentCount: rows.filter((r) => r.dataOrigin === 'synthetic').length,
    totalWeightTonnes: r3(weight),
    totalCo2eTonnes: r6(laneCo2e),
    // Per-mode split of the lane's own CO₂e. Charts must attribute by the leg
    // that produced the emissions, not by the lane's dominant mode — otherwise
    // the road share, which is the part a routing decision moves, disappears
    // behind the ocean leg that outweighs it.
    roadCo2eTonnes: r6(sum(rows, (r) => r.roadCo2eTonnes)),
    railCo2eTonnes: r6(sum(rows, (r) => r.railCo2eTonnes)),
    oceanCo2eTonnes: r6(sum(rows, (r) => r.oceanCo2eTonnes)),
    airCo2eTonnes: r6(sum(rows, (r) => r.airCo2eTonnes)),
    // Every mode the lane has used, in travel order. Concatenating the shipments'
    // own paths is not enough: different shipments visit modes in different
    // orders, so the merged list can come out "Road › Ocean › Rail". The export
    // chain always runs inland-then-long-haul, so it is sorted on that.
    modesUsed: uniq(rows.flatMap((r) => r.modePath)).sort((a, b) => TRAVEL_ORDER.indexOf(a) - TRAVEL_ORDER.indexOf(b)),
    annualCo2eTonnes: r6(laneCo2e / Math.max(1, years)),
    avgCo2ePerTonne: weight > 0 ? r4(laneCo2e / weight) : 0,
    avgCo2ePerTonneKm: tkm > 0 ? r3((laneCo2e * 1e6) / tkm) : 0,
    avgWeightTonnes: r3(weight / rows.length),
    avoidableTonnes: r6(avoidable),
    avoidablePct: laneCo2e > 0 ? r3((avoidable / laneCo2e) * 100) : 0,
    plannedAvoidableTonnes: r6(sum(planned, (r) => r.avoidableTonnes)),
    bestOptionKind: best.bestOptionKind,
    bestOptionLabel: best.bestOptionLabel,
    currentPerShipmentTonnes: r6(best.co2eTonnes),
    bestPerShipmentTonnes: r6(Math.max(0, best.co2eTonnes - best.avoidableTonnes)),
    coords: { origin: coord(first.origin), gateway: coord(gatewayName), destPort: coord(first.destPort) },
    _rows: rows,
  };
}).sort((a, b) => b.avoidableTonnes - a.avoidableTonnes || b.totalCo2eTonnes - a.totalCo2eTonnes);

// ══════════════════════════════════════════════════════════════════════════
// 7. Exceptions — everything odd that the workbook itself shows
// ══════════════════════════════════════════════════════════════════════════

const exceptions = [];

// Synthetic *delivered* rows are mirrors of workbook rows that are already
// listed here, so raising the same exception again would just triple the count.
// Workbook history and the forward book both stay in.
const exceptionRows = enriched.filter((s) => s.dataOrigin === 'workbook' || s.status === 'Planned');

for (const s of exceptionRows.filter((x) => x.isAirFreight)) {
  exceptions.push({
    id: `EXC-AIR-${s.shipmentId}`,
    kind: 'air',
    severity: s.co2eTonnes > 1 ? 'High' : 'Medium',
    shipmentId: s.shipmentId,
    laneLabel: `${s.origin} → ${s.destPort}`,
    region: s.region,
    title: `${wt(s.weightTonnes)} flown to ${s.destPort}`,
    detail: `${fmtCo2e(s.co2eTonnes)} CO₂e on ${s.date}. Air is charged at ${EF.air} kg CO₂e per tonne-km against `
      + `${EF.ocean} at sea — ${Math.round(EF.air / EF.ocean)}× more for every tonne carried.`,
    co2eTonnes: r6(s.co2eTonnes),
    avoidableTonnes: r6(s.avoidableTonnes),
    sourceRef: s.sourceRef,
  });
}

// Dedicated truck runs for a fraction of a load — the road factor is per run.
for (const s of exceptionRows.filter((x) => x.stream === 'export' && !x.isAirFreight && x.weightTonnes < 1 && x.roadCo2eTonnes > 0)) {
  exceptions.push({
    id: `EXC-LOAD-${s.shipmentId}`,
    kind: 'low-load',
    severity: s.roadCo2eTonnes / s.co2eTonnes > 0.5 ? 'High' : 'Medium',
    shipmentId: s.shipmentId,
    laneLabel: `${s.origin} → ${s.destPort}`,
    region: s.region,
    title: `${wt(s.weightTonnes)} on a ${Math.round(s.roadKm)} km dedicated truck run`,
    detail: `Road CO₂e is charged per truck run, so this ${wt(s.weightTonnes)} load carries the same `
      + `${fmtCo2e(s.roadCo2eTonnes)} of road CO₂e that a full ${MAX_TRUCK_TONNES.toFixed(0)} t load would — `
      + `${Math.round((s.roadCo2eTonnes / s.co2eTonnes) * 100)}% of this shipment's whole footprint.`,
    co2eTonnes: r6(s.co2eTonnes),
    avoidableTonnes: r6(s.avoidableTonnes),
    sourceRef: s.sourceRef,
  });
}

for (const year of src.years) {
  (year.dataFlags ?? []).forEach((flag, i) => {
    exceptions.push({
      id: `EXC-DQ-${year.reportingYear}-${i + 1}`,
      kind: 'data-quality',
      severity: 'Low',
      laneLabel: year.reportingYear,
      region: 'All',
      title: flag.kind === 'duplicate-inland-leg' ? 'Duplicated inland leg' : 'Two distances for one movement',
      detail: flag.detail,
      co2eTonnes: r6(flag.co2eTonnes ?? 0),
      avoidableTonnes: 0,
      sourceRef: flag.sourceRef,
    });
  });
}
exceptions.sort((a, b) => (b.avoidableTonnes || b.co2eTonnes) - (a.avoidableTonnes || a.co2eTonnes));

// ══════════════════════════════════════════════════════════════════════════
// 8. Reference data, evidence and assumptions
// ══════════════════════════════════════════════════════════════════════════

const exportRows = enriched.filter((s) => s.stream === 'export');
const delivered = enriched.filter((s) => s.status === 'Delivered');
const planned = enriched.filter((s) => s.status === 'Planned');
/** Rows read straight from the sheet — the only ones the report may quote. */
const fromWorkbook = enriched.filter((s) => s.dataOrigin === 'workbook');

const emissionFactors = [
  {
    id: 'EF-ROAD', mode: 'Road', value: EF.road, unit: EF_UNIT.road, basis: EF_BASIS.road,
    note: 'Charged per truck-kilometre, so a part load emits exactly what a full one does. This is what makes the gateway choice and truck sharing worth real tonnes.',
    sourceRef: [...inlandCatalogue.values()].find((l) => l.mode === 'road').refs[0],
  },
  {
    id: 'EF-RAIL', mode: 'Rail', value: EF.rail, unit: EF_UNIT.rail, basis: EF_BASIS.rail,
    note: 'Charged per tonne-kilometre, so a light load travels almost free next to a dedicated truck.',
    sourceRef: [...inlandCatalogue.values()].find((l) => l.mode === 'rail')?.refs[0] ?? '',
  },
  {
    id: 'EF-OCEAN', mode: 'Ocean', value: EF.ocean, unit: EF_UNIT.ocean, basis: EF_BASIS.ocean,
    note: 'Applied to every sailing in the workbook, whatever the container size.',
    sourceRef: [...oceanCatalogue.values()][0].refs[0],
  },
  {
    id: 'EF-AIR', mode: 'Air', value: EF.air, unit: EF_UNIT.air, basis: EF_BASIS.air,
    note: `${Math.round(EF.air / EF.ocean)}× the ocean factor for every tonne-kilometre.`,
    sourceRef: [...airCatalogue.values()][0]?.refs[0] ?? '',
  },
];

const monthly = (() => {
  const byPeriod = new Map();
  for (const s of delivered) {
    const hit = byPeriod.get(s.period)
      ?? { period: s.period, co2eTonnes: 0, weightTonnes: 0, tkm: 0, avoidable: 0, dataOrigin: s.dataOrigin };
    hit.co2eTonnes += s.co2eTonnes;
    hit.weightTonnes += s.weightTonnes;
    hit.tkm += s.weightTonnes * s.totalDistanceKm;
    hit.avoidable += s.avoidableTonnes;
    byPeriod.set(s.period, hit);
  }
  return [...byPeriod.values()].sort((a, b) => a.period.localeCompare(b.period)).map((p) => ({
    period: p.period,
    // Months never mix the two: the workbook ends 2024-06 and the mirror starts
    // 2024-07, so a month is wholly recorded or wholly synthetic.
    dataOrigin: p.dataOrigin,
    co2eTonnes: r6(p.co2eTonnes),
    weightTonnes: r3(p.weightTonnes),
    intensity: p.tkm > 0 ? r3((p.co2eTonnes * 1e6) / p.tkm) : 0,
    avoidableTonnes: r6(p.avoidable),
    // Not a "business as usual" baseline — the workbook has none. This is the
    // same month re-costed on the best routing it evidences for each shipment.
    ifBestTonnes: r6(Math.max(0, p.co2eTonnes - p.avoidable)),
  }));
})();

/** "FY21-22, FY22-23 and FY23-24" — for prose about the recorded years. */
const ASSUMPTION_FY_LIST = (s) => {
  const ys = s.years.map((y) => y.reportingYear);
  return ys.length > 1 ? `${ys.slice(0, -1).join(', ')} and ${ys.at(-1)}` : ys[0];
};

/** CO₂e split by any key, biggest first — the shape the report tables want. */
function laneShares(rows, key) {
  const agg = new Map();
  const grand = sum(rows, (r) => r.co2eTonnes);
  for (const r of rows) {
    const k = key(r);
    const hit = agg.get(k) ?? { label: k, co2eTonnes: 0, weightTonnes: 0, shipments: 0 };
    hit.co2eTonnes += r.co2eTonnes;
    hit.weightTonnes += r.weightTonnes;
    hit.shipments += 1;
    agg.set(k, hit);
  }
  return [...agg.values()]
    .map((v) => ({
      ...v,
      co2eTonnes: r6(v.co2eTonnes),
      weightTonnes: r3(v.weightTonnes),
      pct: grand > 0 ? r3((v.co2eTonnes / grand) * 100) : 0,
    }))
    .sort(byDesc((v) => v.co2eTonnes));
}

/**
 * Bridge each tab's printed total to the total the app reports. Two tabs
 * annotate their export road block "handled by external SP" and leave it out of
 * the printed figure; the same tabs also re-list some of those runs inside the
 * collection block, which the app must not count twice. Both adjustments are
 * itemised so a reviewer can tie the numbers out.
 */
const evidenceYears = src.years.map((y) => {
  // Workbook rows only. The synthetic mirror years carry the same reporting-year
  // shape but must never reach a figure that claims to tie to the sheet.
  const rows = fromWorkbook.filter((s) => s.reportingYear === y.reportingYear);
  const dates = rows.map((r) => r.date).sort();
  const allLegs = sum(rows, (r) => r.co2eTonnes);
  const tkm = sum(rows, (r) => r.weightTonnes * r.totalDistanceKm);
  const reported = y.reportedTotalCo2eTonnes;

  const roadAttached = sum(
    [...y.exportShipments, ...y.airShipments].flatMap((sh) => sh.inland).filter((l) => modeOfInlandRow(l) === 'road'),
    (l) => l.co2e,
  );
  const relisted = sum(y.exportFirstMileFromCollectionBlock ?? [], (r) => r.co2e);
  const duplicates = sum((y.dataFlags ?? []).filter((f) => f.kind === 'duplicate-inland-leg'), (f) => f.co2eTonnes ?? 0);

  const reconciliation = [{
    label: `Total printed on tab ${y.tab}`,
    co2eTonnes: r6(reported),
    note: 'Cell D53, "Total M.TRANSPORT DOWNSTREAM".',
  }];
  if (y.reportedTotalExcludesExportRoad) {
    reconciliation.push({
      label: 'Add the export road legs the tab omits',
      co2eTonnes: r6(roadAttached),
      note: 'The tab annotates its export road block "handled by external SP, not valid as this is for the Ocean shipment" '
        + 'and leaves it out of the printed total. Those runs still happened, so Tradewind counts them'
        + `${duplicates > 0 ? ` — excluding ${r3(duplicates)} t on a row the workbook lists twice, which is filed under Exceptions instead` : ''}.`,
    });
    if (relisted > 0) {
      reconciliation.push({
        label: 'Less the same runs re-listed in the collection block',
        co2eTonnes: r6(-relisted),
        note: 'The collection block repeats some of those first-mile runs, and the printed total already includes them there. '
          + 'Counting each movement once keeps the figure honest.',
      });
    }
  }
  reconciliation.push({
    label: 'Tradewind reports',
    co2eTonnes: r6(allLegs),
    note: 'Every leg attributed to a shipment, counted once.',
  });

  // The bridge must actually add up, or the build is lying about its own numbers.
  const bridged = sum(reconciliation.slice(0, -1), (s) => s.co2eTonnes);
  if (Math.abs(bridged - allLegs) > 0.005) {
    throw new Error(`${y.reportingYear}: reconciliation bridge sums to ${bridged.toFixed(4)} but the app reports ${allLegs.toFixed(4)}`);
  }

  return {
    reportingYear: y.reportingYear,
    tab: y.tab,
    from: dates[0],
    to: dates.at(-1),
    allLegsCo2eTonnes: r6(allLegs),
    reportedCo2eTonnes: r6(reported),
    reconciliation,
    reconciliationNote: Math.abs(allLegs - reported) < 0.005 ? null
      : `Tradewind reports ${r3(allLegs)} t against the tab's printed ${r3(reported)} t. The tab leaves out its export `
        + `road block as "handled by external SP"; adding those ${r3(roadAttached)} t back`
        + `${relisted > 0 ? ` and removing the ${r3(relisted)} t the collection block re-lists` : ''} bridges the two exactly.`,
    weightTonnes: r3(sum(rows, (r) => r.weightTonnes)),
    shipments: rows.length,
    intensity: tkm > 0 ? r3((allLegs * 1e6) / tkm) : 0,
    avoidableTonnes: r6(sum(rows, (r) => r.avoidableTonnes)),
    airShipments: rows.filter((r) => r.isAirFreight).length,
    // The four mode figures are a split of the year and must exhaust it, so each
    // one counts *legs of that mode* — not shipments of that character. An air
    // shipment also has a truck run to the airport, and counting its whole
    // footprint here would put that road leg in two columns at once.
    roadCo2eTonnes: r6(sum(rows, (r) => r.roadCo2eTonnes)),
    railCo2eTonnes: r6(sum(rows, (r) => r.railCo2eTonnes)),
    oceanCo2eTonnes: r6(sum(rows, (r) => r.oceanCo2eTonnes)),
    airCo2eTonnes: r6(sum(rows, (r) => r.airCo2eTonnes)),
    /** Whole footprint of the shipments that flew — the narrative figure. */
    flownShipmentCo2eTonnes: r6(sum(rows.filter((r) => r.isAirFreight), (r) => r.co2eTonnes)),
    exportShipments: rows.filter((r) => r.stream === 'export').length,
    collectionShipments: rows.filter((r) => r.stream === 'collection').length,
    // Per-mode and per-slice detail so a year can be reported on its own.
    byCategory: laneShares(rows, (r) => r.category),
    byDestPort: laneShares(rows, (r) => r.destPort),
    byGateway: laneShares(rows, (r) => r.gateway ?? 'No gateway (air / collection)'),
    byMode: laneShares(rows, (r) => r.primaryMode),
  };
});
const firstYear = evidenceYears[0];
const lastYear = evidenceYears.at(-1);

const syntheticRows = enriched.filter((s) => s.dataOrigin === 'synthetic');

const ASSUMPTIONS = {
  asOf: APP_TODAY,
  company: 'Terova',
  workbook: src.source.workbook,
  scope: 'Scope 3 · Category 9 — Downstream transportation & distribution',
  /** Range of the recorded data — what the report is allowed to quote. */
  dataFrom: fromWorkbook.map((s) => s.date).sort()[0],
  dataTo: LAST_WORKBOOK_DISPATCH,
  /** Range of everything on screen, recorded plus synthetic continuation. */
  timelineFrom: enriched.map((s) => s.date).sort()[0],
  timelineTo: enriched.map((s) => s.date).sort().at(-1),
  reportingYears: src.years.map((y) => y.reportingYear),
  /** Every reporting year on screen, with where its rows come from. */
  reportingYearOrigins: [
    ...src.years.map((y) => ({ reportingYear: y.reportingYear, dataOrigin: 'workbook', mirrorsReportingYear: null })),
    { reportingYear: PLAN_REPORTING_YEAR, dataOrigin: 'synthetic', mirrorsReportingYear: PLAN_SOURCE_YEAR },
  ],
  latestReportingYear: lastYear.reportingYear,
  totalCo2eTonnes: r6(sum(fromWorkbook, (s) => s.co2eTonnes)),
  latestYearCo2eTonnes: lastYear.allLegsCo2eTonnes,
  syntheticCo2eTonnes: r6(sum(syntheticRows, (s) => s.co2eTonnes)),
  syntheticShipmentCount: syntheticRows.length,
  workbookShipmentCount: fromWorkbook.length,
  transitEstimate: {
    note: 'The workbook records dispatch dates only, so transit is estimated from its distances. Every transit figure is marked "est." and no CO₂e depends on one.',
    kmPerDay: TRANSIT.kmPerDay,
    portDwellDays: TRANSIT.portDwellDays,
  },
  syntheticBasis: `The workbook records ${ASSUMPTION_FY_LIST(src)} and stops on ${LAST_WORKBOOK_DISPATCH}; every row in it `
    + `has already shipped. The only rows in this dataset that are not from the workbook are the ${plannedSeeds.length} `
    + `to-be-planned shipments — nothing between ${LAST_WORKBOOK_DISPATCH} and ${APP_TODAY} has been filled in, so every `
    + `reported figure, every chart of history and the whole ESG report are the workbook's own numbers and nothing else.`,
  plannedBasis: `The forward book is the ${PLAN_SOURCE_YEAR} export shipments dispatched between August and December, `
    + `rolled forward ${ROLL_YEARS} years into the Aug–Dec ${APP_TODAY.slice(0, 4)} planning window — `
    + `${plannedSeeds.length} shipments, capped at ${PLAN_MAX} so the queue stays reviewable. It exists because the `
    + `workbook has no forward-dated rows and a routing decision can only be made on a shipment that has not moved yet. `
    + `Product, weight, gateway, container, every distance and every emission factor are the recorded shipment's; only `
    + `the dates move, and each row carries the cell range it came from.`,
  notInWorkbook: [
    'Customer and consignee — the workbook records destination ports, not who buys.',
    'Vendor, processor, carrier and forwarder — no partner is named anywhere in it.',
    'Freight cost — there is no monetary column, so options are compared on CO₂e and transit, not money.',
    'Arrival dates — dispatch is the only date recorded.',
  ],
};

const evidence = {
  workbook: src.source.workbook,
  workbookTitle: src.source.title,
  baselineYear: firstYear.reportingYear,
  latestYear: lastYear.reportingYear,
  years: evidenceYears,
  changeSinceBaselinePct: r3(((lastYear.allLegsCo2eTonnes - firstYear.allLegsCo2eTonnes) / firstYear.allLegsCo2eTonnes) * 100),
  monthly,
  methodology: {
    formula: 'CO₂e (t) = distance (km) × emission factor ÷ 1,000, with weight (t) applied for rail, ocean and air.',
    roadBasis: `Road is charged per truck run at ${EF.road} kg CO₂e/km regardless of load — the workbook's own basis.`,
    distance: src.source.dataSourceNotes.filter((n) => /distance/i.test(n)).join(' '),
    factors: `Road ${EF.road} kg/km · Rail ${EF.rail} · Ocean ${EF.ocean} · Air ${EF.air} kg per tonne-km, all as stated in the workbook.`,
    scope: ASSUMPTIONS.scope,
    boundary: 'First-mile collection from the growing regions, factory to inland depot, depot to gateway port, and the international sailing or flight.',
  },
  dataSourceNotes: src.source.dataSourceNotes,
  /** Every figure on this page is workbook-only — stated so it can be relied on. */
  workbookOnly: true,
  assumptions: [
    ASSUMPTIONS.transitEstimate.note,
    ASSUMPTIONS.syntheticBasis,
    ASSUMPTIONS.plannedBasis,
    'Route options are only offered where the workbook records every leg they use, and each shows how many shipments already moved that way.',
    "Region and market are derived from the workbook's destination port names; product form and Scoville rating are parsed from its item descriptions.",
    'A shipment shows at most one card per lever — shorter first mile, shorter sailing, different gateway, sea instead of air, shared truck — and only where that lever beats the route as booked. The optimised route is the lowest-CO₂e routing of those; where nothing beats the booked route, the booked route is the optimised one and the count of alternatives priced is shown instead.',
    `Inland alternatives are drawn from all three tabs. The tabs disagree about the factory-to-depot run — 645 km on 69 FY21-22 rows against 21 km on 62 others and 51 km to "ICD Hyderabad" on FY23-24 — and the shorter-first-mile option names both distances rather than silently picking one.`,
  ],
};

const filterOptions = {
  regions: uniq(exportRows.map((s) => s.region)).sort(),
  markets: uniq(exportRows.map((s) => s.market)).sort(),
  categories: uniq(enriched.map((s) => s.category)).sort(),
  modes: ['Road', 'Rail', 'Ocean', 'Air'],
  destPorts: uniq(exportRows.map((s) => s.destPort)).sort(),
  gateways: uniq(exportRows.map((s) => s.gateway).filter(Boolean)).sort(),
  reportingYears: uniq(enriched.map((s) => s.reportingYear)).sort(),
  // Real span per reporting year. The tabs do not tile a clean Jul→Jun calendar
  // (FY21-22 ends 12 May 2022, FY22-23 starts 1 Jun 2022), so a preset derived
  // from the label straddles two of them.
  reportingYearWindows: uniq(enriched.map((s) => s.reportingYear)).sort().map((ry) => {
    const dates = enriched.filter((x) => x.reportingYear === ry).map((x) => x.date).sort();
    return { reportingYear: ry, from: dates[0], to: dates.at(-1) };
  }),
  /** Recorded years only — what the ESG report is allowed to be scoped to. */
  workbookReportingYears: src.years.map((y) => y.reportingYear),
};

// ══════════════════════════════════════════════════════════════════════════
// 8b. The workbook itself, addressable by cell range
// ══════════════════════════════════════════════════════════════════════════
//
// Every figure in the application already carries the cell range it came from.
// This makes that reference resolvable: the app can look up "2022-2024!AM4:AX4"
// and show the row exactly as the spreadsheet holds it — the same quantity,
// distance, factor and CO₂e, in the sheet's own column headings.
//
// It is a supporting capability, not a feature anyone navigates to. The point is
// that no number in the product is a dead end: a reader who does not believe a
// total can open it, and keep opening it, until they are looking at a cell.
const workbookRows = {};
const addWorkbookRow = (row, block, mode) => {
  if (!row?.sourceRef || workbookRows[row.sourceRef]) return;
  const [tab, range] = row.sourceRef.split('!');
  workbookRows[row.sourceRef] = {
    ref: row.sourceRef,
    tab,
    range,
    block,
    mode,
    reportingYear: TABS_BY_NAME[tab],
    date: row.date,
    item: row.item,
    qtyKg: row.qtyKg,
    source: row.source,
    dest: row.dest,
    distanceKm: row.distanceKm,
    distanceNm: row.distanceNm ?? null,
    emissionFactor: row.ef,
    efUnit: EF_UNIT[mode],
    efBasis: EF_BASIS[mode],
    /** CO₂e exactly as the workbook prints it — never a recomputation. */
    co2eTonnes: row.co2e,
    fuelKl: row.fuelKl ?? null,
    fuelType: row.fuelType ?? null,
    trips: row.trips ?? null,
    container: row.container ?? null,
    distPerTripKm: row.distPerTripKm ?? null,
    slNo: row.sl ?? null,
  };
};

for (const year of src.years) {
  for (const sh of year.exportShipments) {
    for (const l of sh.inland) addWorkbookRow(l, 'inland', modeOfInlandRow(l));
    addWorkbookRow(sh.ocean, 'waterway', 'ocean');
  }
  for (const sh of year.airShipments) {
    for (const l of sh.inland) addWorkbookRow(l, 'inland', modeOfInlandRow(l));
    addWorkbookRow(sh.air, 'airway', 'air');
  }
  for (const r of year.collectionMovements) addWorkbookRow(r, 'collection', 'road');
  for (const r of year.exportFirstMileFromCollectionBlock ?? []) addWorkbookRow(r, 'collection', 'road');
  // Rows the extractor flagged are not attached to any shipment, so they would
  // otherwise be unreachable — and the data-quality finding that names them
  // would open onto nothing.
  for (const f of year.dataFlags ?? []) {
    if (f.row) addWorkbookRow(f.row, f.kind === 'conflicting-distance' ? 'collection' : 'inland', modeOfInlandRow(f.row));
  }
}

const workbook = {
  file: src.source.workbook,
  title: src.source.title,
  dataSourceNotes: src.source.dataSourceNotes,
  tabs: src.years.map((y) => {
    const refs = Object.values(workbookRows).filter((r) => r.tab === y.tab);
    const dates = refs.map((r) => r.date).filter(Boolean).sort();
    return {
      tab: y.tab,
      reportingYear: y.reportingYear,
      from: dates[0] ?? null,
      to: dates.at(-1) ?? null,
      rows: refs.length,
      printedTotalCo2eTonnes: y.reportedTotalCo2eTonnes,
      printedTotalCell: 'D53',
      /** The tab's own layout, so the viewer can say which block a row sits in. */
      blocks: [
        { key: 'collection', label: 'ROADWAY #1 — first-mile collection', columns: 'A:L' },
        { key: 'inland', label: 'ROADWAY #2 / RAILWAY — export inland legs', columns: 'N:AK' },
        { key: 'waterway', label: 'WATERWAY — ocean leg', columns: 'AM:AW' },
        { key: 'airway', label: 'AIRWAY — air freight', columns: 'AY:BG' },
      ],
    };
  }),
  rows: workbookRows,
};

const copilotSuggestions = [
  { id: 'CS-1', prompt: 'What should I change on the shipments still to be planned?' },
  { id: 'CS-2', prompt: 'Where is our transport CO₂e concentrated?' },
  { id: 'CS-3', prompt: 'Why is the Chennai gateway heavier than Nhava Sheva?' },
  { id: 'CS-4', prompt: 'What did air freight cost us in CO₂e?' },
  { id: 'CS-5', prompt: 'How does the latest year compare with the baseline?' },
];

// ══════════════════════════════════════════════════════════════════════════
// 9. Write
// ══════════════════════════════════════════════════════════════════════════

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'shipments'), { recursive: true });
mkdirSync(join(OUT, 'lanes'), { recursive: true });

const write = (rel, data) => writeFileSync(join(OUT, rel), JSON.stringify(data));
const OMIT = new Set(['legs', '_rows']);
const light = (obj) => Object.fromEntries(Object.entries(obj).filter(([k]) => !OMIT.has(k)));

write('shipments/index.json', { items: enriched.map(light) });
for (const s of enriched) {
  write(`shipments/${s.shipmentId}.json`, {
    ...light(s),
    legs: s.legs,
    options: optionsById.get(s.shipmentId) ?? [],
    recommendations: recommendations.filter((r) => r.shipmentId === s.shipmentId),
  });
}

write('lanes/index.json', { items: lanes.map(light) });
for (const lane of lanes) {
  // Representative shipment: the one with the most at stake, else the heaviest.
  const rep = [...lane._rows].sort((a, b) => b.avoidableTonnes - a.avoidableTonnes || b.weightTonnes - a.weightTonnes)[0];
  write(`lanes/${lane.laneId}.json`, {
    ...light(lane),
    options: optionsById.get(rep.shipmentId) ?? [],
    recommendations: recommendations.filter((r) => r.laneId === lane.laneId),
    shipmentIds: lane._rows.map((r) => r.shipmentId),
  });
}

write('recommendations.json', recommendations);
write('exceptions.json', exceptions);
write('emission-factors.json', emissionFactors);
write('assumptions.json', ASSUMPTIONS);
write('evidence.json', evidence);
write('filter-options.json', filterOptions);
write('geo.json', GEO);
write('copilot-suggestions.json', copilotSuggestions);
write('workbook.json', workbook);

// ── Report ─────────────────────────────────────────────────────────────────
const plannedRecs = recommendations.filter((r) => r.shipmentId?.startsWith('PLN'));
console.log(`\nBuilt public/mock-data from ${src.source.workbook}`);
console.log(`  shipments        ${enriched.length}  (${delivered.length} delivered · ${planned.length} to be planned)`);
console.log(`  provenance       ${fromWorkbook.length} from the workbook · ${syntheticRows.length} synthetic `
  + `(the forward book only — ${PLAN_REPORTING_YEAR} ← ${PLAN_SOURCE_YEAR} Aug–Dec)`);
console.log(`  timeline         ${ASSUMPTIONS.timelineFrom} → ${ASSUMPTIONS.timelineTo}   `
  + `workbook ends ${LAST_WORKBOOK_DISPATCH} · today ${APP_TODAY}`);
console.log(`  export           ${exportRows.length}  ·  first-mile collection ${enriched.length - exportRows.length}`);
console.log(`  lanes            ${lanes.length}`);
console.log(`  decisions        ${recommendations.length}  worth ${r3(sum(recommendations, (r) => r.estCo2eSavingTonnes))} t CO₂e`);
console.log(`  · to be planned  ${plannedRecs.length}  worth ${r3(sum(plannedRecs, (r) => r.estCo2eSavingTonnes))} t CO₂e`);
console.log(`  exceptions       ${exceptions.length}`);
console.log(`  as of            ${APP_TODAY}`);
for (const y of evidenceYears) {
  console.log(`  ${y.reportingYear}  all legs ${String(r3(y.allLegsCo2eTonnes)).padStart(8)} t   `
    + `workbook total ${String(r3(y.reportedCo2eTonnes)).padStart(8)} t   ${y.reconciliationNote ? 'differs (documented)' : 'exact match'}`);
}
const byKind = new Map();
for (const r of recommendations) byKind.set(r.type, (byKind.get(r.type) ?? 0) + r.estCo2eSavingTonnes);
console.log('  by option:', [...byKind.entries()].map(([k, v]) => `${k} ${r3(v)} t`).join(' · '));

// Coverage — how much of the register the optimiser can actually speak to.
const optimisable = exportRows.filter((s) => s.avoidableTonnes > 1e-9);
const alreadyBest = exportRows.filter((s) => s.avoidableTonnes <= 1e-9 && s.alternativesConsidered > 0);
const noAlternative = exportRows.filter((s) => s.alternativesConsidered === 0);
const cards = exportRows.map((s) => optionsById.get(s.shipmentId).length);
console.log(`  coverage         ${optimisable.length} export shipments have a cheaper route · `
  + `${alreadyBest.length} already on the optimised one · ${noAlternative.length} with nothing else recorded`);
console.log(`  option cards     ${Math.min(...cards)}–${Math.max(...cards)} per export shipment `
  + `(avg ${(sum(cards, (c) => c) / cards.length).toFixed(2)})`);
