/**
 * REST adapter — the drop-in replacement for MockDataSource once a backend
 * exists. Every method maps 1:1 onto an endpoint; the UI never changes.
 *
 * Enable with VITE_DATA_SOURCE=api and VITE_API_BASE_URL=https://…
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
} from '@/types';

/** Flatten scope + filters into query params a REST backend can read. */
function toQuery(params: Record<string, unknown> = {}): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length) q.set(key, value.join(','));
    } else if (typeof value === 'object') {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (v === undefined || v === null || v === '') continue;
        q.set(k, Array.isArray(v) ? v.join(',') : String(v));
      }
    } else {
      q.set(key, String(value));
    }
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

export class ApiDataSource implements CarbonDataSource {
  readonly id = 'api';
  readonly label = 'Live API';

  constructor(private readonly baseUrl: string) {}

  private async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}${toQuery(params)}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`API ${path} failed (${res.status})`);
    return (await res.json()) as T;
  }

  getFilterOptions(): Promise<FilterOptions> {
    return this.get('/filter-options');
  }
  getGeo(): Promise<GeoDictionary> {
    return this.get('/geo');
  }
  getEmissionFactors(): Promise<EmissionFactorRow[]> {
    return this.get('/emission-factors');
  }
  getAssumptions(): Promise<Assumptions> {
    return this.get('/assumptions');
  }
  getAgentCatalog(): Promise<AgentCatalogEntry[]> {
    return this.get('/agents');
  }

  getShipments(query: ShipmentQuery): Promise<Paginated<Shipment>> {
    return this.get('/shipments', query as Record<string, unknown>);
  }
  getShipment(id: string): Promise<ShipmentDetail | null> {
    return this.get(`/shipments/${encodeURIComponent(id)}`);
  }

  getLanes(params?: ScopeParams & { sortBy?: 'avoidable' | 'co2e' }): Promise<Lane[]> {
    return this.get('/lanes', params as Record<string, unknown>);
  }
  getLane(id: string): Promise<LaneDetail | null> {
    return this.get(`/lanes/${encodeURIComponent(id)}`);
  }

  getFootprint(params?: ScopeParams): Promise<Footprint> {
    return this.get('/footprint', params as Record<string, unknown>);
  }
  getHotspots(params?: ScopeParams): Promise<Hotspots> {
    return this.get('/hotspots', params as Record<string, unknown>);
  }
  getEvidence(): Promise<EsgEvidence> {
    return this.get('/evidence');
  }
  getExceptions(params?: ScopeParams): Promise<ExceptionItem[]> {
    return this.get('/exceptions', params as Record<string, unknown>);
  }

  getRecommendations(params?: ScopeParams & { laneId?: string; plannedOnly?: boolean }): Promise<Recommendation[]> {
    return this.get('/recommendations', params as Record<string, unknown>);
  }
  getFocusKpis(params: { persona?: PersonaId; filters?: ShipmentFilters }): Promise<KpiMetric[]> {
    return this.get('/focus-kpis', params as Record<string, unknown>);
  }

  async askCopilot(prompt: string, persona?: PersonaId): Promise<CopilotResult> {
    const res = await fetch(`${this.baseUrl}/copilot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ prompt, persona }),
    });
    if (!res.ok) throw new Error(`API /copilot failed (${res.status})`);
    return (await res.json()) as CopilotResult;
  }
  getCopilotSuggestions(): Promise<CopilotSuggestion[]> {
    return this.get('/copilot/suggestions');
  }
}
