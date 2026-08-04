/**
 * The single data-source contract every screen talks to.
 *
 * UI components depend ONLY on this interface — never on fetch, JSON files, or a
 * specific backend. Swapping mock ↔ real API is therefore a registry change,
 * not a UI rewrite. Every method returns a Promise so a real `fetch`-based
 * implementation is a drop-in replacement.
 */
import type {
  AgentCatalogEntry,
  Assumptions,
  CopilotResult,
  CopilotSuggestion,
  EmissionFactorRow,
  EsgEvidence,
  ExceptionItem,
  Footprint,
  FilterOptions,
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

export interface ScopeParams {
  persona?: PersonaId;
  filters?: ShipmentFilters;
}

export interface CarbonDataSource {
  readonly id: string;
  readonly label: string;

  // Reference data
  getFilterOptions(): Promise<FilterOptions>;
  getGeo(): Promise<GeoDictionary>;
  getEmissionFactors(): Promise<EmissionFactorRow[]>;
  getAssumptions(): Promise<Assumptions>;
  getAgentCatalog(): Promise<AgentCatalogEntry[]>;

  // Shipments
  getShipments(query: ShipmentQuery): Promise<Paginated<Shipment>>;
  getShipment(id: string): Promise<ShipmentDetail | null>;

  // Lanes (decisioning corridors)
  getLanes(params?: ScopeParams & { sortBy?: 'avoidable' | 'co2e' }): Promise<Lane[]>;
  getLane(id: string): Promise<LaneDetail | null>;

  // Aggregates
  getFootprint(params?: ScopeParams): Promise<Footprint>;
  getHotspots(params?: ScopeParams): Promise<Hotspots>;
  getEvidence(): Promise<EsgEvidence>;
  getExceptions(params?: ScopeParams): Promise<ExceptionItem[]>;

  /**
   * The decision queue: shipments with a better workbook-evidenced option.
   * `plannedOnly` narrows it to freight that has not shipped yet — the
   * decisions a logistics lead can still act on.
   */
  getRecommendations(
    params?: ScopeParams & { laneId?: string; plannedOnly?: boolean },
  ): Promise<Recommendation[]>;
  getFocusKpis(params: { persona?: PersonaId; filters?: ShipmentFilters }): Promise<KpiMetric[]>;

  // Copilot
  askCopilot(prompt: string, persona?: PersonaId): Promise<CopilotResult>;
  getCopilotSuggestions(): Promise<CopilotSuggestion[]>;
}
