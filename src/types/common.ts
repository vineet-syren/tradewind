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
 * on at least one shipment — none is a hypothetical routing. Each is one lever,
 * and each changes exactly what its name says: only a gateway swap moves both
 * the inland run and the sailing, because it has to.
 *  - `current`             the route as recorded
 *  - `shorter-first-mile`  same gateway and sailing, on a shorter factory-to-port run the workbook records
 *  - `shorter-sea`         same first mile and ports, on the shorter sailing recorded for that pair
 *  - `gateway-swap`        leave India through a different gateway port, on the inland chain that gateway uses
 *  - `sea-instead-of-air`  the ocean routing recorded to the same destination country
 *  - `consolidate`         share one truck run with same-day shipments through the same gateway
 */
export type OptionKind =
  | 'current'
  | 'shorter-first-mile'
  | 'gateway-swap'
  | 'shorter-sea'
  | 'sea-instead-of-air'
  | 'consolidate';

export type Complexity = 'Low' | 'Medium' | 'High';
export type DataConfidence = 'High' | 'Medium' | 'Low';

/**
 * Where a row came from.
 *  - `workbook`  read from Transport Downstream- V02.xlsx (Jul 2021 – Jun 2024)
 *  - `synthetic` a recorded shipment mirrored forward three years to bridge the
 *                gap between the workbook and today, and to give a forward book.
 *                Product, weight, gateway, distances and factors are the real
 *                shipment's; only the dates move.
 *
 * Nothing that claims to tie back to the sheet — the reconciliation, the ESG
 * report — may include a `synthetic` row.
 */
export type DataOrigin = 'workbook' | 'synthetic';

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
