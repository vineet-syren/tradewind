/**
 * Workbook data source — the ONLY place that reads the generated JSON.
 *
 * - Index files (shipments, lanes, recommendations, …) load once and cache;
 *   filtering, sorting and every aggregate run in-memory via the mappers,
 *   exactly as a real server would.
 * - Heavy per-lane / per-shipment detail is fetched lazily, one chunk per id.
 * - A tiered, jittered latency profile makes it feel like a real API.
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
  PersonaId,
  Recommendation,
  Shipment,
  ShipmentDetail,
  ShipmentFilters,
  ShipmentQuery,
  WorkbookIndex,
} from '@/types';
import { AGENT_CATALOG } from '@/constants/agents';
import { getPersona } from '@/constants/personas';
import { APP_TODAY, addDaysISO } from '@/constants/app';
import { queryShipments, scopeAndFilter } from '@/services/mappers/shipmentQuery';
import { buildFootprint } from '@/services/mappers/footprint';
import { buildHotspots, filterLanes } from '@/services/mappers/hotspots';
import { buildFocusKpis } from '@/services/mappers/focus';
import { composeCopilotReply } from '@/services/mappers/copilot';

const BASE = `${import.meta.env.BASE_URL}mock-data`;
const MOCKS_ENABLED = import.meta.env.VITE_ENABLE_MOCKS !== 'false';

type LatencyTier = 'fast' | 'normal' | 'heavy';
const TIER_RANGE_MS: Record<LatencyTier, [number, number]> = {
  fast: [120, 260],
  normal: [200, 420],
  heavy: [320, 620],
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
  const ms = (min + Math.random() * (max - min)) * LATENCY_FACTOR;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/${path}`);
  if (!res.ok) throw new Error(`Data fetch failed: ${path} (${res.status})`);
  return (await res.json()) as T;
}

function once<T>(loader: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | undefined;
  return () => (promise ??= loader());
}

export class MockDataSource implements CarbonDataSource {
  readonly id = 'workbook';
  readonly label = 'Terova transport workbook';

  private loadShipments = once(async () => (await fetchJson<{ items: Shipment[] }>('shipments/index.json')).items);
  private loadLanes = once(async () => (await fetchJson<{ items: Lane[] }>('lanes/index.json')).items);
  private loadRecommendations = once(() => fetchJson<Recommendation[]>('recommendations.json'));
  private loadEvidence = once(() => fetchJson<EsgEvidence>('evidence.json'));
  private loadExceptions = once(() => fetchJson<ExceptionItem[]>('exceptions.json'));
  private loadAssumptions = once(() => fetchJson<Assumptions>('assumptions.json'));
  private loadFilterOptions = once(() => fetchJson<FilterOptions>('filter-options.json'));
  private loadGeo = once(() => fetchJson<GeoDictionary>('geo.json'));
  private loadEmissionFactors = once(() => fetchJson<EmissionFactorRow[]>('emission-factors.json'));
  private loadCopilotSuggestions = once(() => fetchJson<CopilotSuggestion[]>('copilot-suggestions.json'));
  // 360 KB of source rows — only fetched when someone actually opens a cell.
  private loadWorkbook = once(() => fetchJson<WorkbookIndex>('workbook.json'));

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
    await delay('normal');
    return queryShipments(await this.loadShipments(), query);
  }
  async getShipment(id: string): Promise<ShipmentDetail | null> {
    await delay('fast');
    try {
      return await fetchJson<ShipmentDetail>(`shipments/${id}.json`);
    } catch {
      return null;
    }
  }

  // ── Lanes ──────────────────────────────────────────────────────────────
  async getLanes(params: ScopeParams & { sortBy?: 'avoidable' | 'co2e' } = {}): Promise<Lane[]> {
    await delay('normal');
    const lanes = filterLanes(await this.loadLanes(), params.filters);
    return [...lanes].sort((a, b) =>
      params.sortBy === 'co2e' ? b.totalCo2eTonnes - a.totalCo2eTonnes : b.avoidableTonnes - a.avoidableTonnes,
    );
  }
  async getLane(id: string): Promise<LaneDetail | null> {
    await delay('fast');
    try {
      return await fetchJson<LaneDetail>(`lanes/${id}.json`);
    } catch {
      return null;
    }
  }

  // ── Aggregates ─────────────────────────────────────────────────────────
  async getFootprint(params?: ScopeParams): Promise<Footprint> {
    await delay('heavy');
    const [shipments, lanes] = await Promise.all([this.scopedShipments(params), this.loadLanes()]);
    return buildFootprint(shipments, lanes);
  }
  async getHotspots(params?: ScopeParams): Promise<Hotspots> {
    await delay('normal');
    return buildHotspots(await this.scopedShipments(params));
  }
  async getEvidence(): Promise<EsgEvidence> {
    await delay('normal');
    return this.loadEvidence();
  }
  async getWorkbook(): Promise<WorkbookIndex> {
    await delay('fast');
    return this.loadWorkbook();
  }
  async getExceptions(params?: ScopeParams): Promise<ExceptionItem[]> {
    await delay('normal');
    const exceptions = await this.loadExceptions();
    const regions = params?.filters?.regions;
    if (!regions?.length) return exceptions;
    return exceptions.filter((e) => e.region === 'All' || regions.includes(e.region));
  }

  // ── Decisions ──────────────────────────────────────────────────────────
  async getRecommendations(
    params: ScopeParams & { laneId?: string; plannedOnly?: boolean; shippedOnly?: boolean } = {},
  ): Promise<Recommendation[]> {
    await delay('normal');
    let recs = await this.loadRecommendations();
    if (params.laneId) return recs.filter((r) => r.laneId === params.laneId);
    // "Open" means the freight has not left yet — a decision you can still make.
    if (params.plannedOnly) recs = recs.filter((r) => (r.shipmentDate ?? '') >= APP_TODAY);
    // "Shipped" is the mirror image: freight that has already moved, so the
    // saving is what was missed rather than what is still available. Applied
    // before the filter window, so it holds even when the user has scoped the
    // page forward — some figures must never absorb the forward book whatever
    // the filter says.
    if (params.shippedOnly) recs = recs.filter((r) => (r.shipmentDate ?? '') < APP_TODAY);
    if (params.filters) {
      const scoped = new Set(
        (await this.scopedShipments({ ...params, filters: scopeWindow(params.filters, params) })).map((s) => s.shipmentId),
      );
      recs = recs.filter((r) => !r.shipmentId || scoped.has(r.shipmentId));
    }
    return [...recs].sort((a, b) => b.priorityScore - a.priorityScore);
  }

  async getFocusKpis(params: { persona?: PersonaId; filters?: ShipmentFilters }): Promise<KpiMetric[]> {
    await delay('normal');
    const persona = params.persona ?? 'logistics';
    const [shipments, lanes, allRecs, exceptions] = await Promise.all([
      this.scopedShipments(params),
      this.loadLanes(),
      this.loadRecommendations(),
      this.loadExceptions(),
    ]);
    const footprint = buildFootprint(shipments, lanes);
    const openRecs = allRecs.filter((r) => (r.shipmentDate ?? '') > APP_TODAY);
    return buildFocusKpis(persona, { footprint, openRecs, exceptions });
  }

  // ── Copilot ────────────────────────────────────────────────────────────
  async askCopilot(prompt: string, persona?: PersonaId): Promise<CopilotResult> {
    await delay('heavy');
    const [shipments, lanes, recommendations, exceptions, evidence, assumptions] = await Promise.all([
      this.scopedShipments({ persona }),
      this.loadLanes(),
      this.loadRecommendations(),
      this.loadExceptions(),
      this.loadEvidence(),
      this.loadAssumptions(),
    ]);
    const footprint = buildFootprint(shipments, lanes);
    return composeCopilotReply(prompt, {
      footprint,
      lanes: filterLanes(lanes),
      recommendations,
      openRecommendations: recommendations.filter((r) => (r.shipmentDate ?? '') > APP_TODAY),
      hotspots: buildHotspots(shipments),
      exceptions,
      evidence,
      assumptions,
      personaName: persona ? getPersona(persona).name : 'You',
    });
  }

  async getCopilotSuggestions(): Promise<CopilotSuggestion[]> {
    await delay('fast');
    return this.loadCopilotSuggestions();
  }
}

/**
 * Reconcile the caller's date window with what the query is asking for.
 *
 * Both cases *narrow* the user's window; neither replaces it. An earlier version
 * dropped `dateFrom` for shipped-only queries, which made the Control Tower hero
 * report every year at once while the register beside it honoured the filter —
 * two different totals on one screen. So: keep whatever the user picked and only
 * clamp the end (shipped) or the start (planned) against today.
 */
function scopeWindow(
  filters: ShipmentFilters,
  { plannedOnly, shippedOnly }: { plannedOnly?: boolean; shippedOnly?: boolean },
): ShipmentFilters {
  if (shippedOnly) {
    const lastShipped = addDaysISO(APP_TODAY, -1);
    return {
      ...filters,
      dateTo: filters.dateTo && filters.dateTo < lastShipped ? filters.dateTo : lastShipped,
    };
  }
  if (plannedOnly) {
    return {
      ...filters,
      dateFrom: filters.dateFrom && filters.dateFrom > APP_TODAY ? filters.dateFrom : APP_TODAY,
    };
  }
  return filters;
}
