/**
 * Prompt-to-action copilot. Grounds a natural-language answer in the scoped
 * footprint and renders the right view + executable actions. Pure keyword
 * routing (no LLM) — deterministic and offline.
 */
import type {
  CopilotAction,
  CopilotResult,
  EsgEvidence,
  ExceptionItem,
  Footprint,
  Hotspots,
  Lane,
  Recommendation,
} from '@/types';
import { formatTonnes, formatPercent } from '@/utils/format';

export interface CopilotContext {
  footprint: Footprint;
  lanes: Lane[];
  recommendations: Recommendation[];
  hotspots: Hotspots;
  exceptions: ExceptionItem[];
  evidence: EsgEvidence;
  personaName: string;
}

const actionFromRec = (r: Recommendation): CopilotAction => ({
  id: `ca-${r.id}`,
  label: `Suggestion: ${r.title}`,
  type: r.type,
  laneId: r.laneId,
  shipmentId: r.shipmentId,
  recommendationId: r.id,
  ownerPersona: r.ownerPersona,
  savingTonnes: r.estCo2eSavingTonnes,
});

export function composeCopilotReply(prompt: string, ctx: CopilotContext): CopilotResult {
  const q = prompt.toLowerCase();
  const { footprint: f, lanes, recommendations: recs, hotspots, evidence } = ctx;
  // Whole-word matching — "fair"/"dairy" must NOT trigger the 'air' branch.
  // Word-boundary matching so "fair" never triggers 'air' — with an optional
  // plural/possessive tail so "partners", "carriers", "lanes" still match.
  const has = (...words: string[]) =>
    words.some((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:s|es|'s)?\\b`, 'i').test(q));

  // ── Air exceptions ─────────────────────────────────────────────────────
  if (has('air', 'avoidable', 'exception')) {
    const airRecs = recs.filter((r) => r.type === 'air-avoidance');
    const avoidable = airRecs.filter((r) => r.airAvoidable);
    const saving = airRecs.reduce((s, r) => s + r.estCo2eSavingTonnes, 0);
    return {
      headline: `${f.airExceptionCount} air shipments — ${f.airAvoidableCount} look avoidable`,
      answer: `Air carries the highest CO₂e per tonne-km. ${f.airAvoidableCount} of ${f.airExceptionCount} air shipments could shift to ocean with earlier planning, avoiding about ${formatTonnes(saving)}/yr. Justified ones should be governed against an air budget.`,
      insights: [
        { label: 'Air CO₂e', value: formatTonnes(f.airCo2eTonnes), intent: 'risk' },
        { label: 'Avoidable', value: `${avoidable.length} lanes`, intent: 'opportunity' },
        { label: 'Saving if shifted', value: `${formatTonnes(saving)}/yr`, intent: 'positive' },
      ],
      view: { kind: 'recommendations', title: 'Air-avoidance actions', recommendations: airRecs.slice(0, 6) },
      actions: airRecs.slice(0, 3).map(actionFromRec),
      followups: ['Which lanes have the highest reduction potential?', 'Show me the ocean alternatives'],
    };
  }

  // ── Progress / ambition / baseline ─────────────────────────────────────
  if (has('progress', 'ambition', 'baseline', 'realized', 'target', '15%', '10-20')) {
    return {
      headline: `Realized ${formatPercent(f.realizedReductionPct)} of the ${f.ambitionPct}% ambition`,
      answer: `Against the ${evidence.baselineYear} baseline, downstream-transport intensity is down ${formatPercent(evidence.realizedReductionPct)}. There is ${formatTonnes(f.reductionOpportunityTonnes)}/yr of realizable reduction identified (${formatPercent(f.reductionOpportunityPct)} of the annual footprint) — enough headroom to reach the ${f.ambitionPct}% medium-term ambition if the top lane actions are adopted.`,
      insights: [
        { label: 'Realized', value: formatPercent(f.realizedReductionPct), intent: 'positive' },
        { label: 'Opportunity', value: `${formatTonnes(f.reductionOpportunityTonnes)}/yr`, intent: 'opportunity' },
        { label: 'Ambition', value: `${f.ambitionPct}%`, intent: 'neutral' },
      ],
      view: {
        kind: 'kpis',
        title: 'Reduction progress',
        kpis: [
          { id: 'base', label: `Baseline ${evidence.baselineYear}`, value: evidence.baseline.netTonnes, unit: 'tonnes', intent: 'neutral' },
          { id: 'latest', label: `Latest ${evidence.latestYear}`, value: evidence.latest.netTonnes, unit: 'tonnes', intent: 'neutral' },
          { id: 'realized', label: 'Realized reduction', value: f.realizedReductionPct, unit: 'percent', intent: 'positive' },
          { id: 'ambition', label: 'Ambition', value: f.ambitionPct, unit: 'percent', intent: 'opportunity' },
        ],
      },
      actions: [],
      followups: ['What are the top reduction actions?', 'Show me the ESG evidence pack'],
    };
  }

  // ── Partners (LSP / vendor) ────────────────────────────────────────────
  if (has('lsp', 'carrier', 'partner', 'vendor', 'processor', 'fleet')) {
    const partnerRecs = recs.filter((r) => r.type === 'lsp-swap' || r.type === 'vendor-intervention');
    const saving = partnerRecs.reduce((s, r) => s + r.estCo2eSavingTonnes, 0);
    return {
      headline: `${formatTonnes(saving)}/yr is influenceable via partners`,
      answer: `Terova outsources execution, so part of the reduction sits with vendors, processors and LSPs. ${partnerRecs.length} partner plays — greener-fleet LSP swaps and vendor governance on port/mode choice — total about ${formatTonnes(saving)}/yr of influenceable saving.`,
      insights: [
        { label: 'Partner actions', value: `${partnerRecs.length}`, intent: 'neutral' },
        { label: 'Influenceable', value: `${formatTonnes(saving)}/yr`, intent: 'opportunity' },
      ],
      view: { kind: 'recommendations', title: 'Partner influence actions', recommendations: partnerRecs.slice(0, 6) },
      actions: partnerRecs.slice(0, 3).map(actionFromRec),
      followups: ['Which LSP is above fleet-average intensity?', 'Show me vendor hotspots'],
    };
  }

  // ── Hotspots / biggest / customers ─────────────────────────────────────
  if (has('hotspot', 'biggest', 'highest emit', 'where', 'concentration', 'customer', 'prioritize', 'priority')) {
    const dim = has('customer', 'prioritize', 'priority') ? hotspots.byCustomer : hotspots.byProductCategory;
    const title = dim === hotspots.byCustomer ? 'Top customers by CO₂e' : 'Top product categories by CO₂e';
    const top = dim[0];
    return {
      headline: `${top.label} is your largest hotspot`,
      answer: `${top.label} accounts for ${formatTonnes(top.co2eTonnes)} across ${top.shipments} shipments. Your top-5 customers carry ${formatPercent(f.top5CustomerSharePct, 0)} of downstream CO₂e — concentration that makes a handful of lane interventions high-leverage.`,
      insights: [
        { label: 'Largest', value: top.label, intent: 'risk' },
        { label: 'Its CO₂e', value: formatTonnes(top.co2eTonnes), intent: 'risk' },
        { label: 'Top-5 share', value: formatPercent(f.top5CustomerSharePct, 0), intent: 'neutral' },
      ],
      view: { kind: 'hotspots', title, hotspots: dim.slice(0, 8) },
      actions: [],
      followups: ['Which lanes have the highest reduction potential?', 'Show me the mode split'],
    };
  }

  // ── Mode split ─────────────────────────────────────────────────────────
  if (has('mode', 'ocean', 'split')) {
    const ocean = f.modeSplit.find((m) => m.mode === 'Ocean');
    return {
      headline: `Ocean carries ${ocean ? formatPercent(ocean.pct, 0) : '—'} of CO₂e`,
      answer: `Most movement is ocean-led, which is the lowest-carbon long-haul mode. The leverage is in the inland legs (road → rail) and in governing the small but carbon-heavy air exceptions.`,
      insights: f.modeSplit.map((m) => ({ label: m.mode, value: formatPercent(m.pct, 0), intent: m.mode === 'Air' ? 'risk' : 'neutral' })),
      view: { kind: 'modeSplit', title: 'CO₂e by mode', modeSplit: f.modeSplit },
      actions: [],
      followups: ['Show me avoidable air shipments', 'Which lanes can shift road to rail?'],
    };
  }

  // ── Recommendations / best actions (default-ish) ───────────────────────
  if (has('recommend', 'action', 'best', 'reduce', 'reduction', 'lane', 'potential', 'this quarter', 'focus')) {
    const top = recs.slice(0, 6);
    const saving = top.reduce((s, r) => s + r.estCo2eSavingTonnes, 0);
    return {
      headline: `Top ${top.length} actions save ${formatTonnes(saving)}/yr`,
      answer: `The highest-priority reduction actions — weighted by CO₂e saving and confidence — are mostly rail-inland + ocean-heavy mode shifts and nearest-gateway re-routing. Executing the top ${top.length} captures about ${formatTonnes(saving)}/yr.`,
      insights: [
        { label: 'Top actions', value: `${top.length}`, intent: 'neutral' },
        { label: 'Combined saving', value: `${formatTonnes(saving)}/yr`, intent: 'opportunity' },
        { label: 'Avg confidence', value: `${Math.round(top.reduce((s, r) => s + r.confidence, 0) / Math.max(top.length, 1))}%`, intent: 'positive' },
      ],
      view: { kind: 'recommendations', title: 'Priority reduction actions', recommendations: top },
      actions: top.slice(0, 3).map(actionFromRec),
      followups: ['Show me avoidable air shipments', 'What is our progress to the ambition?'],
    };
  }

  // ── Footprint summary (recognised generic intents only) ────────────────
  if (has('footprint', 'summary', 'overview', 'total', 'emission', 'emissions', 'co2', 'co₂e', 'carbon', 'how much')) {
    return {
      headline: `${formatTonnes(f.annualCo2eTonnes)}/yr downstream transport footprint`,
      answer: `Terova's downstream transportation footprint is about ${formatTonnes(f.annualCo2eTonnes)}/yr across ${f.laneCount} lanes. ${formatTonnes(f.reductionOpportunityTonnes)}/yr (${formatPercent(f.reductionOpportunityPct)}) is realizable, with ${formatPercent(f.realizedReductionPct)} already realized against baseline. Ask about hotspots, lanes, air exceptions, partners or progress.`,
      insights: [
        { label: 'Annual CO₂e', value: `${formatTonnes(f.annualCo2eTonnes)}`, intent: 'neutral' },
        { label: 'Opportunity', value: `${formatTonnes(f.reductionOpportunityTonnes)}/yr`, intent: 'opportunity' },
        { label: 'Realized', value: formatPercent(f.realizedReductionPct), intent: 'positive' },
      ],
      view: {
        kind: 'lanes',
        title: 'Highest-potential lanes',
        lanes: [...lanes].sort((a, b) => b.realizableReductionTonnes - a.realizableReductionTonnes).slice(0, 6),
      },
      actions: [],
      followups: ['Where are my biggest hotspots?', 'Recommend the best CO₂ actions', 'Show me avoidable air shipments'],
    };
  }

  // ── Honest fallback: never pretend to understand ───────────────────────
  return {
    headline: "I don't have a grounded answer for that",
    answer: `I answer only from the shipment data in view, and I couldn't map "${prompt}" to a topic I cover — footprint, hotspots, lanes, air exceptions, carriers & vendors, mode split, or progress to the ambition. Try one of the prompts below, or rephrase around one of those topics.`,
    insights: [],
    view: { kind: 'none' },
    actions: [],
    followups: ['Where are my biggest hotspots?', 'Recommend the best CO₂ actions', 'What is our progress toward the ambition?'],
  };
}
