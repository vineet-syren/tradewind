/** Persona-tailored "focus" KPIs for the Command Center landing. */
import type { ExceptionItem, Footprint, KpiMetric, PersonaId, Recommendation } from '@/types';

interface FocusCtx {
  footprint: Footprint;
  recs: Recommendation[];
  exceptions: ExceptionItem[];
}

const tonnes = (n: number): string => (n >= 100 ? `${Math.round(n)} t` : `${n.toFixed(1)} t`);

export function buildFocusKpis(persona: PersonaId, ctx: FocusCtx): KpiMetric[] {
  const { footprint: f, recs } = ctx;
  const ocean = f.modeSplit.find((m) => m.mode === 'Ocean');
  const influenceable = recs
    .filter((r) => r.controllability.startsWith('Influence'))
    .reduce((s, r) => s + r.estCo2eSavingTonnes, 0);
  const partnerActions = recs.filter((r) => r.type === 'lsp-swap' || r.type === 'vendor-intervention').length;

  switch (persona) {
    case 'logistics':
      return [
        { id: 'top-lane', label: 'Top lane opportunity', value: f.topLanes[0]?.realizableReductionTonnes ?? 0, unit: 'tonnes', display: tonnes(f.topLanes[0]?.realizableReductionTonnes ?? 0) + '/yr', intent: 'opportunity', hint: f.topLanes[0]?.label ?? '—' },
        { id: 'air', label: 'Air exceptions', value: f.airExceptionCount, unit: 'number', intent: f.airExceptionCount ? 'negative' : 'positive', hint: `${f.airAvoidableCount} avoidable` },
        { id: 'ocean', label: 'Ocean-led share', value: ocean?.pct ?? 0, unit: 'percent', intent: 'positive', hint: 'of CO₂e' },
        { id: 'actions', label: 'Open lane actions', value: recs.length, unit: 'number', intent: 'neutral', hint: 'in the tracker' },
      ];
    case 'procurement':
      return [
        { id: 'infl', label: 'Influenceable saving', value: influenceable, unit: 'tonnes', display: tonnes(influenceable) + '/yr', intent: 'opportunity', hint: 'via vendors & LSPs' },
        { id: 'partner-actions', label: 'Partner actions', value: partnerActions, unit: 'number', intent: 'neutral', hint: 'LSP & vendor plays' },
        { id: 'opp', label: 'Reduction opportunity', value: f.reductionOpportunityTonnes, unit: 'tonnes', display: tonnes(f.reductionOpportunityTonnes) + '/yr', intent: 'opportunity', hint: `${f.reductionOpportunityPct}% realizable` },
        { id: 'co2e', label: 'Annual CO₂e', value: f.annualCo2eTonnes, unit: 'tonnes', intent: 'neutral', hint: 'downstream transport' },
      ];
    case 'analyst':
      return [
        { id: 'actions', label: 'Open actions', value: recs.length, unit: 'number', intent: 'neutral', hint: 'awaiting decision' },
        { id: 'opp', label: 'Realizable reduction', value: f.reductionOpportunityTonnes, unit: 'tonnes', display: tonnes(f.reductionOpportunityTonnes) + '/yr', intent: 'opportunity', hint: `${f.reductionOpportunityPct}% of footprint` },
        { id: 'realized', label: 'Realized reduction', value: f.realizedReductionPct, unit: 'percent', intent: 'positive', hint: 'vs baseline' },
        { id: 'lanes', label: 'Lanes in scope', value: f.laneCount, unit: 'number', intent: 'neutral', hint: 'decisioning corridors' },
      ];
    case 'cso':
    default:
      return [
        { id: 'co2e', label: 'Annual downstream CO₂e', value: f.annualCo2eTonnes, unit: 'tonnes', display: tonnes(f.annualCo2eTonnes) + '/yr', intent: 'neutral', hint: 'Scope 3 transport' },
        { id: 'realized', label: 'Realized reduction', value: f.realizedReductionPct, unit: 'percent', intent: 'positive', hint: 'vs baseline year' },
        { id: 'opp', label: 'Reduction opportunity', value: f.reductionOpportunityTonnes, unit: 'tonnes', display: tonnes(f.reductionOpportunityTonnes) + '/yr', intent: 'opportunity', hint: `${f.reductionOpportunityPct}% realizable` },
        { id: 'ambition', label: 'Ambition', value: f.ambitionPct, unit: 'percent', intent: 'neutral', hint: 'medium-term target' },
      ];
  }
}
