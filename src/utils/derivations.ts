/**
 * Live derivations — how the number on screen was actually built, right now.
 *
 * The worked examples in `metricGuide.ts` teach the method with fixed figures.
 * These do the same job for whatever is currently in view: the same arithmetic,
 * but on the rows the user has filtered to, with the workbook cell behind each
 * contributing line. That is the difference between an application that claims
 * to be traceable and one that is — a reader can take any figure, open its
 * derivation, pick the largest contributor, and land on a spreadsheet cell.
 *
 * Deliberately small and generic: almost every figure in the product is a sum
 * over a scoped shipment set, so one builder covers most of it rather than
 * thirty bespoke ones that would drift out of step with the charts.
 */
import type { ReportingYearPoint, Shipment } from '@/types';
import { formatIntensity, formatNumber, formatTonnes } from './format';

export interface DerivationStep {
  label: string;
  /** The arithmetic, set in mono when present. */
  expression?: string;
  value?: string;
  /** Workbook cell ranges behind this line — clickable in the panel. */
  refs?: string[];
  /** Renders as a summed total rather than a contributing line. */
  isTotal?: boolean;
}

export interface Derivation {
  /** What is in scope for this figure, in words. */
  scope: string;
  steps: DerivationStep[];
  /** Closing note — a limit, or what the figure excludes. */
  note?: string;
}

const sum = (rows: Shipment[], f: (s: Shipment) => number) => rows.reduce((a, s) => a + f(s), 0);

/** "290 movements dispatched 1 Jul 2021 – 30 Jun 2024" — the scope line. */
function scopeOf(rows: Shipment[]): string {
  if (!rows.length) return 'Nothing is in scope with the current filters.';
  const dates = rows.map((r) => r.date).sort();
  const planned = rows.filter((r) => r.status === 'Planned').length;
  return (
    `${formatNumber(rows.length)} movement${rows.length === 1 ? '' : 's'} in scope, dispatched ${dates[0]} to ${dates.at(-1)}`
    + `${planned ? ` — of which ${planned} are still to be planned` : ''}.`
  );
}

/**
 * The generic case: a figure that is a sum across the shipments in view.
 *
 * Shows the largest contributors with their source cells, the tail as one line,
 * and the total — so the sum can be spot-checked without listing 290 rows.
 */
export function deriveSum({
  rows,
  valueOf,
  format = formatTonnes,
  totalLabel,
  topN = 5,
  note,
}: {
  rows: Shipment[];
  valueOf: (s: Shipment) => number;
  format?: (v: number) => string;
  totalLabel: string;
  topN?: number;
  note?: string;
}): Derivation {
  const contributing = rows.filter((r) => Math.abs(valueOf(r)) > 1e-9).sort((a, b) => valueOf(b) - valueOf(a));
  const top = contributing.slice(0, topN);
  const rest = contributing.slice(topN);
  const total = sum(rows, valueOf);

  const steps: DerivationStep[] = top.map((s) => ({
    label: `${s.shipmentId} · ${s.origin} → ${s.destPort} · ${s.date}`,
    value: format(valueOf(s)),
    refs: [s.sourceRef],
  }));
  if (rest.length) {
    steps.push({
      label: `+ ${formatNumber(rest.length)} further movement${rest.length === 1 ? '' : 's'}`,
      value: format(sum(rest, valueOf)),
    });
  }
  steps.push({ label: totalLabel, value: format(total), isTotal: true });
  return { scope: scopeOf(rows), steps, note };
}

/** Total CO₂e — the sum, plus how one shipment's own legs add up. */
export function deriveTotalCo2e(rows: Shipment[]): Derivation {
  const base = deriveSum({ rows, valueOf: (s) => s.co2eTonnes, totalLabel: 'CO₂e in scope' });
  const biggest = [...rows].sort((a, b) => b.co2eTonnes - a.co2eTonnes)[0];
  if (biggest) {
    base.steps.splice(0, 0, {
      label: `Each movement is itself the sum of its legs — ${biggest.shipmentId}, for instance`,
      expression:
        `road ${formatTonnes(biggest.roadCo2eTonnes)} + rail ${formatTonnes(biggest.railCo2eTonnes)}`
        + ` + ocean ${formatTonnes(biggest.oceanCo2eTonnes)} + air ${formatTonnes(biggest.airCo2eTonnes)}`
        + ` = ${formatTonnes(biggest.co2eTonnes)}`,
      refs: [biggest.sourceRef],
    });
  }
  base.note = 'Every leg is counted once and attributed to exactly one movement, so no kilometre is double-counted.';
  return base;
}

/** Intensity — the division, with both sides of it built out. */
export function deriveIntensity(rows: Shipment[]): Derivation {
  const co2e = sum(rows, (s) => s.co2eTonnes);
  const tkm = sum(rows, (s) => s.weightTonnes * s.totalDistanceKm);
  const worst = [...rows].sort((a, b) => b.co2ePerTonneKm - a.co2ePerTonneKm)[0];
  const steps: DerivationStep[] = [
    { label: 'CO₂e in scope', value: formatTonnes(co2e) },
    {
      label: 'Transport work done — each movement’s weight × its distance',
      value: `${formatNumber(tkm)} t·km`,
    },
    {
      label: 'Intensity',
      expression: `${formatTonnes(co2e)} × 1,000,000 ÷ ${formatNumber(tkm)} t·km = ${formatIntensity(tkm > 0 ? (co2e * 1e6) / tkm : 0)}`,
      isTotal: true,
    },
  ];
  if (worst) {
    steps.push({
      label: `Least efficient movement in scope: ${worst.shipmentId}`,
      expression: `${formatTonnes(worst.co2eTonnes)} × 1,000,000 ÷ (${worst.weightTonnes} t × ${formatNumber(worst.totalDistanceKm)} km) = ${formatIntensity(worst.co2ePerTonneKm)}`,
      refs: [worst.sourceRef],
    });
  }
  return {
    scope: scopeOf(rows),
    steps,
    note: 'A weighted average, not an average of averages — the tonne-kilometres are summed first, so a large movement counts for more than a small one.',
  };
}

/** Avoidable CO₂e — what each optimised route would have saved. */
export function deriveAvoidable(rows: Shipment[]): Derivation {
  const withSaving = rows.filter((r) => r.avoidableTonnes > 1e-9);
  const base = deriveSum({
    rows,
    valueOf: (s) => s.avoidableTonnes,
    totalLabel: 'Avoidable on optimised routes',
  });
  base.scope =
    `${formatNumber(withSaving.length)} of ${formatNumber(rows.length)} movements in scope have a cheaper routing the `
    + `workbook itself records. The rest are already on their optimised route.`;
  base.note =
    'Each line is one movement’s own saving: what it emitted, less what its optimised route would have emitted. Open a '
    + 'movement in the register to see both routings side by side.';
  return base;
}

/** Road-leg CO₂e — and why it is the addressable part. */
export function deriveRoadLegs(rows: Shipment[]): Derivation {
  const base = deriveSum({ rows, valueOf: (s) => s.roadCo2eTonnes, totalLabel: 'CO₂e from road legs' });
  const total = sum(rows, (s) => s.co2eTonnes);
  const road = sum(rows, (s) => s.roadCo2eTonnes);
  base.steps.push({
    label: 'Share of the footprint in scope',
    expression: `${formatTonnes(road)} ÷ ${formatTonnes(total)} = ${total > 0 ? ((road / total) * 100).toFixed(1) : '0'}%`,
  });
  base.note =
    'Road is charged per kilometre driven rather than per tonne carried, so these figures do not fall when a truck runs '
    + 'part-loaded — which is exactly why a shorter run or a shared truck converts straight into tonnes saved.';
  return base;
}

/** Freight moved — the weight behind the intensity denominator. */
export function deriveWeight(rows: Shipment[]): Derivation {
  return deriveSum({
    rows,
    valueOf: (s) => s.weightTonnes,
    format: (v) => `${formatNumber(v)} t`,
    totalLabel: 'Freight moved',
    note: 'Read this before concluding anything from a change in the total: emissions falling because less was shipped is not an efficiency gain.',
  });
}

/** The year bars — each year's total, and the change between them. */
export function deriveYears(years: ReportingYearPoint[]): Derivation {
  const closed = years.filter((y) => !y.isPartial && y.plannedShipments === 0);
  const steps: DerivationStep[] = years.map((y) => ({
    label:
      `${y.reportingYear} — ${formatNumber(y.shipments)} movements carrying ${formatNumber(y.weightTonnes)} t`
      + `${y.isPartial || y.plannedShipments > 0 ? ' (part year, not comparable)' : ''}`
      + `${y.dataOrigin === 'synthetic' ? ' (synthetic)' : ''}`,
    expression: `CO₂e ${formatTonnes(y.co2eTonnes)} · intensity ${formatIntensity(y.intensity)}`,
  }));
  if (closed.length >= 2) {
    const first = closed[0];
    const last = closed[closed.length - 1];
    steps.push({
      label: `Change from ${first.reportingYear} to ${last.reportingYear}`,
      expression:
        `(${formatTonnes(last.co2eTonnes)} − ${formatTonnes(first.co2eTonnes)}) ÷ ${formatTonnes(first.co2eTonnes)}`
        + ` = ${(((last.co2eTonnes - first.co2eTonnes) / first.co2eTonnes) * 100).toFixed(1)}%`,
      isTotal: true,
    });
    steps.push({
      label: 'Volume over the same period',
      expression:
        `(${formatNumber(last.weightTonnes)} t − ${formatNumber(first.weightTonnes)} t) ÷ ${formatNumber(first.weightTonnes)} t`
        + ` = ${(((last.weightTonnes - first.weightTonnes) / first.weightTonnes) * 100).toFixed(1)}%`,
    });
  }
  return {
    scope: `${years.length} reporting year${years.length === 1 ? '' : 's'} in scope, each a July-to-June window.`,
    steps,
    note: 'Part years are charted but excluded from the trend — a few weeks of freight is not comparable with twelve months of it.',
  };
}

/** A ranked slice — the groups, their shares, and what they sum to. */
export function deriveRanking(
  groups: { label: string; co2eTonnes: number; shipments: number }[],
  dimensionLabel: string,
): Derivation {
  const total = groups.reduce((s, g) => s + g.co2eTonnes, 0);
  const steps: DerivationStep[] = groups.slice(0, 6).map((g) => ({
    label: `${g.label} — ${formatNumber(g.shipments)} movement${g.shipments === 1 ? '' : 's'}`,
    expression: `${formatTonnes(g.co2eTonnes)} · ${total > 0 ? ((g.co2eTonnes / total) * 100).toFixed(1) : '0'}% of the slice`,
  }));
  if (groups.length > 6) {
    const rest = groups.slice(6);
    steps.push({
      label: `+ ${rest.length} further group${rest.length === 1 ? '' : 's'}`,
      value: formatTonnes(rest.reduce((s, g) => s + g.co2eTonnes, 0)),
    });
  }
  steps.push({ label: `Total across every ${dimensionLabel}`, value: formatTonnes(total), isTotal: true });
  return {
    scope: `Every movement in scope grouped by ${dimensionLabel}; the groups are the same emissions divided a different way.`,
    steps,
    note: 'Switching the dimension re-cuts the same total — it never changes it, which is the check that the grouping is sound.',
  };
}
