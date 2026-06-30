import type { GeoCoord, Mode, ModeLabel, DestRegion, DataConfidence } from './common';
import type { Scenario } from './lane';
import type { Recommendation } from './recommendation';

/** A single movement leg with its full CO₂e calculation breakdown. */
export interface Leg {
  seq: number;
  mode: Mode;
  modeLabel: ModeLabel;
  from: string;
  to: string;
  fromCoord: GeoCoord;
  toCoord: GeoCoord;
  distanceKm: number;
  distanceSource: string;
  distanceTier: string;
  emissionFactor: number;
  efUnit: string;
  vehicleType: string;
  weightTonnes: number;
  co2eTonnes: number;
  fuelLitres: number;
  fuelType: string;
  vehicleCount: number;
  transitDaysExpected: number;
  transitDaysActual: number;
}

/** Lightweight shipment fact (the index row). */
export interface Shipment {
  shipmentId: string;
  laneId: string;
  period: string; // YYYY-MM
  year: number;
  date: string; // YYYY-MM-DD — ship/departure date
  eta: string; // YYYY-MM-DD — estimated arrival (date + transit)
  status: 'Delivered' | 'In transit' | 'Planned';
  productSku: string;
  productName: string;
  category: string;
  family: string;
  shu: number;
  customer: string;
  customerGroup: string;
  market: string;
  region: DestRegion;
  vendor: string;
  processor: string;
  vendorControllability: string;
  lsp: string;
  carrier: string;
  lspIntensityIndex: number;
  origin: string;
  originState: string;
  originPort: string;
  destPort: string;
  destCity: string;
  destCountry: string;
  modePath: ModeLabel[];
  primaryMode: ModeLabel;
  inlandMode: ModeLabel | null;
  weightTonnes: number;
  weightSharePct: number;
  isConsolidated: boolean;
  monthlyTrips: number;
  totalDistanceKm: number;
  oceanDistanceKm: number;
  roadDistanceKm: number;
  railDistanceKm: number;
  airDistanceKm: number;
  co2eTonnes: number;
  co2ePerTonne: number;
  realizedReductionPct: number;
  freightUsd: number;
  transitDays: number;
  dataConfidence: DataConfidence;
  airException: boolean;
  airAvoidable: boolean | null;
  reductionPotentialTonnes: number;
  /** Per-shipment CO₂e avoidable by routing current → best (no annualization). */
  avoidableTonnes: number;
  bestScenarioKind: string;
}

/** Full per-shipment record (lazy detail chunk). */
export interface ShipmentDetail extends Shipment {
  co2eGrossTonnes: number;
  legs: Leg[];
  scenarios: { current: Scenario; optimal: Scenario; balanced: Scenario; best: Scenario };
  recommendations: Recommendation[];
  hasOpenRecommendation: boolean;
}
