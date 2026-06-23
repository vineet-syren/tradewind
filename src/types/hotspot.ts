/** A ranked emission hotspot row (by product, customer, port, mode, etc.). */
export interface HotspotRow {
  key: string;
  label: string;
  co2eTonnes: number;
  weightTonnes: number;
  shipments: number;
  co2ePerTonne: number;
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
}

export type HotspotDimension = keyof Hotspots;
