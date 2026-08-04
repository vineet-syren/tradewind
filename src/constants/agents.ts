import type { AgentCatalogEntry } from '@/types';

/**
 * What the app does to the workbook, described as the four jobs it performs.
 * Each one is a real step in `scripts/generate-mock-data.mjs`, not a promise.
 */
export const AGENT_CATALOG: AgentCatalogEntry[] = [
  {
    id: 'ingest',
    name: 'Workbook reader',
    role: 'Rebuild shipments from the sheet',
    description:
      'Reads all five modal blocks on each year tab and rejoins them into whole shipments — factory to depot, depot to gateway, then the sailing or flight. Every leg keeps the cell range it came from, and each tab is tied back to the total the workbook itself prints.',
    autonomy: 'auto',
    iconKey: 'evidence',
  },
  {
    id: 'hotspots',
    name: 'Hotspot finder',
    role: 'Where the carbon sits',
    description:
      'Ranks CO₂e by product, destination port, gateway, market and mode, and separates the export chain from the first-mile collection runs.',
    autonomy: 'auto',
    iconKey: 'hotspots',
  },
  {
    id: 'options',
    name: 'Route option pricer',
    role: 'What else the workbook proves is possible',
    description:
      'Re-costs each shipment through leg chains the workbook records for other shipments, using its own distances and emission factors. An option only appears if every leg it needs exists in the sheet.',
    autonomy: 'auto',
    iconKey: 'decisioning',
  },
  {
    id: 'exceptions',
    name: 'Exception watch',
    role: 'Air, part loads and data faults',
    description:
      'Flags shipments that flew, dedicated truck runs carrying a fraction of a load, and rows the workbook duplicates or contradicts itself on.',
    autonomy: 'auto',
    iconKey: 'air',
  },
];
