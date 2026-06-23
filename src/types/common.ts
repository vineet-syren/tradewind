/** Cross-cutting primitives shared across domain contracts. */

export type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

export type Intent = 'positive' | 'negative' | 'neutral' | 'opportunity' | 'risk';
export type Severity = 'High' | 'Medium' | 'Low';

/** Transport modes. */
export type Mode = 'road' | 'rail' | 'ocean' | 'air';
export type ModeLabel = 'Road' | 'Rail' | 'Ocean' | 'Air';

/** Destination market grouping. */
export type DestRegion = 'Americas' | 'Europe' | 'APAC' | 'Middle East';

/** Decisioning approaches (route_mode_decision.png). */
export type ApproachKind = 'current' | 'optimal' | 'balanced' | 'best_co2';

export type Controllability = 'Direct (Terova)' | 'Influence (partner)';
export type Complexity = 'Low' | 'Medium' | 'High';
export type DataConfidence = 'High' | 'Medium' | 'Low';

export interface GeoCoord {
  lat: number;
  lon: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
