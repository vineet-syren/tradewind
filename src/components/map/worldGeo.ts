/**
 * Simplified continent outlines in [lon, lat], drawn with the same
 * equirectangular projection as the plotted shipment coordinates so cities land
 * on the right landmasses. Stylized (low-detail) but self-contained — no map
 * library or external tiles.
 */
export const CONTINENTS: [number, number][][] = [
  // North America (+ Greenland-ish)
  [
    [-165, 60], [-168, 65], [-156, 71], [-130, 70], [-122, 73], [-95, 72], [-82, 73],
    [-62, 82], [-45, 82], [-38, 73], [-55, 66], [-65, 60], [-60, 47], [-70, 43],
    [-81, 31], [-90, 29], [-97, 26], [-107, 23], [-117, 32], [-124, 40], [-130, 54],
    [-150, 59], [-165, 60],
  ],
  // South America
  [
    [-81, 8], [-72, 11], [-60, 6], [-50, 0], [-44, -3], [-35, -7], [-39, -15], [-48, -25],
    [-58, -35], [-66, -45], [-73, -52], [-75, -45], [-71, -30], [-70, -18], [-78, -5], [-81, 8],
  ],
  // Europe
  [
    [-10, 43], [-9, 38], [-2, 36], [3, 42], [9, 44], [12, 38], [18, 40], [28, 41], [30, 46],
    [40, 48], [40, 60], [25, 66], [10, 63], [5, 58], [-5, 58], [-10, 51], [-10, 43],
  ],
  // Africa
  [
    [-16, 15], [-17, 21], [-10, 28], [-5, 32], [10, 34], [24, 32], [33, 31], [43, 12],
    [51, 12], [42, -2], [40, -15], [33, -26], [25, -34], [18, -35], [12, -16], [9, 4],
    [-8, 5], [-16, 15],
  ],
  // Asia (Middle East → Siberia → Japan → SE Asia)
  [
    [26, 40], [35, 37], [45, 40], [48, 30], [57, 25], [60, 25], [67, 25], [70, 21],
    [73, 19], [77, 8], [80, 13], [82, 17], [88, 22], [92, 21], [98, 10], [104, 1],
    [110, 9], [109, 18], [122, 30], [122, 41], [130, 43], [135, 35], [140, 36], [145, 45],
    [143, 53], [160, 61], [180, 66], [172, 70], [140, 73], [100, 77], [70, 76], [60, 68],
    [50, 55], [44, 47], [35, 45], [28, 45], [26, 40],
  ],
  // Oceania (Australia)
  [
    [114, -22], [122, -18], [130, -12], [137, -12], [142, -11], [146, -18], [150, -25],
    [153, -28], [150, -37], [143, -39], [135, -35], [129, -32], [123, -34], [115, -34],
    [113, -26], [114, -22],
  ],
];

// Projection band — crops the empty deep-polar/Antarctic rows for a tighter map.
export const PROJ = { latTop: 80, latBot: -58, width: 1000 };
export const PROJ_HEIGHT = (PROJ.width * (PROJ.latTop - PROJ.latBot)) / 360; // ≈ 383

export function project(lon: number, lat: number): { x: number; y: number } {
  const x = ((lon + 180) / 360) * PROJ.width;
  const y = ((PROJ.latTop - lat) / (PROJ.latTop - PROJ.latBot)) * PROJ_HEIGHT;
  return { x, y };
}

export function polygonToPath(points: [number, number][]): string {
  return (
    points
      .map(([lon, lat], i) => {
        const { x, y } = project(lon, lat);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ') + ' Z'
  );
}

/** Quadratic-bezier great-circle-ish arc between two projected points. */
export function arcPath(a: { x: number; y: number }, b: { x: number; y: number }, lift = 0.18): string {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 1;
  const px = -dy / dist;
  const py = dx / dist;
  const cx = mx + px * dist * lift;
  const cy = my + py * dist * lift;
  return `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
}

/** Midpoint of the quadratic arc (for placing mode icons). */
export function arcMidpoint(a: { x: number; y: number }, b: { x: number; y: number }, lift = 0.18) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 1;
  const cx = mx + (-dy / dist) * dist * lift;
  const cy = my + (dx / dist) * dist * lift;
  // Point at t=0.5 on the quadratic curve.
  return { x: 0.25 * a.x + 0.5 * cx + 0.25 * b.x, y: 0.25 * a.y + 0.5 * cy + 0.25 * b.y };
}
