/** Recompute carrier (LSP) and vendor partner stats from a scoped shipment set. */
import type { LspPartner, Partners, Shipment, VendorPartner } from '@/types';

const round = (n: number, dp = 2) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

const GREENEST_INDEX = 0.88; // best fleet intensity available in the network

/**
 * Stable partner code derived from the name (djb2 hash → 3 digits), so the same
 * partner keeps the same ID regardless of the active filter set.
 */
function partnerCode(prefix: string, name: string): string {
  let h = 5381;
  for (let i = 0; i < name.length; i++) h = ((h << 5) + h + name.charCodeAt(i)) >>> 0;
  return `${prefix}-${String(100 + (h % 900))}`;
}

export function buildPartners(shipments: Shipment[]): Partners {
  const lspAgg = new Map<string, { name: string; carrier: string; intensityIndex: number; co2e: number; weight: number; ships: number }>();
  const vAgg = new Map<string, { name: string; origin: string; controllability: string; co2e: number; weight: number; ships: number }>();
  const yearAgg = new Map<number, Record<string, number>>();

  for (const s of shipments) {
    const l = lspAgg.get(s.lsp) ?? { name: s.lsp, carrier: s.carrier, intensityIndex: s.lspIntensityIndex, co2e: 0, weight: 0, ships: 0 };
    l.co2e += s.co2eTonnes;
    l.weight += s.weightTonnes;
    l.ships += 1;
    lspAgg.set(s.lsp, l);

    const v = vAgg.get(s.vendor) ?? { name: s.vendor, origin: s.origin, controllability: s.vendorControllability, co2e: 0, weight: 0, ships: 0 };
    v.co2e += s.co2eTonnes;
    v.weight += s.weightTonnes;
    v.ships += 1;
    vAgg.set(s.vendor, v);

    const yr = yearAgg.get(s.year) ?? {};
    yr[s.lsp] = (yr[s.lsp] ?? 0) + s.co2eTonnes;
    yearAgg.set(s.year, yr);
  }

  const lspTrend = [...yearAgg.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, values]) => ({
      year,
      values: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, round(v)])),
    }));

  // YoY per carrier — compare the last two COMPLETE years (the max year is
  // usually a partial year in progress, which would fake a collapse).
  const years = lspTrend.map((t) => t.year);
  const maxYear = years[years.length - 1];
  const fullYears = years.filter((y) => y < maxYear);
  const [prevY, lastY] = fullYears.slice(-2);
  const yoyFor = (lsp: string): number | null => {
    if (lastY == null || prevY == null) return null;
    const prev = lspTrend.find((t) => t.year === prevY)?.values[lsp] ?? 0;
    const last = lspTrend.find((t) => t.year === lastY)?.values[lsp] ?? 0;
    if (prev <= 0) return null;
    return round(((last - prev) / prev) * 100, 1);
  };

  const lsps: LspPartner[] = [...lspAgg.values()]
    .map((l) => ({
      id: partnerCode('CAR', l.name),
      name: l.name,
      carrier: l.carrier,
      intensityIndex: l.intensityIndex,
      greenProgram: l.intensityIndex < 0.95,
      co2eTonnes: round(l.co2e),
      weightTonnes: round(l.weight),
      shipments: l.ships,
      co2ePerTonne: round(l.co2e / Math.max(l.weight, 0.001), 3),
      // Saving if this carrier's volume moved to the greenest fleet.
      influenceableSavingTonnes: round(l.co2e * Math.max(0, l.intensityIndex - GREENEST_INDEX) * 0.5, 2),
      yoyChangePct: yoyFor(l.name),
    }))
    .sort((a, b) => b.co2eTonnes - a.co2eTonnes);

  const vendors: VendorPartner[] = [...vAgg.values()]
    .map((v) => ({
      id: partnerCode('VEN', v.name),
      name: v.name,
      origin: v.origin,
      controllability: v.controllability,
      co2eTonnes: round(v.co2e),
      weightTonnes: round(v.weight),
      shipments: v.ships,
      co2ePerTonne: round(v.co2e / Math.max(v.weight, 0.001), 3),
      // Influenceable via governance — more where Terova has less direct control.
      influenceableSavingTonnes: round(v.co2e * (v.controllability === 'High' ? 0.08 : v.controllability === 'Medium' ? 0.16 : 0.22), 2),
    }))
    .sort((a, b) => b.co2eTonnes - a.co2eTonnes);

  return { vendors, lsps, lspTrend };
}
