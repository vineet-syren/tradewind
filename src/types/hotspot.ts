/** A ranked emission hotspot row (by product, customer, port, mode, etc.). */
export interface HotspotRow {
  key: string;
  label: string;
  co2eTonnes: number;
  weightTonnes: number;
  shipments: number;
  co2ePerTonne: number;
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
