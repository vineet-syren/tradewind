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
const co2e = (t) => {
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
 * Inland routings to each gateway, taken from the FY23-24 tab only — the latest
 * reporting year, the one whose leg totals reconcile to the workbook's own
 * printed total to the last decimal, and the only tab whose depot labels are
 * internally consistent. Earlier tabs record the same run as both
 * "Hyderabad, 21 km" and "Hyderabad, 645 km", so they cannot define an option.
 */
const INLAND_ROUTINGS = (() => {
  const fy = src.years.find((y) => y.reportingYear === 'FY23-24');
  const byGateway = new Map();
  for (const sh of fy.exportShipments) {
    if (!sh.inland.length) continue;
    const gw = sh.ocean.source;
    const chain = sh.inland.map(inlandKey);
    const bucket = byGateway.get(gw) ?? new Map();
    const key = chain.join(' + ');
    const hit = bucket.get(key) ?? { gateway: gw, chain, count: 0 };
    hit.count += 1;
    bucket.set(key, hit);
    byGateway.set(gw, bucket);
  }
  return new Map([...byGateway].map(([gw, b]) => [gw, [...b.values()].sort(byDesc((r) => r.count))]));
})();

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

// ── To-be-planned shipments ────────────────────────────────────────────────
// The workbook's last dispatch is 30 Jun 2024, so the app's "today" is 1 Jul
// 2024 and the forward book is the FY23-24 July–September quarter rolled
// forward 366 days. Product, weight, gateway, container and every distance stay
// exactly as recorded; only the dates move.
const LAST_DISPATCH = raw.map((s) => s.date).sort().at(-1);
const APP_TODAY = addDays(LAST_DISPATCH, 1);
const ROLL_DAYS = 366;
const PLAN_QUARTER = ['2023-07', '2023-08', '2023-09'];

raw
  .filter((s) => s.reportingYear === 'FY23-24' && s.stream === 'export' && PLAN_QUARTER.includes(s.date.slice(0, 7)))
  .forEach((s, i) => {
    raw.push({
      ...s,
      shipmentId: `PLN-${String(i + 1).padStart(3, '0')}`,
      status: 'Planned',
      reportingYear: 'FY24-25 (to be planned)',
      date: addDays(s.date, ROLL_DAYS),
      legs: s.legs.map((l) => ({ ...l })),
      derivedFromRef: s.sourceRef,
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
    dataConfidence: 'High',
    isAirFreight: legs.some((l) => l.mode === 'air'),
  };
}

/** Lane = destination port × product category (collection keeps its own lanes). */
const laneIdOf = (s) => (s.stream === 'collection'
  ? `LN-COL-${slug(s.origin)}-${slug(s.destPort)}`
  : `LN-${slug(s.destPort)}-${slug(s.category)}`);

let enriched = raw.map(rollup).map((s) => ({ ...s, laneId: laneIdOf(s) }));

// ══════════════════════════════════════════════════════════════════════════
// 4. Route options — re-cost each shipment through evidenced chains
// ══════════════════════════════════════════════════════════════════════════

const OPTION_META = {
  current: { label: 'As booked today', tagline: 'The route this shipment is on' },
  'gateway-swap': { label: 'Different gateway', tagline: 'Leave India through another port' },
  'shorter-sea': { label: 'Shorter sea routing', tagline: 'Same two ports, shorter sailing' },
  'sea-instead-of-air': { label: 'Send by sea', tagline: 'Ocean routing to the same country' },
  consolidate: { label: 'Share the truck', tagline: 'One truck run for the same-day shipments' },
};

function finishOption(kind, legs, gateway, current, extra) {
  const co2e = sum(legs, (l) => l.co2eTonnes);
  const days = Math.round(sum(legs, (l) => l.transitDaysEst));
  const delta = current ? co2e - current.co2eTonnes : 0;
  const modes = uniq(legs.map((l) => l.modeLabel));
  // A gateway swap is named after what actually changes inland, so the label can
  // never claim rail on an all-road routing.
  const label = kind === 'gateway-swap'
    ? `${modes.includes('Rail') ? 'Rail' : 'Road'} to ${gateway}`
    : OPTION_META[kind].label;
  const seaKm = sum(legs.filter((l) => l.mode === 'ocean' || l.mode === 'air'), (l) => l.distanceKm);
  return {
    // Two options can share a kind (two gateways, or two recorded sailings for
    // one port pair), so the id carries the gateway and the long-haul distance.
    id: `${kind}:${slug(gateway ?? 'none')}:${Math.round(seaKm)}`,
    kind,
    label,
    tagline: OPTION_META[kind].tagline,
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

function buildOptions(s) {
  const weight = s.weightTonnes;
  const current = finishOption('current', s.legs, s.gateway, null, {
    timesUsedInWorkbook: 1,
    evidence: `Recorded on tab ${s.sourceRef.split('!')[0]} of the workbook.`,
    evidenceRefs: [s.sourceRef],
  });
  if (s.stream === 'collection') return [current];

  const options = [current];
  // Only keep an option that actually beats what is booked today.
  const add = (opt) => { if (opt.co2eDeltaTonnes < -1e-9) options.push(opt); };

  // (a) Air → sea, where the workbook records a sailing to the same country.
  if (s.isAirFreight) {
    const country = DEST_MARKET[s.destPort];
    const best = [...oceanCatalogue.values()]
      .filter((e) => DEST_MARKET[e.dest] === country)
      .sort((a, b) => a.distanceKm - b.distanceKm)[0];
    const routing = best && (INLAND_ROUTINGS.get(best.source) ?? [])[0];
    if (best && routing) {
      const legs = [...costInlandRouting(routing, weight), costPerTonneKmLeg(best, 'ocean', weight, 99)];
      add(finishOption('sea-instead-of-air', legs, best.source, current, {
        timesUsedInWorkbook: best.count,
        evidence: `The workbook already ships to ${country} by sea on ${best.source} → ${best.dest} `
          + `(${nf(best.distanceKm)} km, ${best.count} shipment${best.count === 1 ? '' : 's'}). Air is charged at `
          + `${EF.air} kg CO₂e per tonne-km against ${EF.ocean} at sea — ${Math.round(EF.air / EF.ocean)}× more.`,
        evidenceRefs: best.refs,
      }));
    }
    return options;
  }

  // (b) Gateway and sailing swaps — reach the same destination port through any
  //     gateway whose sailing to it the workbook records.
  for (const oceanEntry of oceanOptionsTo(s.destPort)) {
    for (const routing of INLAND_ROUTINGS.get(oceanEntry.source) ?? []) {
      const sameGateway = oceanEntry.source === s.gateway;
      const sameSea = Math.abs(oceanEntry.distanceKm - s.oceanKm) < 0.5;
      if (sameGateway && sameSea) continue; // that is the current route
      const legs = [...costInlandRouting(routing, weight), costPerTonneKmLeg(oceanEntry, 'ocean', weight, 99)];
      const railKm = sum(legs.filter((l) => l.mode === 'rail'), (l) => l.distanceKm);
      const roadKm = sum(legs.filter((l) => l.mode === 'road'), (l) => l.distanceKm);
      const seaDelta = s.oceanKm - oceanEntry.distanceKm;

      // State only what actually changes, so the sentence is always true of the
      // legs beside it: the inland swap, the sea distance, or both.
      const inlandPart = sameGateway ? '' :
        `Reaching ${oceanEntry.source} takes ${Math.round(roadKm)} km by road`
        + `${railKm ? ` then ${Math.round(railKm)} km by rail` : ''}, against ${Math.round(s.roadKm)} km of road`
        + `${s.railKm ? ` and ${Math.round(s.railKm)} km of rail` : ''} today. `
        + `Road is charged ${EF.road} kg CO₂e per km whatever the load`
        + `${railKm ? `, rail ${EF.rail} kg per tonne-km` : ''}. `;
      const seaPart = Math.abs(seaDelta) < 0.5 ? `The sailing is unchanged at ${nf(oceanEntry.distanceKm)} km.`
        : `${oceanEntry.source} → ${oceanEntry.dest} is ${nf(oceanEntry.distanceKm)} km against `
          + `${nf(s.oceanKm)} km today — ${nf(Math.abs(seaDelta))} km ${seaDelta > 0 ? 'less' : 'more'} at sea.`;
      const usedPart = ` The workbook already sails ${oceanEntry.source} → ${oceanEntry.dest} `
        + `${oceanEntry.count} time${oceanEntry.count === 1 ? '' : 's'}`
        + `${sameGateway ? '' : `, and runs that inland chain on ${routing.count} shipment${routing.count === 1 ? '' : 's'}`}.`;

      add(finishOption(sameGateway ? 'shorter-sea' : 'gateway-swap', legs, oceanEntry.source, current, {
        timesUsedInWorkbook: Math.min(oceanEntry.count, sameGateway ? oceanEntry.count : routing.count),
        evidence: inlandPart + seaPart + usedPart,
        evidenceRefs: uniq([
          ...oceanEntry.refs.slice(0, 2),
          ...routing.chain.map((k) => inlandCatalogue.get(k).refs[0]),
        ]),
      }));
    }
  }

  // (c) Consolidation — the workbook's road factor is per truck run, so
  //     same-day shipments through one gateway that fit one load can share it.
  const group = truckGroups.get(`${s.date}|${s.gateway}|${s.status}`) ?? [];
  const groupWeight = sum(group, (g) => g.weightTonnes);
  if (group.length > 1 && groupWeight <= MAX_TRUCK_TONNES && s.roadCo2eTonnes > 0) {
    const share = 1 / group.length;
    const legs = s.legs.map((l) => (l.mode === 'road'
      ? { ...l, co2eTonnes: r6(l.co2eTonnes * share), fuelLitres: Math.round((l.fuelLitres ?? 0) * share) }
      : { ...l }));
    add(finishOption('consolidate', legs, s.gateway, current, {
      timesUsedInWorkbook: group.length,
      evidence: `${group.length} shipments leave through ${s.gateway} on ${s.date} totalling ${wt(groupWeight)}, `
        + `inside the ${MAX_TRUCK_TONNES.toFixed(1)} t heaviest load the workbook records. Road CO₂e is charged per truck `
        + `run, so one run instead of ${group.length} splits it ${group.length} ways.`,
      evidenceRefs: group.map((g) => g.sourceRef).slice(0, 4),
    }));
  }

  return options.sort((a, b) => (a.isCurrent ? -1 : b.isCurrent ? 1 : a.co2eTonnes - b.co2eTonnes));
}

const optionsById = new Map();
enriched = enriched.map((s) => {
  const options = buildOptions(s);
  optionsById.set(s.shipmentId, options);
  const best = options.find((o) => !o.isCurrent);
  const avoidable = best ? -best.co2eDeltaTonnes : 0;
  return {
    ...s,
    avoidableTonnes: r6(avoidable),
    avoidablePct: s.co2eTonnes > 0 ? r3((avoidable / s.co2eTonnes) * 100) : 0,
    bestOptionKind: best?.kind ?? null,
    bestOptionLabel: best?.label ?? null,
  };
});

// ══════════════════════════════════════════════════════════════════════════
// 5. Recommendations — one per shipment with a better evidenced option
// ══════════════════════════════════════════════════════════════════════════

const COMPLEXITY = { 'gateway-swap': 'Medium', 'shorter-sea': 'Low', 'sea-instead-of-air': 'Medium', consolidate: 'Low' };
const TITLE = {
  'gateway-swap': (s, o) => (o.modePath.includes('Rail')
    ? `Rail it out through ${o.gateway} instead of trucking to ${s.gateway}`
    : `Route through ${o.gateway} instead of ${s.gateway}`),
  'shorter-sea': (s, o) => `Book the shorter ${o.gateway} → ${s.destPort} sailing`,
  'sea-instead-of-air': (s, o) => `Send this by sea through ${o.gateway} instead of flying`,
  consolidate: (s) => `Put the ${s.date} ${s.gateway} loads on one truck`,
};

const recommendations = [];
for (const s of enriched) {
  const best = (optionsById.get(s.shipmentId) ?? []).find((o) => !o.isCurrent);
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
    rationale: `${co2e(s.co2eTonnes)} → ${co2e(best.co2eTonnes)} CO₂e, saving ${co2e(saving)} `
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
      { label: 'CO₂e today', value: co2e(s.co2eTonnes) },
      { label: 'On this option', value: co2e(best.co2eTonnes), comparison: `${co2e(saving)} saved` },
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
  const co2e = sum(rows, (r) => r.co2eTonnes);
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
    shipmentCount: rows.length,
    plannedShipmentCount: planned.length,
    totalWeightTonnes: r3(weight),
    totalCo2eTonnes: r6(co2e),
    annualCo2eTonnes: r6(co2e / Math.max(1, years)),
    avgCo2ePerTonne: weight > 0 ? r4(co2e / weight) : 0,
    avgCo2ePerTonneKm: tkm > 0 ? r3((co2e * 1e6) / tkm) : 0,
    avgWeightTonnes: r3(weight / rows.length),
    avoidableTonnes: r6(avoidable),
    avoidablePct: co2e > 0 ? r3((avoidable / co2e) * 100) : 0,
    plannedAvoidableTonnes: r6(sum(planned, (r) => r.avoidableTonnes)),
    bestOptionKind: best.bestOptionKind,
    bestOptionLabel: best.bestOptionLabel,
    coords: { origin: coord(first.origin), gateway: coord(gatewayName), destPort: coord(first.destPort) },
    _rows: rows,
  };
}).sort((a, b) => b.avoidableTonnes - a.avoidableTonnes || b.totalCo2eTonnes - a.totalCo2eTonnes);

// ══════════════════════════════════════════════════════════════════════════
// 7. Exceptions — everything odd that the workbook itself shows
// ══════════════════════════════════════════════════════════════════════════

const exceptions = [];

for (const s of enriched.filter((x) => x.isAirFreight)) {
  exceptions.push({
    id: `EXC-AIR-${s.shipmentId}`,
    kind: 'air',
    severity: s.co2eTonnes > 1 ? 'High' : 'Medium',
    shipmentId: s.shipmentId,
    laneLabel: `${s.origin} → ${s.destPort}`,
    region: s.region,
    title: `${wt(s.weightTonnes)} flown to ${s.destPort}`,
    detail: `${co2e(s.co2eTonnes)} CO₂e on ${s.date}. Air is charged at ${EF.air} kg CO₂e per tonne-km against `
      + `${EF.ocean} at sea — ${Math.round(EF.air / EF.ocean)}× more for every tonne carried.`,
    co2eTonnes: r6(s.co2eTonnes),
    avoidableTonnes: r6(s.avoidableTonnes),
    sourceRef: s.sourceRef,
  });
}

// Dedicated truck runs for a fraction of a load — the road factor is per run.
for (const s of enriched.filter((x) => x.stream === 'export' && !x.isAirFreight && x.weightTonnes < 1 && x.roadCo2eTonnes > 0)) {
  exceptions.push({
    id: `EXC-LOAD-${s.shipmentId}`,
    kind: 'low-load',
    severity: s.roadCo2eTonnes / s.co2eTonnes > 0.5 ? 'High' : 'Medium',
    shipmentId: s.shipmentId,
    laneLabel: `${s.origin} → ${s.destPort}`,
    region: s.region,
    title: `${wt(s.weightTonnes)} on a ${Math.round(s.roadKm)} km dedicated truck run`,
    detail: `Road CO₂e is charged per truck run, so this ${wt(s.weightTonnes)} load carries the same `
      + `${co2e(s.roadCo2eTonnes)} of road CO₂e that a full ${MAX_TRUCK_TONNES.toFixed(0)} t load would — `
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
    const hit = byPeriod.get(s.period) ?? { period: s.period, co2eTonnes: 0, weightTonnes: 0, tkm: 0 };
    hit.co2eTonnes += s.co2eTonnes;
    hit.weightTonnes += s.weightTonnes;
    hit.tkm += s.weightTonnes * s.totalDistanceKm;
    byPeriod.set(s.period, hit);
  }
  return [...byPeriod.values()].sort((a, b) => a.period.localeCompare(b.period)).map((p) => ({
    period: p.period,
    co2eTonnes: r6(p.co2eTonnes),
    weightTonnes: r3(p.weightTonnes),
    intensity: p.tkm > 0 ? r3((p.co2eTonnes * 1e6) / p.tkm) : 0,
  }));
})();

/**
 * Bridge each tab's printed total to the total the app reports. Two tabs
 * annotate their export road block "handled by external SP" and leave it out of
 * the printed figure; the same tabs also re-list some of those runs inside the
 * collection block, which the app must not count twice. Both adjustments are
 * itemised so a reviewer can tie the numbers out.
 */
const evidenceYears = src.years.map((y) => {
  const rows = enriched.filter((s) => s.reportingYear === y.reportingYear);
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
  };
});
const firstYear = evidenceYears[0];
const lastYear = evidenceYears.at(-1);

const ASSUMPTIONS = {
  asOf: APP_TODAY,
  company: 'Terova',
  workbook: src.source.workbook,
  scope: 'Scope 3 · Category 9 — Downstream transportation & distribution',
  dataFrom: delivered.map((s) => s.date).sort()[0],
  dataTo: LAST_DISPATCH,
  reportingYears: src.years.map((y) => y.reportingYear),
  latestReportingYear: lastYear.reportingYear,
  totalCo2eTonnes: r6(sum(delivered, (s) => s.co2eTonnes)),
  latestYearCo2eTonnes: lastYear.allLegsCo2eTonnes,
  transitEstimate: {
    note: 'The workbook records dispatch dates only, so transit is estimated from its distances. Every transit figure is marked "est." and no CO₂e depends on one.',
    kmPerDay: TRANSIT.kmPerDay,
    portDwellDays: TRANSIT.portDwellDays,
  },
  plannedBasis: `The workbook's last dispatch is ${LAST_DISPATCH}, so today is ${APP_TODAY} and the forward book is the `
    + `FY23-24 July–September quarter rolled forward ${ROLL_DAYS} days. Product, weight, gateway, container and every `
    + `distance are unchanged from the real shipment — only the dates move, and each planned row carries the cell range it came from.`,
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
  assumptions: [
    ASSUMPTIONS.transitEstimate.note,
    ASSUMPTIONS.plannedBasis,
    'Route options are only offered where the workbook records every leg they use, and each shows how many shipments already moved that way.',
    "Region and market are derived from the workbook's destination port names; product form and Scoville rating are parsed from its item descriptions.",
    `Route options use the FY23-24 inland network. Earlier tabs record the same run as both 21 km and 645 km to "Hyderabad", so they are read for history but not used to price alternatives.`,
  ],
};

const filterOptions = {
  regions: uniq(exportRows.map((s) => s.region)).sort(),
  markets: uniq(exportRows.map((s) => s.market)).sort(),
  categories: uniq(enriched.map((s) => s.category)).sort(),
  modes: ['Road', 'Rail', 'Ocean', 'Air'],
  destPorts: uniq(exportRows.map((s) => s.destPort)).sort(),
  gateways: uniq(exportRows.map((s) => s.gateway).filter(Boolean)).sort(),
  reportingYears: uniq(enriched.map((s) => s.reportingYear)),
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

// ── Report ─────────────────────────────────────────────────────────────────
const plannedRecs = recommendations.filter((r) => r.shipmentId?.startsWith('PLN'));
console.log(`\nBuilt public/mock-data from ${src.source.workbook}`);
console.log(`  shipments        ${enriched.length}  (${delivered.length} delivered · ${planned.length} to be planned)`);
console.log(`  export           ${exportRows.length}  ·  first-mile collection ${enriched.length - exportRows.length}`);
console.log(`  lanes            ${lanes.length}`);
console.log(`  decisions        ${recommendations.length}  worth ${r3(sum(recommendations, (r) => r.estCo2eSavingTonnes))} t CO₂e`);
console.log(`  · to be planned  ${plannedRecs.length}  worth ${r3(sum(plannedRecs, (r) => r.estCo2eSavingTonnes))} t CO₂e`);
console.log(`  exceptions       ${exceptions.length}`);
console.log(`  as of            ${APP_TODAY}  (last workbook dispatch ${LAST_DISPATCH})`);
for (const y of evidenceYears) {
  console.log(`  ${y.reportingYear}  all legs ${String(r3(y.allLegsCo2eTonnes)).padStart(8)} t   `
    + `workbook total ${String(r3(y.reportedCo2eTonnes)).padStart(8)} t   ${y.reconciliationNote ? 'differs (documented)' : 'exact match'}`);
}
const byKind = new Map();
for (const r of recommendations) byKind.set(r.type, (byKind.get(r.type) ?? 0) + r.estCo2eSavingTonnes);
console.log('  by option:', [...byKind.entries()].map(([k, v]) => `${k} ${r3(v)} t`).join(' · '));
