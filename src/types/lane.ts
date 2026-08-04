import type { GeoCoord, ModeLabel, OptionKind } from './common';
import type { Leg } from './shipment';
import type { Recommendation } from './recommendation';

/**
 * One route the workbook evidences for a shipment, priced in CO₂e using the
 * workbook's own distances and emission factors.
 *
 * `evidence` is the sentence shown to justify the option and `evidenceRefs` are
 * the workbook cell ranges behind it. An option only exists here when the
 * workbook records every leg it uses — there are no hypothetical routings.
 */
export interface RouteOption {
  /**
   * Unique within a shipment's option list. A shipment can have two options of
   * the same `kind` — two different gateways, or two recorded sailings for one
   * port pair — so selection and React keys must use this, not `kind`.
   */
  id: string;
  kind: OptionKind;
  label: string;
  tagline: string;
  legs: Leg[];
  modePath: ModeLabel[];
  gateway: string | null;
  co2eTonnes: number;
  distanceKm: number;
  /** Estimated from distance — not a workbook figure. */
  transitDaysEst: number;
  co2eDeltaTonnes: number;
  co2eDeltaPct: number;
  transitDeltaDays: number;
  /** How many workbook shipments already moved this way. */
  timesUsedInWorkbook: number;
  evidence: string;
  evidenceRefs: string[];
  isCurrent: boolean;
}

export interface LaneCoords {
  origin: GeoCoord;
  gateway: GeoCoord;
  destPort: GeoCoord;
}

/** A shipping corridor — destination port × product category. */
export interface Lane {
  laneId: string;
  label: string;
  origin: string;
  destPort: string;
  destCountry: string;
  market: string;
  region: string;
  category: string;
  productForm: string;
  /** Gateways this lane has actually used, most-used first. */
  gateways: string[];
  primaryGateway: string;
  primaryMode: ModeLabel;
  modePath: ModeLabel[];
  hasAirFreight: boolean;
  airShipmentCount: number;
  /** Share of this lane's CO₂e that came from shipments that flew (%). */
  airSharePct: number;
  shipmentCount: number;
  /** Shipments per reporting year the lane was active — the annualisation basis. */
  annualFrequency: number;
  plannedShipmentCount: number;
  totalWeightTonnes: number;
  totalCo2eTonnes: number;
  /** Total ÷ reporting years the lane was active — the ceiling for annual claims. */
  annualCo2eTonnes: number;
  avgCo2ePerTonne: number;
  /** Transport intensity — g CO₂e per tonne-kilometre. */
  avgCo2ePerTonneKm: number;
  avgWeightTonnes: number;
  /** CO₂e avoidable across this lane's shipments on the best evidenced option. */
  avoidableTonnes: number;
  avoidablePct: number;
  /** Same, restricted to shipments still to be planned. */
  plannedAvoidableTonnes: number;
  bestOptionKind: string | null;
  bestOptionLabel: string | null;
  /** CO₂e for a representative shipment on the route as booked today. */
  currentPerShipmentTonnes: number;
  /** Same shipment on the best workbook-evidenced option. */
  bestPerShipmentTonnes: number;
  coords: LaneCoords;
}

export interface LaneDetail extends Lane {
  /** Options for a representative shipment on this lane. */
  options: RouteOption[];
  recommendations: Recommendation[];
  shipmentIds: string[];
}
