/** Persona-tailored headline KPIs. */
import type { ExceptionItem, Footprint, KpiMetric, PersonaId, Recommendation } from '@/types';

interface FocusCtx {
  footprint: Footprint;
  /** Decisions still open — i.e. on freight that has not shipped yet. */
  openRecs: Recommendation[];
  exceptions: ExceptionItem[];
}

const tonnes = (n: number): string => (n >= 100 ? `${Math.round(n)} t` : `${n.toFixed(2)} t`);

export function buildFocusKpis(persona: PersonaId, ctx: FocusCtx): KpiMetric[] {
  const { footprint: f, openRecs, exceptions } = ctx;
  const atStake = openRecs.reduce((s, r) => s + r.estCo2eSavingTonnes, 0);
  const biggest = [...openRecs].sort((a, b) => b.estCo2eSavingTonnes - a.estCo2eSavingTonnes)[0];

  if (persona === 'logistics') {
    return [
      {
        id: 'decisions',
        label: 'Decisions to make',
        value: openRecs.length,
        unit: 'number',
        intent: openRecs.length ? 'opportunity' : 'positive',
        hint: openRecs.length ? 'on freight not yet shipped' : 'nothing outstanding',
        icon: 'decisioning',
      },
      {
        id: 'at-stake',
        label: 'CO₂e at stake',
        value: atStake,
        unit: 'tonnes',
        display: tonnes(atStake),
        intent: 'opportunity',
        hint: 'if every suggestion is taken',
        icon: 'co2e',
      },
      {
        id: 'biggest',
        label: 'Biggest single win',
        value: biggest?.estCo2eSavingTonnes ?? 0,
        unit: 'tonnes',
        display: tonnes(biggest?.estCo2eSavingTonnes ?? 0),
        intent: 'opportunity',
        hint: biggest ? `${biggest.laneLabel} · ${biggest.shipmentDate}` : '—',
        icon: 'lanes',
      },
      {
        id: 'road',
        label: 'Road share of CO₂e',
        value: f.totalCo2eTonnes > 0 ? Math.round((f.roadCo2eTonnes / f.totalCo2eTonnes) * 100) : 0,
        unit: 'percent',
        intent: 'neutral',
        hint: 'charged per truck run, not per tonne',
        icon: 'carrier',
      },
    ];
  }

  // CSO and analyst share the reporting lens.
  const dataIssues = exceptions.filter((e) => e.kind === 'data-quality').length;
  return [
    {
      id: 'latest',
      label: `CO₂e · ${f.latestReportingYear}`,
      value: f.latestYearCo2eTonnes,
      unit: 'tonnes',
      display: tonnes(f.latestYearCo2eTonnes),
      intent: 'neutral',
      hint: 'latest complete reporting year',
      deltaPct: f.yoyChangePct ?? undefined,
      deltaLabel: 'vs prior year',
      betterWhenLower: true,
      icon: 'co2e',
    },
    {
      id: 'avoidable',
      label: 'Avoidable on optimised routes',
      value: f.avoidableTonnes,
      unit: 'tonnes',
      display: tonnes(f.avoidableTonnes),
      intent: 'opportunity',
      hint: `${f.avoidablePct}% of the footprint in scope`,
      icon: 'decisioning',
    },
    {
      id: 'air',
      label: 'Air freight CO₂e',
      value: f.airCo2eTonnes,
      unit: 'tonnes',
      display: tonnes(f.airCo2eTonnes),
      intent: f.airShipmentCount ? 'negative' : 'positive',
      hint: `${f.airShipmentCount} shipment${f.airShipmentCount === 1 ? '' : 's'} flown`,
      icon: 'air',
    },
    {
      id: 'quality',
      label: 'Data issues to fix',
      value: dataIssues,
      unit: 'number',
      intent: dataIssues ? 'risk' : 'positive',
      hint: dataIssues ? 'duplicated or conflicting rows' : 'workbook is internally consistent',
      icon: 'evidence',
    },
  ];
}
