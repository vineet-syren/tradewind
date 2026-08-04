/**
 * The bridge from the total the workbook prints for a tab to the total the app
 * reports. Every line is a number read out of the workbook, so the two figures
 * can be tied out to the last kilogram.
 */
export interface ReconciliationStep {
  label: string;
  co2eTonnes: number;
  /** Why this line exists — shown under the label. */
  note: string;
}

/** One reporting year, reconciled against the figure the workbook itself prints. */
export interface ReportingYearFootprint {
  reportingYear: string;
  /** Workbook tab the year comes from. */
  tab: string;
  /** Window of dispatch dates actually present on that tab. */
  from: string;
  to: string;
  /** What the app reports — every leg it attributes to a shipment. */
  allLegsCo2eTonnes: number;
  /** The total the workbook prints in cell D53 of the tab. */
  reportedCo2eTonnes: number;
  /** Ordered bridge from `reportedCo2eTonnes` to `allLegsCo2eTonnes`. */
  reconciliation: ReconciliationStep[];
  /** One-line summary, or null when the two totals already agree exactly. */
  reconciliationNote: string | null;
  weightTonnes: number;
  shipments: number;
  intensity: number;
}

export interface MonthlyPoint {
  period: string;
  co2eTonnes: number;
  weightTonnes: number;
  intensity: number;
  /** CO₂e that month that a workbook-evidenced option would have avoided. */
  avoidableTonnes: number;
  /**
   * What the month would have been had every shipment taken its best evidenced
   * option. The workbook holds no counterfactual baseline, so this — not an
   * invented "business as usual" line — is what the trend is measured against.
   */
  ifBestTonnes: number;
}

export interface Methodology {
  formula: string;
  roadBasis: string;
  distance: string;
  factors: string;
  scope: string;
  boundary: string;
}

/** ESG / annual-report evidence pack, fully traceable to the workbook. */
export interface EsgEvidence {
  workbook: string;
  workbookTitle: string;
  baselineYear: string;
  latestYear: string;
  years: ReportingYearFootprint[];
  /** Change from the first reporting year to the latest (%), negative is a cut. */
  changeSinceBaselinePct: number;
  monthly: MonthlyPoint[];
  methodology: Methodology;
  /** Verbatim data-source notes the workbook prints under its tables. */
  dataSourceNotes: string[];
  assumptions: string[];
}
