/**
 * Approximate "actual" routing for the map so ocean legs follow real sea
 * corridors (Suez, Gibraltar/Med, Panama, Malacca, Cape of Good Hope, Torres
 * Strait) and never cut across land. Waypoint chains are dense enough that every
 * straight segment between consecutive points stays over water. Self-contained
 * — no routing API. Short land/air legs get a gentle curve.
 */
import type { GeoCoord } from '@/types';

export type LatLng = [number, number];

// Open-ocean hubs the corridors fan out from.
const ARAB_HUB: LatLng = [13, 62]; // open Arabian Sea, well W of India
const BAY_HUB: LatLng = [8, 89]; //  open Bay of Bengal / NE Indian Ocean

// Port → hub approaches (kept over water; round the subcontinent when needed).
const ARAB_W: LatLng[] = [[20, 67], [15, 65]]; // W-coast port → Arabian Sea
const ARAB_E: LatLng[] = [[12, 84], [6, 82], [5, 78], [8, 70]]; // E-coast → round S of Sri Lanka
const BAY_W: LatLng[] = [[15, 69], [8, 73], [5, 78], [7, 84]]; // W-coast → round S → Bay
const BAY_E: LatLng[] = [[13, 84], [10, 87]]; // E-coast port → Bay

// Shared sub-chains.
const SUEZ: LatLng[] = [
  ARAB_HUB, [13, 55], [12.5, 48], [12.6, 43.4], [16, 42], [20, 38], [24, 36], [27.5, 34], [29.5, 32.8], [30.6, 32.4], [31.6, 32.2], [32.2, 31.5],
]; // Arabian Sea → Aden → Bab-el-Mandeb → Red Sea → Gulf of Suez → Canal → Port Said
const MED_GIB: LatLng[] = [[33.5, 28], [34.5, 22], [36.5, 16], [37.3, 11.6], [38, 7], [37.5, 2], [36, -2], [35.95, -5.6]]; // Med (S of Crete/Italy) → Sicily channel → Alboran → Gibraltar
const ATL_NEUR: LatLng[] = [[36, -9], [40, -11], [44.5, -9.5], [48, -6.5], [49.8, -4], [50.6, -0.5]]; // Cape St Vincent → off Portugal → Biscay → Channel

const EAST_DESTS = new Set(['Laem Chabang', 'Guangzhou', 'Shanghai', 'Singapore', 'Tokyo', 'Busan', 'Sydney']);

// From the relevant hub to (just before) each destination port.
const CORRIDOR: Record<string, LatLng[]> = {
  Antwerp: [...SUEZ, ...MED_GIB, ...ATL_NEUR, [51.4, 3.2]],
  Rotterdam: [...SUEZ, ...MED_GIB, ...ATL_NEUR, [52, 3.6]],
  Felixstowe: [...SUEZ, ...MED_GIB, [36, -9], [40, -11], [44.5, -9.5], [48, -6.5], [49.8, -4], [50.6, 0.3], [51.4, 1.5]],
  Hamburg: [...SUEZ, ...MED_GIB, ...ATL_NEUR, [52, 3.6], [54, 7], [54, 8.4]],
  Genoa: [...SUEZ, [33.5, 28], [34.5, 22], [37, 17], [39, 13.5], [41, 10], [43, 9]],
  'New York': [...SUEZ, ...MED_GIB, [36, -9], [38, -20], [39, -40], [40, -58], [40.4, -71]],
  Savannah: [...SUEZ, ...MED_GIB, [36, -9], [37, -25], [35, -50], [33, -70], [32, -78.5]],
  Houston: [...SUEZ, ...MED_GIB, [35, -9], [33, -25], [28, -52], [26, -72], [24.3, -79.6], [25, -84], [27.5, -90], [29, -94]],
  'Los Angeles': [
    ...SUEZ, ...MED_GIB, [34, -10], [26, -30], [18, -52], [15, -62], [13, -68], [11, -74], [10, -78], [9.4, -79.8], [8.8, -79.7], [9, -83], [13, -92], [17, -103], [24, -113], [31, -119],
  ],
  'Jebel Ali': [ARAB_HUB, [20, 61], [24, 58.8], [25.5, 56.9], [25.9, 56.3], [25.3, 55.4]],
  Santos: [ARAB_HUB, [8, 60], [0, 58], [-12, 53], [-25, 46], [-33, 33], [-36, 25], [-37, 15], [-33, 4], [-27, -8], [-25, -25], [-24, -40]],
  'Laem Chabang': [BAY_HUB, [6, 93], [4, 97], [2.5, 100], [1.4, 104], [4, 103.2], [8, 101.6], [11, 100.9]],
  Guangzhou: [BAY_HUB, [6, 94], [4, 99], [1.5, 104], [5, 106], [10, 110], [16, 112.5], [20, 113.5], [22, 113.8]],
  Shanghai: [BAY_HUB, [6, 95], [3, 100], [1.5, 104], [6, 107], [12, 111], [18, 116], [24, 120], [29, 122.6]],
  Singapore: [BAY_HUB, [5, 95], [3, 99], [1.6, 103.9]],
  Tokyo: [BAY_HUB, [5, 96], [2, 103], [1.5, 104.6], [6, 109], [14, 116], [22, 124], [28, 131], [33, 137]],
  Busan: [BAY_HUB, [5, 96], [2, 103], [1.5, 104.6], [7, 110], [15, 118], [24, 124], [30, 126.5], [33, 128.6]],
  Sydney: [BAY_HUB, [3, 98], [0, 103], [-3, 107], [-7, 114], [-9, 123], [-10, 134], [-10.6, 142.6], [-15, 147], [-24, 153.6], [-31, 153.6]],
};

/** Routed ocean polyline (origin port → sea corridors → destination port). */
export function oceanRoute(destPort: string, origin: GeoCoord, dest: GeoCoord): LatLng[] {
  const eastBound = EAST_DESTS.has(destPort);
  const west = origin.lon < 78;
  const approach: LatLng[] = eastBound ? (west ? BAY_W : BAY_E) : west ? ARAB_W : ARAB_E;
  const corridor = CORRIDOR[destPort];
  if (!corridor) return [[origin.lat, origin.lon], [dest.lat, dest.lon]];
  return [[origin.lat, origin.lon], ...approach, ...corridor, [dest.lat, dest.lon]];
}

/** Gentle quadratic-bezier curve for short land/air legs (never dead straight). */
export function landCurve(a: GeoCoord, b: GeoCoord, bow = 0.16): LatLng[] {
  const mLat = (a.lat + b.lat) / 2;
  const mLon = (a.lon + b.lon) / 2;
  const dLat = b.lat - a.lat;
  const dLon = b.lon - a.lon;
  const dist = Math.hypot(dLat, dLon) || 1;
  const cLat = mLat + (-dLon / dist) * dist * bow;
  const cLon = mLon + (dLat / dist) * dist * bow;
  const pts: LatLng[] = [];
  for (let t = 0; t <= 1.0001; t += 0.1) {
    const u = 1 - t;
    pts.push([u * u * a.lat + 2 * u * t * cLat + t * t * b.lat, u * u * a.lon + 2 * u * t * cLon + t * t * b.lon]);
  }
  return pts;
}

/** Midpoint of a polyline (for placing an icon). */
export function midOf(pts: LatLng[]): LatLng {
  return pts.length ? pts[Math.floor(pts.length / 2)] : [0, 0];
}
