/** Recompute carrier (LSP) and vendor partner stats from a scoped shipment set. */
import type { LspPartner, Partners, Shipment, VendorPartner } from '@/types';

const round = (n: number, dp = 2) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

const GREENEST_INDEX = 0.88; // best fleet intensity available in the network

export function buildPartners(shipments: Shipment[]): Partners {
  const lspAgg = new Map<string, { name: string; carrier: string; intensityIndex: number; co2e: number; weight: number; ships: number }>();
  const vAgg = new Map<string, { name: string; origin: string; controllability: string; co2e: number; weight: number; ships: number }>();

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
  }

  const lsps: LspPartner[] = [...lspAgg.values()]
    .map((l) => ({
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
    }))
    .sort((a, b) => b.co2eTonnes - a.co2eTonnes);

  const vendors: VendorPartner[] = [...vAgg.values()]
    .map((v) => ({
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

  return { vendors, lsps };
}
