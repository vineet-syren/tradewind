export interface VendorPartner {
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
  name: string;
  carrier: string;
  intensityIndex: number;
  greenProgram: boolean;
  co2eTonnes: number;
  weightTonnes: number;
  shipments: number;
  co2ePerTonne: number;
  influenceableSavingTonnes: number;
}

export interface Partners {
  vendors: VendorPartner[];
  lsps: LspPartner[];
}
