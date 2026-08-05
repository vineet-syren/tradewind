/**
 * Insight generators — grounded, deterministic narratives computed from the
 * exact data a chart is rendering. Written for a reader who is not a logistics
 * specialist: names are annotated with what they are, jargon is spelled out,
 * and the key figures are wrapped in **bold** markers (rendered by
 * ChartContainer). No LLM call — the numbers ARE the insight.
 */
import type {
  EmissionFactorRow,
  ExceptionItem,
  FlowRow,
  HotspotRow,
  Lane,
  ModeSplitRow,
  MonthlyPoint,
  MonthModeRow,
  RegionModeRow,
  ReportingYearFootprint,
  ReportingYearPoint,
  Recommendation,
  Shipment,
} from '@/types';
import { formatIntensity, formatNumber, formatPercent, formatPeriod, formatTonnes, formatWeightTonnes } from './format';

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
    // Compare per tonne carried, not per shipment. A flown shipment weighs a
    // fraction of a container, so "3× a typical ocean shipment" makes air sound
    // marginally worse than sea when per tonne it is nearly two hundred times
    // worse — the comparison has to hold weight constant to mean anything.
    out.push(
      `Air freight is the outlier: **${air.shipments} shipment${air.shipments === 1 ? '' : 's'}** produced **${formatTonnes(air.co2eTonnes)}**, **${formatPercent(air.pct, 1)}** of the total. Judge it per tonne carried rather than per shipment — a flown consignment weighs a fraction of a container, so the shipment count flatters it. The workbook charges air at **1.58 kg CO₂e per tonne-kilometre against 0.0084 at sea, 188× more**, which is what makes even a few hundred kilograms in the air visible against thousands of tonnes at sea.`,
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
export function insightsForReportingYears(all: ReportingYearPoint[]): string[] {
  // A part year is a few weeks of freight next to twelve months of it. Comparing
  // one is meaningless, so the trend is read across closed years only and the
  // part year is called out separately.
  const data = all.filter((y) => !y.isPartial && y.plannedShipments === 0);
  const partial = all.filter((y) => y.isPartial || y.plannedShipments > 0);
  if (data.length < 2) {
    return data.length + partial.length > 0
      ? [
          `Only **${data.length} complete reporting year${data.length === 1 ? '' : 's'}** is in scope, so there is no year-on-year trend to read yet.${partial.length ? ` **${partial.map((p) => p.reportingYear).join(', ')}** ${partial.length === 1 ? 'is' : 'are'} still open and shown dashed.` : ''}`,
        ]
      : [];
  }
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
      `**${worst.reportingYear}** was the heaviest year at **${formatTonnes(worst.co2eTonnes)}**; the latest closed year runs **${formatPercent(Math.abs(pct(last.co2eTonnes - worst.co2eTonnes, worst.co2eTonnes)), 1)} below** that peak.`,
    );
  }
  const synthetic = data.filter((y) => y.dataOrigin === 'synthetic');
  if (synthetic.length) {
    out.push(
      `**${synthetic.map((y) => y.reportingYear).join(' and ')}** ${synthetic.length === 1 ? 'is' : 'are'} synthetic, drawn in amber — recorded shipments mirrored forward to bridge the workbook (which ends June 2024) to today. They are here so the timeline is continuous; the reported footprint and the ESG report use the recorded years only.`,
    );
  }
  if (partial.length) {
    out.push(
      `**${partial.map((p) => p.reportingYear).join(', ')}** ${partial.length === 1 ? 'is' : 'are'} shown dashed because ${partial.length === 1 ? 'it has' : 'they have'} not reached the June year-end yet. Those bars are part-year totals — do not read them against a closed year.`,
    );
  }
  return out.slice(0, 5);
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

/**
 * The month-by-month timeline: what the shape of it means, how volatile it is,
 * and where the recorded data stops and the synthetic bridge begins.
 */
export function insightsForMonthlyTimeline(monthly: MonthlyPoint[]): string[] {
  if (monthly.length < 3) return [];
  const real = monthly.filter((m) => m.dataOrigin === 'workbook');
  const synthetic = monthly.filter((m) => m.dataOrigin === 'synthetic');
  const totalCo2e = monthly.reduce((s, m) => s + m.co2eTonnes, 0);
  const avg = totalCo2e / monthly.length;
  const peak = [...monthly].sort((a, b) => b.co2eTonnes - a.co2eTonnes)[0];
  const trough = [...monthly].sort((a, b) => a.co2eTonnes - b.co2eTonnes)[0];

  const out = [
    `Each bar is one month of CO₂e; the line above is how much that month moved against the one before it, read on the right-hand axis. Across **${monthly.length} months** the average month is **${formatTonnes(avg)}**.`,
    `The heaviest month is **${formatPeriod(peak.period)}** at **${formatTonnes(peak.co2eTonnes)}** — **${(peak.co2eTonnes / Math.max(avg, 0.001)).toFixed(1)}× an average month** — and the lightest is **${formatPeriod(trough.period)}** at **${formatTonnes(trough.co2eTonnes)}**. A swing that wide is normal for spice export: shipments are lumpy, and one 25-tonne container landing inside a month moves the whole bar.`,
  ];

  // Volatility, stated as the typical month-on-month move rather than a σ.
  const swings: number[] = [];
  for (let i = 1; i < monthly.length; i += 1) {
    const prev = monthly[i - 1].co2eTonnes;
    if (prev > 0) swings.push(Math.abs(pct(monthly[i].co2eTonnes - prev, prev)));
  }
  if (swings.length) {
    const median = [...swings].sort((a, b) => a - b)[Math.floor(swings.length / 2)];
    out.push(
      `A typical month moves about **${formatPercent(median, 0)}** up or down from the last one, so month-to-month changes on their own say very little. The year totals and the intensity figure are the ones to read for direction.`,
    );
  }

  if (real.length && synthetic.length) {
    const realTotal = real.reduce((s, m) => s + m.co2eTonnes, 0);
    out.push(
      `The first **${real.length} months** (to **${formatPeriod(real[real.length - 1].period)}**, **${formatTonnes(realTotal)}**) are read from the workbook. The **${synthetic.length} months** after it are synthetic — recorded shipments mirrored forward so the timeline reaches today — and are drawn in amber. Nothing in the reported footprint or the ESG report uses them.`,
    );
  }
  return out;
}

/** Destination × mode bars: how each market's freight actually travels. */
export function insightsForDestModes(
  rows: { name: string; Ocean: number; Rail: number; Road: number; Air: number }[],
): string[] {
  if (!rows.length) return [];
  const totalOf = (r: (typeof rows)[number]) => r.Ocean + r.Rail + r.Road + r.Air;
  const grand = rows.reduce((s, r) => s + totalOf(r), 0);
  const top = [...rows].sort((a, b) => totalOf(b) - totalOf(a))[0];
  const out = [
    `Each bar is one destination port, split by the mode that carried the CO₂e. **${top.name}** is the largest at **${formatTonnes(totalOf(top))}**, **${formatPercent(pct(totalOf(top), grand), 0)}** of everything shown.`,
  ];
  const roadHeavy = [...rows]
    .filter((r) => totalOf(r) > 0)
    .sort((a, b) => pct(b.Road, totalOf(b)) - pct(a.Road, totalOf(a)))[0];
  if (roadHeavy && roadHeavy.Road > 0) {
    out.push(
      `**${roadHeavy.name}** leans hardest on road at **${formatPercent(pct(roadHeavy.Road, totalOf(roadHeavy)), 0)}** of its CO₂e. Road is charged per truck run rather than per tonne carried, so that share is the part a different gateway or a shared truck can actually move.`,
    );
  }
  const flown = rows.filter((r) => r.Air > 0);
  if (flown.length) {
    out.push(
      `**${flown.map((r) => r.name).join(', ')}** received freight by air. Air is charged at 188× the sea factor for every tonne carried, so even a few hundred kilograms shows up as a full-height band here.`,
    );
  } else {
    out.push('No destination in this scope received freight by air — everything moved by sea, rail or road.');
  }
  return out;
}

/** Lane-priority bubble chart: how to read it and which lanes it points at. */
export function insightsForLanePriority(lanes: Lane[]): string[] {
  if (!lanes.length) return [];
  const withSaving = lanes.filter((l) => l.avoidableTonnes > 0.0005);
  const biggest = [...lanes].sort((a, b) => b.avoidableTonnes - a.avoidableTonnes)[0];
  const heaviest = [...lanes].sort((a, b) => b.totalWeightTonnes - a.totalWeightTonnes)[0];
  const leastEfficient = [...lanes].sort((a, b) => b.avgCo2ePerTonneKm - a.avgCo2ePerTonneKm)[0];

  const out = [
    `Every bubble is one lane. Left to right is how much freight it moved; bottom to top is how much CO₂e each tonne costs per kilometre; the size of the bubble is what could be saved by re-routing it. The ones worth a conversation sit high (inefficient) and to the right (a lot of freight), or are simply large.`,
    `**${heaviest.origin} → ${heaviest.destPort}** carries the most freight at **${formatWeightTonnes(heaviest.totalWeightTonnes)}** across **${heaviest.shipmentCount} shipments**, but at **${formatIntensity(heaviest.avgCo2ePerTonneKm)}** it is one of the efficient ones — volume alone is not a problem.`,
    `**${leastEfficient.origin} → ${leastEfficient.destPort}** (${leastEfficient.category}) is the least efficient at **${formatIntensity(leastEfficient.avgCo2ePerTonneKm)}**, roughly **${(leastEfficient.avgCo2ePerTonneKm / Math.max(heaviest.avgCo2ePerTonneKm, 0.001)).toFixed(0)}× the cost per tonne-kilometre** of the heaviest lane. Small, light shipments on dedicated trucks and anything flown land up here.`,
  ];
  if (biggest.avoidableTonnes > 0.0005) {
    out.push(
      `The biggest bubble is **${biggest.origin} → ${biggest.destPort}** with **${formatTonnes(biggest.avoidableTonnes)}** recoverable on **${biggest.bestOptionLabel ?? 'a routing the workbook already runs'}**. In total **${withSaving.length} of ${lanes.length} lanes** have a cheaper routing available, worth **${formatTonnes(lanes.reduce((s, l) => s + l.avoidableTonnes, 0))}**.`,
    );
  }
  out.push(
    'The axes default to a log scale because the lanes are wildly different sizes — one moves over a thousand tonnes and a dozen move under ten. On a straight linear scale almost every bubble collapses into the bottom-left corner. Switch to Linear for true proportional spacing.',
  );
  return out;
}

/** The full lane table: concentration, the tail, and where the saving sits. */
export function insightsForLaneTable(lanes: Lane[]): string[] {
  if (!lanes.length) return [];
  const sorted = [...lanes].sort((a, b) => b.totalCo2eTonnes - a.totalCo2eTonnes);
  const grand = sorted.reduce((s, l) => s + l.totalCo2eTonnes, 0);
  const top3 = sorted.slice(0, 3).reduce((s, l) => s + l.totalCo2eTonnes, 0);
  const tail = sorted.filter((l) => l.totalCo2eTonnes < grand * 0.02);
  const multiGateway = lanes.filter((l) => l.gateways.length > 1);
  const planned = lanes.reduce((s, l) => s + l.plannedShipmentCount, 0);

  const out = [
    `**${lanes.length} lanes** carry **${formatTonnes(grand)}**, and the top three alone carry **${formatPercent(pct(top3, grand), 0)}** of it: **${sorted.slice(0, 3).map((l) => `${l.destPort} (${formatTonnes(l.totalCo2eTonnes)})`).join(', ')}**. A lane here is one destination port carrying one product category.`,
  ];
  if (tail.length) {
    out.push(
      `**${tail.length} lanes** are under 2% of the total each and together add up to **${formatTonnes(tail.reduce((s, l) => s + l.totalCo2eTonnes, 0))}**. They are not where the tonnes are, but several are the least efficient per tonne moved — worth checking whether they need a dedicated shipment at all.`,
    );
  }
  if (multiGateway.length) {
    out.push(
      `**${multiGateway.length} lane${multiGateway.length === 1 ? '' : 's'}** have shipped through more than one gateway — ${multiGateway.slice(0, 3).map((l) => `${l.destPort} via ${l.gateways.join(' and ')}`).join('; ')}. Those are the lanes where a gateway swap is not a proposal but a choice the business has already made both ways.`,
    );
  }
  if (planned > 0) {
    out.push(
      `**${planned} shipment${planned === 1 ? '' : 's'}** across these lanes are still to be planned, carrying **${formatTonnes(lanes.reduce((s, l) => s + l.plannedAvoidableTonnes, 0))}** of the recoverable total. Those are the ones where a decision can still change the outcome.`,
    );
  }
  return out;
}

/** The shipment register: what is in it, and what stands out row by row. */
export function insightsForRegister(rows: Shipment[]): string[] {
  if (!rows.length) return [];
  const co2e = rows.reduce((s, r) => s + r.co2eTonnes, 0);
  const weight = rows.reduce((s, r) => s + r.weightTonnes, 0);
  const planned = rows.filter((r) => r.status === 'Planned');
  const synthetic = rows.filter((r) => r.dataOrigin === 'synthetic');
  const heaviest = [...rows].sort((a, b) => b.co2eTonnes - a.co2eTonnes)[0];
  const air = rows.filter((r) => r.isAirFreight);
  const withOption = rows.filter((r) => r.avoidableTonnes > 0.0005);

  const out = [
    `**${formatNumber(rows.length)} movements** in view carrying **${formatNumber(weight)} t** of product for **${formatTonnes(co2e)}** of CO₂e — an average of **${formatTonnes(co2e / rows.length)}** per movement.`,
    `The single heaviest is **${heaviest.shipmentId}** (${heaviest.origin} → ${heaviest.destPort}, ${heaviest.date}) at **${formatTonnes(heaviest.co2eTonnes)}**, **${formatPercent(pct(heaviest.co2eTonnes, co2e), 1)}** of everything shown.`,
  ];
  if (withOption.length) {
    out.push(
      `**${withOption.length} of ${rows.length}** have a lower-carbon routing the workbook itself has run, worth **${formatTonnes(rows.reduce((s, r) => s + r.avoidableTonnes, 0))}** in total. Click any row to see its optimised route beside the one it was booked on.`,
    );
  }
  if (air.length) {
    out.push(
      `**${air.length} movement${air.length === 1 ? '' : 's'}** flew, carrying just **${formatWeightTonnes(air.reduce((s, r) => s + r.weightTonnes, 0))}** but producing **${formatTonnes(air.reduce((s, r) => s + r.co2eTonnes, 0))}** — **${formatPercent(pct(air.reduce((s, r) => s + r.co2eTonnes, 0), co2e), 1)}** of the CO₂e from **${formatPercent(pct(air.length, rows.length), 1)}** of the movements.`,
    );
  }
  if (planned.length) {
    out.push(
      `**${planned.length}** are still to be planned, carrying **${formatTonnes(planned.reduce((s, r) => s + r.avoidableTonnes, 0))}** of recoverable CO₂e. Those are the only rows where a decision still changes anything — everything else has already shipped.`,
    );
  }
  if (synthetic.length) {
    out.push(
      `The to-be-planned rows are the only ones here that are not read from the workbook — it is a closed record that ends in June 2024, so a forward book has to be added for there to be anything left to decide. Each one is a real recorded shipment with its dates moved, and carries the cell range it came from.`,
    );
  }
  return out;
}

/** The reconciliation bridge: whether the numbers tie, and where they don't. */
export function insightsForReconciliation(years: ReportingYearFootprint[]): string[] {
  if (!years.length) return [];
  const exact = years.filter((y) => y.reconciliationNote === null);
  const bridged = years.filter((y) => y.reconciliationNote !== null);
  const reported = years.reduce((s, y) => s + y.reportedCo2eTonnes, 0);
  const ours = years.reduce((s, y) => s + y.allLegsCo2eTonnes, 0);

  const out = [
    `This is the audit trail: for each reporting year it starts from the total the workbook itself prints in cell D53 of that tab, lists every adjustment, and ends at the figure this application reports. Across **${years.length} years** that is **${formatTonnes(reported)}** printed against **${formatTonnes(ours)}** reported.`,
  ];
  if (exact.length) {
    out.push(
      `**${exact.map((y) => y.reportingYear).join(', ')}** tie${exact.length === 1 ? 's' : ''} exactly — the workbook's own total and ours are the same figure to the last kilogram, with no adjustment at all.`,
    );
  }
  if (bridged.length) {
    out.push(
      `**${bridged.map((y) => y.reportingYear).join(' and ')}** need a bridge, and the reason is the same on both: the tab marks its export road block "handled by external SP" and leaves it out of the printed total. Those truck runs still happened and still emitted, so they are counted here — and where the collection block lists the same run a second time, it is removed so nothing is double-counted.`,
    );
  }
  out.push(
    `The difference is a **scope** difference, not a calculation one. No emission factor, distance or weight has been altered anywhere: every line above is a number read out of the sheet, and the bridge is checked at build time — if it ever stopped adding up, the build would fail rather than publish a figure that could not be traced.`,
  );
  return out;
}

/** One reporting year's four splits: where the year's carbon actually sat. */
export function insightsForYearDetail(years: ReportingYearFootprint[]): string[] {
  if (!years.length) return [];
  const y = years.length === 1 ? years[0] : null;
  if (!y) {
    const total = years.reduce((s, x) => s + x.allLegsCo2eTonnes, 0);
    return [
      `All **${years.length} recorded years** together: **${formatTonnes(total)}** across **${years.reduce((s, x) => s + x.shipments, 0)} movements**. Pick a single reporting year above to read one year's splits on their own.`,
      `Each year is split four ways — product category, destination port, gateway port and transport mode — and the four always add back to the same year total, because they are the same movements counted a different way rather than four separate measurements.`,
    ];
  }
  const topCat = y.byCategory[0];
  const topPort = y.byDestPort[0];
  const topGw = y.byGateway[0];
  const out = [
    `In **${y.reportingYear}** the biggest product category was **${topCat.label}** at **${formatTonnes(topCat.co2eTonnes)}** (**${formatPercent(topCat.pct, 0)}** of the year), and the biggest destination was **${topPort.label}** at **${formatTonnes(topPort.co2eTonnes)}** (**${formatPercent(topPort.pct, 0)}**).`,
    `**${topGw.label}** carried **${formatPercent(topGw.pct, 0)}** of the year out of India. Gateway concentration matters more than it looks: the gateway decides the inland run, and inland road is charged per truck rather than per tonne.`,
  ];
  const modeRoad = y.byMode.find((m) => m.label === 'Road');
  if (modeRoad) {
    out.push(
      `**${formatPercent(modeRoad.pct, 0)}** of the year's CO₂e came from shipments where road was the dominant leg — **${formatTonnes(modeRoad.co2eTonnes)}** across **${modeRoad.shipments} movements**. Those are the ones where a shorter first mile or a shared truck changes the number.`,
    );
  }
  if (y.airShipments > 0) {
    out.push(
      `**${y.airShipments} shipment${y.airShipments === 1 ? '' : 's'}** flew in ${y.reportingYear}. The flights themselves produced **${formatTonnes(y.airCo2eTonnes)}**, and those shipments cost **${formatTonnes(y.flownShipmentCo2eTonnes)}** door to door once the truck run to the airport is counted — **${formatPercent(pct(y.flownShipmentCo2eTonnes, y.allLegsCo2eTonnes), 1)}** of the year from a handful of movements.`,
    );
  }
  out.push(
    `**${formatTonnes(y.avoidableTonnes)}** of the year (**${formatPercent(pct(y.avoidableTonnes, y.allLegsCo2eTonnes), 1)}**) could have gone a routing the workbook itself records. That is hindsight, not a target — but it sizes what the same decisions are worth going forward.`,
  );
  return out;
}

/** The bridge waterfall: read left to right, what each step is. */
export function insightsForBridge(year: ReportingYearFootprint): string[] {
  const adjustments = year.reconciliation.slice(1, -1);
  const out = [
    `Read left to right: the first bar is the total the workbook prints for ${year.reportingYear} in cell D53 of tab ${year.tab} (**${formatTonnes(year.reportedCo2eTonnes)}**), and the last is what this application reports (**${formatTonnes(year.allLegsCo2eTonnes)}**). Everything between is an adjustment, each one a number read out of the same sheet.`,
  ];
  if (!adjustments.length) {
    out.push(
      `${year.reportingYear} needs no adjustment at all — the two bars are the same figure, so this year ties to the workbook exactly with nothing in between.`,
    );
    return out;
  }
  for (const a of adjustments) {
    out.push(
      `**${a.label}: ${a.co2eTonnes > 0 ? '+' : ''}${formatTonnes(a.co2eTonnes)}.** ${a.note}`,
    );
  }
  out.push(
    `The net effect is **${formatTonnes(year.allLegsCo2eTonnes - year.reportedCo2eTonnes)}** more than the printed total. It is a difference in what is counted, not in how it is calculated — no factor, distance or weight has been changed anywhere.`,
  );
  return out;
}

/** Emission factors: what the numbers mean and why the basis matters most. */
export function insightsForFactors(factors: EmissionFactorRow[]): string[] {
  if (!factors.length) return [];
  const road = factors.find((f) => f.mode === 'Road');
  const ocean = factors.find((f) => f.mode === 'Ocean');
  const air = factors.find((f) => f.mode === 'Air');
  const rail = factors.find((f) => f.mode === 'Rail');

  const out = [
    'These four numbers turn kilometres into carbon, and they are the workbook\'s own — nothing here is a published industry default. Every CO₂e figure anywhere in the application is a distance multiplied by one of these.',
  ];
  if (road && ocean) {
    out.push(
      `The important column is **Charged**, not the factor. Road is the only mode billed **per truck run**: a truck driving 100 km emits **${(road.value * 100).toFixed(1)} kg** whether it carries 400 kg or 25 tonnes. Every other mode is billed **per tonne carried**, so a light load genuinely costs less. That single difference is why a part-loaded truck to a distant port can cost more carbon than the entire ocean voyage that follows it.`,
    );
  }
  if (air && ocean) {
    out.push(
      `Air is **${Math.round(air.value / ocean.value)}× the sea factor** for every tonne-kilometre — **${air.value} against ${ocean.value} kg CO₂e**. One tonne flown the distance of a sea route costs what nearly two hundred tonnes would cost by ship, which is why a handful of air shipments dominate any month they appear in.`,
    );
  }
  if (rail && road) {
    out.push(
      `Rail at **${rail.value} kg per tonne-kilometre** is the cheapest inland option in the book. Moving 25 tonnes 700 km by rail costs about **${((rail.value * 25 * 700) / 1000).toFixed(2)} t**; the same 700 km by truck costs **${((road.value * 700) / 1000).toFixed(2)} t** regardless of what is on board.`,
    );
  }
  return out;
}

/** Data-quality findings: what is wrong in the source and what it is worth. */
export function insightsForDataIssues(issues: ExceptionItem[]): string[] {
  if (!issues.length) return ['No contradictions were found while rebuilding the shipments from the workbook.'];
  const affected = issues.reduce((s, e) => s + e.co2eTonnes, 0);
  return [
    `**${issues.length} row${issues.length === 1 ? '' : 's'}** in the source workbook contradict something else in the same workbook, together touching **${formatTonnes(affected)}** of CO₂e. These are not calculation errors in the application — they are places the sheet disagrees with itself, surfaced rather than quietly resolved.`,
    `The pattern that matters most is the factory-to-depot run being recorded at **645 km on the FY21-22 tab and 21 km on the tabs either side of it**. Hyderabad is where the factory is, so 645 km cannot be right, and at the road factor that one distance is worth about **0.37 t of CO₂e per shipment**. Fixing it in the source is the single highest-value correction available.`,
    'Each finding carries the exact cell range it came from, so it can be checked and corrected in the workbook directly. Nothing here has been auto-corrected: the application reports what the sheet says and shows you where the sheet is inconsistent.',
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
