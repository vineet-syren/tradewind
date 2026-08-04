/** Cross-cutting primitives shared across domain contracts. */

export type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

export type Intent = 'positive' | 'negative' | 'neutral' | 'opportunity' | 'risk';
export type Severity = 'High' | 'Medium' | 'Low';

/** Transport modes, as the workbook's five modal blocks record them. */
export type Mode = 'road' | 'rail' | 'ocean' | 'air';
export type ModeLabel = 'Road' | 'Rail' | 'Ocean' | 'Air';

/** Destination market grouping, derived from the workbook's destination ports. */
export type DestRegion = 'Americas' | 'Europe' | 'APAC';

/**
 * The movements the workbook tracks: `export` is the outbound chain
 * (factory → ICD → gateway port → destination port), `collection` is the
 * first-mile road runs that bring raw chilli in from the growing regions.
 */
export type Stream = 'export' | 'collection';

/**
 * A route option. Every kind below is something the workbook itself evidences
 * on at least one shipment — none is a hypothetical routing.
 *  - `current`            the route as recorded
 *  - `gateway-swap`       leave India through a different gateway port, on the inland chain that gateway uses
 *  - `shorter-sea`        the shorter sailing recorded for the same two ports
 *  - `sea-instead-of-air` the ocean routing recorded to the same destination country
 *  - `consolidate`        share one truck run with same-day shipments through the same gateway
 */
export type OptionKind = 'current' | 'gateway-swap' | 'shorter-sea' | 'sea-instead-of-air' | 'consolidate';

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
