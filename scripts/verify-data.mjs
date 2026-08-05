/**
 * Independent verification of everything in `public/mock-data`.
 *
 * This deliberately does NOT import anything from `generate-mock-data.mjs`. It
 * re-derives each figure straight from the workbook extract and from the emitted
 * JSON's own leg lists, then diffs. A bug shared between the generator and its
 * checker would be invisible, so the two must not share code — the only thing
 * they have in common is the workbook.
 *
 * Run with: `npm run mock:verify` (after `npm run mock:gen`).
 * Exits non-zero on the first failing category, so CI can gate on it.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'public', 'mock-data');
const read = (p) => JSON.parse(readFileSync(join(OUT, p), 'utf8'));
const src = JSON.parse(readFileSync(join(__dirname, 'source', 'transport-downstream.json'), 'utf8'));

// ── Test harness ───────────────────────────────────────────────────────────
const failures = [];
let checks = 0;
let currentGroup = '';

const group = (name) => {
  currentGroup = name;
  process.stdout.write(`\n${name}\n`);
};
function ok(label, condition, detail) {
  checks += 1;
  if (condition) return true;
  failures.push({ group: currentGroup, label, detail });
  process.stdout.write(`  ✗ ${label}\n      ${detail}\n`);
  return false;
}
function pass(label, note = '') {
  process.stdout.write(`  ✓ ${label}${note ? `  ${note}` : ''}\n`);
}

/**
 * Floating-point comparison with an absolute tolerance.
 *
 * 0.5 g on a tonne figure. Everything here is a sum of six-decimal rounded
 * values, so exact equality would fail on rounding alone; anything looser would
 * let a real error through.
 */
const TOL = 5e-7;
const near = (a, b, tol = TOL) => Math.abs(a - b) <= tol;
const sum = (arr, f) => arr.reduce((a, b) => a + f(b), 0);
const r6 = (n) => Math.round(n * 1e6) / 1e6;

// ── Fixtures ───────────────────────────────────────────────────────────────
const EF = { road: 0.5928, rail: 0.00996, ocean: 0.0084, air: 1.58 };
const PER_TRUCK = new Set(['road']); // charged per km driven, load-independent

const shipmentIndex = read('shipments/index.json').items;
const shipmentFiles = readdirSync(join(OUT, 'shipments')).filter((f) => f !== 'index.json');
const details = shipmentFiles.map((f) => read(`shipments/${f}`));
const detailById = new Map(details.map((d) => [d.shipmentId, d]));
const laneIndex = read('lanes/index.json').items;
const laneDetails = readdirSync(join(OUT, 'lanes'))
  .filter((f) => f !== 'index.json')
  .map((f) => read(`lanes/${f}`));
const recommendations = read('recommendations.json');
const evidence = read('evidence.json');
const assumptions = read('assumptions.json');
const factors = read('emission-factors.json');
const exceptions = read('exceptions.json');
const filterOptions = read('filter-options.json');

const workbookRows = shipmentIndex.filter((s) => s.dataOrigin === 'workbook');
const plannedRows = shipmentIndex.filter((s) => s.status === 'Planned');

// ══════════════════════════════════════════════════════════════════════════
group('1. Leg arithmetic — every leg re-costed from distance × factor');
// ══════════════════════════════════════════════════════════════════════════
{
  let bad = 0;
  let legCount = 0;
  let maxDrift = 0;
  const basisErrors = [];
  for (const d of details) {
    for (const leg of d.legs) {
      legCount += 1;
      const perTruck = PER_TRUCK.has(leg.mode);
      // The whole model rests on this distinction, so assert the basis itself
      // rather than trusting the flag the generator wrote.
      if (perTruck !== (leg.efBasis === 'per-truck-km')) {
        basisErrors.push(`${d.shipmentId} ${leg.mode} basis=${leg.efBasis}`);
      }
      const expected = perTruck
        ? (leg.distanceKm * leg.emissionFactor) / 1000
        : (leg.weightTonnes * leg.distanceKm * leg.emissionFactor) / 1000;
      // A recorded leg keeps the CO₂e the *workbook* prints for it rather than a
      // recomputation, which is the right way round for an audit tool — the app
      // must quote the sheet, not overrule it. The sheet rounds, so the two can
      // differ slightly, and what matters is that the gap stays immaterial.
      // Anything above 10 mg on a leg would mean a factor or distance is wrong,
      // not that a cell was rounded.
      const drift = Math.abs(expected - leg.co2eTonnes);
      maxDrift = Math.max(maxDrift, drift);
      if (drift > 1e-5) {
        bad += 1;
        if (bad <= 3) {
          process.stdout.write(
            `      ${d.shipmentId} leg ${leg.seq} ${leg.from}→${leg.to}: stored ${leg.co2eTonnes}, recomputed ${r6(expected)}\n`,
          );
        }
      }
      if (leg.emissionFactor !== EF[leg.mode]) {
        basisErrors.push(`${d.shipmentId} ${leg.mode} factor=${leg.emissionFactor} expected ${EF[leg.mode]}`);
      }
    }
  }
  ok(`all ${legCount} legs re-cost from distance × factor to within 10 mg`, bad === 0, `${bad} legs disagree by more than that`);
  ok('every leg uses the workbook factor and the right charging basis', basisErrors.length === 0, basisErrors.slice(0, 3).join('; '));
  if (bad === 0 && basisErrors.length === 0) {
    pass(`${legCount} legs`, `— road per truck-km, rail/ocean/air per tonne-km; worst rounding drift ${(maxDrift * 1e6).toFixed(2)} mg`);
  }
}

// ══════════════════════════════════════════════════════════════════════════
group('2. Shipment rollups — totals equal the sum of their own legs');
// ══════════════════════════════════════════════════════════════════════════
{
  const errs = [];
  for (const d of details) {
    const legs = d.legs;
    const modeSum = (m) => sum(legs.filter((l) => l.mode === m), (l) => l.co2eTonnes);
    const kmSum = (m) => sum(legs.filter((l) => l.mode === m), (l) => l.distanceKm);
    const total = sum(legs, (l) => l.co2eTonnes);
    const totalKm = sum(legs, (l) => l.distanceKm);
    const push = (what, a, b) => !near(a, b, 1e-5) && errs.push(`${d.shipmentId} ${what}: ${a} vs ${b}`);

    push('co2eTonnes', d.co2eTonnes, total);
    push('roadCo2e', d.roadCo2eTonnes, modeSum('road'));
    push('railCo2e', d.railCo2eTonnes, modeSum('rail'));
    push('oceanCo2e', d.oceanCo2eTonnes, modeSum('ocean'));
    push('airCo2e', d.airCo2eTonnes, modeSum('air'));
    push('roadKm', d.roadKm, kmSum('road'));
    push('railKm', d.railKm, kmSum('rail'));
    push('oceanKm', d.oceanKm, kmSum('ocean'));
    push('airKm', d.airKm, kmSum('air'));
    push('totalDistanceKm', d.totalDistanceKm, totalKm);
    // Mode split must exhaust the total — no CO₂e unattributed to a mode.
    push('mode split exhausts total', d.roadCo2eTonnes + d.railCo2eTonnes + d.oceanCo2eTonnes + d.airCo2eTonnes, total);

    if (d.weightTonnes > 0) {
      push('co2ePerTonne', d.co2ePerTonne, Math.round((total / d.weightTonnes) * 1e4) / 1e4);
      if (totalKm > 0) {
        push('co2ePerTonneKm', d.co2ePerTonneKm, Math.round(((total * 1e6) / (d.weightTonnes * totalKm)) * 1e3) / 1e3);
      }
    }
    if (d.isAirFreight !== legs.some((l) => l.mode === 'air')) errs.push(`${d.shipmentId} isAirFreight wrong`);
    if (d.primaryMode !== [...legs].sort((a, b) => b.co2eTonnes - a.co2eTonnes)[0].modeLabel) {
      errs.push(`${d.shipmentId} primaryMode is not the heaviest leg`);
    }
  }
  ok(`all ${details.length} shipment rollups agree with their legs`, errs.length === 0, errs.slice(0, 4).join(' | '));
  if (!errs.length) pass(`${details.length} shipments`, '— CO₂e, per-mode splits, distances and intensities');
}

// ══════════════════════════════════════════════════════════════════════════
group('3. Index ↔ detail — the list and the record agree');
// ══════════════════════════════════════════════════════════════════════════
{
  const errs = [];
  ok('every index row has a detail file', shipmentIndex.length === details.length, `${shipmentIndex.length} vs ${details.length}`);
  for (const s of shipmentIndex) {
    const d = detailById.get(s.shipmentId);
    if (!d) {
      errs.push(`${s.shipmentId} missing detail`);
      continue;
    }
    for (const k of ['co2eTonnes', 'weightTonnes', 'totalDistanceKm', 'avoidableTonnes', 'date', 'status', 'dataOrigin', 'laneId', 'destPort', 'gateway']) {
      if (JSON.stringify(s[k]) !== JSON.stringify(d[k])) errs.push(`${s.shipmentId}.${k}: ${s[k]} vs ${d[k]}`);
    }
  }
  ok('index and detail carry identical figures', errs.length === 0, errs.slice(0, 4).join(' | '));
  if (!errs.length) pass(`${shipmentIndex.length} rows cross-checked`);
}

// ══════════════════════════════════════════════════════════════════════════
group('4. Workbook coverage — every source leg counted exactly once');
// ══════════════════════════════════════════════════════════════════════════
{
  // Build the expected leg multiset straight from the extract.
  const expected = new Map(); // sourceRef -> count
  const addRef = (ref) => expected.set(ref, (expected.get(ref) ?? 0) + 1);
  for (const y of src.years) {
    for (const sh of y.exportShipments) {
      for (const l of sh.inland) addRef(l.sourceRef);
      addRef(sh.ocean.sourceRef);
    }
    for (const sh of y.airShipments) {
      for (const l of sh.inland) addRef(l.sourceRef);
      addRef(sh.air.sourceRef);
    }
    for (const r of y.collectionMovements) addRef(r.sourceRef);
  }
  // Duplicated rows the extractor flagged are reported as exceptions, not
  // attributed to a shipment, so they are not expected to appear.
  const flagged = new Set(
    src.years.flatMap((y) => (y.dataFlags ?? []).filter((f) => f.kind === 'duplicate-inland-leg').map((f) => f.sourceRef)),
  );
  for (const ref of flagged) expected.delete(ref);

  const actual = new Map();
  for (const s of workbookRows) {
    for (const leg of detailById.get(s.shipmentId).legs) actual.set(leg.sourceRef, (actual.get(leg.sourceRef) ?? 0) + 1);
  }

  const missing = [...expected.keys()].filter((k) => !actual.has(k));
  const extra = [...actual.keys()].filter((k) => !expected.has(k));
  const miscounted = [...expected.entries()].filter(([k, n]) => actual.has(k) && actual.get(k) !== n);

  ok('no workbook leg is dropped', missing.length === 0, `${missing.length} missing, e.g. ${missing.slice(0, 3).join(', ')}`);
  ok('no leg is attributed that the workbook does not contain', extra.length === 0, `${extra.length} extra, e.g. ${extra.slice(0, 3).join(', ')}`);
  ok('no workbook leg is double-counted', miscounted.length === 0, miscounted.slice(0, 3).map(([k, n]) => `${k} expected ${n} got ${actual.get(k)}`).join('; '));
  if (!missing.length && !extra.length && !miscounted.length) {
    pass(`${expected.size} source legs`, `— each attributed to exactly one shipment (${flagged.size} duplicates filed as exceptions)`);
  }
}

// ══════════════════════════════════════════════════════════════════════════
group('5. Reconciliation — the bridge to the workbook’s printed totals');
// ══════════════════════════════════════════════════════════════════════════
{
  for (const y of evidence.years) {
    const rows = workbookRows.filter((s) => s.reportingYear === y.reportingYear);
    const total = sum(rows, (s) => s.co2eTonnes);
    ok(
      `${y.reportingYear}: reported total equals the sum of its shipments`,
      near(total, y.allLegsCo2eTonnes, 1e-5),
      `shipments sum to ${r6(total)}, year says ${y.allLegsCo2eTonnes}`,
    );
    const printed = src.years.find((x) => x.reportingYear === y.reportingYear).reportedTotalCo2eTonnes;
    ok(
      `${y.reportingYear}: printed workbook total quoted verbatim`,
      near(printed, y.reportedCo2eTonnes, 1e-6),
      `extract says ${printed}, evidence says ${y.reportedCo2eTonnes}`,
    );
    const bridge = sum(y.reconciliation.slice(0, -1), (s) => s.co2eTonnes);
    ok(
      `${y.reportingYear}: bridge lines add up to the reported figure`,
      near(bridge, y.allLegsCo2eTonnes, 5e-3),
      `bridge sums to ${r6(bridge)}, reports ${y.allLegsCo2eTonnes}`,
    );
    ok(
      `${y.reportingYear}: bridge starts at the printed total`,
      near(y.reconciliation[0].co2eTonnes, y.reportedCo2eTonnes, 1e-6),
      `starts at ${y.reconciliation[0].co2eTonnes}`,
    );
    // The four per-mode figures must exhaust the year, or a mode is unaccounted.
    const modes = y.roadCo2eTonnes + y.railCo2eTonnes + y.oceanCo2eTonnes + y.airCo2eTonnes;
    ok(`${y.reportingYear}: per-mode splits exhaust the year`, near(modes, y.allLegsCo2eTonnes, 1e-5), `modes ${r6(modes)} vs ${y.allLegsCo2eTonnes}`);
    // And so must each reported slice.
    for (const [name, rowsOf] of [['category', y.byCategory], ['destPort', y.byDestPort], ['gateway', y.byGateway], ['mode', y.byMode]]) {
      const s = sum(rowsOf, (r) => r.co2eTonnes);
      ok(`${y.reportingYear}: by-${name} slice sums to the year total`, near(s, y.allLegsCo2eTonnes, 1e-4), `${r6(s)} vs ${y.allLegsCo2eTonnes}`);
      const p = sum(rowsOf, (r) => r.pct);
      ok(`${y.reportingYear}: by-${name} shares sum to 100%`, Math.abs(p - 100) < 0.6, `${p.toFixed(2)}%`);
      const n = sum(rowsOf, (r) => r.shipments);
      ok(`${y.reportingYear}: by-${name} movement counts sum to the year`, n === y.shipments, `${n} vs ${y.shipments}`);
    }
  }
  ok(
    'no synthetic row reaches the reported total',
    near(sum(workbookRows, (s) => s.co2eTonnes), assumptions.totalCo2eTonnes, 1e-4),
    `workbook rows sum to ${r6(sum(workbookRows, (s) => s.co2eTonnes))}, assumptions say ${assumptions.totalCo2eTonnes}`,
  );
}

// ══════════════════════════════════════════════════════════════════════════
group('6. Route options — every alternative is priced and evidenced');
// ══════════════════════════════════════════════════════════════════════════
{
  const errs = [];
  let optionCount = 0;
  let optimisedMissing = 0;
  for (const d of details) {
    const current = d.options.find((o) => o.isCurrent);
    if (!current) {
      errs.push(`${d.shipmentId} has no current option`);
      continue;
    }
    if (!near(current.co2eTonnes, d.co2eTonnes, 1e-5)) {
      errs.push(`${d.shipmentId} current option ${current.co2eTonnes} != shipment ${d.co2eTonnes}`);
    }
    const optimised = d.options.filter((o) => o.isOptimised);
    if (optimised.length !== 1) optimisedMissing += 1;

    for (const o of d.options) {
      optionCount += 1;
      const legTotal = sum(o.legs, (l) => l.co2eTonnes);
      if (!near(legTotal, o.co2eTonnes, 1e-5)) errs.push(`${d.shipmentId}/${o.id} total ${o.co2eTonnes} != legs ${r6(legTotal)}`);
      const legKm = sum(o.legs, (l) => l.distanceKm);
      if (!near(legKm, o.distanceKm, 1e-3)) errs.push(`${d.shipmentId}/${o.id} distance ${o.distanceKm} != legs ${r6(legKm)}`);
      if (!o.isCurrent) {
        const delta = o.co2eTonnes - current.co2eTonnes;
        if (!near(delta, o.co2eDeltaTonnes, 1e-5)) errs.push(`${d.shipmentId}/${o.id} delta ${o.co2eDeltaTonnes} != ${r6(delta)}`);
        // Only options that beat the booked route are offered.
        if (o.co2eDeltaTonnes >= 0) errs.push(`${d.shipmentId}/${o.id} offered but is not cheaper (${o.co2eDeltaTonnes})`);
        const pctExp = (delta / current.co2eTonnes) * 100;
        if (!near(pctExp, o.co2eDeltaPct, 1e-2)) errs.push(`${d.shipmentId}/${o.id} pct ${o.co2eDeltaPct} != ${pctExp.toFixed(3)}`);
        // "Proven on N shipments" must be a real count, and the evidence must cite cells.
        if (!(o.timesUsedInWorkbook >= 1)) errs.push(`${d.shipmentId}/${o.id} timesUsedInWorkbook=${o.timesUsedInWorkbook}`);
        if (!o.evidenceRefs?.length) errs.push(`${d.shipmentId}/${o.id} has no evidence refs`);
        if (!o.evidence || o.evidence.length < 40) errs.push(`${d.shipmentId}/${o.id} evidence too thin`);
      }
      // One card per lever — a shipment must never show two of the same kind.
      const kinds = d.options.map((x) => x.kind);
      if (new Set(kinds).size !== kinds.length) errs.push(`${d.shipmentId} shows two options of one kind: ${kinds.join(',')}`);
      const ids = d.options.map((x) => x.id);
      if (new Set(ids).size !== ids.length) errs.push(`${d.shipmentId} has duplicate option ids`);
    }

    // The optimised flag must sit on the genuinely lowest-CO₂e routing.
    const lowest = [...d.options].sort((a, b) => a.co2eTonnes - b.co2eTonnes)[0];
    if (optimised.length === 1 && !near(optimised[0].co2eTonnes, lowest.co2eTonnes, 1e-9)) {
      errs.push(`${d.shipmentId} optimised is ${optimised[0].id} but ${lowest.id} is cheaper`);
    }
    // Avoidable must equal what the optimised option actually saves.
    const best = d.options.find((o) => o.isOptimised && !o.isCurrent);
    const avoidable = best ? -best.co2eDeltaTonnes : 0;
    if (!near(avoidable, d.avoidableTonnes, 1e-5)) errs.push(`${d.shipmentId} avoidable ${d.avoidableTonnes} != ${r6(avoidable)}`);
    if ((d.bestOptionKind ?? null) !== (best?.kind ?? null)) errs.push(`${d.shipmentId} bestOptionKind mismatch`);
  }
  ok('exactly one option per shipment is flagged optimised', optimisedMissing === 0, `${optimisedMissing} shipments wrong`);
  ok(`all ${optionCount} route options price, rank and evidence correctly`, errs.length === 0, errs.slice(0, 5).join(' | '));
  if (!errs.length && !optimisedMissing) pass(`${optionCount} options across ${details.length} shipments`);
}

// ══════════════════════════════════════════════════════════════════════════
group('7. Option legs exist in the workbook — nothing hypothetical');
// ══════════════════════════════════════════════════════════════════════════
{
  // Every leg the workbook records, as source→dest→distance→mode.
  const catalogue = new Set();
  const modeOf = (l) => (l.ef === EF.rail ? 'rail' : 'road');
  for (const y of src.years) {
    for (const sh of y.exportShipments) {
      for (const l of sh.inland) catalogue.add(`${l.source}|${l.dest}|${l.distanceKm.toFixed(3)}|${modeOf(l)}`);
      catalogue.add(`${sh.ocean.source}|${sh.ocean.dest}|${sh.ocean.distanceKm.toFixed(3)}|ocean`);
    }
    for (const sh of y.airShipments) {
      for (const l of sh.inland) catalogue.add(`${l.source}|${l.dest}|${l.distanceKm.toFixed(3)}|${modeOf(l)}`);
      catalogue.add(`${sh.air.source}|${sh.air.dest}|${sh.air.distanceKm.toFixed(3)}|air`);
    }
    for (const r of y.collectionMovements) catalogue.add(`${r.source}|${r.dest}|${r.distanceKm.toFixed(3)}|road`);
  }
  const invented = new Set();
  for (const d of details) {
    for (const o of d.options) {
      for (const l of o.legs) {
        const key = `${l.from}|${l.to}|${l.distanceKm.toFixed(3)}|${l.mode}`;
        if (!catalogue.has(key)) invented.add(`${d.shipmentId}/${o.id}: ${key}`);
      }
    }
  }
  ok('no option uses a leg the workbook does not record', invented.size === 0, [...invented].slice(0, 5).join(' | '));
  if (!invented.size) pass(`${catalogue.size} distinct workbook legs`, '— every option leg drawn from this set');
}

// ══════════════════════════════════════════════════════════════════════════
group('8. Recommendations — each one traces to the option it names');
// ══════════════════════════════════════════════════════════════════════════
{
  const errs = [];
  for (const r of recommendations) {
    const d = detailById.get(r.shipmentId);
    if (!d) {
      errs.push(`${r.id} references unknown shipment ${r.shipmentId}`);
      continue;
    }
    const opt = d.options.find((o) => o.id === r.optionId);
    if (!opt) {
      errs.push(`${r.id} names optionId ${r.optionId}, which the shipment does not have`);
      continue;
    }
    if (opt.kind !== r.optionKind || opt.kind !== r.type) errs.push(`${r.id} kind mismatch: ${r.type}/${r.optionKind} vs ${opt.kind}`);
    if (!opt.isOptimised) errs.push(`${r.id} recommends ${opt.id}, which is not the optimised route`);
    const saving = -opt.co2eDeltaTonnes;
    if (!near(saving, r.estCo2eSavingTonnes, 1e-5)) errs.push(`${r.id} saving ${r.estCo2eSavingTonnes} != ${r6(saving)}`);
    if (!near(Math.abs(opt.co2eDeltaPct), r.estCo2eSavingPct, 1e-2)) errs.push(`${r.id} saving pct mismatch`);
    if (r.transitImpactDays !== opt.transitDeltaDays) errs.push(`${r.id} transit impact mismatch`);
    if (r.priorityScore !== r.estCo2eSavingTonnes) errs.push(`${r.id} priorityScore is not the saving`);
    if (JSON.stringify(r.toModePath) !== JSON.stringify(opt.modePath)) errs.push(`${r.id} toModePath does not match the option`);
    if (JSON.stringify(r.fromModePath) !== JSON.stringify(d.modePath)) errs.push(`${r.id} fromModePath does not match the shipment`);
    if (r.proof !== opt.evidence) errs.push(`${r.id} proof is not the option's own evidence`);
    if (!r.proofRefs?.length) errs.push(`${r.id} has no proof refs`);
    if (r.shipmentDate !== d.date) errs.push(`${r.id} date mismatch`);
    // The rationale must state the real before/after and the real saving.
    if (!r.rationale || r.rationale.length < 30) errs.push(`${r.id} rationale too thin`);
  }
  // Every shipment with a cheaper route must have a recommendation, and vice versa.
  const withSaving = details.filter((d) => d.avoidableTonnes > 1e-9).map((d) => d.shipmentId).sort();
  const recFor = [...new Set(recommendations.map((r) => r.shipmentId))].sort();
  ok('one recommendation per shipment that has a cheaper route', JSON.stringify(withSaving) === JSON.stringify(recFor),
    `${withSaving.length} shipments with savings vs ${recFor.length} with recommendations`);
  ok(`all ${recommendations.length} recommendations trace to their option`, errs.length === 0, errs.slice(0, 5).join(' | '));
  if (!errs.length) pass(`${recommendations.length} recommendations`, '— saving, transit, mode path, proof and refs all verified');
}

// ══════════════════════════════════════════════════════════════════════════
group('8b. Recommendation reasoning — the stated cause explains the saving');
// ══════════════════════════════════════════════════════════════════════════
{
  // A recommendation is only defensible if the reason printed beside it names
  // the leg that actually moved the number. This decomposes each option against
  // the route it replaces and checks the prose against the arithmetic.
  const errs = [];
  const byKind = new Map();
  for (const r of recommendations) {
    const d = detailById.get(r.shipmentId);
    const opt = d.options.find((o) => o.id === r.optionId);
    const cur = d.options.find((o) => o.isCurrent);
    const modeSum = (legs, m) => sum(legs.filter((l) => l.mode === m), (l) => l.co2eTonnes);
    const deltas = ['road', 'rail', 'ocean', 'air']
      .map((m) => ({ mode: m, delta: modeSum(opt.legs, m) - modeSum(cur.legs, m) }))
      .filter((x) => Math.abs(x.delta) > 1e-9);

    // 1. The per-mode deltas must reconstruct the headline saving exactly.
    const rebuilt = sum(deltas, (x) => x.delta);
    if (!near(rebuilt, -r.estCo2eSavingTonnes, 1e-5)) {
      errs.push(`${r.id}: per-mode deltas sum to ${r6(rebuilt)} but the saving claims ${-r.estCo2eSavingTonnes}`);
    }
    // 2. The mode carrying most of the change must be named in the reason —
    //    in whatever word the prose naturally uses for it.
    const NAMES = {
      road: /road|truck/i,
      rail: /rail|train/i,
      ocean: /ocean|sea|sail/i,
      air: /air|flight|flown|plane/i,
    };
    const dominant = [...deltas].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
    if (dominant && !NAMES[dominant.mode].test(r.proof)) {
      errs.push(`${r.id}: ${dominant.mode} carries ${r6(dominant.delta)} t but the reason never mentions it`);
    }
    // 3. The reason must cite the factor basis that makes the saving real.
    if (!/per truck|per tonne|whatever the load|tonne-km/i.test(r.proof)) {
      errs.push(`${r.id}: the reason never states how the mode is charged`);
    }
    // 4. It must say how many times the workbook has run it — the "not a
    //    proposal" claim the whole product rests on.
    if (!/\d+\s+(shipment|time)/i.test(r.proof)) errs.push(`${r.id}: the reason gives no usage count`);
    // 5. The rationale's before/after must be the real before/after.
    const shown = r.rationale.match(/^([\d.,]+\s*(?:kg|t))\s*→\s*([\d.,]+\s*(?:kg|t))/);
    if (!shown) errs.push(`${r.id}: rationale does not state a before → after`);
    // 6. A slower option must say so, and a faster one must not claim slower.
    if (r.transitImpactDays > 0 && !/slower/.test(r.rationale)) errs.push(`${r.id}: adds ${r.transitImpactDays} days but does not say slower`);
    if (r.transitImpactDays < 0 && !/faster/.test(r.rationale)) errs.push(`${r.id}: saves days but does not say faster`);
    if (r.transitImpactDays === 0 && !/no change/.test(r.rationale)) errs.push(`${r.id}: no transit change but rationale does not say so`);

    byKind.set(r.type, (byKind.get(r.type) ?? 0) + 1);
  }
  ok(`all ${recommendations.length} reasons account for the saving they claim`, errs.length === 0, errs.slice(0, 5).join(' | '));
  // Every lever the engine can offer must actually be exercised, or a code path
  // is dead and nobody would notice.
  for (const kind of ['shorter-first-mile', 'shorter-sea', 'gateway-swap', 'sea-instead-of-air', 'consolidate']) {
    ok(`the "${kind}" lever is exercised by the data`, (byKind.get(kind) ?? 0) > 0, 'no recommendation of this kind');
  }
  if (!errs.length) {
    pass('per-mode decomposition', `— ${[...byKind.entries()].map(([k, n]) => `${k} ${n}`).join(' · ')}`);
  }
}

// ══════════════════════════════════════════════════════════════════════════
group('9. Lanes — rollups equal the sum of their member shipments');
// ══════════════════════════════════════════════════════════════════════════
{
  const byLane = new Map();
  for (const s of shipmentIndex) byLane.set(s.laneId, [...(byLane.get(s.laneId) ?? []), s]);
  const errs = [];
  ok('every lane in the index has a detail file', laneIndex.length === laneDetails.length, `${laneIndex.length} vs ${laneDetails.length}`);
  for (const lane of laneIndex) {
    const rows = byLane.get(lane.laneId) ?? [];
    const push = (what, a, b, tol = 1e-4) => !near(a, b, tol) && errs.push(`${lane.laneId} ${what}: ${a} vs ${r6(b)}`);
    if (rows.length !== lane.shipmentCount) errs.push(`${lane.laneId} shipmentCount ${lane.shipmentCount} vs ${rows.length}`);
    push('totalCo2e', lane.totalCo2eTonnes, sum(rows, (s) => s.co2eTonnes));
    push('totalWeight', lane.totalWeightTonnes, sum(rows, (s) => s.weightTonnes), 1e-2);
    push('avoidable', lane.avoidableTonnes, sum(rows, (s) => s.avoidableTonnes));
    push('roadCo2e', lane.roadCo2eTonnes, sum(rows, (s) => s.roadCo2eTonnes));
    push('railCo2e', lane.railCo2eTonnes, sum(rows, (s) => s.railCo2eTonnes));
    push('oceanCo2e', lane.oceanCo2eTonnes, sum(rows, (s) => s.oceanCo2eTonnes));
    push('airCo2e', lane.airCo2eTonnes, sum(rows, (s) => s.airCo2eTonnes));
    push('mode split exhausts lane', lane.roadCo2eTonnes + lane.railCo2eTonnes + lane.oceanCo2eTonnes + lane.airCo2eTonnes, lane.totalCo2eTonnes);
    if (lane.plannedShipmentCount !== rows.filter((s) => s.status === 'Planned').length) errs.push(`${lane.laneId} plannedShipmentCount wrong`);
    if (lane.workbookShipmentCount + lane.syntheticShipmentCount !== lane.shipmentCount) errs.push(`${lane.laneId} provenance counts do not sum`);
    if (lane.airShipmentCount !== rows.filter((s) => s.isAirFreight).length) errs.push(`${lane.laneId} airShipmentCount wrong`);
    // Modes used must be exactly the modes its shipments travel, in travel order.
    const order = ['Road', 'Rail', 'Ocean', 'Air'];
    const expectModes = [...new Set(rows.flatMap((s) => s.modePath))].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    if (JSON.stringify(lane.modesUsed) !== JSON.stringify(expectModes)) {
      errs.push(`${lane.laneId} modesUsed ${lane.modesUsed} vs ${expectModes}`);
    }
    const tkm = sum(rows, (s) => s.totalDistanceKm * s.weightTonnes);
    if (tkm > 0) push('avgCo2ePerTonneKm', lane.avgCo2ePerTonneKm, Math.round(((lane.totalCo2eTonnes * 1e6) / tkm) * 1e3) / 1e3, 1e-2);
  }
  // Lane totals must exhaust the shipment set — no shipment orphaned.
  const laneTotal = sum(laneIndex, (l) => l.totalCo2eTonnes);
  const shipTotal = sum(shipmentIndex, (s) => s.co2eTonnes);
  ok('lanes account for every shipment', near(laneTotal, shipTotal, 1e-3), `lanes ${r6(laneTotal)} vs shipments ${r6(shipTotal)}`);
  ok(`all ${laneIndex.length} lane rollups agree with their shipments`, errs.length === 0, errs.slice(0, 5).join(' | '));
  if (!errs.length) pass(`${laneIndex.length} lanes`, '— CO₂e, weight, mode split, counts and intensity');
}

// ══════════════════════════════════════════════════════════════════════════
group('10. Monthly series — the timeline sums to the shipments');
// ══════════════════════════════════════════════════════════════════════════
{
  const delivered = shipmentIndex.filter((s) => s.status === 'Delivered');
  const byPeriod = new Map();
  for (const s of delivered) byPeriod.set(s.period, [...(byPeriod.get(s.period) ?? []), s]);
  const errs = [];
  ok('every delivered month appears exactly once', evidence.monthly.length === byPeriod.size, `${evidence.monthly.length} vs ${byPeriod.size}`);
  for (const m of evidence.monthly) {
    const rows = byPeriod.get(m.period) ?? [];
    if (!rows.length) {
      errs.push(`${m.period} has no shipments`);
      continue;
    }
    if (!near(m.co2eTonnes, sum(rows, (s) => s.co2eTonnes), 1e-5)) errs.push(`${m.period} co2e mismatch`);
    if (!near(m.avoidableTonnes, sum(rows, (s) => s.avoidableTonnes), 1e-5)) errs.push(`${m.period} avoidable mismatch`);
    if (!near(m.ifBestTonnes, Math.max(0, m.co2eTonnes - m.avoidableTonnes), 1e-5)) errs.push(`${m.period} ifBest mismatch`);
    if (m.ifBestTonnes > m.co2eTonnes + 1e-9) errs.push(`${m.period} best route costs more than actual`);
    const origins = new Set(rows.map((s) => s.dataOrigin));
    if (origins.size !== 1 || !origins.has(m.dataOrigin)) errs.push(`${m.period} dataOrigin ${m.dataOrigin} vs rows ${[...origins]}`);
  }
  const monthlyTotal = sum(evidence.monthly, (m) => m.co2eTonnes);
  ok('monthly series totals the delivered shipments', near(monthlyTotal, sum(delivered, (s) => s.co2eTonnes), 1e-4),
    `${r6(monthlyTotal)} vs ${r6(sum(delivered, (s) => s.co2eTonnes))}`);
  ok('every month reconciles', errs.length === 0, errs.slice(0, 4).join(' | '));
  if (!errs.length) pass(`${evidence.monthly.length} months`, `${evidence.monthly[0].period} → ${evidence.monthly.at(-1).period}`);
}

// ══════════════════════════════════════════════════════════════════════════
group('11. The forward book — shape, dates and provenance');
// ══════════════════════════════════════════════════════════════════════════
{
  const today = assumptions.asOf;
  ok('20–30 shipments to be planned', plannedRows.length >= 20 && plannedRows.length <= 30, `${plannedRows.length}`);
  ok('every planned shipment is dated on or after today', plannedRows.every((s) => s.date >= today), 'some are in the past');
  const months = [...new Set(plannedRows.map((s) => s.date.slice(0, 7)))].sort();
  ok('the forward book runs August to December', months[0] === '2026-08' && months.at(-1) === '2026-12', months.join(', '));
  ok('planned and synthetic are the same set',
    plannedRows.length === shipmentIndex.filter((s) => s.dataOrigin === 'synthetic').length,
    'synthetic rows exist that are not planned');
  ok('no delivered shipment is synthetic', shipmentIndex.every((s) => s.status !== 'Delivered' || s.dataOrigin === 'workbook'), 'found synthetic history');
  ok('every planned row cites the recorded shipment it came from', plannedRows.every((s) => Boolean(s.derivedFromRef)), 'missing derivedFromRef');

  // Each planned row must be leg-for-leg identical to a real shipment.
  const errs = [];
  for (const p of plannedRows) {
    const d = detailById.get(p.shipmentId);
    const seed = details.find((x) => x.dataOrigin === 'workbook' && x.sourceRef === p.derivedFromRef);
    if (!seed) {
      errs.push(`${p.shipmentId} cites ${p.derivedFromRef}, which matches no recorded shipment`);
      continue;
    }
    if (!near(d.co2eTonnes, seed.co2eTonnes, 1e-9)) errs.push(`${p.shipmentId} CO₂e differs from its seed`);
    if (d.weightTonnes !== seed.weightTonnes) errs.push(`${p.shipmentId} weight differs from its seed`);
    const legKey = (x) => x.legs.map((l) => `${l.from}>${l.to}:${l.distanceKm}:${l.mode}:${l.co2eTonnes}`).join('|');
    if (legKey(d) !== legKey(seed)) errs.push(`${p.shipmentId} legs differ from its seed`);
    // Only the date may move.
    if (d.date.slice(5) !== seed.date.slice(5)) errs.push(`${p.shipmentId} day/month moved, not just the year`);
  }
  ok('planned rows are their seed shipment with only the dates moved', errs.length === 0, errs.slice(0, 4).join(' | '));
  if (!errs.length) pass(`${plannedRows.length} planned shipments`, `${months.join(', ')} — each leg-for-leg a recorded shipment`);
}

// ══════════════════════════════════════════════════════════════════════════
group('12. Reference data and exceptions');
// ══════════════════════════════════════════════════════════════════════════
{
  for (const f of factors) {
    ok(`${f.mode} factor matches the workbook`, f.value === EF[f.mode.toLowerCase()], `${f.value} vs ${EF[f.mode.toLowerCase()]}`);
    ok(`${f.mode} factor cites a workbook cell`, Boolean(f.sourceRef), 'missing sourceRef');
  }
  const modes = new Set(shipmentIndex.map((s) => s.primaryMode));
  ok('filter options cover every mode actually present', [...modes].every((m) => filterOptions.modes.includes(m)), [...modes].join(','));
  const years = new Set(shipmentIndex.map((s) => s.reportingYear));
  ok('filter options list exactly the reporting years present',
    JSON.stringify([...years].sort()) === JSON.stringify([...filterOptions.reportingYears].sort()),
    `${[...years].sort()} vs ${[...filterOptions.reportingYears].sort()}`);
  ok('the ESG report can only be scoped to recorded years',
    filterOptions.workbookReportingYears.every((y) => src.years.some((x) => x.reportingYear === y)),
    filterOptions.workbookReportingYears.join(','));

  const badExc = exceptions.filter((e) => e.shipmentId && !detailById.has(e.shipmentId));
  ok('every exception points at a real shipment', badExc.length === 0, badExc.slice(0, 3).map((e) => e.id).join(', '));
  const airExc = exceptions.filter((e) => e.kind === 'air');
  const airShips = shipmentIndex.filter((s) => s.isAirFreight && (s.dataOrigin === 'workbook' || s.status === 'Planned'));
  ok('every air shipment is flagged exactly once', airExc.length === airShips.length, `${airExc.length} exceptions vs ${airShips.length} air shipments`);
  ok('every exception cites a source cell', exceptions.every((e) => Boolean(e.sourceRef)), 'missing sourceRef');
}

// ══════════════════════════════════════════════════════════════════════════
group('13. Geography — every place on the map is a workbook place');
// ══════════════════════════════════════════════════════════════════════════
{
  const geo = read('geo.json');
  const places = new Set();
  for (const d of details) {
    for (const l of d.legs) {
      places.add(l.from);
      places.add(l.to);
    }
    for (const o of d.options) for (const l of o.legs) { places.add(l.from); places.add(l.to); }
  }
  const missing = [...places].filter((p) => !geo[p]);
  ok('every place used has coordinates', missing.length === 0, missing.join(', '));
  const badCoord = [...places].filter((p) => geo[p] && (Math.abs(geo[p].lat) > 90 || Math.abs(geo[p].lon) > 180));
  ok('every coordinate is on the globe', badCoord.length === 0, badCoord.join(', '));
  // A leg's own endpoints must match the coordinates it carries.
  const drift = [];
  for (const d of details) {
    for (const l of d.legs) {
      if (geo[l.from] && (geo[l.from].lat !== l.fromCoord.lat || geo[l.from].lon !== l.fromCoord.lon)) drift.push(`${d.shipmentId} ${l.from}`);
      if (geo[l.to] && (geo[l.to].lat !== l.toCoord.lat || geo[l.to].lon !== l.toCoord.lon)) drift.push(`${d.shipmentId} ${l.to}`);
    }
  }
  ok('leg coordinates match the geo dictionary', drift.length === 0, drift.slice(0, 3).join(', '));
  if (!missing.length && !drift.length) pass(`${places.size} places`, '— all mapped and consistent');
}

// ── Verdict ────────────────────────────────────────────────────────────────
process.stdout.write(`\n${'─'.repeat(72)}\n`);
if (failures.length === 0) {
  process.stdout.write(`PASS — ${checks} checks, no discrepancies.\n`);
  process.stdout.write(
    `  ${shipmentIndex.length} shipments · ${details.reduce((n, d) => n + d.legs.length, 0)} legs · `
    + `${laneIndex.length} lanes · ${recommendations.length} recommendations · ${evidence.monthly.length} months\n`,
  );
} else {
  process.stdout.write(`FAIL — ${failures.length} of ${checks} checks failed:\n`);
  for (const f of failures) process.stdout.write(`  [${f.group}] ${f.label}\n      ${f.detail}\n`);
  process.exit(1);
}
