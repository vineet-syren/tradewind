/**
 * Deterministic mock-data generator for Tradewind — Downstream Transportation
 * Carbon Decisioning (frontend-only POC for Terova, a global spice exporter).
 *
 * Writes JSON into `public/mock-data/` shaped exactly like the contracts in
 * `src/types`. Heavy per-lane / per-shipment detail (legs, scenarios, calc
 * breakdown) is written as individual chunk files so it can be fetched lazily.
 * Aggregates that depend on the active persona / filters (footprint, focus KPIs)
 * are computed in the app's mappers, not here — this script emits the raw facts
 * plus the non-derivable scenario maths and a few assumptions.
 *
 * Methodology (from the customer's calc screenshot + the architect call):
 *   CO2e (kg) = Weight (tonnes) × Distance (km) × Emission Factor (kg/tonne-km)
 *   Distance  = Haversine straight-line × 1.20 (deviation buffer)
 *   EF is mode- and distance-tiered. Consolidated containers attribute CO2e by
 *   the shipment's weight share.
 *
 * Run with: `npm run mock:gen`  (or `node scripts/generate-mock-data.mjs`)
 * Output is committed so the app works with zero build steps.
 */

import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'mock-data');

// Frozen "as of" so the generated dataset is stable & demo-friendly. The
// historical shipment window is Jan 2022 → Dec 2024 (mirrors the customer's
// 2020-2022 / 2021-2023 / 2022-2024 workbook tabs).
const AS_OF = new Date('2026-06-30T00:00:00Z');
const AS_OF_PERIOD = '2026-06';
const BASELINE_YEAR = 2020;
const LATEST_YEAR = 2026;
const REDUCTION_AMBITION = 0.15; // 10–20% medium-term ambition (mid-point)
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 3600 * 1000;

// ── Deterministic RNG (mulberry32) ─────────────────────────────────────────
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20250108);
const rand = (min, max) => min + (max - min) * rng();
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const pickWeighted = (entries) => {
  const total = entries.reduce((a, [, w]) => a + w, 0);
  let r = rng() * total;
  for (const [v, w] of entries) if ((r -= w) <= 0) return v;
  return entries[entries.length - 1][0];
};
const round = (n, dp = 0) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const tsHoursAgo = (h) => new Date(AS_OF.getTime() - Math.round(h * HOUR_MS)).toISOString();
const tsDaysAgo = (d) => new Date(AS_OF.getTime() - Math.round(d * DAY_MS)).toISOString();
const AS_OF_ISO = AS_OF.toISOString().slice(0, 10); // '2026-06-30' (frozen "today")
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// ── Geography (real coordinates from the customer's Route_Dictionary) ────────
// kind: origin (inland processing) | port (sea gateway) | dest (destination market)
const GEO = {
  // Indian inland processing origins
  Vatsavai: { lat: 16.983, lon: 80.25, kind: 'origin', country: 'India', state: 'Andhra Pradesh' },
  Ballari: { lat: 15.1394, lon: 76.9214, kind: 'origin', country: 'India', state: 'Karnataka' },
  Hyderabad: { lat: 17.385, lon: 78.4867, kind: 'origin', country: 'India', state: 'Telangana' },
  Khammam: { lat: 17.2473, lon: 80.1514, kind: 'origin', country: 'India', state: 'Telangana' },
  Warangal: { lat: 17.9689, lon: 79.5941, kind: 'origin', country: 'India', state: 'Telangana' },
  Guntur: { lat: 16.3067, lon: 80.4365, kind: 'origin', country: 'India', state: 'Andhra Pradesh' },
  // Indian sea gateways (origin ports)
  'Nhava Sheva': { lat: 18.949, lon: 72.952, kind: 'port', country: 'India', state: 'Maharashtra', portCode: 'INNSA' },
  Chennai: { lat: 13.0827, lon: 80.2707, kind: 'port', country: 'India', state: 'Tamil Nadu', portCode: 'INMAA' },
  Visakhapatnam: { lat: 17.747, lon: 83.239, kind: 'port', country: 'India', state: 'Andhra Pradesh', portCode: 'INVTZ' },
  Mundra: { lat: 22.839, lon: 69.728, kind: 'port', country: 'India', state: 'Gujarat', portCode: 'INMUN' },
  // Destination ports / markets
  'New York': { lat: 40.7128, lon: -74.006, kind: 'dest', country: 'USA', region: 'Americas', portCode: 'USNYC' },
  Savannah: { lat: 32.0809, lon: -81.0912, kind: 'dest', country: 'USA', region: 'Americas', portCode: 'USSAV' },
  'Los Angeles': { lat: 33.7544, lon: -118.2165, kind: 'dest', country: 'USA', region: 'Americas', portCode: 'USLAX' },
  Houston: { lat: 29.7604, lon: -95.3698, kind: 'dest', country: 'USA', region: 'Americas', portCode: 'USHOU' },
  Santos: { lat: -23.9608, lon: -46.3336, kind: 'dest', country: 'Brazil', region: 'Americas', portCode: 'BRSSZ' },
  Antwerp: { lat: 51.2194, lon: 4.4025, kind: 'dest', country: 'Belgium', region: 'Europe', portCode: 'BEANR' },
  Rotterdam: { lat: 51.9244, lon: 4.4777, kind: 'dest', country: 'Netherlands', region: 'Europe', portCode: 'NLRTM' },
  Felixstowe: { lat: 51.967, lon: 1.352, kind: 'dest', country: 'United Kingdom', region: 'Europe', portCode: 'GBFXT' },
  Hamburg: { lat: 53.5511, lon: 9.9937, kind: 'dest', country: 'Germany', region: 'Europe', portCode: 'DEHAM' },
  Genoa: { lat: 44.4056, lon: 8.9463, kind: 'dest', country: 'Italy', region: 'Europe', portCode: 'ITGOA' },
  'Jebel Ali': { lat: 25.0118, lon: 55.1336, kind: 'dest', country: 'UAE', region: 'Middle East', portCode: 'AEJEA' },
  'Laem Chabang': { lat: 13.0836, lon: 100.8844, kind: 'dest', country: 'Thailand', region: 'APAC', portCode: 'THLCH' },
  Guangzhou: { lat: 23.1291, lon: 113.2644, kind: 'dest', country: 'China', region: 'APAC', portCode: 'CNCAN' },
  Shanghai: { lat: 31.2304, lon: 121.4737, kind: 'dest', country: 'China', region: 'APAC', portCode: 'CNSHA' },
  Singapore: { lat: 1.3521, lon: 103.8198, kind: 'dest', country: 'Singapore', region: 'APAC', portCode: 'SGSIN' },
  Tokyo: { lat: 35.6762, lon: 139.6503, kind: 'dest', country: 'Japan', region: 'APAC', portCode: 'JPTYO' },
  Busan: { lat: 35.1796, lon: 129.0756, kind: 'dest', country: 'South Korea', region: 'APAC', portCode: 'KRPUS' },
  Sydney: { lat: -33.8688, lon: 151.2093, kind: 'dest', country: 'Australia', region: 'APAC', portCode: 'AUSYD' },
};

// Final inland delivery city near each destination port (for the dest road leg).
const DEST_HINTERLAND = {
  'New York': { city: 'Edison, NJ', lat: 40.5187, lon: -74.4121 },
  Savannah: { city: 'Atlanta, GA', lat: 33.749, lon: -84.388 },
  'Los Angeles': { city: 'Ontario, CA', lat: 34.0633, lon: -117.6509 },
  Houston: { city: 'Dallas, TX', lat: 32.7767, lon: -96.797 },
  Santos: { city: 'São Paulo', lat: -23.5558, lon: -46.6396 },
  Antwerp: { city: 'Brussels', lat: 50.8503, lon: 4.3517 },
  Rotterdam: { city: 'Utrecht', lat: 52.0907, lon: 5.1214 },
  Felixstowe: { city: 'London', lat: 51.5072, lon: -0.1276 },
  Hamburg: { city: 'Hanover', lat: 52.3759, lon: 9.732 },
  Genoa: { city: 'Milan', lat: 45.4642, lon: 9.19 },
  'Jebel Ali': { city: 'Dubai', lat: 25.2048, lon: 55.2708 },
  'Laem Chabang': { city: 'Bangkok', lat: 13.7563, lon: 100.5018 },
  Guangzhou: { city: 'Foshan', lat: 23.0215, lon: 113.1214 },
  Shanghai: { city: 'Suzhou', lat: 31.2989, lon: 120.5853 },
  Singapore: { city: 'Jurong', lat: 1.3329, lon: 103.7436 },
  Tokyo: { city: 'Yokohama', lat: 35.4437, lon: 139.638 },
  Busan: { city: 'Daegu', lat: 35.8714, lon: 128.6014 },
  Sydney: { city: 'Parramatta', lat: -33.815, lon: 151.0 },
};

// ── Distance & emissions maths ──────────────────────────────────────────────
const R_EARTH = 6371;
const toRad = (d) => (d * Math.PI) / 180;
function haversineKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  return R_EARTH * c;
}
/** Straight-line Haversine + 20% deviation buffer (customer methodology). */
const distanceKm = (a, b) => round(haversineKm(a, b) * 1.2, 1);

/**
 * Emission factor in kg CO2e per tonne-km, mode- and distance-tiered.
 * - Air uses the customer's screenshot tiers (2.136 / 1.323 / 1.191).
 * - Ocean/rail/road use defensible global container/rail/full-truck factors so
 *   the cross-mode comparison (CO2e per tonne-km) tells the right story:
 *   air ≫ road > rail > ocean. All factors are surfaced in the methodology page.
 */
function efPerTonneKm(mode, km) {
  switch (mode) {
    case 'air':
      return km < 1000 ? 2.136 : km <= 3700 ? 1.323 : 1.191;
    case 'ocean':
      return km < 1000 ? 0.016 : km <= 3700 ? 0.012 : 0.008;
    case 'rail':
      return 0.028;
    case 'road':
    default:
      return 0.088; // full-load diesel truck, tonne-km basis
  }
}
const distanceTier = (km) => (km < 1000 ? '< 1000 km' : km <= 3700 ? '1000–3700 km' : '> 3700 km');

/** CO2e for a single leg, in tonnes. weightTonnes already = attributed share. */
function legCo2eTonnes(mode, km, weightTonnes) {
  return (weightTonnes * km * efPerTonneKm(mode, km)) / 1000;
}

// Rough transit days per mode (incl. port/handling buffers).
function legDays(mode, km) {
  switch (mode) {
    case 'air':
      return round(km / 9000 + 1.5, 1);
    case 'ocean':
      return round(km / 650 + 4, 1); // ~650 km/day + port dwell
    case 'rail':
      return round(km / 550 + 1, 1);
    case 'road':
    default:
      return round(km / 600 + 0.5, 1);
  }
}

// Rough freight cost (USD) per leg — ocean cheapest/tonne, air ~12× ocean.
function legCostUsd(mode, km, weightTonnes) {
  const perTkm = mode === 'air' ? 0.62 : mode === 'road' ? 0.14 : mode === 'rail' ? 0.06 : 0.022;
  const base = mode === 'ocean' ? 240 : mode === 'air' ? 180 : 40;
  return Math.round(base + weightTonnes * km * perTkm);
}

// Fuel consumed/projected per leg — litres, attributed by weight share.
// Litres per tonne-km by mode (illustrative; ships are efficient per t-km, air burns the most).
const FUEL_RATE = { road: 0.022, rail: 0.005, ocean: 0.0025, air: 0.2 };
const FUEL_TYPE = { road: 'Diesel', rail: 'Diesel', ocean: 'Marine fuel oil', air: 'Jet A-1' };
function legFuelLitres(mode, km, weightTonnes) {
  return weightTonnes * km * (FUEL_RATE[mode] ?? 0.02);
}

// Per-vehicle payload capacity (tonnes) → how many vehicles fill one shipment leg.
const VEHICLE_CAPACITY = { road: 12, rail: 55, ocean: 26, air: 90 };
function legVehicleCount(mode, weightTonnes) {
  return Math.max(1, Math.ceil(weightTonnes / (VEHICLE_CAPACITY[mode] ?? 20)));
}

const MODE_LABEL = { road: 'Road', rail: 'Rail', ocean: 'Ocean', air: 'Air' };

// ── Domain pools ────────────────────────────────────────────────────────────
// Spice product catalogue (categories, families, SHU heat) — Terova's exports.
const PRODUCTS = [
  { sku: 'CHL-RC-30', name: 'Chilli Red Crushed (3/16", 30K SHU)', category: 'Chilli & Cayenne', family: 'Crushed Chilli', shu: 30000 },
  { sku: 'CHL-RG-35', name: 'Red Pepper Ground (35K–40K SHU)', category: 'Chilli & Cayenne', family: 'Ground Chilli', shu: 38000 },
  { sku: 'CHL-RG-40', name: 'Red Pepper Ground (40K–50K SHU)', category: 'Chilli & Cayenne', family: 'Ground Chilli', shu: 45000 },
  { sku: 'CHL-CY-ST', name: 'Cayenne Ground, Steam-Treated', category: 'Chilli & Cayenne', family: 'Cayenne', shu: 50000 },
  { sku: 'CHL-RC-MC', name: 'Chilli Red Crushed, Micro Steam', category: 'Chilli & Cayenne', family: 'Crushed Chilli', shu: 32000 },
  { sku: 'PAP-SW-LO', name: 'Sweet Paprika Ground (low SHU)', category: 'Paprika', family: 'Paprika', shu: 500 },
  { sku: 'PAP-SM-MD', name: 'Smoked Paprika Ground', category: 'Paprika', family: 'Paprika', shu: 800 },
  { sku: 'TUR-GR-CU', name: 'Turmeric Ground, Curcumin 3%', category: 'Turmeric', family: 'Turmeric', shu: 0 },
  { sku: 'CUM-GR-ST', name: 'Cumin Ground, Steam-Sterilised', category: 'Cumin & Coriander', family: 'Cumin', shu: 0 },
  { sku: 'COR-GR-ST', name: 'Coriander Ground, Steam-Sterilised', category: 'Cumin & Coriander', family: 'Coriander', shu: 0 },
  { sku: 'PEP-BL-TE', name: 'Black Pepper, Tellicherry Whole', category: 'Pepper', family: 'Black Pepper', shu: 0 },
  { sku: 'GIN-GR-DR', name: 'Ginger Ground, Dried', category: 'Ginger', family: 'Ginger', shu: 0 },
  { sku: 'BLN-CY-SE', name: 'Curry Seasoning Blend', category: 'Blends', family: 'Blends', shu: 8000 },
];

// Customers (importers) by destination market → default destination port.
const CUSTOMERS = [
  { name: 'Atlantic Spice Imports', group: 'Atlantic Foods', region: 'Americas', port: 'New York' },
  { name: 'Gulf Coast Seasonings', group: 'Gulf Foods Inc', region: 'Americas', port: 'Houston' },
  { name: 'Pacific Flavor Co', group: 'Pacific Pantry', region: 'Americas', port: 'Los Angeles' },
  { name: 'Savannah Spice Traders', group: 'Atlantic Foods', region: 'Americas', port: 'Savannah' },
  { name: 'Andes Sabores', group: 'LatAm Foods', region: 'Americas', port: 'Santos' },
  { name: 'Antwerp Spice Group', group: 'Benelux Flavours', region: 'Europe', port: 'Antwerp' },
  { name: 'Rhineland Seasonings', group: 'Rhein Foods AG', region: 'Europe', port: 'Hamburg' },
  { name: 'Britannia Spice Ltd', group: 'Albion Foods', region: 'Europe', port: 'Felixstowe' },
  { name: 'Mediterraneo Spezie', group: 'Sud Foods SpA', region: 'Europe', port: 'Genoa' },
  { name: 'Rotterdam Flavour BV', group: 'Benelux Flavours', region: 'Europe', port: 'Rotterdam' },
  { name: 'Levant Spice Trading', group: 'Gulf Pantry', region: 'Middle East', port: 'Jebel Ali' },
  { name: 'Guangzhou Spice Trading', group: 'Pearl River Foods', region: 'APAC', port: 'Guangzhou' },
  { name: 'Nippon Flavour KK', group: 'Sakura Foods', region: 'APAC', port: 'Tokyo' },
  { name: 'Siam Spice Imports', group: 'Mekong Foods', region: 'APAC', port: 'Laem Chabang' },
  { name: 'Lion City Seasonings', group: 'Straits Pantry', region: 'APAC', port: 'Singapore' },
  { name: 'Shanghai Taste Co', group: 'Pearl River Foods', region: 'APAC', port: 'Shanghai' },
  { name: 'Hanseatic Spice', group: 'Rhein Foods AG', region: 'Europe', port: 'Rotterdam' },
  { name: 'Southern Cross Foods', group: 'Pacifica Pantry', region: 'APAC', port: 'Sydney' },
];

// Vendors / processors — Terova's outsourced processing & origin handoff.
const VENDORS = [
  { name: 'Vatsavai Processing Unit', origin: 'Vatsavai', controllability: 'Medium' },
  { name: 'Ballari Agro Processors', origin: 'Ballari', controllability: 'Medium' },
  { name: 'VKS Spice Mills, Hyderabad', origin: 'Hyderabad', controllability: 'High' },
  { name: 'Khammam Cold Chain', origin: 'Khammam', controllability: 'Low' },
  { name: 'Warangal Grinding Co', origin: 'Warangal', controllability: 'Medium' },
  { name: 'Guntur Chilli Yards', origin: 'Guntur', controllability: 'Low' },
];

// Logistics service providers (freight forwarders + ocean carriers) with a
// relative CO2e-intensity index (1.0 = fleet average; <1 greener fleet).
const LSPS = [
  { name: 'Oceanic Freight Solutions', carrier: 'SeaLink Lines', intensityIndex: 0.88, greenProgram: true },
  { name: 'BlueRoute Logistics', carrier: 'EverBlue Container Line', intensityIndex: 0.94, greenProgram: true },
  { name: 'Meridian Forwarders', carrier: 'Pacific Star Shipping', intensityIndex: 1.06, greenProgram: false },
  { name: 'TransGlobe Logistics', carrier: 'OrientGulf Carrier', intensityIndex: 1.13, greenProgram: false },
  { name: 'Continental Cargo Partners', carrier: 'SeaLink Lines', intensityIndex: 1.0, greenProgram: false },
];

// Origin port selection by destination region (which Indian gateway is used).
// Mainland-coast gateways only — Mundra sits inside the Gulf of Kachchh, so a
// straight inland road leg to it would skim the sea; excluded so road/rail legs
// stay over land.
const PORT_BY_REGION = {
  Americas: ['Nhava Sheva', 'Chennai'],
  Europe: ['Nhava Sheva'],
  'Middle East': ['Nhava Sheva'],
  APAC: ['Chennai', 'Visakhapatnam', 'Nhava Sheva'],
};
// The nearest/greener gateway we'd recommend per origin (cuts inland km).
const NEAREST_PORT_BY_ORIGIN = {
  Vatsavai: 'Visakhapatnam',
  Guntur: 'Visakhapatnam',
  Khammam: 'Visakhapatnam',
  Warangal: 'Visakhapatnam',
  Hyderabad: 'Chennai',
  Ballari: 'Chennai',
};

const MONTHS = [];
for (let y = BASELINE_YEAR; y <= LATEST_YEAR; y++)
  for (let m = 1; m <= 12; m++) {
    const p = `${y}-${String(m).padStart(2, '0')}`;
    if (p <= AS_OF_PERIOD) MONTHS.push(p); // no future months beyond "today"
  }

// Reduction program ramp: realized % reduction applied to a lane in a month.
// Pilot starts 2023-07; ramps from ~2% toward ~14% by mid-2026 (the structured
// reduction journey toward the 10–20% ambition — not a month-one promise).
function realizedReductionPct(period) {
  const [y, m] = period.split('-').map(Number);
  const idx = (y - BASELINE_YEAR) * 12 + (m - 1);
  const pilotStart = (2023 - BASELINE_YEAR) * 12 + 6; // 2023-07
  if (idx < pilotStart) return 0;
  const ramp = (idx - pilotStart) / 35; // → 1.0 by 2026-06
  return clamp(0.02 + ramp * 0.12, 0, 0.14);
}

// Live status from the shipment's ship date + ETA relative to "today".
// Future ship date → Planned (scheduled); shipped-but-not-arrived → In transit.
function statusForDates(date, eta) {
  if (date > AS_OF_ISO) return 'Planned';
  if (eta > AS_OF_ISO) return 'In transit';
  return 'Delivered';
}

// ── Leg + scenario construction ─────────────────────────────────────────────
function makeLeg(seq, mode, fromName, toName, weightTonnes, opts = {}) {
  const from = opts.from ?? GEO[fromName];
  const to = opts.to ?? GEO[toName];
  const km = opts.km ?? distanceKm(from, to);
  const ef = efPerTonneKm(mode, km);
  const co2e = legCo2eTonnes(mode, km, weightTonnes);
  return {
    seq,
    mode,
    modeLabel: MODE_LABEL[mode],
    from: fromName,
    to: toName,
    fromCoord: { lat: from.lat, lon: from.lon },
    toCoord: { lat: to.lat, lon: to.lon },
    distanceKm: round(km, 1),
    distanceSource: opts.distanceSource ?? 'Haversine + 20%',
    distanceTier: distanceTier(km),
    emissionFactor: ef,
    efUnit: 'kg CO₂e / tonne-km',
    vehicleType: opts.vehicleType ?? (mode === 'road' ? 'Full-load diesel truck' : mode === 'ocean' ? 'Container vessel' : mode === 'rail' ? 'Freight rail' : 'Air freighter'),
    weightTonnes: round(weightTonnes, 3),
    co2eTonnes: round(co2e, 3),
    fuelLitres: round(legFuelLitres(mode, km, weightTonnes), 1),
    fuelType: FUEL_TYPE[mode] ?? 'Diesel',
    vehicleCount: legVehicleCount(mode, weightTonnes),
    transitDaysExpected: legDays(mode, km),
    transitDaysActual: round(legDays(mode, km) * rand(1.0, 1.18), 1),
  };
}

function sumCo2e(legs) {
  return round(legs.reduce((s, l) => s + l.co2eTonnes, 0), 3);
}
function sumDays(legs) {
  return round(legs.reduce((s, l) => s + legDays(l.mode, l.distanceKm), 0), 1);
}
function sumCost(legs) {
  return Math.round(legs.reduce((s, l) => s + legCostUsd(l.mode, l.distanceKm, l.weightTonnes), 0));
}

/**
 * Build the four decisioning scenarios for a lane flow. `base` carries the
 * current path facts; transforms encode the route_mode_decision.png playbook:
 *  - Optimal   = multimodal / air-heavy, fastest, highest CO2 (urgent SLA fit)
 *  - Balanced  = road+ocean optimized, 2–3 weeks, balanced CO2 (pragmatic)
 *  - Best-CO2  = ocean-heavy + rail inland + consolidation, slowest, lowest CO2
 *  - Current   = as-shipped
 */
function buildScenarios(base) {
  const { origin, originPort, destPort, destCity, destCoord, weightTonnes, inlandMode, isAir } = base;
  const W = weightTonnes;

  // ----- CURRENT -----
  let current;
  if (isAir) {
    current = [makeLeg(1, 'air', origin, destCity, W, { to: destCoord })];
  } else {
    current = [
      makeLeg(1, inlandMode, origin, originPort, W),
      makeLeg(2, 'ocean', originPort, destPort, W),
      makeLeg(3, 'road', destPort, destCity, W, { to: destCoord }),
    ];
  }

  // ----- BEST FOR CO2 -----  ocean-heavy, rail inland, nearest port, consolidation
  const nearer = NEAREST_PORT_BY_ORIGIN[origin] ?? originPort;
  const bestLegs = [
    makeLeg(1, 'rail', origin, nearer, W),
    makeLeg(2, 'ocean', nearer, destPort, W),
    makeLeg(3, 'rail', destPort, destCity, W, { to: destCoord, km: distanceKm(GEO[destPort], destCoord) }),
  ];
  // Consolidation + slow-steaming efficiency: trim ocean leg CO2e ~6%.
  bestLegs[1].co2eTonnes = round(bestLegs[1].co2eTonnes * 0.94, 3);

  // ----- BALANCED -----  road+ocean, optimized port pairing, partial rail
  const balancedLegs = [
    makeLeg(1, 'rail', origin, originPort, W),
    makeLeg(2, 'ocean', originPort, destPort, W),
    makeLeg(3, 'road', destPort, destCity, W, { to: destCoord, km: distanceKm(GEO[destPort], destCoord) * 0.9 }),
  ];

  // ----- OPTIMAL -----  multimodal/air-heavy: fastest, highest CO2
  const optimalLegs = [
    makeLeg(1, 'road', origin, originPort, W),
    makeLeg(2, 'air', originPort, destPort, W),
    makeLeg(3, 'road', destPort, destCity, W, { to: destCoord, km: distanceKm(GEO[destPort], destCoord) }),
  ];

  const mk = (kind, legs, opts) => {
    const co2e = sumCo2e(legs);
    return {
      kind,
      label: opts.label,
      legs,
      modePath: legs.map((l) => l.modeLabel),
      co2eTonnes: co2e,
      transitDays: round(sumDays(legs) + opts.dwell, 1),
      freightUsd: Math.round(sumCost(legs) * opts.costMult),
      tagline: opts.tagline,
      transitBand: opts.transitBand,
      slaRisk: opts.slaRisk,
      feasibility: opts.feasibility,
      narrative: opts.narrative,
    };
  };

  const cur = mk('current', current, {
    label: 'Current (as shipped)',
    dwell: isAir ? 1 : 6,
    costMult: 1,
    tagline: isAir ? 'Air freight — fast but carbon-heavy' : 'Road inland + ocean + road delivery',
    transitBand: isAir ? '3–5 days' : '3–4 weeks',
    slaRisk: 'Baseline',
    feasibility: 'In place',
    narrative: isAir
      ? 'Shipped by air — an exception path with the highest CO₂e per tonne-km.'
      : 'The lane as currently executed by the vendor/LSP.',
  });
  const optimal = mk('optimal', optimalLegs, {
    label: 'Fastest',
    dwell: 1,
    costMult: 1.0,
    tagline: 'Multimodal / air-heavy — fastest, but highest CO₂ & cost',
    transitBand: '3–5 days',
    slaRisk: 'Lowest',
    feasibility: 'For urgent / replenishment only',
    narrative: 'Air on the long leg for urgent SLAs. Best transit, but the highest emissions — govern as an exception.',
  });
  const balanced = mk('balanced', balancedLegs, {
    label: 'Balanced',
    dwell: 5,
    costMult: 0.82,
    tagline: 'Road + ocean optimized — 2–3 weeks, balanced CO₂',
    transitBand: '2–3 weeks',
    slaRisk: 'Low',
    feasibility: 'Drop-in for most lanes',
    narrative: 'Rail to port + ocean + optimized delivery. The pragmatic default — meaningful CO₂ cut with little service impact.',
  });
  const best = mk('best_co2', bestLegs, {
    label: 'Best for CO₂',
    dwell: 8,
    costMult: 0.74,
    tagline: 'Ocean-heavy + rail inland + consolidation — lowest CO₂',
    transitBand: '4–6 weeks',
    slaRisk: 'Higher (longer transit)',
    feasibility: 'Where lead time allows',
    narrative: 'Rail inland, nearest greener gateway, consolidated full containers and slow-steaming ocean. The lowest-carbon path.',
  });

  // Deltas vs current
  for (const s of [optimal, balanced, best]) {
    s.co2eDeltaTonnes = round(cur.co2eTonnes - s.co2eTonnes, 3);
    s.co2eDeltaPct = round(((cur.co2eTonnes - s.co2eTonnes) / cur.co2eTonnes) * 100, 1);
    s.costDeltaUsd = s.freightUsd - cur.freightUsd;
    s.transitDeltaDays = round(s.transitDays - cur.transitDays, 1);
  }
  cur.co2eDeltaTonnes = 0;
  cur.co2eDeltaPct = 0;
  cur.costDeltaUsd = 0;
  cur.transitDeltaDays = 0;

  return { current: cur, optimal, balanced, best };
}

// ── Shipment generation ─────────────────────────────────────────────────────
const VENDOR_BY_ORIGIN = VENDORS.reduce((m, v) => ((m[v.origin] ??= v), m), {});

let shipSeq = 0;
// A handful of customers carry most of the volume (Pareto / concentration —
// the hotspot story the brief calls for). Weight selection accordingly.
const CUSTOMER_WEIGHTS = {
  'Atlantic Spice Imports': 5,
  'Antwerp Spice Group': 4.5,
  'Britannia Spice Ltd': 3.5,
  'Rotterdam Flavour BV': 3,
  'Siam Spice Imports': 3,
  'Guangzhou Spice Trading': 2.5,
  'Gulf Coast Seasonings': 2.5,
  'Rhineland Seasonings': 2,
  'Levant Spice Trading': 2,
  'Nippon Flavour KK': 1.6,
};
function buildShipment(forcedPeriod) {
  const product = pickWeighted(PRODUCTS.map((p) => [p, p.category === 'Chilli & Cayenne' ? 3 : 1]));
  const customer = pickWeighted(CUSTOMERS.map((c) => [c, CUSTOMER_WEIGHTS[c.name] ?? 1]));
  const region = customer.region;
  const destPort = customer.port;
  const vendor = pick(VENDORS);
  const origin = vendor.origin;
  const originPort = pick(PORT_BY_REGION[region] ?? ['Nhava Sheva']);
  const lsp = pick(LSPS);
  const period = forcedPeriod ?? pick(MONTHS);
  const year = Number(period.split('-')[0]);
  // Day-level ship date within the month (day-wise shipment data).
  const date = `${period}-${String(randInt(1, 28)).padStart(2, '0')}`;

  // ~6% air exceptions (tiny urgent/sample shipments); rest ocean-led containers.
  const isAir = rng() < 0.06;
  const weightTonnes = isAir
    ? round(rand(0.02, 0.6), 3)
    : round(rand(9, 25), 2);
  const isConsolidated = !isAir && rng() < 0.34;
  const weightSharePct = isConsolidated ? randInt(30, 80) : 100;
  const inlandMode = !isAir && rng() < 0.4 ? 'rail' : 'road';
  const monthlyTrips = isAir ? 1 : pickWeighted([[1, 5], [2, 4], [3, 2], [4, 1]]);

  const dest = DEST_HINTERLAND[destPort];
  const destCoord = { lat: dest.lat, lon: dest.lon };
  const destCity = dest.city;

  const scenarios = buildScenarios({
    origin, originPort, destPort, destCity, destCoord, weightTonnes, inlandMode, isAir,
  });
  const current = scenarios.current;
  // ETA = ship date + expected transit; together they set the live status.
  const eta = addDays(date, Math.max(1, Math.round(current.transitDays)));
  const status = statusForDates(date, eta);

  // Apply realized program reduction to recent periods (so the trend bends down).
  const realized = realizedReductionPct(period);
  const co2eTonnes = round(current.co2eTonnes * (1 - realized), 3);
  const totalDistanceKm = round(current.legs.reduce((s, l) => s + l.distanceKm, 0), 1);
  const co2ePerTonne = round(co2eTonnes / weightTonnes, 3);
  const co2ePerTonneKm = round((co2eTonnes * 1e6) / Math.max(weightTonnes * totalDistanceKm, 0.001), 1); // g CO₂e/t·km

  const airAvoidable = isAir ? rng() < 0.7 : null;
  const dataConfidence = pickWeighted([['High', 5], ['Medium', 3], ['Low', 1.4]]);

  const best = scenarios.best;
  const reductionPotentialTonnes = round(Math.max(0, current.co2eTonnes - best.co2eTonnes) * monthlyTrips, 2);
  // Per-shipment avoidable (this single move, current → best) — used for the
  // forward window so the scheduler doesn't sum annualized lane potential.
  const avoidableTonnes = round(Math.max(0, co2eTonnes - best.co2eTonnes), 3);

  shipSeq += 1;
  const shipmentId = `shp-${String(shipSeq).padStart(4, '0')}`;

  return {
    shipmentId,
    period,
    year,
    date,
    eta,
    status,
    productSku: product.sku,
    productName: product.name,
    category: product.category,
    family: product.family,
    shu: product.shu,
    customer: customer.name,
    customerGroup: customer.group,
    market: GEO[destPort].country,
    region,
    vendor: vendor.name,
    processor: vendor.name,
    vendorControllability: vendor.controllability,
    lsp: lsp.name,
    carrier: lsp.carrier,
    lspIntensityIndex: lsp.intensityIndex,
    origin,
    originState: GEO[origin].state,
    originPort,
    destPort,
    destCity,
    destCountry: GEO[destPort].country,
    modePath: current.modePath,
    primaryMode: isAir ? 'Air' : 'Ocean',
    inlandMode: isAir ? null : MODE_LABEL[inlandMode],
    weightTonnes,
    weightSharePct,
    isConsolidated,
    monthlyTrips,
    totalDistanceKm,
    oceanDistanceKm: round(current.legs.filter((l) => l.mode === 'ocean').reduce((s, l) => s + l.distanceKm, 0), 1),
    roadDistanceKm: round(current.legs.filter((l) => l.mode === 'road').reduce((s, l) => s + l.distanceKm, 0), 1),
    railDistanceKm: round(current.legs.filter((l) => l.mode === 'rail').reduce((s, l) => s + l.distanceKm, 0), 1),
    airDistanceKm: round(current.legs.filter((l) => l.mode === 'air').reduce((s, l) => s + l.distanceKm, 0), 1),
    co2eTonnes,
    co2eGrossTonnes: current.co2eTonnes,
    co2ePerTonne,
    co2ePerTonneKm,
    realizedReductionPct: round(realized * 100, 1),
    freightUsd: current.freightUsd,
    transitDays: current.transitDays,
    dataConfidence,
    airException: isAir,
    airAvoidable,
    reductionPotentialTonnes,
    avoidableTonnes,
    bestScenarioKind: 'best_co2',
    // carried for detail/aggregation, stripped from the light index
    _scenarios: scenarios,
    _vendor: vendor,
    _lsp: lsp,
    _product: product,
    _customer: customer,
  };
}

// ── Forward schedule (future planned shipments) ─────────────────────────────
// Project a recurring lane into the future: clone a recent shipment (so lane,
// route and scenarios stay consistent — "based on previous data and trends"),
// re-date it forward, mark it Planned, and carry the reduction ramp a little
// further. These power the Scheduler / forward-planning views.
function buildPlannedShipment(template, date) {
  shipSeq += 1;
  const shipmentId = `shp-${String(shipSeq).padStart(4, '0')}`;
  const period = date.slice(0, 7);
  const year = Number(date.slice(0, 4));
  const eta = addDays(date, Math.max(1, Math.round(template.transitDays)));
  const daysOut = Math.round((new Date(`${date}T00:00:00Z`).getTime() - AS_OF.getTime()) / DAY_MS);
  const realized = clamp(0.14 + (daysOut / 30) * 0.005, 0.14, 0.17); // continued ramp
  const co2eTonnes = round(template.co2eGrossTonnes * (1 - realized), 3);
  return {
    ...template,
    shipmentId,
    period,
    year,
    date,
    eta,
    status: 'Planned',
    co2eTonnes,
    co2ePerTonne: round(co2eTonnes / template.weightTonnes, 3),
    co2ePerTonneKm: round((co2eTonnes * 1e6) / Math.max(template.weightTonnes * template.totalDistanceKm, 0.001), 1),
    realizedReductionPct: round(realized * 100, 1),
    avoidableTonnes: round(Math.max(0, co2eTonnes - template._scenarios.best.co2eTonnes), 3),
  };
}

// ── Lanes (decisioning corridors) ───────────────────────────────────────────
// A lane = unique (origin → originPort → destPort → customer → product category)
// flow. Aggregates its shipments and owns the Current + 3 alternative scenarios.
function laneKeyOf(s) {
  return [s.origin, s.destPort, s.category].join('|');
}

function buildLanes(shipments) {
  const groups = new Map();
  for (const s of shipments) {
    const key = laneKeyOf(s);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  const lanes = [];
  let i = 0;
  for (const [, members] of groups) {
    i += 1;
    const sample = members[0];
    const laneId = `lane-${String(i).padStart(4, '0')}`;
    const shipmentCount = members.length;
    const totalWeightTonnes = round(members.reduce((s, m) => s + m.weightTonnes, 0), 2);
    const totalCo2eTonnes = round(members.reduce((s, m) => s + m.co2eTonnes, 0), 2);
    const airMembers = members.filter((m) => m.airException);
    const oceanMembers = members.filter((m) => !m.airException);
    const airSharePct = round((airMembers.length / shipmentCount) * 100, 0);
    // Lane scenarios always model the ocean-led containerized corridor (the
    // decisioning unit). Air is a per-shipment exception handled in Air Watch.
    // Scenarios are modelled per representative shipment; annual figures scale
    // by the lane's annual trip frequency.
    const repMembers = oceanMembers.length ? oceanMembers : members;
    const repWeight = Math.max(9, round(repMembers.reduce((s, m) => s + m.weightTonnes, 0) / repMembers.length, 2));
    const annualFrequency = Math.max(1, Math.round(repMembers.reduce((s, m) => s + m.monthlyTrips, 0) / 3));
    const avgCo2ePerTonne = round(totalCo2eTonnes / Math.max(totalWeightTonnes, 0.001), 3);
    const totalTonKm = members.reduce((s, m) => s + m.weightTonnes * m.totalDistanceKm, 0);
    const avgCo2ePerTonneKm = round((totalCo2eTonnes * 1e6) / Math.max(totalTonKm, 0.001), 1); // g CO₂e/t·km

    const sampleInland = repMembers.find((m) => m.inlandMode)?.inlandMode || 'Road';
    const scenarios = buildScenarios({
      origin: sample.origin,
      originPort: sample.originPort,
      destPort: sample.destPort,
      destCity: sample.destCity,
      destCoord: { lat: DEST_HINTERLAND[sample.destPort].lat, lon: DEST_HINTERLAND[sample.destPort].lon },
      weightTonnes: repWeight,
      inlandMode: sampleInland === 'Rail' ? 'rail' : 'road',
      isAir: false,
    });

    const perShipmentSaving = Math.max(0, scenarios.current.co2eTonnes - scenarios.best.co2eTonnes);
    const reductionPotentialTonnes = round(perShipmentSaving * annualFrequency, 2);
    const reductionPotentialPct = scenarios.best.co2eDeltaPct;
    const recommendedApproach = reductionPotentialPct >= 22 ? 'best_co2' : 'balanced';
    // Realistic adoption: not every lane can fully switch to rail/nearest port.
    // A feasibility factor tempers the theoretical max into a credible,
    // 10–20%-ambition-aligned realizable reduction.
    const feasibilityFactor = clamp(
      0.16 +
        (sample.vendorControllability === 'High' ? 0.12 : sample.vendorControllability === 'Medium' ? 0.05 : 0) +
        (NEAREST_PORT_BY_ORIGIN[sample.origin] ? 0.05 : 0) +
        rand(-0.03, 0.05),
      0.1,
      0.5,
    );
    const realizableReductionTonnes = round(reductionPotentialTonnes * feasibilityFactor, 2);

    lanes.push({
      laneId,
      label: `${sample.origin} → ${sample.destPort} · ${sample.category}`,
      origin: sample.origin,
      originState: GEO[sample.origin].state,
      originPort: sample.originPort,
      destPort: sample.destPort,
      destCity: sample.destCity,
      destCountry: sample.destCountry,
      market: sample.market,
      region: sample.region,
      productCategory: sample.category,
      customer: sample.customer,
      customerGroup: sample.customerGroup,
      vendor: sample.vendor,
      lsp: sample.lsp,
      lspIntensityIndex: sample.lspIntensityIndex,
      vendorControllability: sample.vendorControllability,
      primaryMode: 'Ocean',
      modePath: scenarios.current.modePath,
      hasAirExceptions: airMembers.length > 0,
      airSharePct,
      airShipmentCount: airMembers.length,
      shipmentCount,
      totalWeightTonnes,
      totalCo2eTonnes,
      avgCo2ePerTonne,
      avgCo2ePerTonneKm,
      annualFrequency,
      repWeightTonnes: repWeight,
      // Per representative shipment (scenarios are modelled per shipment).
      currentPerShipmentTonnes: scenarios.current.co2eTonnes,
      balancedPerShipmentTonnes: scenarios.balanced.co2eTonnes,
      bestPerShipmentTonnes: scenarios.best.co2eTonnes,
      optimalPerShipmentTonnes: scenarios.optimal.co2eTonnes,
      reductionPotentialTonnes,
      reductionPotentialPct,
      realizableReductionTonnes,
      feasibilityFactor: round(feasibilityFactor, 2),
      recommendedApproach,
      coords: {
        origin: { lat: GEO[sample.origin].lat, lon: GEO[sample.origin].lon },
        originPort: { lat: GEO[sample.originPort].lat, lon: GEO[sample.originPort].lon },
        destPort: { lat: GEO[sample.destPort].lat, lon: GEO[sample.destPort].lon },
        destCity: { lat: DEST_HINTERLAND[sample.destPort].lat, lon: DEST_HINTERLAND[sample.destPort].lon },
      },
      _scenarios: scenarios,
      _members: members.map((m) => m.shipmentId),
    });
  }
  return lanes.sort((a, b) => b.reductionPotentialTonnes - a.reductionPotentialTonnes);
}

// ── Recommendations (the action engine) ─────────────────────────────────────
const ACTION_META = {
  'air-avoidance': { agent: 'Mode Governance Agent', owner: 'logistics', complexity: 'Medium' },
  'mode-shift': { agent: 'Route & Mode Agent', owner: 'logistics', complexity: 'Medium' },
  'origin-port': { agent: 'Route & Mode Agent', owner: 'logistics', complexity: 'Medium' },
  'dest-port': { agent: 'Route & Mode Agent', owner: 'logistics', complexity: 'High' },
  consolidation: { agent: 'Consolidation Agent', owner: 'logistics', complexity: 'Low' },
  'lsp-swap': { agent: 'Partner Influence Agent', owner: 'procurement', complexity: 'Medium' },
  'vendor-intervention': { agent: 'Partner Influence Agent', owner: 'procurement', complexity: 'High' },
  'route-swap': { agent: 'Route & Mode Agent', owner: 'logistics', complexity: 'Medium' },
};

let recSeq = 0;
function buildRecommendations(lanes) {
  const recs = [];
  for (const lane of lanes) {
    const s = lane._scenarios;
    const F = lane.annualFrequency; // per-shipment scenario deltas → annual
    const candidates = [];

    candidates.push({
      type: 'mode-shift',
      approach: 'best_co2',
      title: `Rail-inland + ocean-heavy on ${lane.origin}→${lane.destPort}`,
      rationale: `Switching inland road to rail, routing via the nearest gateway and consolidating containers cuts ${round(s.best.co2eDeltaTonnes * F, 1)} t CO₂e/yr (${s.best.co2eDeltaPct}%) on this lane.`,
      saving: s.best.co2eDeltaTonnes,
      approachScenario: s.best,
    });
    if (lane.reductionPotentialPct < 24) {
      candidates.push({
        type: 'route-swap',
        approach: 'balanced',
        title: `Balanced road+ocean optimization for ${lane.customer}`,
        rationale: `A balanced rail-to-port + optimized delivery plan saves ${round(s.balanced.co2eDeltaTonnes * F, 1)} t CO₂e/yr (${s.balanced.co2eDeltaPct}%) with minimal service impact (${s.balanced.transitBand}).`,
        saving: s.balanced.co2eDeltaTonnes,
        approachScenario: s.balanced,
      });
    }
    if (NEAREST_PORT_BY_ORIGIN[lane.origin] && NEAREST_PORT_BY_ORIGIN[lane.origin] !== lane.originPort) {
      candidates.push({
        type: 'origin-port',
        approach: 'best_co2',
        title: `Re-route ${lane.origin} via ${NEAREST_PORT_BY_ORIGIN[lane.origin]} port`,
        rationale: `${lane.origin} currently feeds ${lane.originPort}. ${NEAREST_PORT_BY_ORIGIN[lane.origin]} is closer, cutting the inland road leg and its emissions.`,
        saving: round(s.best.co2eDeltaTonnes * 0.4, 2),
        approachScenario: s.best,
      });
    }
    if (lane.shipmentCount >= 3) {
      candidates.push({
        type: 'consolidation',
        approach: 'balanced',
        title: `Consolidate ${lane.shipmentCount} ${lane.customer} shipments`,
        rationale: `${lane.shipmentCount} shipments run this lane. Consolidating into full containers reduces trips and inland road legs — a low-effort, low-risk reduction.`,
        saving: round(s.balanced.co2eDeltaTonnes * 0.5, 2),
        approachScenario: s.balanced,
      });
    }
    if (lane.lspIntensityIndex > 1.02) {
      const greener = LSPS.filter((l) => l.intensityIndex < 0.95)[0];
      candidates.push({
        type: 'lsp-swap',
        approach: 'balanced',
        title: `Move ${lane.lsp} volume to ${greener.name}`,
        rationale: `${lane.lsp} runs ~${Math.round((lane.lspIntensityIndex - 1) * 100)}% above fleet-average CO₂ intensity. ${greener.name} (${greener.carrier}) operates a greener fleet on comparable lanes.`,
        saving: round((lane.totalCo2eTonnes / 3) * (lane.lspIntensityIndex - greener.intensityIndex) * 0.5, 2),
        approachScenario: s.balanced,
        annual: true,
      });
    }
    if (lane.vendorControllability !== 'High' && rng() < 0.4) {
      candidates.push({
        type: 'vendor-intervention',
        approach: 'best_co2',
        title: `Align ${lane.vendor} on greener gateway`,
        rationale: `${lane.vendor} controls the origin handoff and current port choice. A data-backed governance conversation can unlock the rail-inland + nearest-port plan.`,
        saving: round(s.best.co2eDeltaTonnes * 0.35, 2),
        approachScenario: s.best,
      });
    }

    const currentAnnual = round(s.current.co2eTonnes * F, 2);
    for (const c of candidates) {
      const annualSaving = round(c.annual ? c.saving : c.saving * F, 2);
      if (annualSaving <= 0) continue;
      recSeq += 1;
      const meta = ACTION_META[c.type];
      const confidence = randInt(62, 95);
      const slaRisk = c.approachScenario.slaRisk;
      const controllability = ['lsp-swap', 'vendor-intervention'].includes(c.type)
        ? 'Influence (partner)'
        : 'Direct (Terova)';
      recs.push({
        id: `rec-${String(recSeq).padStart(4, '0')}`,
        laneId: lane.laneId,
        laneLabel: lane.label,
        customer: lane.customer,
        origin: lane.origin,
        destPort: lane.destPort,
        region: lane.region,
        productCategory: lane.productCategory,
        vendor: lane.vendor,
        lsp: lane.lsp,
        type: c.type,
        agent: meta.agent,
        approach: c.approach,
        title: c.title,
        rationale: c.rationale,
        estCo2eSavingTonnes: annualSaving,
        estCo2eSavingPct: c.approachScenario.co2eDeltaPct,
        costImpactUsd: c.approachScenario.costDeltaUsd,
        costImpactLabel: c.approachScenario.costDeltaUsd <= 0 ? 'Cost-neutral / saving' : 'Cost increase',
        transitImpactDays: c.approachScenario.transitDeltaDays,
        slaImpact: slaRisk,
        confidence,
        complexity: meta.complexity,
        controllability,
        ownerPersona: meta.owner,
        priorityScore: round(annualSaving * (confidence / 100), 2),
        status: 'suggested',
        evidence: [
          { label: 'Current CO₂e', value: `${currentAnnual} t/yr` },
          { label: 'After action', value: `${round(currentAnnual - annualSaving, 2)} t/yr` },
          { label: 'Mode path', value: c.approachScenario.modePath.join(' → ') },
          { label: 'Transit', value: c.approachScenario.transitBand },
        ],
      });
    }
  }
  return recs;
}

/** Per-shipment air-avoidance recommendations (the air-exception governance). */
function buildAirRecs(shipments, laneByShipment) {
  const recs = [];
  for (const s of shipments.filter((x) => x.airException)) {
    const sc = s._scenarios; // current = air, best = ocean+rail
    const perTrip = Math.max(0, sc.current.co2eTonnes - sc.best.co2eTonnes);
    const saving = round(perTrip * s.monthlyTrips, 2);
    if (saving <= 0) continue;
    recSeq += 1;
    const confidence = s.airAvoidable ? randInt(78, 96) : randInt(55, 72);
    recs.push({
      id: `rec-${String(recSeq).padStart(4, '0')}`,
      laneId: laneByShipment.get(s.shipmentId),
      shipmentId: s.shipmentId,
      laneLabel: `${s.origin} → ${s.destCity}`,
      customer: s.customer,
      origin: s.origin,
      destPort: s.destPort,
      region: s.region,
      productCategory: s.category,
      vendor: s.vendor,
      lsp: s.lsp,
      type: 'air-avoidance',
      agent: 'Mode Governance Agent',
      approach: 'best_co2',
      title: `${s.airAvoidable ? 'Shift avoidable air' : 'Govern air exception'} — ${s.customer}`,
      rationale: s.airAvoidable
        ? `${s.productName} moved by air to ${s.destPort}. With earlier planning this could ship by ocean, cutting ~${saving} t CO₂e/yr (${sc.best.co2eDeltaPct}%). Classify and shift.`
        : `${s.productName} air shipment to ${s.destPort} appears genuinely urgent. Document the justification and govern future occurrences against an air budget.`,
      estCo2eSavingTonnes: saving,
      estCo2eSavingPct: sc.best.co2eDeltaPct,
      costImpactUsd: sc.best.costDeltaUsd,
      costImpactLabel: 'Cost-neutral / saving',
      transitImpactDays: sc.best.transitDeltaDays,
      slaImpact: 'Higher (longer transit)',
      confidence,
      complexity: 'Medium',
      controllability: 'Direct (Terova)',
      ownerPersona: 'logistics',
      priorityScore: round(saving * (confidence / 100), 2),
      status: 'suggested',
      airAvoidable: s.airAvoidable,
      evidence: [
        { label: 'Current (air)', value: `${round(sc.current.co2eTonnes, 2)} t` },
        { label: 'Ocean alternative', value: `${round(sc.best.co2eTonnes, 2)} t` },
        { label: 'Mode path', value: sc.best.modePath.join(' → ') },
        { label: 'Transit', value: sc.best.transitBand },
      ],
    });
  }
  return recs;
}

// ── Hotspots ────────────────────────────────────────────────────────────────
function topGroups(shipments, keyFn, labelFn, limit = 8) {
  const m = new Map();
  for (const s of shipments) {
    const k = keyFn(s);
    if (!m.has(k)) m.set(k, { key: k, label: labelFn(s), co2eTonnes: 0, weightTonnes: 0, shipments: 0 });
    const g = m.get(k);
    g.co2eTonnes += s.co2eTonnes;
    g.weightTonnes += s.weightTonnes;
    g.shipments += 1;
  }
  return [...m.values()]
    .map((g) => ({
      ...g,
      co2eTonnes: round(g.co2eTonnes, 2),
      weightTonnes: round(g.weightTonnes, 2),
      co2ePerTonne: round(g.co2eTonnes / Math.max(g.weightTonnes, 0.001), 3),
    }))
    .sort((a, b) => b.co2eTonnes - a.co2eTonnes)
    .slice(0, limit);
}

function buildHotspots(shipments) {
  return {
    byProductCategory: topGroups(shipments, (s) => s.category, (s) => s.category),
    byCustomer: topGroups(shipments, (s) => s.customer, (s) => s.customer),
    byMarket: topGroups(shipments, (s) => s.market, (s) => s.market),
    byMode: topGroups(shipments, (s) => s.primaryMode, (s) => `${s.primaryMode}-led`),
    byOriginPort: topGroups(shipments, (s) => s.originPort, (s) => s.originPort),
    byDestPort: topGroups(shipments, (s) => s.destPort, (s) => s.destPort),
    byVendor: topGroups(shipments, (s) => s.vendor, (s) => s.vendor),
    byLsp: topGroups(shipments, (s) => s.lsp, (s) => s.lsp),
    byOrigin: topGroups(shipments, (s) => s.origin, (s) => `${s.origin}, ${s.originState}`),
  };
}

// ── Partners (vendor / processor / LSP influence) ───────────────────────────
function buildPartners(shipments, recs) {
  const recsByVendor = new Map();
  const recsByLsp = new Map();
  for (const r of recs) {
    if (r.type === 'vendor-intervention') recsByVendor.set(r.vendor, (recsByVendor.get(r.vendor) ?? 0) + r.estCo2eSavingTonnes);
    if (r.type === 'lsp-swap') recsByLsp.set(r.lsp, (recsByLsp.get(r.lsp) ?? 0) + r.estCo2eSavingTonnes);
  }
  const vendorAgg = new Map();
  const lspAgg = new Map();
  for (const s of shipments) {
    if (!vendorAgg.has(s.vendor))
      vendorAgg.set(s.vendor, { name: s.vendor, origin: s.origin, controllability: s.vendorControllability, co2eTonnes: 0, weightTonnes: 0, shipments: 0 });
    const v = vendorAgg.get(s.vendor);
    v.co2eTonnes += s.co2eTonnes; v.weightTonnes += s.weightTonnes; v.shipments += 1;
    if (!lspAgg.has(s.lsp))
      lspAgg.set(s.lsp, { name: s.lsp, carrier: s.carrier, intensityIndex: s.lspIntensityIndex, greenProgram: s._lsp.greenProgram, co2eTonnes: 0, weightTonnes: 0, shipments: 0 });
    const l = lspAgg.get(s.lsp);
    l.co2eTonnes += s.co2eTonnes; l.weightTonnes += s.weightTonnes; l.shipments += 1;
  }
  const fin = (g, extra = {}) => ({
    ...g,
    co2eTonnes: round(g.co2eTonnes, 2),
    weightTonnes: round(g.weightTonnes, 2),
    co2ePerTonne: round(g.co2eTonnes / Math.max(g.weightTonnes, 0.001), 3),
    ...extra,
  });
  return {
    vendors: [...vendorAgg.values()]
      .map((v) => fin(v, { influenceableSavingTonnes: round(recsByVendor.get(v.name) ?? 0, 2) }))
      .sort((a, b) => b.co2eTonnes - a.co2eTonnes),
    lsps: [...lspAgg.values()]
      .map((l) => fin(l, { influenceableSavingTonnes: round(recsByLsp.get(l.name) ?? 0, 2) }))
      .sort((a, b) => b.co2eTonnes - a.co2eTonnes),
  };
}

// ── ESG evidence pack (baseline → realized → ambition) ──────────────────────
function buildEvidence(shipments) {
  const byMonth = new Map();
  for (const s of shipments) {
    if (!byMonth.has(s.period)) byMonth.set(s.period, { period: s.period, grossTonnes: 0, netTonnes: 0, weightTonnes: 0 });
    const g = byMonth.get(s.period);
    g.grossTonnes += s.co2eGrossTonnes;
    g.netTonnes += s.co2eTonnes;
    g.weightTonnes += s.weightTonnes;
  }
  const monthly = [...byMonth.values()]
    .sort((a, b) => (a.period < b.period ? -1 : 1))
    .map((g) => ({
      period: g.period,
      grossTonnes: round(g.grossTonnes, 1),
      netTonnes: round(g.netTonnes, 1),
      avoidedTonnes: round(g.grossTonnes - g.netTonnes, 1),
      intensity: round(g.netTonnes / Math.max(g.weightTonnes, 0.001), 3),
    }));

  const yearAgg = (y) => {
    const rows = shipments.filter((s) => s.year === y);
    const gross = rows.reduce((s, r) => s + r.co2eGrossTonnes, 0);
    const net = rows.reduce((s, r) => s + r.co2eTonnes, 0);
    const w = rows.reduce((s, r) => s + r.weightTonnes, 0);
    return { year: y, grossTonnes: round(gross, 1), netTonnes: round(net, 1), weightTonnes: round(w, 1), intensity: round(net / Math.max(w, 0.001), 3) };
  };
  const baseline = yearAgg(BASELINE_YEAR);
  const latest = yearAgg(LATEST_YEAR);
  const realizedPct = round(((baseline.intensity - latest.intensity) / baseline.intensity) * 100, 1);

  return {
    baselineYear: BASELINE_YEAR,
    latestYear: LATEST_YEAR,
    baseline,
    latest,
    realizedReductionPct: realizedPct,
    ambitionPct: round(REDUCTION_AMBITION * 100, 0),
    monthly,
    methodology: {
      formula: 'CO₂e (kg) = Weight (tonnes) × Distance (km) × Emission Factor (kg CO₂e / tonne-km)',
      distance: 'Straight-line Haversine distance between validated source/destination coordinates, plus a 20% buffer for indirect routes and deviations.',
      allocation: 'For shared/consolidated containers, CO₂e is attributed to each shipment by its weight share.',
      factors: 'Mode- and distance-tiered emission factors. Air uses the client-provided distance tiers (2.136 / 1.323 / 1.191 kg CO₂e/tonne-km). Ocean, rail and road use global container/rail/full-truck factors. All factors are listed in the methodology table.',
      scope: 'GHG Protocol Scope 3 — Category 4/9 downstream transportation & distribution.',
    },
    assumptions: [
      'Distances validated via Bing Maps API and cached in a route dictionary (±5%).',
      'Emission factors held constant within the reporting window; region-specific factors to be confirmed with the customer.',
      'Realized reductions reflect pilot-lane actions from 2023-07 onward; the 10–20% target is a medium-term ambition, not a month-one guarantee.',
    ],
  };
}

// ── Pulse: "what changed" feed ──────────────────────────────────────────────
function buildPulse(lanes, recs, shipments) {
  const out = [];

  // Live (2026) shipments needing a decision now — the "live decisioning" hook.
  const live = (shipments ?? []).filter((s) => s.status === 'In transit' || s.status === 'Planned');
  const planned = live.filter((s) => s.status === 'Planned');
  const inTransit = live.filter((s) => s.status === 'In transit');
  if (planned.length)
    out.push({ id: 'pulse-live-1', kind: 'live', region: 'All', intent: 'opportunity', summary: `${planned.length} shipments are being planned for this month — choose the mode before booking to lock in CO₂e savings.`, timestamp: tsHoursAgo(randInt(2, 10)) });
  if (inTransit.length)
    out.push({ id: 'pulse-live-2', kind: 'live', region: 'All', intent: 'neutral', summary: `${inTransit.length} shipments are in transit now — tracking actual vs expected transit and emissions.`, timestamp: tsHoursAgo(randInt(3, 14)) });
  for (const s of planned.slice(0, 4)) {
    out.push({ id: `pulse-live-${s.shipmentId}`, kind: 'live', laneId: s.laneId, region: s.region, intent: s.airException ? 'risk' : 'opportunity', summary: `Planned: ${s.customer} ${s.category} (${s.origin}→${s.destPort})${s.airException ? ' is set to fly — switch to ocean to cut CO₂e' : ' — confirm Best-for-CO₂ routing'}.`, timestamp: tsHoursAgo(randInt(1, 18)) });
  }

  const topLanes = lanes.slice(0, 14);
  const kinds = [
    (l) => ({ kind: 'recommendation', summary: `New reduction play on ${l.label} — up to ${l.reductionPotentialTonnes} t CO₂e/yr available.`, intent: 'opportunity' }),
    (l) => ({ kind: 'air-exception', summary: `${l.customer} ${l.productCategory} flagged an air exception — review avoidability.`, intent: l.hasAirExceptions ? 'risk' : 'neutral' }),
    (l) => ({ kind: 'reduction', summary: `${l.origin}→${l.destPort} realized a CO₂e cut after rail-inland switch.`, intent: 'positive' }),
    (l) => ({ kind: 'hotspot', summary: `${l.label} entered the top-10 emitting lanes this quarter.`, intent: 'risk' }),
    (l) => ({ kind: 'lsp', summary: `${l.lsp} intensity drifted above fleet average on ${l.destPort} lanes.`, intent: 'risk' }),
    (l) => ({ kind: 'consolidation', summary: `${l.shipmentCount} ${l.customer} shipments are consolidation candidates.`, intent: 'opportunity' }),
  ];
  topLanes.forEach((l, i) => {
    const make = kinds[i % kinds.length];
    const e = make(l);
    out.push({
      id: `pulse-${String(i + 1).padStart(3, '0')}`,
      laneId: l.laneId,
      region: l.region,
      ...e,
      timestamp: tsHoursAgo(randInt(3, 70)),
    });
  });
  // A couple of program-level learning notes.
  out.push({ id: 'pulse-901', kind: 'program', region: 'All', intent: 'positive', summary: `Recalibrated route dictionary — ${randInt(20, 60)} new lat/long pairs validated against Bing API.`, timestamp: tsDaysAgo(randInt(2, 6)) });
  out.push({ id: 'pulse-902', kind: 'program', region: 'All', intent: 'neutral', summary: `${recs.length} reduction actions in the tracker; ${recs.filter((r) => r.controllability.startsWith('Direct')).length} are directly under Terova's control.`, timestamp: tsDaysAgo(randInt(1, 4)) });
  return out.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}

// ── Exceptions / Air Watch + data quality ───────────────────────────────────
function buildExceptions(shipments, lanes) {
  const out = [];
  let i = 0;
  for (const s of shipments.filter((x) => x.airException)) {
    i += 1;
    out.push({
      id: `exc-${String(i).padStart(3, '0')}`,
      kind: 'air',
      severity: s.airAvoidable ? 'High' : 'Medium',
      shipmentId: s.shipmentId,
      laneLabel: `${s.origin} → ${s.destPort}`,
      customer: s.customer,
      region: s.region,
      title: `Air shipment — ${s.productName}`,
      detail: s.airAvoidable
        ? 'Avoidable: could have moved by ocean with earlier planning. Classify and shift.'
        : 'Justified: genuine urgency / perishability. Govern and document.',
      classification: s.airAvoidable ? 'Avoidable' : 'Justified',
      co2eTonnes: s.co2eTonnes,
      detectedAt: tsDaysAgo(randInt(1, 40)),
    });
  }
  // Data-quality / blocked-route exceptions (mirrors the workbook's blocked rows).
  const dq = [
    { title: 'Blocked route — missing destination coordinates', detail: 'Konan / “confirm country/location” — destination lat/long ambiguous. Final CO₂e blocked until resolved.', region: 'APAC' },
    { title: 'Invalid route — handled by external party', detail: 'Rail leg marked “shipment handled by external” with INVALID source/destination. Exclude or reassign.', region: 'All' },
    { title: 'Low data confidence — weight share unconfirmed', detail: 'Consolidated container with unconfirmed weight allocation. Attributed CO₂e may shift on validation.', region: 'Europe' },
  ];
  dq.forEach((d, k) => {
    out.push({
      id: `exc-dq-${k + 1}`,
      kind: 'data-quality',
      severity: 'Medium',
      laneLabel: '—',
      customer: '—',
      region: d.region,
      title: d.title,
      detail: d.detail,
      classification: 'Needs data',
      co2eTonnes: 0,
      detectedAt: tsDaysAgo(randInt(2, 30)),
    });
  });
  void lanes;
  return out.sort((a, b) => ({ High: 0, Medium: 1, Low: 2 }[a.severity] - { High: 0, Medium: 1, Low: 2 }[b.severity]));
}

// ── Emission-factor reference table (methodology page) ──────────────────────
const EMISSION_FACTORS = [
  { id: 'AIR_SHORT', mode: 'Air', basis: 'Distance < 1000 km', value: 2.136, unit: 'kg CO₂e/tonne-km', source: 'Client screenshot', note: 'Air exception — highest intensity.' },
  { id: 'AIR_MED', mode: 'Air', basis: 'Distance 1000–3700 km', value: 1.323, unit: 'kg CO₂e/tonne-km', source: 'Client screenshot', note: 'Air exception.' },
  { id: 'AIR_LONG', mode: 'Air', basis: 'Distance > 3700 km', value: 1.191, unit: 'kg CO₂e/tonne-km', source: 'Client screenshot', note: 'Air exception — long-haul.' },
  { id: 'OCEAN_SHORT', mode: 'Ocean', basis: 'Distance < 1000 km', value: 0.016, unit: 'kg CO₂e/tonne-km', source: 'Container shipping (global)', note: 'Lowest-carbon long-haul mode.' },
  { id: 'OCEAN_MED', mode: 'Ocean', basis: 'Distance 1000–3700 km', value: 0.012, unit: 'kg CO₂e/tonne-km', source: 'Container shipping (global)', note: '' },
  { id: 'OCEAN_LONG', mode: 'Ocean', basis: 'Distance > 3700 km', value: 0.008, unit: 'kg CO₂e/tonne-km', source: 'Container shipping (global)', note: 'Best for long ocean legs.' },
  { id: 'RAIL', mode: 'Rail', basis: 'All distances', value: 0.028, unit: 'kg CO₂e/tonne-km', source: 'Freight rail (global)', note: 'Preferred inland mode.' },
  { id: 'ROAD_TRUCK', mode: 'Road', basis: 'Full-load diesel truck', value: 0.088, unit: 'kg CO₂e/tonne-km', source: 'Full-truckload (tonne-km)', note: 'Primary road basis for cross-mode comparison.' },
  { id: 'ROAD_VAN_KM', mode: 'Road', basis: 'Van (vehicle-km)', value: 0.835, unit: 'kg CO₂e/km', source: 'Client screenshot', note: 'Vehicle-km basis — allocate by weight share.' },
  { id: 'ROAD_PETROL_KM', mode: 'Road', basis: 'Petrol vehicle (vehicle-km)', value: 1.13, unit: 'kg CO₂e/km', source: 'Client screenshot', note: 'Vehicle-km basis.' },
  { id: 'ROAD_DIESEL_KM', mode: 'Road', basis: 'Diesel vehicle (vehicle-km)', value: 0.768, unit: 'kg CO₂e/km', source: 'Client screenshot', note: 'Vehicle-km basis.' },
  { id: 'FUEL_DIESEL', mode: 'Fuel', basis: 'Diesel (fuel-based)', value: 2.68, unit: 'kg CO₂e/litre', source: 'Architect call example', note: 'Alternative fuel-based method.' },
];

// ── Copilot suggestions ─────────────────────────────────────────────────────
const COPILOT_SUGGESTIONS = [
  { id: 'cs-1', prompt: 'Where are my biggest emission hotspots?' },
  { id: 'cs-2', prompt: 'Which lanes have the highest reduction potential?' },
  { id: 'cs-3', prompt: 'Show me avoidable air shipments' },
  { id: 'cs-4', prompt: 'What is our progress toward the 15% ambition?' },
  { id: 'cs-5', prompt: 'Which LSP is above fleet-average intensity?' },
  { id: 'cs-6', prompt: 'Recommend the best CO₂ actions this quarter' },
  { id: 'cs-7', prompt: 'Which customers should we prioritize?' },
];

// ── Write everything ─────────────────────────────────────────────────────────
function writeJson(relPath, data) {
  const full = join(OUT, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, JSON.stringify(data));
}

function stripShipment(s) {
  const { _scenarios, _vendor, _lsp, _product, _customer, co2eGrossTonnes, ...rest } = s;
  void _vendor; void _lsp; void _product; void _customer; void _scenarios;
  return { ...rest, co2eGrossTonnes };
}

const SHIPMENT_COUNT = 600;

function main() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  // Distribute shipments evenly across years (mild volume growth) so annual
  // totals reflect the per-shipment reduction ramp — not random per-year counts.
  // 2026 is partial (to AS_OF), so it gets a half quota over Jan–Jun.
  const fullYears = [];
  for (let y = BASELINE_YEAR; y < LATEST_YEAR; y++) fullYears.push(y);
  const growth = (i) => 1 + i * 0.03; // ~3%/yr volume growth
  const weightSum = fullYears.reduce((s, _y, i) => s + growth(i), 0) + 0.5; // +0.5 for partial 2026
  const baseN = SHIPMENT_COUNT / weightSum;
  const periods = [];
  fullYears.forEach((y, i) => {
    const n = Math.round(baseN * growth(i));
    for (let k = 0; k < n; k++) periods.push(`${y}-${String(randInt(1, 12)).padStart(2, '0')}`);
  });
  const n26 = Math.round(baseN * 0.5);
  for (let k = 0; k < n26; k++) periods.push(`${LATEST_YEAR}-${String(randInt(1, 6)).padStart(2, '0')}`);
  const shipments = periods.map((p) => buildShipment(p));
  const lanes = buildLanes(shipments);
  const laneByShipment = new Map();
  for (const l of lanes) for (const sid of l._members) laneByShipment.set(sid, l.laneId);

  // Forward schedule — project the next horizon from recent lane cadence.
  const PLAN_HORIZON_DAYS = 100;
  const recentCut = addDays(AS_OF_ISO, -180);
  const planPool = shipments.filter((s) => s.date >= recentCut);
  const pool = planPool.length ? planPool : shipments;
  const plannedCount = Math.max(56, Math.round((pool.length / 180) * PLAN_HORIZON_DAYS));
  const templateFor = new Map();
  const planned = [];
  for (let i = 0; i < plannedCount; i++) {
    const template = pick(pool);
    const date = addDays(AS_OF_ISO, randInt(2, PLAN_HORIZON_DAYS));
    const p = buildPlannedShipment(template, date);
    templateFor.set(p.shipmentId, template.shipmentId);
    planned.push(p);
  }
  const allShipments = [...shipments, ...planned];
  const laneIdOf = (s) => laneByShipment.get(s.shipmentId) ?? laneByShipment.get(templateFor.get(s.shipmentId));

  const recs = [...buildRecommendations(lanes), ...buildAirRecs(shipments, laneByShipment)].sort(
    (a, b) => b.priorityScore - a.priorityScore,
  );
  const recsByLane = new Map();
  const recsByShipment = new Map();
  for (const r of recs) {
    if (r.laneId) {
      if (!recsByLane.has(r.laneId)) recsByLane.set(r.laneId, []);
      recsByLane.get(r.laneId).push(r);
    }
    if (r.shipmentId) {
      if (!recsByShipment.has(r.shipmentId)) recsByShipment.set(r.shipmentId, []);
      recsByShipment.get(r.shipmentId).push(r);
    }
  }

  // Per-shipment detail chunks (legs + calc breakdown + lane pointer).
  for (const s of allShipments) {
    const laneId = laneIdOf(s);
    const ownRecs = [
      ...(recsByShipment.get(s.shipmentId) ?? []),
      ...(recsByLane.get(laneId) ?? []).filter((r) => !r.shipmentId),
    ];
    writeJson(`shipments/${s.shipmentId}.json`, {
      ...stripShipment(s),
      laneId,
      legs: s._scenarios.current.legs,
      scenarios: s._scenarios,
      recommendations: ownRecs,
      hasOpenRecommendation: ownRecs.length > 0,
    });
  }
  // Per-lane detail chunks (full scenarios + member shipments + recs).
  for (const l of lanes) {
    writeJson(`lanes/${l.laneId}.json`, {
      ...stripLane(l),
      scenarios: l._scenarios,
      recommendations: recsByLane.get(l.laneId) ?? [],
      shipmentIds: l._members,
    });
  }

  const lightShipments = allShipments.map((s) => {
    const { co2eGrossTonnes, ...rest } = stripShipment(s);
    void co2eGrossTonnes;
    return { ...rest, laneId: laneIdOf(s) };
  });
  const lightLanes = lanes.map(stripLane);

  writeJson('shipments/index.json', { generatedAt: AS_OF.toISOString(), items: lightShipments });
  writeJson('lanes/index.json', { generatedAt: AS_OF.toISOString(), items: lightLanes });
  writeJson('recommendations.json', recs);
  writeJson('hotspots.json', buildHotspots(shipments));
  writeJson('partners.json', buildPartners(shipments, recs));
  writeJson('evidence.json', buildEvidence(shipments));
  writeJson('pulse.json', buildPulse(lanes, recs, allShipments));
  writeJson('exceptions.json', buildExceptions(shipments, lanes));
  writeJson('emission-factors.json', EMISSION_FACTORS);
  writeJson('copilot-suggestions.json', COPILOT_SUGGESTIONS);
  writeJson('geo.json', GEO);

  const regions = [...new Set(shipments.map((s) => s.region))].sort();
  const totalNet = round(shipments.reduce((s, r) => s + r.co2eTonnes, 0), 1);
  writeJson('assumptions.json', {
    asOf: AS_OF.toISOString().slice(0, 10),
    company: 'Terova',
    product: 'Tradewind',
    baselineYear: BASELINE_YEAR,
    latestYear: LATEST_YEAR,
    ambitionPct: round(REDUCTION_AMBITION * 100, 0),
    totalNetCo2eTonnes: totalNet,
    scope: 'Scope 3 · Downstream Transportation',
    planHorizonDays: PLAN_HORIZON_DAYS,
    planHorizonEnd: addDays(AS_OF_ISO, PLAN_HORIZON_DAYS),
    plannedShipmentCount: planned.length,
  });

  writeJson('filter-options.json', {
    regions,
    markets: [...new Set(shipments.map((s) => s.market))].sort(),
    productCategories: [...new Set(shipments.map((s) => s.category))].sort(),
    modes: ['Ocean', 'Air', 'Rail', 'Road'],
    customers: [...new Set(shipments.map((s) => s.customer))].sort(),
    vendors: VENDORS.map((v) => v.name).sort(),
    lsps: LSPS.map((l) => l.name).sort(),
    originPorts: [...new Set(shipments.map((s) => s.originPort))].sort(),
    years: [...new Set(shipments.map((s) => s.year))].sort(),
    approaches: ['optimal', 'balanced', 'best_co2'],
  });

  // Console summary
  const byMode = lightShipments.reduce((a, s) => ((a[s.primaryMode] = (a[s.primaryMode] || 0) + 1), a), {});
  console.log('Tradewind mock data generated →', OUT);
  console.table(byMode);
  console.log(
    `shipments: ${shipments.length}, lanes: ${lanes.length}, recommendations: ${recs.length}, ` +
      `air exceptions: ${shipments.filter((s) => s.airException).length}, total net CO₂e: ${totalNet} t`,
  );
  console.log(
    `reduction potential (top lane): ${lanes[0].reductionPotentialTonnes} t/yr on ${lanes[0].label}`,
  );
}

function stripLane(l) {
  const { _scenarios, _members, ...rest } = l;
  void _scenarios; void _members;
  return rest;
}

main();
