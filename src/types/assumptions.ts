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

export interface Assumptions {
  /** The day the app treats as "today" — the day after the workbook's last dispatch. */
  asOf: string;
  company: string;
  workbook: string;
  scope: string;
  /** First and last dispatch date anywhere in the workbook. */
  dataFrom: string;
  dataTo: string;
  reportingYears: string[];
  latestReportingYear: string;
  totalCo2eTonnes: number;
  latestYearCo2eTonnes: number;
  /** Speeds and dwell used to estimate transit days — the only non-workbook numbers. */
  transitEstimate: {
    note: string;
    kmPerDay: Record<string, number>;
    portDwellDays: number;
  };
  /** How the to-be-planned shipments were produced. */
  plannedBasis: string;
  /** Dimensions the workbook does not contain, so the app does not show them. */
  notInWorkbook: string[];
}
