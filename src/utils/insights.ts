/**
 * Insight generators — grounded, deterministic narratives computed from the
 * exact data a chart is rendering. Written in plain English for a reader who
 * is not a logistics specialist: every name is annotated with what it is
 * (customer, destination port, carrier, vendor…), jargon is spelled out, and
 * the key figures are highlighted with **bold** markers (rendered by
 * ChartContainer). No LLM call — the numbers ARE the insight.
 */
import type {
  CustomerModeRow,
  FlowRow,
  HotspotRow,
  LspPartner,
  ModeSplitRow,
  MonthlyPoint,
  MonthModeRow,
  RegionModeRow,
  ScheduleWeek,
  VendorPartner,
  YearPoint,
} from '@/types';
import { formatIntensity, formatPercent, formatPeriod, formatTonnes } from './format';

const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);
const MODES = ['Ocean', 'Rail', 'Road', 'Air'] as const;

/** Mode-split donut: dominant transport mode, air anomaly, cleanest lever. */
export function insightsForModeSplit(rows: ModeSplitRow[]): string[] {
  if (!rows.length) return [];
  const sorted = [...rows].sort((a, b) => b.co2eTonnes - a.co2eTonnes);
  const top = sorted[0];
  const air = rows.find((r) => r.mode === 'Air');
  const out = [
    `Most of the footprint travels by ${top.mode.toLowerCase()} (${top.mode === 'Ocean' ? 'container ship' : top.mode === 'Air' ? 'plane' : top.mode === 'Rail' ? 'train' : 'truck'}): **${formatPercent(top.pct, 0)}** of all CO₂e — that is **${formatTonnes(top.co2eTonnes)}** across **${top.shipments} shipments**.`,
  ];
  if (air && air.co2eTonnes > 0) {
    const perShipment = air.co2eTonnes / Math.max(air.shipments, 1);
    const topPer = top.co2eTonnes / Math.max(top.shipments, 1);
    if (perShipment > topPer * 2) {
      out.push(
        `Air freight (plane) is the outlier: each air shipment emits about **${(perShipment / Math.max(topPer, 0.001)).toFixed(0)}× more** CO₂e than a typical ${top.mode.toLowerCase()} shipment. Reviewing the **${air.shipments} air shipments** one by one is the fastest way to cut emissions.`,
      );
    } else {
      out.push(`Air freight (plane) contributes **${formatTonnes(air.co2eTonnes)}** across **${air.shipments} shipments** — each one is worth checking against the "was flying really necessary?" policy.`);
    }
  }
  return out.slice(0, 3);
}

/** Year-over-year column+line: trajectory, peak year, efficiency decoupling. */
export function insightsForYearOverYear(data: YearPoint[]): string[] {
  if (data.length < 2) return [];
  const first = data[0];
  const last = data[data.length - 1];
  const co2Delta = pct(last.co2eTonnes - first.co2eTonnes, first.co2eTonnes);
  const intensityDelta = pct(last.intensity - first.intensity, first.intensity);
  const out = [
    `Total emissions went **${co2Delta >= 0 ? 'up' : 'down'} ${formatPercent(Math.abs(co2Delta), 1)}** between ${first.year} and ${last.year} — from **${formatTonnes(first.co2eTonnes)}** to **${formatTonnes(last.co2eTonnes)}** per year.`,
  ];
  if (intensityDelta < 0 && co2Delta > 0) {
    out.push(
      `Efficiency (CO₂e per tonne of goods moved) actually improved **${formatPercent(Math.abs(intensityDelta), 1)}** — total emissions rose only because shipping volume grew. The routing itself is getting cleaner.`,
    );
  } else if (intensityDelta < 0) {
    out.push(
      `Efficiency improved **${formatPercent(Math.abs(intensityDelta), 1)}** to **${formatIntensity(last.intensity)}** (grams of CO₂e per tonne of goods per kilometre) — greener route choices are genuinely working.`,
    );
  } else {
    out.push(
      `Efficiency worsened **${formatPercent(intensityDelta, 1)}** to **${formatIntensity(last.intensity)}** — shipments are drifting toward faster but dirtier transport (more road and air, less sea and rail).`,
    );
  }
  const worst = [...data].sort((a, b) => b.co2eTonnes - a.co2eTonnes)[0];
  if (worst.year !== last.year)
    out.push(`**${worst.year}** was the heaviest year (**${formatTonnes(worst.co2eTonnes)}**); the current run-rate is **${formatPercent(Math.abs(pct(last.co2eTonnes - worst.co2eTonnes, worst.co2eTonnes)), 1)} below** that peak.`);
  return out.slice(0, 3);
}

/** Month-over-month rows: latest swing + biggest month in the window. */
export function insightsForMonthOverMonth(rows: { label: string; value: number }[]): string[] {
  if (rows.length < 3) return [];
  const last = rows[rows.length - 1];
  const prev = rows[rows.length - 2];
  const momPct = prev.value > 0 ? pct(last.value - prev.value, prev.value) : 0;
  const peak = [...rows].sort((a, b) => b.value - a.value)[0];
  return [
    `The most recent month (**${last.label}**) came in at **${formatTonnes(last.value)}**, which is **${momPct >= 0 ? 'up' : 'down'} ${formatPercent(Math.abs(momPct), 1)}** versus the month before (${prev.label}).`,
    `The heaviest month in this window was **${peak.label}** at **${formatTonnes(peak.value)}** — month-to-month swings mostly follow the shipping calendar (harvest and order peaks), so compare against the same month last year before reading too much into one jump.`,
  ];
}

/** Stacked mode-trend area: seasonality + which mode is growing fastest. */
export function insightsForMonthlyByMode(data: MonthModeRow[]): string[] {
  if (data.length < 3) return [];
  const total = (r: MonthModeRow) => r.Ocean + r.Rail + r.Road + r.Air;
  const peak = [...data].sort((a, b) => total(b) - total(a))[0];
  const half = Math.floor(data.length / 2);
  const sumBy = (rows: MonthModeRow[], m: (typeof MODES)[number]) => rows.reduce((s, r) => s + r[m], 0);
  const growth = MODES.map((m) => {
    const a = sumBy(data.slice(0, half), m);
    const b = sumBy(data.slice(half), m);
    return { mode: m, delta: pct(b - a, Math.max(a, 0.001)) };
  }).sort((a, b) => b.delta - a.delta)[0];
  return [
    `**${formatPeriod(peak.period)}** was the busiest month for emissions (**${formatTonnes(total(peak))}**) — that is the shipping season where combining part-loads into fewer, fuller containers pays off most.`,
    `**${growth.mode}** is the fastest-growing transport mode (up **${formatPercent(Math.max(growth.delta, 0), 0)}** comparing the second half of this window to the first) — worth watching before that pattern becomes the default.`,
  ];
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
    `The darkest column is **${formatPeriod(peak.period)}** (**${formatTonnes(total(peak))}**), the lightest is **${formatPeriod(trough.period)}** (**${formatTonnes(total(trough))}**) — booking sea and rail capacity ahead of the peak month keeps freight off planes and trucks.`,
  ];
  if (airMonths.length) {
    const worstAir = [...airMonths].sort((a, b) => b.Air - a.Air)[0];
    out.push(
      `Air freight (plane) shows up in **${airMonths.length} of the last ${months.length} months**, worst in **${formatPeriod(worstAir.period)}** (**${formatTonnes(worstAir.Air)}**) — those are the cells to investigate first: was each flight really unavoidable?`,
    );
  } else {
    out.push('No air-freight cells in this window — the "avoid flying" policy is holding.');
  }
  return out;
}

/** Carrier share donut: concentration of the footprint across the carrier panel. */
export function insightsForCarrierShare(lsps: LspPartner[]): string[] {
  if (!lsps.length) return [];
  const sorted = [...lsps].sort((a, b) => b.co2eTonnes - a.co2eTonnes);
  const total = sorted.reduce((s, l) => s + l.co2eTonnes, 0);
  const top = sorted[0];
  const top3 = sorted.slice(0, 3).reduce((s, l) => s + l.co2eTonnes, 0);
  return [
    `**${top.name}** (${top.id} — a logistics service provider, i.e. the company that physically moves the freight) alone carries **${formatPercent(pct(top.co2eTonnes, total), 0)}** of all carrier CO₂e — one relationship moves a large share of the number.`,
    `The top 3 carriers together hold **${formatPercent(pct(top3, total), 0)}** of the footprint. Concentration cuts both ways: fewer conversations to have, but a bigger risk if one partner underperforms.`,
  ];
}

/** Ranked hotspot rows (treemap / bar list): concentration + intensity outlier. */
export function insightsForHotspots(rows: HotspotRow[], dimensionLabel: string): string[] {
  if (!rows.length) return [];
  const total = rows.reduce((s, r) => s + r.co2eTonnes, 0);
  const top = rows[0];
  const top3 = rows.slice(0, 3).reduce((s, r) => s + r.co2eTonnes, 0);
  const out = [
    `**${top.label}** (${dimensionLabel}) is the single biggest source at **${formatPercent(pct(top.co2eTonnes, total), 0)}** of the CO₂e shown — **${formatTonnes(top.co2eTonnes)}** in absolute terms.`,
    `The top 3 together account for **${formatPercent(pct(top3, total), 0)}** of emissions — focusing on just those three moves most of the total number.`,
  ];
  const intense = [...rows].sort((a, b) => b.co2ePerTonneKm - a.co2ePerTonneKm)[0];
  if (intense.key !== top.key) {
    out.push(
      `**${intense.label}** (${dimensionLabel}) is the least efficient per unit moved: **${formatIntensity(intense.co2ePerTonneKm)}** (grams of CO₂e per tonne of goods per kilometre) — small volume, but an outsized footprint for every tonne it ships.`,
    );
  }
  return out;
}

/** Customer × mode stacked/heatmap: who is most air-dependent. */
export function insightsForCustomerModes(rows: CustomerModeRow[]): string[] {
  if (!rows.length) return [];
  const airHeavy = [...rows].sort((a, b) => pct(b.Air, b.total) - pct(a.Air, a.total))[0];
  const oceanShare = pct(rows.reduce((s, r) => s + r.Ocean, 0), rows.reduce((s, r) => s + r.total, 0));
  const out = [
    `Across the top customers, **${formatPercent(oceanShare, 0)}** of CO₂e already moves by sea (the cleanest option per tonne) — that is the good baseline to protect.`,
  ];
  if (airHeavy && airHeavy.Air > 0) {
    out.push(
      `**${airHeavy.customer}** (customer) relies most on air freight: **${formatPercent(pct(airHeavy.Air, airHeavy.total), 0)}** of its CO₂e comes from flying. A conversation about slightly longer delivery times would cut that sharply.`,
    );
  }
  return out;
}

/** Region × mode matrix (mekko): where the footprint concentrates geographically. */
export function insightsForRegionModes(rows: RegionModeRow[]): string[] {
  if (!rows.length) return [];
  const total = rows.reduce((s, r) => s + r.total, 0);
  const top = rows[0];
  const airiest = [...rows].sort((a, b) => pct(b.Air, b.total) - pct(a.Air, a.total))[0];
  const out = [
    `**${top.region}** (destination region) receives **${formatPercent(pct(top.total, total), 0)}** of downstream CO₂e (**${formatTonnes(top.total)}**) — the widest column is the biggest prize.`,
  ];
  if (airiest.Air > 0)
    out.push(
      `**${airiest.region}** has the highest share of air freight (**${formatPercent(pct(airiest.Air, airiest.total), 0)}** of its CO₂e) — switching those shipments to sea or rail is the priority there.`,
    );
  return out;
}

/** Sankey flows: strongest origin→mode→region corridor. */
export function insightsForFlows(flows: FlowRow[]): string[] {
  if (!flows.length) return [];
  const modeSet = new Set<string>(MODES);
  const stage1 = flows.filter((f) => modeSet.has(f.to));
  const stage2 = flows.filter((f) => modeSet.has(f.from));
  const out: string[] = [];
  if (stage1.length) {
    const top = stage1[0];
    out.push(
      `The heaviest flow starts in **${top.from}** (origin city) and moves by **${top.to.toLowerCase()}**, carrying **${formatTonnes(top.value)}** of CO₂e — fixes at that corridor level move the most.`,
    );
  }
  if (stage2.length) {
    const top = stage2[0];
    out.push(`**${top.from}** feeding **${top.to}** (destination region) is the single biggest artery at **${formatTonnes(top.value)}** — follow that band across the diagram to see where it could thin out.`);
  }
  return out;
}

/** Evidence monthly trend / waterfall: avoided tonnage and trajectory. */
export function insightsForReductionTrend(monthly: MonthlyPoint[]): string[] {
  if (monthly.length < 2) return [];
  const avoided = monthly.reduce((s, m) => s + m.avoidedTonnes, 0);
  const last = monthly[monthly.length - 1];
  const first = monthly[0];
  const netDelta = pct(last.netTonnes - first.netTonnes, Math.max(first.netTonnes, 0.001));
  return [
    `**${formatTonnes(avoided)}** of CO₂e was avoided in total across this period — the gap between the "as-usual" line and the actual line is the reduction program's proof of work.`,
    `Actual emissions are **${netDelta >= 0 ? 'up' : 'down'} ${formatPercent(Math.abs(netDelta), 1)}** versus the start of the window (**${formatTonnes(first.netTonnes)}** → **${formatTonnes(last.netTonnes)}** per month).`,
    `Efficiency now sits at **${formatIntensity(last.intensity)}** (grams of CO₂e per tonne of goods per kilometre) — this is the figure to carry into the ESG disclosure.`,
  ];
}

/** Forward schedule (gantt/columns): busiest week + air exposure. */
export function insightsForSchedule(byWeek: ScheduleWeek[], airExposedCount?: number): string[] {
  if (!byWeek.length) return [];
  const total = (w: ScheduleWeek) => w.Ocean + w.Rail + w.Road + w.Air;
  const peak = [...byWeek].sort((a, b) => total(b) - total(a))[0];
  const out = [
    `The week of **${peak.label}** is the heaviest ahead: **${formatTonnes(total(peak))}** projected across **${peak.count} shipments** — review those routes first while every option is still open.`,
  ];
  const airTonnes = byWeek.reduce((s, w) => s + w.Air, 0);
  if (airTonnes > 0)
    out.push(
      `**${formatTonnes(airTonnes)}** of the coming window is booked as air freight (plane)${airExposedCount ? ` across **${airExposedCount} shipments**` : ''} — every one of them can still switch to a slower, far cleaner option.`,
    );
  return out;
}

/** Carrier benchmark bubbles: laggards vs green programs. */
export function insightsForLsps(lsps: LspPartner[]): string[] {
  if (!lsps.length) return [];
  const laggard = [...lsps].sort((a, b) => b.intensityIndex - a.intensityIndex)[0];
  const green = lsps.filter((l) => l.greenProgram);
  const saving = lsps.reduce((s, l) => s + l.influenceableSavingTonnes, 0);
  return [
    `**${laggard.name}** (${laggard.id} — a logistics service provider, the company that moves the freight) runs **${((laggard.intensityIndex - 1) * 100).toFixed(0)}% above** the fleet-average emissions intensity — the clearest outlier on this chart.`,
    `**${green.length} of ${lsps.length} carriers** run a certified green-fleet program (cleaner ships and trucks). Moving more volume to them is worth about **${formatTonnes(saving)} per year**.`,
  ];
}

/** Vendor governance bubbles: controllability vs footprint. */
export function insightsForVendors(vendors: VendorPartner[]): string[] {
  if (!vendors.length) return [];
  const high = vendors.filter((v) => v.controllability === 'High');
  const highSaving = high.reduce((s, v) => s + v.influenceableSavingTonnes, 0);
  const big = [...vendors].sort((a, b) => b.co2eTonnes - a.co2eTonnes)[0];
  return [
    `**${high.length} vendors** (the processors who prepare and hand over the goods at origin) are rated "High controllability" — Terova can directly change how they book freight, which is worth about **${formatTonnes(highSaving)} per year** with no contract renegotiation.`,
    `**${big.name}** (vendor) has the largest footprint at **${formatTonnes(big.co2eTonnes)}** — pair its controllability rating with clear routing guidance to capture the saving.`,
  ];
}
