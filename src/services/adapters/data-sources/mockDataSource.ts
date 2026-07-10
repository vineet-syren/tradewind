/**
 * Mock data source — the ONLY place that reads raw mock JSON.
 *
 * - Index files (shipments, lanes, recommendations, hotspots, etc.) are loaded
 *   once and cached; persona-scoping, filtering, sorting and all aggregate maths
 *   run in-memory via the mappers, exactly as a real server would.
 * - Heavy per-lane / per-shipment detail is fetched lazily, one chunk per id.
 * - A tiered, jittered latency profile makes the mock feel like a real API.
 *   Tune via VITE_MOCK_LATENCY (off | fast | normal | slow).
 */
import type { CarbonDataSource, ScopeParams } from '@/services/dataSource';
import type {
  AgentCatalogEntry,
  Assumptions,
  CopilotResult,
  CopilotSuggestion,
  EmissionFactorRow,
  EsgEvidence,
  ExceptionItem,
  FilterOptions,
  Footprint,
  GeoDictionary,
  Hotspots,
  KpiMetric,
  Lane,
  LaneDetail,
  Paginated,
  Partners,
  PersonaId,
  PulseEvent,
  Recommendation,
  ScheduleSummary,
  Shipment,
  ShipmentDetail,
  ShipmentFilters,
  ShipmentQuery,
} from '@/types';
import { AGENT_CATALOG } from '@/constants/agents';
import { getPersona } from '@/constants/personas';
import { APP_TODAY, PLAN_HORIZON_DAYS, addDaysISO } from '@/constants/app';
import { queryShipments, scopeAndFilter } from '@/services/mappers/shipmentQuery';
import { buildSchedule } from '@/services/mappers/schedule';
import { buildFootprint } from '@/services/mappers/footprint';
import { buildHotspots, filterLanes } from '@/services/mappers/hotspots';
import { buildPartners } from '@/services/mappers/partners';
import { buildFocusKpis } from '@/services/mappers/focus';
import { composeCopilotReply } from '@/services/mappers/copilot';

const BASE = `${import.meta.env.BASE_URL}mock-data`;
const MOCKS_ENABLED = import.meta.env.VITE_ENABLE_MOCKS !== 'false';

type LatencyTier = 'fast' | 'normal' | 'heavy';
const TIER_RANGE_MS: Record<LatencyTier, [number, number]> = {
  fast: [160, 380],
  normal: [320, 680],
  heavy: [520, 980],
};

const LATENCY_FACTOR = (() => {
  switch ((import.meta.env.VITE_MOCK_LATENCY ?? 'normal').toLowerCase()) {
    case 'off':
      return 0;
    case 'fast':
      return 0.5;
    case 'slow':
      return 1.8;
    default:
      return 1;
  }
})();

function delay(tier: LatencyTier = 'normal'): Promise<void> {
  if (!MOCKS_ENABLED || LATENCY_FACTOR === 0) return Promise.resolve();
  const [min, max] = TIER_RANGE_MS[tier];
  let ms = (min + Math.random() * (max - min)) * LATENCY_FACTOR;
  if (Math.random() < 0.07) ms += 300 + Math.random() * 500;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/${path}`);
  if (!res.ok) throw new Error(`Mock fetch failed: ${path} (${res.status})`);
  return (await res.json()) as T;
}

function once<T>(loader: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | undefined;
  return () => (promise ??= loader());
}

export class MockDataSource implements CarbonDataSource {
  readonly id = 'mock';
  readonly label = 'Mock data (bundled JSON)';

  private loadShipments = once(async () => (await fetchJson<{ items: Shipment[] }>('shipments/index.json')).items);
  private loadLanes = once(async () => (await fetchJson<{ items: Lane[] }>('lanes/index.json')).items);
  private loadRecommendations = once(() => fetchJson<Recommendation[]>('recommendations.json'));
  private loadEvidence = once(() => fetchJson<EsgEvidence>('evidence.json'));
  private loadPulse = once(() => fetchJson<PulseEvent[]>('pulse.json'));
  private loadExceptions = once(() => fetchJson<ExceptionItem[]>('exceptions.json'));
  private loadAssumptions = once(() => fetchJson<Assumptions>('assumptions.json'));
  private loadFilterOptions = once(() => fetchJson<FilterOptions>('filter-options.json'));
  private loadGeo = once(() => fetchJson<GeoDictionary>('geo.json'));
  private loadEmissionFactors = once(() => fetchJson<EmissionFactorRow[]>('emission-factors.json'));
  private loadCopilotSuggestions = once(() => fetchJson<CopilotSuggestion[]>('copilot-suggestions.json'));

  private async scopedShipments(params?: ScopeParams): Promise<Shipment[]> {
    return scopeAndFilter(await this.loadShipments(), params?.persona, params?.filters);
  }

  // ── Reference ──────────────────────────────────────────────────────────
  async getFilterOptions(): Promise<FilterOptions> {
    await delay('fast');
    return this.loadFilterOptions();
  }
  async getGeo(): Promise<GeoDictionary> {
    await delay('fast');
    return this.loadGeo();
  }
  async getEmissionFactors(): Promise<EmissionFactorRow[]> {
    await delay('fast');
    return this.loadEmissionFactors();
  }
  async getAssumptions(): Promise<Assumptions> {
    await delay('fast');
    return this.loadAssumptions();
  }
  async getAgentCatalog(): Promise<AgentCatalogEntry[]> {
    await delay('fast');
    return AGENT_CATALOG;
  }

  // ── Shipments ──────────────────────────────────────────────────────────
  async getShipments(query: ShipmentQuery): Promise<Paginated<Shipment>> {
    await delay('heavy');
    return queryShipments(await this.loadShipments(), query);
  }
  async getShipment(id: string): Promise<ShipmentDetail | null> {
    await delay('normal');
    try {
      return await fetchJson<ShipmentDetail>(`shipments/${id}.json`);
    } catch {
      return null;
    }
  }

  // ── Lanes ──────────────────────────────────────────────────────────────
  async getLanes(params: ScopeParams & { sortBy?: 'reduction' | 'co2e' } = {}): Promise<Lane[]> {
    await delay('normal');
    const lanes = filterLanes(await this.loadLanes(), params.filters);
    const sorted = [...lanes].sort((a, b) =>
      params.sortBy === 'co2e'
        ? b.totalCo2eTonnes - a.totalCo2eTonnes
        : b.realizableReductionTonnes - a.realizableReductionTonnes,
    );
    return sorted;
  }
  async getLane(id: string): Promise<LaneDetail | null> {
    await delay('normal');
    try {
      return await fetchJson<LaneDetail>(`lanes/${id}.json`);
    } catch {
      return null;
    }
  }

  // ── Aggregates ─────────────────────────────────────────────────────────
  async getFootprint(params?: ScopeParams): Promise<Footprint> {
    await delay('heavy');
    const [shipments, lanes, assumptions] = await Promise.all([
      this.scopedShipments(params),
      this.loadLanes(),
      this.loadAssumptions(),
    ]);
    return buildFootprint(shipments, lanes, assumptions);
  }
  async getHotspots(params?: ScopeParams): Promise<Hotspots> {
    await delay('normal');
    return buildHotspots(await this.scopedShipments(params));
  }
  async getPartners(params?: ScopeParams): Promise<Partners> {
    await delay('normal');
    return buildPartners(await this.scopedShipments(params));
  }
  async getEvidence(): Promise<EsgEvidence> {
    await delay('normal');
    return this.loadEvidence();
  }
  async getPulse(params?: ScopeParams): Promise<PulseEvent[]> {
    await delay('fast');
    const events = await this.loadPulse();
    const regions = params?.filters?.regions;
    if (!regions?.length) return events;
    return events.filter((e) => e.region === 'All' || regions.includes(e.region));
  }
  async getExceptions(params?: ScopeParams): Promise<ExceptionItem[]> {
    await delay('normal');
    const exceptions = await this.loadExceptions();
    const regions = params?.filters?.regions;
    if (!regions?.length) return exceptions;
    return exceptions.filter((e) => e.region === 'All' || regions.includes(e.region));
  }
  async getSchedule(params?: ScopeParams): Promise<ScheduleSummary> {
    await delay('normal');
    // Forward window: honour the user's date range, but never look backward —
    // the scheduler is always about what's still to ship.
    const f = params?.filters ?? {};
    const fromDefault = addDaysISO(APP_TODAY, 1);
    const toDefault = addDaysISO(APP_TODAY, PLAN_HORIZON_DAYS);
    const from = f.dateFrom && f.dateFrom > fromDefault ? f.dateFrom : fromDefault;
    const to = f.dateTo && f.dateTo > from ? f.dateTo : toDefault;
    const scoped = scopeAndFilter(await this.loadShipments(), params?.persona, { ...f, dateFrom: from, dateTo: to });
    const planned = scoped.filter((s) => s.date > APP_TODAY);
    return buildSchedule(planned, { from, to });
  }

  // ── Recommendations & focus ────────────────────────────────────────────
  async getRecommendations(
    params: ScopeParams & { laneId?: string; ownerPersona?: PersonaId } = {},
  ): Promise<Recommendation[]> {
    await delay('normal');
    let recs = await this.loadRecommendations();
    if (params.laneId) return recs.filter((r) => r.laneId === params.laneId);
    if (params.ownerPersona) recs = recs.filter((r) => r.ownerPersona === params.ownerPersona);
    if (params.filters) {
      const scoped = new Set((await this.scopedShipments(params)).map((s) => s.laneId));
      recs = recs.filter((r) => !r.laneId || scoped.has(r.laneId));
    }
    return [...recs].sort((a, b) => b.priorityScore - a.priorityScore);
  }

  async getFocusKpis(params: { persona?: PersonaId; filters?: ShipmentFilters }): Promise<KpiMetric[]> {
    await delay('normal');
    const persona = params.persona ?? 'cso';
    const [shipments, lanes, assumptions, recs, exceptions] = await Promise.all([
      this.scopedShipments(params),
      this.loadLanes(),
      this.loadAssumptions(),
      this.loadRecommendations(),
      this.loadExceptions(),
    ]);
    const footprint = buildFootprint(shipments, lanes, assumptions);
    const laneIds = new Set(shipments.map((s) => s.laneId));
    const scopedRecs = recs.filter((r) => !r.laneId || laneIds.has(r.laneId));
    return buildFocusKpis(persona, { footprint, recs: scopedRecs, exceptions });
  }

  // ── Copilot ────────────────────────────────────────────────────────────
  async askCopilot(prompt: string, persona?: PersonaId): Promise<CopilotResult> {
    await delay('heavy');
    const [shipments, lanes, assumptions, recommendations, hotspotsBase, exceptions, evidence] = await Promise.all([
      this.scopedShipments({ persona }),
      this.loadLanes(),
      this.loadAssumptions(),
      this.loadRecommendations(),
      this.loadShipments(),
      this.loadExceptions(),
      this.loadEvidence(),
    ]);
    const footprint = buildFootprint(shipments, lanes, assumptions);
    const laneIds = new Set(shipments.map((s) => s.laneId));
    const scopedRecs = recommendations.filter((r) => !r.laneId || laneIds.has(r.laneId));
    const hotspots = buildHotspots(hotspotsBase);
    const personaName = persona ? getPersona(persona).name : 'You';
    return composeCopilotReply(prompt, {
      footprint,
      lanes: filterLanes(lanes),
      recommendations: scopedRecs,
      hotspots,
      exceptions,
      evidence,
      personaName,
    });
  }

  async getCopilotSuggestions(): Promise<CopilotSuggestion[]> {
    await delay('fast');
    return this.loadCopilotSuggestions();
  }
}
