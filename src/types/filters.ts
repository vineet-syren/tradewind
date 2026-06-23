import type { ApproachKind, ModeLabel } from './common';
import type { PersonaId } from './persona';

export interface ShipmentFilters {
  regions?: string[];
  markets?: string[];
  productCategories?: string[];
  modes?: ModeLabel[];
  customers?: string[];
  vendors?: string[];
  lsps?: string[];
  originPorts?: string[];
  years?: number[];
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
  productCategories: string[];
  modes: ModeLabel[];
  customers: string[];
  vendors: string[];
  lsps: string[];
  originPorts: string[];
  years: number[];
  approaches: ApproachKind[];
}
