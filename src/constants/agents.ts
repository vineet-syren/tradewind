import type { AgentCatalogEntry } from '@/types';

/** The decisioning agents surfaced across Tradewind. */
export const AGENT_CATALOG: AgentCatalogEntry[] = [
  {
    id: 'footprint',
    name: 'Footprint & Hotspot Agent',
    role: 'Baseline & hotspots',
    description: 'Builds the downstream-transport CO₂e baseline from shipment data and ranks the highest-emitting lanes, products, customers, ports and partners.',
    autonomy: 'auto',
    iconKey: 'hotspots',
  },
  {
    id: 'route-mode',
    name: 'Route & Mode Agent',
    role: 'Route, mode & port decisioning',
    description: 'Compares Optimal, Balanced and Best-for-CO₂ paths for every lane, balancing CO₂e, cost and transit time against SLAs.',
    autonomy: 'assisted',
    iconKey: 'decisioning',
  },
  {
    id: 'mode-governance',
    name: 'Mode Governance Agent',
    role: 'Air-exception control',
    description: 'Flags air shipments, classifies them as avoidable or justified, and proposes ocean alternatives with planning lead time.',
    autonomy: 'assisted',
    iconKey: 'air',
  },
  {
    id: 'consolidation',
    name: 'Consolidation Agent',
    role: 'Shipment consolidation',
    description: 'Finds small, frequent shipments that can be consolidated into full containers to cut trips and inland road legs.',
    autonomy: 'auto',
    iconKey: 'consolidation',
  },
  {
    id: 'partner',
    name: 'Partner Influence Agent',
    role: 'Vendor / processor / LSP',
    description: 'Maps emissions to vendors, processors and logistics providers and surfaces data-backed governance actions Terova can influence.',
    autonomy: 'assisted',
    iconKey: 'partners',
  },
  {
    id: 'evidence',
    name: 'Evidence & Reporting Agent',
    role: 'ESG evidence',
    description: 'Tracks estimated vs realized reductions and assembles report-ready, methodology-backed evidence for ESG and annual reporting.',
    autonomy: 'auto',
    iconKey: 'evidence',
  },
];
