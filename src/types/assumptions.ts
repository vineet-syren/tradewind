import type { DataOrigin } from './common';

/** Emission factor as the workbook states it, with the basis spelled out. */
export interface EmissionFactorRow {
  id: string;
  mode: string;
  value: number;
  unit: string;
  basis: 'per-truck-km' | 'per-tonne-km';
  note: string;
  /** A workbook cell range where this factor appears. */
  sourceRef: string;
}

/** A reporting year on screen and where its rows come from. */
export interface ReportingYearOrigin {
  reportingYear: string;
  dataOrigin: DataOrigin;
  /** For synthetic years, the recorded year they mirror. */
  mirrorsReportingYear: string | null;
}

export interface Assumptions {
  /** The day the app treats as "today". */
  asOf: string;
  company: string;
  workbook: string;
  scope: string;
  /** First and last dispatch date recorded in the workbook. */
  dataFrom: string;
  dataTo: string;
  /** First and last date on screen — recorded data plus the synthetic bridge. */
  timelineFrom: string;
  timelineTo: string;
  /** Recorded reporting years only. */
  reportingYears: string[];
  reportingYearOrigins: ReportingYearOrigin[];
  latestReportingYear: string;
  /** Recorded CO₂e only — synthetic rows are excluded from this figure. */
  totalCo2eTonnes: number;
  latestYearCo2eTonnes: number;
  syntheticCo2eTonnes: number;
  syntheticShipmentCount: number;
  workbookShipmentCount: number;
  /** Speeds and dwell used to estimate transit days — the only non-workbook numbers. */
  transitEstimate: {
    note: string;
    kmPerDay: Record<string, number>;
    portDwellDays: number;
  };
  /** How the synthetic bridge between the workbook and today was produced. */
  syntheticBasis: string;
  /** How the to-be-planned shipments were produced. */
  plannedBasis: string;
  /** Dimensions the workbook does not contain, so the app does not show them. */
  notInWorkbook: string[];
}
