/**
 * Real-API data source — a drop-in replacement for the mock. It implements the
 * exact same `CarbonDataSource` contract against REST endpoints under
 * VITE_API_BASE_URL. No backend ships with this POC, so the registry defaults
 * to mock; this exists to prove the seam (swapping is a registry change only).
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
  Shipment,
  ShipmentDetail,
  ShipmentFilters,
  ShipmentQuery,
} from '@/types';

export class ApiDataSource implements CarbonDataSource {
  readonly id = 'api';
  readonly label = 'Live API';
  private readonly base = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

  private async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    const url = new URL(`${this.base}${path}`);
    if (params)
      for (const [k, v] of Object.entries(params)) {
        if (v == null) continue;
        url.searchParams.set(k, Array.isArray(v) ? v.join(',') : String(v));
      }
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
    return (await res.json()) as T;
  }

  getFilterOptions = () => this.get<FilterOptions>('/filter-options');
  getGeo = () => this.get<GeoDictionary>('/geo');
  getEmissionFactors = () => this.get<EmissionFactorRow[]>('/emission-factors');
  getAssumptions = () => this.get<Assumptions>('/assumptions');
  getAgentCatalog = () => this.get<AgentCatalogEntry[]>('/agents');

  getShipments = (query: ShipmentQuery) => this.get<Paginated<Shipment>>('/shipments', { ...query });
  getShipment = (id: string) => this.get<ShipmentDetail | null>(`/shipments/${id}`);

  getLanes = (params: ScopeParams & { sortBy?: 'reduction' | 'co2e' } = {}) =>
    this.get<Lane[]>('/lanes', { persona: params.persona, sortBy: params.sortBy, ...params.filters });
  getLane = (id: string) => this.get<LaneDetail | null>(`/lanes/${id}`);

  getFootprint = (params?: ScopeParams) => this.get<Footprint>('/footprint', { persona: params?.persona, ...params?.filters });
  getHotspots = (params?: ScopeParams) => this.get<Hotspots>('/hotspots', { persona: params?.persona, ...params?.filters });
  getPartners = (params?: ScopeParams) => this.get<Partners>('/partners', { persona: params?.persona, ...params?.filters });
  getEvidence = () => this.get<EsgEvidence>('/evidence');
  getPulse = (params?: ScopeParams) => this.get<PulseEvent[]>('/pulse', { persona: params?.persona });
  getExceptions = (params?: ScopeParams) => this.get<ExceptionItem[]>('/exceptions', { persona: params?.persona });

  getRecommendations = (params: ScopeParams & { laneId?: string; ownerPersona?: PersonaId } = {}) =>
    this.get<Recommendation[]>('/recommendations', { persona: params.persona, laneId: params.laneId, ownerPersona: params.ownerPersona, ...params.filters });
  getFocusKpis = (params: { persona?: PersonaId; filters?: ShipmentFilters }) =>
    this.get<KpiMetric[]>('/focus-kpis', { persona: params.persona, ...params.filters });

  askCopilot = (prompt: string, persona?: PersonaId) =>
    this.get<CopilotResult>('/copilot', { prompt, persona });
  getCopilotSuggestions = () => this.get<CopilotSuggestion[]>('/copilot-suggestions');
}
