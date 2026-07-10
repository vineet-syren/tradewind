export interface VendorPartner {
  /** Stable vendor code, derived from the vendor name (e.g. VEN-482). */
  id: string;
  name: string;
  origin: string;
  controllability: string;
  co2eTonnes: number;
  weightTonnes: number;
  shipments: number;
  co2ePerTonne: number;
  influenceableSavingTonnes: number;
}

export interface LspPartner {
  /** Stable carrier code, derived from the LSP name (e.g. CAR-317). */
  id: string;
  name: string;
  carrier: string;
  intensityIndex: number;
  greenProgram: boolean;
  co2eTonnes: number;
  weightTonnes: number;
  shipments: number;
  co2ePerTonne: number;
  influenceableSavingTonnes: number;
  /** CO₂e change, last complete year vs the year before (%). Null when history is too short. */
  yoyChangePct: number | null;
}

/** One year of CO₂e per carrier (for the carrier mix trend). */
export interface LspYearRow {
  year: number;
  values: Record<string, number>;
}

export interface Partners {
  vendors: VendorPartner[];
  lsps: LspPartner[];
  /** Carrier CO₂e by year — feeds the year-over-year carrier mix trend. */
  lspTrend: LspYearRow[];
}
