import type { ModeLabel } from './common';
import type { PersonaId } from './persona';

/**
 * Filter dimensions — every one of these is a column the workbook actually
 * records (or a direct derivation of one). There is no customer, vendor,
 * carrier or freight-cost dimension because the workbook holds none.
 */
export interface ShipmentFilters {
  regions?: string[];
  markets?: string[];
  categories?: string[];
  modes?: ModeLabel[];
  destPorts?: string[];
  gateways?: string[];
  reportingYears?: string[];
  dateFrom?: string; // YYYY-MM-DD inclusive
  dateTo?: string; // YYYY-MM-DD inclusive
  search?: string;
}

export interface ShipmentQuery extends ShipmentFilters {
  persona?: PersonaId;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

/**
 * A reporting year with the dispatch dates it actually spans.
 *
 * The workbook's tabs do not tile a clean Jul→Jun calendar — FY21-22 ends
 * 12 May 2022 and FY22-23 starts 1 Jun 2022 — so a preset cannot be derived from
 * the label. Deriving one swept June 2022 shipments into "FY21-22".
 */
export interface ReportingYearWindow {
  reportingYear: string;
  from: string; // YYYY-MM-DD, first dispatch on the tab
  to: string; // YYYY-MM-DD, last dispatch on the tab
}

export interface FilterOptions {
  regions: string[];
  markets: string[];
  categories: string[];
  modes: ModeLabel[];
  destPorts: string[];
  gateways: string[];
  reportingYears: string[];
  /** Real date span per reporting year, for the range presets. */
  reportingYearWindows: ReportingYearWindow[];
}
