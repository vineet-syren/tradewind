import type { ApproachKind, GeoCoord, ModeLabel } from './common';
import type { Leg } from './shipment';
import type { Recommendation } from './recommendation';

/** A decisioning scenario for a lane / shipment (Current + 3 alternatives). */
export interface Scenario {
  kind: ApproachKind;
  label: string;
  legs: Leg[];
  modePath: ModeLabel[];
  co2eTonnes: number;
  transitDays: number;
  freightUsd: number;
  tagline: string;
  transitBand: string;
  slaRisk: string;
  feasibility: string;
  narrative: string;
  co2eDeltaTonnes: number;
  co2eDeltaPct: number;
  costDeltaUsd: number;
  transitDeltaDays: number;
}

export interface LaneCoords {
  origin: GeoCoord;
  originPort: GeoCoord;
  destPort: GeoCoord;
  destCity: GeoCoord;
}

/** A shipping corridor (origin → destination port × product category). */
export interface Lane {
  laneId: string;
  label: string;
  origin: string;
  originState: string;
  originPort: string;
  destPort: string;
  destCity: string;
  destCountry: string;
  market: string;
  region: string;
  productCategory: string;
  customer: string;
  customerGroup: string;
  vendor: string;
  lsp: string;
  lspIntensityIndex: number;
  vendorControllability: string;
  primaryMode: ModeLabel;
  modePath: ModeLabel[];
  hasAirExceptions: boolean;
  airSharePct: number;
  airShipmentCount: number;
  shipmentCount: number;
  totalWeightTonnes: number;
  totalCo2eTonnes: number;
  /** Observed annual emissions (total ÷ years active) — ceiling for annual claims. */
  observedAnnualTonnes: number;
  avgCo2ePerTonne: number;
  /** True transport intensity — g CO₂e per tonne-kilometre. */
  avgCo2ePerTonneKm: number;
  annualFrequency: number;
  repWeightTonnes: number;
  currentPerShipmentTonnes: number;
  balancedPerShipmentTonnes: number;
  bestPerShipmentTonnes: number;
  optimalPerShipmentTonnes: number;
  reductionPotentialTonnes: number;
  reductionPotentialPct: number;
  realizableReductionTonnes: number;
  feasibilityFactor: number;
  recommendedApproach: ApproachKind;
  coords: LaneCoords;
}

export interface LaneDetail extends Lane {
  scenarios: { current: Scenario; optimal: Scenario; balanced: Scenario; best: Scenario };
  recommendations: Recommendation[];
  shipmentIds: string[];
}
