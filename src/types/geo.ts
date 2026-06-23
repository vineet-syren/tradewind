/** Geocoded place dictionary (origins, ports, destinations) for the world map. */
export interface GeoPlace {
  lat: number;
  lon: number;
  kind: 'origin' | 'port' | 'dest';
  country: string;
  state?: string;
  region?: string;
  portCode?: string;
}

export type GeoDictionary = Record<string, GeoPlace>;

/** Emission-factor reference row (methodology page). */
export interface EmissionFactorRow {
  id: string;
  mode: string;
  basis: string;
  value: number;
  unit: string;
  source: string;
  note: string;
}
