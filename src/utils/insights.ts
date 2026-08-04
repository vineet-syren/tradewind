/**
 * Insight generators — grounded, deterministic narratives computed from the
 * exact data a chart is rendering. Written for a reader who is not a logistics
 * specialist: names are annotated with what they are, jargon is spelled out,
 * and the key figures are wrapped in **bold** markers (rendered by
 * ChartContainer). No LLM call — the numbers ARE the insight.
 */
import type {
  FlowRow,
  HotspotRow,
  ModeSplitRow,
  MonthlyPoint,
  MonthModeRow,
  RegionModeRow,
  ReportingYearPoint,
  Recommendation,
} from '@/types';
import { formatIntensity, formatPercent, formatPeriod, formatTonnes } from './format';

const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);
const MODES = ['Ocean', 'Rail', 'Road', 'Air'] as const;

const MODE_PLAIN: Record<string, string> = {
  Ocean: 'container ship',
  Rail: 'train',
  Road: 'truck',
  Air: 'plane',
};

/** Mode-split donut: dominant mode, and how far out of line air is. */
export function insightsForModeSplit(rows: ModeSplitRow[]): string[] {
  if (!rows.length) return [];
  const sorted = [...rows].sort((a, b) => b.co2eTonnes - a.co2eTonnes);
  const top = sorted[0];
  const air = rows.find((r) => r.mode === 'Air');
  const out = [
    `Most of the footprint travels by ${top.mode.toLowerCase()} (${MODE_PLAIN[top.mode]}): **${formatPercent(top.pct, 0)}** of all CO₂e, or **${formatTonnes(top.co2eTonnes)}** across **${top.shipments} shipments**.`,
  ];
  if (air && air.co2eTonnes > 0) {
    const perAir = air.co2eTonnes / Math.max(air.shipments, 1);
    const perTop = top.co2eTonnes / Math.max(top.shipments, 1);
    out.push(
      `Air freight is the outlier: **${air.shipments} shipment${air.shipments === 1 ? '' : 's'}** produced **${formatTonnes(air.co2eTonnes)}**, about **${(perAir / Math.max(perTop, 0.001)).toFixed(0)}× the CO₂e** of a typical ${top.mode.toLowerCase()} shipment. The workbook charges air at 188× the sea factor per tonne carried.`,
    );
  }
  const road = rows.find((r) => r.mode === 'Road');
  if (road && road.co2eTonnes > 0) {
    out.push(
      `Road-led shipments carry **${formatPercent(road.pct, 0)}** of the CO₂e. Road is the one mode charged per truck run rather than per tonne, so a part load costs the same as a full one — which is exactly why the gateway choice matters.`,
    );
  }
  return out.slice(0, 3);
}

/** Reporting-year bars: trajectory, and whether routing or volume drove it. */
export function insightsForReportingYears(data: ReportingYearPoint[]): string[] {
  if (data.length < 2) return [];
  const first = data[0];
  const last = data[data.length - 1];
  const co2Delta = pct(last.co2eTonnes - first.co2eTonnes, first.co2eTonnes);
  const weightDelta = pct(last.weightTonnes - first.weightTonnes, first.weightTonnes);
  const intensityDelta = pct(last.intensity - first.intensity, first.intensity);
  const out = [
    `Total emissions went **${co2Delta >= 0 ? 'up' : 'down'} ${formatPercent(Math.abs(co2Delta), 1)}** from ${first.reportingYear} to ${last.reportingYear} — **${formatTonnes(first.co2eTonnes)}** to **${formatTonnes(last.co2eTonnes)}**.`,
  ];
  if (Math.abs(weightDelta) > 5) {
    out.push(
      `Freight volume moved **${weightDelta >= 0 ? 'up' : 'down'} ${formatPercent(Math.abs(weightDelta), 0)}** over the same period, so read the total alongside efficiency: **${formatIntensity(last.intensity)}** (grams of CO₂e per tonne of goods per kilometre) against **${formatIntensity(first.intensity)}** at the start.`,
    );
  } else {
    out.push(
      `Efficiency ${intensityDelta < 0 ? 'improved' : 'worsened'} **${formatPercent(Math.abs(intensityDelta), 1)}** to **${formatIntensity(last.intensity)}** (grams of CO₂e per tonne of goods per kilometre).`,
    );
  }
  const worst = [...data].sort((a, b) => b.co2eTonnes - a.co2eTonnes)[0];
  if (worst.reportingYear !== last.reportingYear) {
    out.push(
      `**${worst.reportingYear}** was the heaviest year at **${formatTonnes(worst.co2eTonnes)}**; the latest year runs **${formatPercent(Math.abs(pct(last.co2eTonnes - worst.co2eTonnes, worst.co2eTonnes)), 1)} below** that peak.`,
    );
  }
  return out.slice(0, 3);
}

/** Stacked mode-trend area: seasonality + which mode is growing. */
export function insightsForMonthlyByMode(data: MonthModeRow[]): string[] {
  if (data.length < 3) return [];
  const total = (r: MonthModeRow) => r.Ocean + r.Rail + r.Road + r.Air;
  const peak = [...data].sort((a, b) => total(b) - total(a))[0];
  const half = Math.floor(data.length / 2);
  const sumBy = (rows: MonthModeRow[], m: (typeof MODES)[number]) => rows.reduce((s, r) => s + r[m], 0);
  const growth = MODES.map((m) => {
    const a = sumBy(data.slice(0, half), m);
    const b = sumBy(data.slice(half), m);
    return { mode: m, delta: pct(b - a, Math.max(a, 0.001)), latest: b };
  })
    .filter((g) => g.latest > 0)
    .sort((a, b) => b.delta - a.delta)[0];
  const out = [
    `**${formatPeriod(peak.period)}** was the heaviest month at **${formatTonnes(total(peak))}** — that is the peak where combining part loads into fewer, fuller truck runs pays off most.`,
  ];
  if (growth && growth.delta > 5) {
    out.push(
      `**${growth.mode}** is growing fastest, up **${formatPercent(growth.delta, 0)}** comparing the back half of this window with the front — worth watching before it becomes the default.`,
    );
  }
  return out;
}

/** Seasonality heat map (mode × month grid): peak/trough cells + air months. */
export function insightsForSeasonality(data: MonthModeRow[]): string[] {
  const months = data.slice(-12);
  if (months.length < 3) return [];
  const total = (r: MonthModeRow) => r.Ocean + r.Rail + r.Road + r.Air;
  const peak = [...months].sort((a, b) => total(b) - total(a))[0];
  const trough = [...months].sort((a, b) => total(a) - total(b))[0];
  const airMonths = months.filter((m) => m.Air > 0);
  const out = [
    `The darkest column is **${formatPeriod(peak.period)}** (**${formatTonnes(total(peak))}**) and the lightest is **${formatPeriod(trough.period)}** (**${formatTonnes(total(trough))}**) — booking rail and sea capacity ahead of the peak keeps freight off trucks and planes.`,
  ];
  if (airMonths.length) {
    const worstAir = [...airMonths].sort((a, b) => b.Air - a.Air)[0];
    out.push(
      `Air freight appears in **${airMonths.length} of the last ${months.length} months**, worst in **${formatPeriod(worstAir.period)}** (**${formatTonnes(worstAir.Air)}**) — those are the cells to question first.`,
    );
  } else {
    out.push('No air freight anywhere in this window — everything moved by sea, rail or road.');
  }
  return out;
}

/** Ranked hotspot rows (treemap / bar list): concentration + intensity outlier. */
export function insightsForHotspots(rows: HotspotRow[], dimensionLabel: string): string[] {
  if (!rows.length) return [];
  const total = rows.reduce((s, r) => s + r.co2eTonnes, 0);
  const top = rows[0];
  const top3 = rows.slice(0, 3).reduce((s, r) => s + r.co2eTonnes, 0);
  const out = [
    `**${top.label}** (${dimensionLabel}) is the single biggest source: **${formatPercent(pct(top.co2eTonnes, total), 0)}** of the CO₂e shown, or **${formatTonnes(top.co2eTonnes)}**.`,
    `The top three together carry **${formatPercent(pct(top3, total), 0)}** — acting on just those moves most of the total.`,
  ];
  const intense = [...rows].sort((a, b) => b.co2ePerTonneKm - a.co2ePerTonneKm)[0];
  if (intense.key !== top.key) {
    out.push(
      `**${intense.label}** is the least efficient for what it moves at **${formatIntensity(intense.co2ePerTonneKm)}** (grams of CO₂e per tonne of goods per kilometre) — small volume, outsized footprint per tonne.`,
    );
  }
  const recoverable = rows.reduce((s, r) => s + r.avoidableTonnes, 0);
  if (recoverable > 0.01) {
    const best = [...rows].sort((a, b) => b.avoidableTonnes - a.avoidableTonnes)[0];
    out.push(
      `**${formatTonnes(recoverable)}** of what is shown could have gone a route the workbook already records, most of it on **${best.label}** (**${formatTonnes(best.avoidableTonnes)}**).`,
    );
  }
  return out.slice(0, 4);
}

/** Region × mode matrix: where the footprint concentrates geographically. */
export function insightsForRegionModes(rows: RegionModeRow[]): string[] {
  if (!rows.length) return [];
  const total = rows.reduce((s, r) => s + r.total, 0);
  const top = rows[0];
  const out = [
    `**${top.region}** (destination region) receives **${formatPercent(pct(top.total, total), 0)}** of downstream CO₂e (**${formatTonnes(top.total)}**) — the widest band is the biggest prize.`,
  ];
  const airiest = [...rows].sort((a, b) => pct(b.Air, b.total) - pct(a.Air, a.total))[0];
  if (airiest.Air > 0) {
    out.push(
      `**${airiest.region}** has the highest air share at **${formatPercent(pct(airiest.Air, airiest.total), 0)}** of its CO₂e — the workbook records sea routings to the same countries.`,
    );
  }
  return out;
}

/** Sankey flows: strongest gateway→mode→region corridor. */
export function insightsForFlows(flows: FlowRow[]): string[] {
  if (!flows.length) return [];
  const modeSet = new Set<string>(MODES);
  const stage1 = flows.filter((f) => modeSet.has(f.to));
  const stage2 = flows.filter((f) => modeSet.has(f.from));
  const out: string[] = [];
  if (stage1.length) {
    const top = stage1[0];
    out.push(
      `The heaviest flow leaves through **${top.from}** (gateway port) by **${top.to.toLowerCase()}**, carrying **${formatTonnes(top.value)}** of CO₂e — changing the gateway changes this whole band.`,
    );
  }
  if (stage2.length) {
    const top = stage2[0];
    out.push(
      `**${top.from}** feeding **${top.to}** (destination region) is the single biggest artery at **${formatTonnes(top.value)}**.`,
    );
  }
  return out;
}

/** Monthly reported footprint: trend + the figure to disclose. */
export function insightsForMonthlyTrend(monthly: MonthlyPoint[]): string[] {
  if (monthly.length < 2) return [];
  const last = monthly[monthly.length - 1];
  const first = monthly[0];
  const delta = pct(last.co2eTonnes - first.co2eTonnes, Math.max(first.co2eTonnes, 0.001));
  const peak = [...monthly].sort((a, b) => b.co2eTonnes - a.co2eTonnes)[0];
  return [
    `Monthly CO₂e is **${delta >= 0 ? 'up' : 'down'} ${formatPercent(Math.abs(delta), 1)}** across the window — **${formatTonnes(first.co2eTonnes)}** in ${formatPeriod(first.period)} to **${formatTonnes(last.co2eTonnes)}** in ${formatPeriod(last.period)}.`,
    `**${formatPeriod(peak.period)}** was the single heaviest month at **${formatTonnes(peak.co2eTonnes)}**.`,
    `Efficiency in the latest month is **${formatIntensity(last.intensity)}** (grams of CO₂e per tonne of goods per kilometre) — this is the figure that belongs in the disclosure, because it holds when volume moves.`,
  ];
}

/** Open decision queue: what is at stake and where it is concentrated. */
export function insightsForDecisions(recs: Recommendation[]): string[] {
  if (!recs.length) return ['Nothing in the forward book has a lower-carbon option left that the workbook can evidence.'];
  const saving = recs.reduce((s, r) => s + r.estCo2eSavingTonnes, 0);
  const top = [...recs].sort((a, b) => b.estCo2eSavingTonnes - a.estCo2eSavingTonnes)[0];
  const byType = new Map<string, number>();
  for (const r of recs) byType.set(r.type, (byType.get(r.type) ?? 0) + r.estCo2eSavingTonnes);
  const biggestType = [...byType.entries()].sort((a, b) => b[1] - a[1])[0];
  const out = [
    `**${recs.length} shipment${recs.length === 1 ? '' : 's'}** still to be planned have a lower-carbon option the workbook has already used, together worth **${formatTonnes(saving)}**.`,
    `The largest single decision is **${top.laneLabel}** on ${top.shipmentDate}, worth **${formatTonnes(top.estCo2eSavingTonnes)}** — ${formatPercent(top.estCo2eSavingPct, 0)} of that shipment's footprint.`,
  ];
  if (biggestType) {
    out.push(
      `Most of the value sits in one kind of change: **${biggestType[0].replace(/-/g, ' ')}**, worth **${formatTonnes(biggestType[1])}** of the total.`,
    );
  }
  const slower = recs.filter((r) => r.transitImpactDays > 0);
  if (slower.length) {
    out.push(
      `**${slower.length} of ${recs.length}** would add transit time (up to **${Math.max(...slower.map((r) => r.transitImpactDays))} days**, estimated) — the rest cost nothing in time.`,
    );
  }
  return out.slice(0, 4);
}
