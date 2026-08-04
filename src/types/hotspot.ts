/** A ranked emission hotspot row (by product, port, gateway, mode, etc.). */
export interface HotspotRow {
  key: string;
  label: string;
  co2eTonnes: number;
  weightTonnes: number;
  shipments: number;
  co2ePerTonne: number;
  /** Transport intensity — g CO₂e per tonne-kilometre. */
  co2ePerTonneKm: number;
  /** CO₂e avoidable here on workbook-evidenced options. */
  avoidableTonnes: number;
}

export interface MonthModeRow {
  period: string;
  Ocean: number;
  Rail: number;
  Road: number;
  Air: number;
}

/** CO₂e by destination region, split by transport mode (mekko/heatmap input). */
export interface RegionModeRow {
  region: string;
  Ocean: number;
  Rail: number;
  Road: number;
  Air: number;
  total: number;
}

/** A directed CO₂e flow between two stages (gateway → mode → region) for sankey views. */
export interface FlowRow {
  from: string;
  to: string;
  value: number;
}

export interface Hotspots {
  byCategory: HotspotRow[];
  byMarket: HotspotRow[];
  byMode: HotspotRow[];
  byGateway: HotspotRow[];
  byDestPort: HotspotRow[];
  byProduct: HotspotRow[];
  /** First-mile collection runs, by growing region — the workbook's inbound block. */
  byCollectionOrigin: HotspotRow[];
  monthlyByMode: MonthModeRow[];
  regionModeMatrix: RegionModeRow[];
  flows: FlowRow[];
}

/** Dimension keys that map to a `HotspotRow[]` ranking (for the self-service view). */
export type HotspotDimension =
  | 'byCategory'
  | 'byMarket'
  | 'byMode'
  | 'byGateway'
  | 'byDestPort'
  | 'byProduct'
  | 'byCollectionOrigin';
