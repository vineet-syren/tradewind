/** Geocoded place dictionary for the map — every place named in the workbook. */
export interface GeoPlace {
  lat: number;
  lon: number;
  kind: 'origin' | 'icd' | 'gateway' | 'dest' | 'growing-region';
  country: string;
  state?: string;
  region?: string;
}

export type GeoDictionary = Record<string, GeoPlace>;
