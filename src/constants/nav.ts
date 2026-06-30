/** Sidebar navigation config — menu as metadata. Sidebar + router derive from here. */
export interface NavItemDef {
  label: string;
  to: string;
  iconKey: string;
}

export interface NavGroupDef {
  heading: string;
  items: NavItemDef[];
}

export const NAV_GROUPS: NavGroupDef[] = [
  {
    heading: '',
    items: [{ label: 'Carbon Copilot', to: '/', iconKey: 'copilot' }],
  },
  {
    heading: 'VISIBILITY',
    items: [
      { label: 'Shipment Route Map', to: '/decisioning', iconKey: 'decisioning' },
      { label: 'Shipment Ledger', to: '/ledger', iconKey: 'ledger' },
      { label: 'Emission Hotspots', to: '/hotspots', iconKey: 'hotspots' },
      { label: 'Customer & Product Lanes', to: '/lanes', iconKey: 'lanes' },
      { label: 'Carrier & Vendor Performance', to: '/partners', iconKey: 'partners' },
    ],
  },
  {
    heading: 'REDUCE',
    items: [
      { label: 'Shipment Planner', to: '/scheduler', iconKey: 'scheduler' },
      { label: 'Reduction Opportunities', to: '/recommendations', iconKey: 'recommendations' },
      { label: 'Action Tracker', to: '/actions', iconKey: 'actions' },
    ],
  },
  {
    heading: 'REPORT',
    items: [{ label: 'ESG Reporting', to: '/evidence', iconKey: 'evidence' }],
  },
  {
    heading: 'REFERENCE',
    items: [{ label: 'Methodology & Factors', to: '/methodology', iconKey: 'methodology' }],
  },
];
