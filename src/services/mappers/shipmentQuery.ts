/**
 * Scope, filter, sort and paginate shipments — the in-memory query layer a real
 * server would run before responding. UI never does this itself.
 */
import type { Paginated, PersonaId, Shipment, ShipmentFilters, ShipmentQuery } from '@/types';
import { APP_TODAY } from '@/constants/app';

/**
 * Persona scope. Terova's footprint is one company network, so every persona
 * sees the full set — the persona changes the lens, not the rows. Kept as a
 * seam so a real backend could scope by user without a UI change.
 */
export function scopeByPersona(shipments: Shipment[], _persona?: PersonaId): Shipment[] {
  void _persona;
  return shipments;
}

export function applyFilters(shipments: Shipment[], f?: ShipmentFilters): Shipment[] {
  const inSet = (v: string | number, arr?: (string | number)[]) => !arr?.length || arr.includes(v);
  const search = f?.search?.trim().toLowerCase();
  // Date window. With no range set we keep to what has already shipped, so
  // historical analytics never absorb the forward book; a range can reach ahead.
  const dateOk = (d: string) => {
    if (f?.dateFrom && d < f.dateFrom) return false;
    if (f?.dateTo && d > f.dateTo) return false;
    if (!f?.dateFrom && !f?.dateTo && d > APP_TODAY) return false;
    return true;
  };
  return shipments.filter(
    (s) =>
      dateOk(s.date) &&
      inSet(s.region, f?.regions) &&
      inSet(s.market, f?.markets) &&
      inSet(s.category, f?.categories) &&
      inSet(s.primaryMode, f?.modes) &&
      inSet(s.destPort, f?.destPorts) &&
      (!f?.gateways?.length || (s.gateway ? f.gateways.includes(s.gateway) : false)) &&
      inSet(s.reportingYear, f?.reportingYears) &&
      (!search ||
        s.productName.toLowerCase().includes(search) ||
        s.category.toLowerCase().includes(search) ||
        s.origin.toLowerCase().includes(search) ||
        s.destPort.toLowerCase().includes(search) ||
        s.market.toLowerCase().includes(search) ||
        (s.gateway ?? '').toLowerCase().includes(search) ||
        s.shipmentId.toLowerCase().includes(search)),
  );
}

export function scopeAndFilter(
  shipments: Shipment[],
  persona?: PersonaId,
  filters?: ShipmentFilters,
): Shipment[] {
  return applyFilters(scopeByPersona(shipments, persona), filters);
}

const SORTERS: Record<string, (a: Shipment, b: Shipment) => number> = {
  co2eTonnes: (a, b) => a.co2eTonnes - b.co2eTonnes,
  avoidableTonnes: (a, b) => a.avoidableTonnes - b.avoidableTonnes,
  weightTonnes: (a, b) => a.weightTonnes - b.weightTonnes,
  totalDistanceKm: (a, b) => a.totalDistanceKm - b.totalDistanceKm,
  co2ePerTonneKm: (a, b) => a.co2ePerTonneKm - b.co2ePerTonneKm,
  period: (a, b) => a.period.localeCompare(b.period),
  date: (a, b) => a.date.localeCompare(b.date),
  destPort: (a, b) => a.destPort.localeCompare(b.destPort),
  productName: (a, b) => a.productName.localeCompare(b.productName),
};

export function queryShipments(shipments: Shipment[], query: ShipmentQuery): Paginated<Shipment> {
  const filtered = scopeAndFilter(shipments, query.persona, query);
  const sortBy = query.sortBy ?? 'date';
  const dir = query.sortDir ?? 'desc';
  const sorter = SORTERS[sortBy] ?? SORTERS.date;
  const sorted = [...filtered].sort((a, b) => (dir === 'asc' ? sorter(a, b) : sorter(b, a)));
  const page = query.page ?? 0;
  const pageSize = query.pageSize ?? 25;
  const start = page * pageSize;
  return { items: sorted.slice(start, start + pageSize), total: sorted.length, page, pageSize };
}
