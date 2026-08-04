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

export interface FilterOptions {
  regions: string[];
  markets: string[];
  categories: string[];
  modes: ModeLabel[];
  destPorts: string[];
  gateways: string[];
  reportingYears: string[];
}
