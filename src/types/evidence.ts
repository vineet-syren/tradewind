export interface MonthlyPoint {
  period: string;
  grossTonnes: number;
  netTonnes: number;
  avoidedTonnes: number;
  intensity: number;
}

export interface YearFootprint {
  year: number;
  grossTonnes: number;
  netTonnes: number;
  weightTonnes: number;
  intensity: number;
}

export interface Methodology {
  formula: string;
  distance: string;
  allocation: string;
  factors: string;
  scope: string;
}

/** ESG / annual-report evidence pack. */
export interface EsgEvidence {
  baselineYear: number;
  latestYear: number;
  baseline: YearFootprint;
  latest: YearFootprint;
  realizedReductionPct: number;
  ambitionPct: number;
  monthly: MonthlyPoint[];
  methodology: Methodology;
  assumptions: string[];
}
