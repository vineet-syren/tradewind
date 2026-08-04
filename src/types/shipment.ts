import type { DataConfidence, DestRegion, GeoCoord, Mode, ModeLabel, Stream } from './common';
import type { RouteOption } from './lane';
import type { Recommendation } from './recommendation';

/**
 * One movement leg with the full CO₂e calculation as the workbook states it.
 *
 * Road is charged per truck trip (kg CO₂e per km, independent of load), while
 * rail, ocean and air are charged per tonne-kilometre. `efBasis` says which,
 * because it is the single most important thing to grasp when comparing
 * options: a 400 kg truck run costs exactly what a 25-tonne one does.
 */
export interface Leg {
  seq: number;
  mode: Mode;
  modeLabel: ModeLabel;
  from: string;
  to: string;
  fromCoord: GeoCoord;
  toCoord: GeoCoord;
  distanceKm: number;
  /** Nautical miles as recorded for ocean legs; null for other modes. */
  distanceNm: number | null;
  emissionFactor: number;
  efUnit: string;
  efBasis: 'per-truck-km' | 'per-tonne-km';
  weightTonnes: number;
  co2eTonnes: number;
  fuelLitres: number | null;
  fuelType: string | null;
  /** Estimated from distance, not from the workbook — see `Assumptions.transitEstimate`. */
  transitDaysEst: number;
  /** Workbook cell range this leg was read from, e.g. "2022-2024!N12:Y12". */
  sourceRef: string;
}

/** Lightweight shipment fact (the index row). */
export interface Shipment {
  shipmentId: string;
  laneId: string;
  stream: Stream;
  /** Workbook tab this came from, as its reporting-year label (e.g. "FY23-24"). */
  reportingYear: string;
  period: string; // YYYY-MM
  year: number;
  date: string; // YYYY-MM-DD — dispatch date
  /**
   * Estimated arrival = dispatch + estimated transit. The workbook records no
   * arrival date, so this is derived and carries the same caveat as
   * `transitDaysEst`; no CO₂e depends on it.
   */
  eta: string; // YYYY-MM-DD
  status: 'Delivered' | 'Planned';
  productSku: string;
  productName: string;
  /** Ground / Crushed / Whole, parsed from the workbook's item description. */
  productForm: string;
  category: string;
  /** Scoville heat units parsed from the item description; null when absent. */
  shu: number | null;
  origin: string;
  /** Gateway port the export leaves India through; null for collection movements. */
  gateway: string | null;
  /** Inland container depot used, when the chain routes through one. */
  icd: string | null;
  destPort: string;
  destCountry: string;
  market: string;
  region: DestRegion;
  containerType: string | null;
  modePath: ModeLabel[];
  primaryMode: ModeLabel;
  weightTonnes: number;
  truckTrips: number;
  roadKm: number;
  railKm: number;
  oceanKm: number;
  airKm: number;
  totalDistanceKm: number;
  fuelLitres: number;
  co2eTonnes: number;
  roadCo2eTonnes: number;
  railCo2eTonnes: number;
  oceanCo2eTonnes: number;
  airCo2eTonnes: number;
  co2ePerTonne: number;
  /** Transport intensity — g CO₂e per tonne-kilometre. */
  co2ePerTonneKm: number;
  transitDaysEst: number;
  dataConfidence: DataConfidence;
  /** True when any leg flew. */
  isAirFreight: boolean;
  /** CO₂e this shipment could avoid on the best workbook-evidenced option. */
  avoidableTonnes: number;
  avoidablePct: number;
  /** The option that achieves `avoidableTonnes`; null when none is evidenced. */
  bestOptionKind: string | null;
  bestOptionLabel: string | null;
  sourceRef: string;
  /** Planned rows are rolled forward from a real shipment — this is its cell range. */
  derivedFromRef: string | null;
}

/** Full per-shipment record (lazy detail chunk). */
export interface ShipmentDetail extends Shipment {
  legs: Leg[];
  /** `current` first, then every option the workbook evidences for this route. */
  options: RouteOption[];
  recommendations: Recommendation[];
}
