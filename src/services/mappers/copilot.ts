/**
 * Prompt-to-answer copilot. Grounds every reply in the scoped workbook figures
 * and renders the matching view. Pure keyword routing (no LLM) — deterministic,
 * offline, and it says so when it cannot answer rather than guessing.
 */
import type {
  Assumptions,
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
  /** Decisions on freight that has not shipped yet. */
  openRecommendations: Recommendation[];
  hotspots: Hotspots;
  exceptions: ExceptionItem[];
  evidence: EsgEvidence;
  assumptions: Assumptions;
  personaName: string;
}

const actionFromRec = (r: Recommendation): CopilotAction => ({
  id: `ca-${r.id}`,
  label: r.title,
  type: r.type,
  laneId: r.laneId,
  shipmentId: r.shipmentId,
  recommendationId: r.id,
  savingTonnes: r.estCo2eSavingTonnes,
});

const sumSaving = (recs: Recommendation[]) => recs.reduce((s, r) => s + r.estCo2eSavingTonnes, 0);

export function composeCopilotReply(prompt: string, ctx: CopilotContext): CopilotResult {
  const q = prompt.toLowerCase();
  const { footprint: f, lanes, openRecommendations: open, recommendations: recs, hotspots, evidence, exceptions } = ctx;
  // Word-boundary matching so "fair" never triggers 'air', with an optional
  // plural tail so "lanes", "ports", "options" still match.
  const has = (...words: string[]) =>
    words.some((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:s|es|'s)?\\b`, 'i').test(q));

  // ── What should I change / decisions ───────────────────────────────────
  if (has('change', 'decision', 'decide', 'plan', 'planned', 'action', 'recommend', 'do next', 'should i')) {
    const top = open.slice(0, 6);
    const saving = sumSaving(open);
    if (!open.length) {
      return {
        headline: 'Nothing is waiting on a decision',
        answer: `Every shipment in the forward book is already on the lowest-carbon route the workbook can evidence. The historical record still shows ${formatTonnes(sumSaving(recs))} that could have been avoided — useful as a target, but not a decision you can still make.`,
        insights: [{ label: 'Open decisions', value: '0', intent: 'positive' }],
        view: { kind: 'none' },
        actions: [],
        followups: ['Where is our transport CO₂e concentrated?', 'What did air freight cost us in CO₂e?'],
      };
    }
    return {
      headline: `${open.length} decisions worth ${formatTonnes(saving)}`,
      answer: `${open.length} shipment${open.length === 1 ? ' has' : 's have'} a lower-carbon option the workbook already proves works. Taking all of them saves ${formatTonnes(saving)} — ${formatPercent((saving / Math.max(f.totalCo2eTonnes, 0.001)) * 100, 1)} of the footprint in scope. The biggest is ${top[0].title.toLowerCase()}, worth ${formatTonnes(top[0].estCo2eSavingTonnes)} on its own.`,
      insights: [
        { label: 'Open decisions', value: `${open.length}`, intent: 'opportunity' },
        { label: 'CO₂e at stake', value: formatTonnes(saving), intent: 'opportunity' },
        { label: 'Biggest single win', value: formatTonnes(top[0].estCo2eSavingTonnes), intent: 'positive' },
      ],
      view: { kind: 'recommendations', title: 'Decisions still open', recommendations: top },
      actions: top.slice(0, 3).map(actionFromRec),
      followups: ['Why is the Chennai gateway heavier than Nhava Sheva?', 'Where is our transport CO₂e concentrated?'],
    };
  }

  // ── Air freight ────────────────────────────────────────────────────────
  if (has('air', 'flown', 'fly', 'flight', 'plane')) {
    const airRecs = recs.filter((r) => r.type === 'sea-instead-of-air');
    const saving = sumSaving(airRecs);
    if (!f.airShipmentCount) {
      return {
        headline: 'No air freight in this scope',
        answer: 'None of the shipments in view flew. Widen the date range to see the three air shipments the workbook records.',
        insights: [],
        view: { kind: 'none' },
        actions: [],
        followups: ['Where is our transport CO₂e concentrated?', 'How does the latest year compare with the baseline?'],
      };
    }
    return {
      headline: `${f.airShipmentCount} shipments flew, costing ${formatTonnes(f.airCo2eTonnes)}`,
      answer: `Air is charged at 1.58 kg CO₂e per tonne-kilometre against 0.0084 at sea — 188 times more for every tonne carried. Those ${f.airShipmentCount} shipments carried very little weight but produced ${formatTonnes(f.airCo2eTonnes)}, ${formatPercent((f.airCo2eTonnes / Math.max(f.totalCo2eTonnes, 0.001)) * 100, 1)} of the footprint in scope. The workbook already sails to the same countries, so ${formatTonnes(saving)} of that was avoidable on routes it has itself recorded.`,
      insights: [
        { label: 'Air CO₂e', value: formatTonnes(f.airCo2eTonnes), intent: 'risk' },
        { label: 'Shipments flown', value: `${f.airShipmentCount}`, intent: 'risk' },
        { label: 'Avoidable by sea', value: formatTonnes(saving), intent: 'opportunity' },
      ],
      view: { kind: 'recommendations', title: 'Sea alternatives the workbook records', recommendations: airRecs.slice(0, 6) },
      actions: airRecs.slice(0, 3).map(actionFromRec),
      followups: ['What should I change on the shipments still to be planned?', 'Where is our transport CO₂e concentrated?'],
    };
  }

  // ── Gateways ───────────────────────────────────────────────────────────
  if (has('gateway', 'chennai', 'nhava', 'port', 'rail', 'road', 'truck', 'inland')) {
    const gatewayRecs = recs.filter((r) => r.type === 'gateway-swap');
    const saving = sumSaving(gatewayRecs);
    const byGateway = f.byGateway.slice(0, 4);
    return {
      headline: `The gateway choice is worth ${formatTonnes(saving)}`,
      answer: `Road CO₂e is charged per truck run — 0.5928 kg per kilometre whatever is on the truck — while rail is charged per tonne-kilometre. Routing through Chennai means about 703 km of road; routing through Nhava Sheva means 51 km of road plus 702 km of rail. For a light load the difference is dramatic, and the workbook has already sailed both gateways to the same destination ports, so nothing here is hypothetical. Road legs account for ${formatTonnes(f.roadCo2eTonnes)} of the scope, ${formatPercent((f.roadCo2eTonnes / Math.max(f.totalCo2eTonnes, 0.001)) * 100, 0)} of the total.`,
      insights: [
        { label: 'Road CO₂e in scope', value: formatTonnes(f.roadCo2eTonnes), intent: 'risk' },
        { label: 'Gateway swaps found', value: `${gatewayRecs.length}`, intent: 'neutral' },
        { label: 'Worth', value: formatTonnes(saving), intent: 'opportunity' },
      ],
      view: { kind: 'hotspots', title: 'CO₂e by gateway', hotspots: hotspots.byGateway.slice(0, 6) },
      actions: gatewayRecs.slice(0, 3).map(actionFromRec),
      followups: ['What should I change on the shipments still to be planned?', 'Where is our transport CO₂e concentrated?'],
      ...(byGateway.length ? {} : {}),
    };
  }

  // ── Hotspots / concentration ───────────────────────────────────────────
  if (has('hotspot', 'biggest', 'where', 'concentrat', 'product', 'destination', 'market', 'prioritise', 'prioritize')) {
    const dim = has('product') ? hotspots.byProduct : has('market', 'destination') ? hotspots.byDestPort : hotspots.byCategory;
    const title = dim === hotspots.byProduct ? 'Top products by CO₂e'
      : dim === hotspots.byDestPort ? 'Top destination ports by CO₂e'
        : 'Top product categories by CO₂e';
    const top = dim[0];
    if (!top) {
      return {
        headline: 'Nothing in scope',
        answer: 'No shipments match the current filters, so there is nothing to rank. Clear a filter and ask again.',
        insights: [],
        view: { kind: 'none' },
        actions: [],
        followups: ['What should I change on the shipments still to be planned?'],
      };
    }
    return {
      headline: `${top.label} is the largest single source`,
      answer: `${top.label} accounts for ${formatTonnes(top.co2eTonnes)} across ${top.shipments} shipment${top.shipments === 1 ? '' : 's'}. The top three destination ports carry ${formatPercent(f.top3DestSharePct, 0)} of downstream CO₂e — that concentration is what makes a handful of gateway decisions move the whole number.`,
      insights: [
        { label: 'Largest', value: top.label, intent: 'risk' },
        { label: 'Its CO₂e', value: formatTonnes(top.co2eTonnes), intent: 'risk' },
        { label: 'Top-3 port share', value: formatPercent(f.top3DestSharePct, 0), intent: 'neutral' },
      ],
      view: { kind: 'hotspots', title, hotspots: dim.slice(0, 8) },
      actions: [],
      followups: ['What should I change on the shipments still to be planned?', 'Why is the Chennai gateway heavier than Nhava Sheva?'],
    };
  }

  // ── Mode split ─────────────────────────────────────────────────────────
  if (has('mode', 'ocean', 'sea', 'split')) {
    const ocean = f.modeSplit.find((m) => m.mode === 'Ocean');
    return {
      headline: `Ocean carries ${ocean ? formatPercent(ocean.pct, 0) : '—'} of CO₂e`,
      answer: 'Most movement is ocean-led, which is the lowest-carbon long-haul option per tonne. That means the leverage is not in the sailing — it is in the inland legs, where road is charged per truck run, and in the handful of shipments that flew.',
      insights: f.modeSplit.map((m) => ({
        label: m.mode,
        value: formatPercent(m.pct, 0),
        intent: m.mode === 'Air' ? ('risk' as const) : ('neutral' as const),
      })),
      view: { kind: 'modeSplit', title: 'CO₂e by mode', modeSplit: f.modeSplit },
      actions: [],
      followups: ['Why is the Chennai gateway heavier than Nhava Sheva?', 'What did air freight cost us in CO₂e?'],
    };
  }

  // ── Trend / baseline / reporting ────────────────────────────────────────
  if (has('year', 'trend', 'baseline', 'compare', 'reduce', 'reduction', 'progress', 'report', 'reconcile', 'evidence')) {
    const first = evidence.years[0];
    const last = evidence.years.at(-1)!;
    const dq = exceptions.filter((e) => e.kind === 'data-quality').length;
    return {
      headline: `${formatTonnes(last.allLegsCo2eTonnes)} in ${last.reportingYear}, ${formatPercent(Math.abs(evidence.changeSinceBaselinePct), 1)} ${evidence.changeSinceBaselinePct < 0 ? 'below' : 'above'} ${first.reportingYear}`,
      answer: `Downstream transport went from ${formatTonnes(first.allLegsCo2eTonnes)} in ${first.reportingYear} to ${formatTonnes(last.allLegsCo2eTonnes)} in ${last.reportingYear}${last.reconciliationNote ? '' : ', which ties exactly to the total the workbook prints for that tab'}. Volume matters as much as routing here, so read it alongside intensity: ${last.intensity} g CO₂e per tonne-kilometre in the latest year against ${first.intensity} in the baseline.${dq ? ` ${dq} row${dq === 1 ? '' : 's'} in the workbook contradict themselves and are listed under Exceptions.` : ''}`,
      insights: [
        { label: first.reportingYear, value: formatTonnes(first.allLegsCo2eTonnes), intent: 'neutral' },
        { label: last.reportingYear, value: formatTonnes(last.allLegsCo2eTonnes), intent: evidence.changeSinceBaselinePct < 0 ? 'positive' : 'risk' },
        { label: 'Change', value: formatPercent(evidence.changeSinceBaselinePct, 1), intent: evidence.changeSinceBaselinePct < 0 ? 'positive' : 'risk' },
      ],
      view: {
        kind: 'kpis',
        title: 'Reported footprint by year',
        kpis: evidence.years.map((y) => ({
          id: y.reportingYear,
          label: y.reportingYear,
          value: y.allLegsCo2eTonnes,
          unit: 'tonnes' as const,
          intent: 'neutral' as const,
          hint: `${y.shipments} shipments · ${y.intensity} g/t·km`,
        })),
      },
      actions: [],
      followups: ['What should I change on the shipments still to be planned?', 'Where is our transport CO₂e concentrated?'],
    };
  }

  // ── Footprint summary ──────────────────────────────────────────────────
  if (has('footprint', 'summary', 'overview', 'total', 'emission', 'co2', 'co₂e', 'carbon', 'how much')) {
    return {
      headline: `${formatTonnes(f.totalCo2eTonnes)} across ${f.shipmentCount} shipments`,
      answer: `The scope in view holds ${formatTonnes(f.totalCo2eTonnes)} across ${f.shipmentCount} shipments on ${f.laneCount} lanes, at ${f.avgIntensity} g CO₂e per tonne-kilometre. ${formatTonnes(f.avoidableTonnes)} of it (${formatPercent(f.avoidablePct, 1)}) could have gone a lower-carbon way the workbook itself records. Ask about decisions, gateways, air freight, hotspots or the year-on-year trend.`,
      insights: [
        { label: 'CO₂e in scope', value: formatTonnes(f.totalCo2eTonnes), intent: 'neutral' },
        { label: 'Avoidable', value: formatTonnes(f.avoidableTonnes), intent: 'opportunity' },
        { label: 'Intensity', value: `${f.avgIntensity} g/t·km`, intent: 'neutral' },
      ],
      view: {
        kind: 'lanes',
        title: 'Lanes with the most at stake',
        lanes: [...lanes].sort((a, b) => b.avoidableTonnes - a.avoidableTonnes).slice(0, 6),
      },
      actions: [],
      followups: ['What should I change on the shipments still to be planned?', 'Where is our transport CO₂e concentrated?', 'What did air freight cost us in CO₂e?'],
    };
  }

  // ── Honest fallback: never pretend to understand ───────────────────────
  return {
    headline: "I don't have a grounded answer for that",
    answer: `I answer only from the ${ctx.assumptions.workbook} figures in view, and I could not map "${prompt}" onto something I hold — decisions, gateways, air freight, hotspots, mode split, or the year-on-year footprint. Try one of the prompts below.`,
    insights: [],
    view: { kind: 'none' },
    actions: [],
    followups: [
      'What should I change on the shipments still to be planned?',
      'Where is our transport CO₂e concentrated?',
      'How does the latest year compare with the baseline?',
    ],
  };
}
