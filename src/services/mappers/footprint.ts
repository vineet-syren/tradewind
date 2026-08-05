/**
 * Build the downstream-transportation footprint for a scoped shipment set.
 * This is the equivalent of a server-side aggregate endpoint — all maths run
 * here, never in the components.
 */
import type {
  Footprint,
  Lane,
  ModeLabel,
  ModeSplitRow,
  NamedShare,
  ReportingYearPoint,
  Shipment,
} from '@/types';
import { APP_TODAY } from '@/constants/app';

const round = (n: number, dp = 1) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};
const total = (rows: Shipment[], f: (s: Shipment) => number) => rows.reduce((a, s) => a + f(s), 0);

const MODES: ModeLabel[] = ['Ocean', 'Rail', 'Road', 'Air'];

/**
 * Has a reporting year run its course? "FY26-27" is the Jul 2026 → Jun 2027
 * window, so it is closed once 30 Jun 2027 is in the past.
 */
function isYearClosed(reportingYear: string): boolean {
  const m = /^FY(\d{2})-(\d{2})$/.exec(reportingYear.trim());
  if (!m) return true; // an unrecognised label is not something to caveat
  return `20${m[2]}-06-30` <= APP_TODAY;
}

/**
 * g CO₂e per tonne-km — the GLEC intensity unit.
 *
 * Kept to three decimals, not one. `formatIntensity` renders values under 10
 * with two decimals, so rounding here to one produced falsely precise output:
 * a true 9.25 became 9.3 and then displayed as "9.30". Rounding is the
 * formatter's job; the mapper's job is not to lose the figure first.
 */
const gPerTonneKm = (co2eT: number, tonneKm: number) => round((co2eT * 1e6) / Math.max(tonneKm, 0.001), 3);

function shares(rows: Shipment[], key: (s: Shipment) => string, grand: number): NamedShare[] {
  const agg = new Map<string, number>();
  for (const s of rows) agg.set(key(s), (agg.get(key(s)) ?? 0) + s.co2eTonnes);
  return [...agg.entries()]
    .map(([label, co2e]) => ({
      label,
      co2eTonnes: round(co2e, 2),
      pct: round((co2e / Math.max(grand, 0.001)) * 100, 1),
    }))
    .sort((a, b) => b.co2eTonnes - a.co2eTonnes);
}

export function buildFootprint(shipments: Shipment[], lanes: Lane[]): Footprint {
  const totalCo2eTonnes = total(shipments, (s) => s.co2eTonnes);
  const totalWeightTonnes = total(shipments, (s) => s.weightTonnes);
  const totalTonneKm = total(shipments, (s) => s.weightTonnes * s.totalDistanceKm);

  // Mode split by the leg mode that dominates each shipment's CO₂e.
  const modeAgg = new Map<ModeLabel, { co2e: number; ships: number }>();
  for (const s of shipments) {
    const g = modeAgg.get(s.primaryMode) ?? { co2e: 0, ships: 0 };
    g.co2e += s.co2eTonnes;
    g.ships += 1;
    modeAgg.set(s.primaryMode, g);
  }
  const modeSplit: ModeSplitRow[] = MODES.filter((m) => modeAgg.has(m)).map((m) => {
    const g = modeAgg.get(m)!;
    return {
      mode: m,
      co2eTonnes: round(g.co2e, 2),
      pct: round((g.co2e / Math.max(totalCo2eTonnes, 0.001)) * 100, 1),
      shipments: g.ships,
    };
  });

  // By reporting year — the workbook's own Jul→Jun windows, in year order.
  const yearAgg = new Map<
    string,
    { co2e: number; weight: number; tonneKm: number; n: number; planned: number; synthetic: number }
  >();
  for (const s of shipments) {
    const g = yearAgg.get(s.reportingYear) ?? { co2e: 0, weight: 0, tonneKm: 0, n: 0, planned: 0, synthetic: 0 };
    g.co2e += s.co2eTonnes;
    g.weight += s.weightTonnes;
    g.tonneKm += s.weightTonnes * s.totalDistanceKm;
    g.n += 1;
    if (s.status === 'Planned') g.planned += 1;
    if (s.dataOrigin === 'synthetic') g.synthetic += 1;
    yearAgg.set(s.reportingYear, g);
  }
  const byReportingYear: ReportingYearPoint[] = [...yearAgg.entries()]
    .map(([reportingYear, g]) => ({
      reportingYear,
      co2eTonnes: round(g.co2e, 2),
      weightTonnes: round(g.weight, 1),
      intensity: gPerTonneKm(g.co2e, g.tonneKm),
      shipments: g.n,
      dataOrigin: (g.synthetic > 0 ? 'synthetic' : 'workbook') as ReportingYearPoint['dataOrigin'],
      plannedShipments: g.planned,
      isPartial: !isYearClosed(reportingYear),
    }))
    .sort((a, b) => a.reportingYear.localeCompare(b.reportingYear));

  // "Latest year" means the last *complete* reporting year in scope, so the
  // headline is comparable rather than a part-year sum.
  //
  // Two things make a year incomplete, and both have to be tested. It can still
  // hold undispatched shipments, or — the case that is easy to miss — the
  // calendar simply has not reached its June year-end yet, which is true of the
  // year in progress even when the scope excludes the forward book entirely. A
  // part-year totalling a fortnight of freight would otherwise be charted and
  // compared as though it were a full twelve months.
  const complete = byReportingYear.filter((y) => y.plannedShipments === 0 && !y.isPartial);
  const latest = complete.at(-1);
  const previous = complete.at(-2);

  const byDest = shares(shipments, (s) => s.destPort, totalCo2eTonnes);
  const top3DestSharePct = round(byDest.slice(0, 3).reduce((a, d) => a + d.pct, 0), 0);

  const laneIds = new Set(shipments.map((s) => s.laneId));
  const scopedLanes = lanes.filter((l) => laneIds.has(l.laneId));

  const planned = shipments.filter((s) => s.status === 'Planned');
  const avoidableTonnes = total(shipments, (s) => s.avoidableTonnes);
  const airRows = shipments.filter((s) => s.isAirFreight);

  return {
    totalCo2eTonnes: round(totalCo2eTonnes, 2),
    latestYearCo2eTonnes: latest?.co2eTonnes ?? round(totalCo2eTonnes, 2),
    latestReportingYear: latest?.reportingYear ?? '—',
    totalWeightTonnes: round(totalWeightTonnes, 1),
    avgIntensity: gPerTonneKm(totalCo2eTonnes, totalTonneKm),
    shipmentCount: shipments.length,
    laneCount: scopedLanes.length,
    modeSplit,
    byRegion: shares(shipments, (s) => s.region, totalCo2eTonnes),
    byCategory: shares(shipments, (s) => s.category, totalCo2eTonnes),
    byGateway: shares(shipments, (s) => s.gateway ?? 'No gateway (air / collection)', totalCo2eTonnes),
    byReportingYear,
    avoidableTonnes: round(avoidableTonnes, 2),
    avoidablePct: round((avoidableTonnes / Math.max(totalCo2eTonnes, 0.001)) * 100, 1),
    plannedAvoidableTonnes: round(total(planned, (s) => s.avoidableTonnes), 2),
    plannedShipmentCount: planned.length,
    yoyChangePct:
      latest && previous && previous.co2eTonnes > 0
        ? round(((latest.co2eTonnes - previous.co2eTonnes) / previous.co2eTonnes) * 100, 1)
        : null,
    airShipmentCount: airRows.length,
    airCo2eTonnes: round(total(airRows, (s) => s.co2eTonnes), 2),
    roadCo2eTonnes: round(total(shipments, (s) => s.roadCo2eTonnes), 2),
    topLanes: [...scopedLanes].sort((a, b) => b.avoidableTonnes - a.avoidableTonnes).slice(0, 6),
    top3DestSharePct,
  };
}
