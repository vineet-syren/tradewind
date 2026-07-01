/** Enterprise carbon inventory — full GHG Protocol Scope 1 + 2 + 3. */

export type ScopeId = 'scope1' | 'scope2' | 'scope3';

export type DataQuality = 'primary' | 'secondary' | 'estimated';

/** One emission source line — a Scope 1/2 sub-source or a Scope 3 category (1–15). */
export interface InventoryCategory {
  id: string;
  scope: ScopeId;
  /** GHG Protocol category number 1–15 for Scope 3; null for Scope 1/2 sub-sources. */
  categoryNumber: number | null;
  name: string;
  co2eTonnes: number;
  /** Share of the whole org footprint. */
  pct: number;
  /** Share within its own scope. */
  scopePct: number;
  deltaPctVsBaseline: number;
  dataQuality: DataQuality;
  method: string;
  note: string;
  /** false for categories not applicable to the business (e.g. franchises). */
  relevant: boolean;
  /** true for the category measured bottom-up in the Transportation module (Cat 9). */
  trackedHere: boolean;
}

export interface ScopeSummary {
  scope: ScopeId;
  label: string;
  description: string;
  co2eTonnes: number;
  pct: number;
  deltaPctVsBaseline: number;
  categoryCount: number;
}

export interface InventoryYearPoint {
  year: number;
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
  /** SBTi-aligned linear reduction path value for the year. */
  targetTotal: number;
}

export interface CarbonTarget {
  name: string;
  baseYear: number;
  targetYear: number;
  scope12ReductionPct: number;
  scope3ReductionPct: number;
  targetTotalTonnes: number;
  milestoneTonnes: number;
  gapTonnes: number;
  onTrack: boolean;
  status: string;
}

export interface CarbonInventory {
  reportingYear: number;
  baselineYear: number;
  asOf: string;
  company: string;
  totalCo2eTonnes: number;
  totalBaselineTonnes: number;
  deltaPctVsBaseline: number;
  byScope: ScopeSummary[];
  categories: InventoryCategory[];
  byYear: InventoryYearPoint[];
  scope2: { marketBasedTonnes: number; locationBasedTonnes: number; renewablePct: number };
  intensity: { perRevenue: number; unit: string; revenueUsdM: number; deltaPct: number };
  dataQuality: { primaryPct: number; secondaryPct: number; estimatedPct: number };
  target: CarbonTarget;
}
