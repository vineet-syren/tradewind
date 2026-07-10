/** A ranked emission hotspot row (by product, customer, port, mode, etc.). */
export interface HotspotRow {
  key: string;
  label: string;
  co2eTonnes: number;
  weightTonnes: number;
  shipments: number;
  co2ePerTonne: number;
  /** True transport intensity — g CO₂e per tonne-kilometre. */
  co2ePerTonneKm: number;
}

export interface CustomerModeRow {
  customer: string;
  Ocean: number;
  Rail: number;
  Road: number;
  Air: number;
  total: number;
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

/** A directed CO₂e flow between two stages (origin → mode, mode → region) for sankey views. */
export interface FlowRow {
  from: string;
  to: string;
  value: number;
}

export interface Hotspots {
  byProductCategory: HotspotRow[];
  byCustomer: HotspotRow[];
  byMarket: HotspotRow[];
  byMode: HotspotRow[];
  byOriginPort: HotspotRow[];
  byDestPort: HotspotRow[];
  byVendor: HotspotRow[];
  byLsp: HotspotRow[];
  byOrigin: HotspotRow[];
  customerModeMatrix: CustomerModeRow[];
  monthlyByMode: MonthModeRow[];
  regionModeMatrix: RegionModeRow[];
  flows: FlowRow[];
}

/** Dimension keys that map to a `HotspotRow[]` ranking (for the self-service view). */
export type HotspotDimension =
  | 'byProductCategory'
  | 'byCustomer'
  | 'byMarket'
  | 'byMode'
  | 'byOriginPort'
  | 'byDestPort'
  | 'byVendor'
  | 'byLsp'
  | 'byOrigin';
