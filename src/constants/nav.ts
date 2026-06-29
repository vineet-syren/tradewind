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
    heading: 'VISIBILITY',
    items: [
      { label: 'Command Center', to: '/', iconKey: 'command' },
      { label: 'Shipment Route Map', to: '/decisioning', iconKey: 'decisioning' },
      { label: 'Emission Hotspots', to: '/hotspots', iconKey: 'hotspots' },
      { label: 'Customer & Product Lanes', to: '/lanes', iconKey: 'lanes' },
      { label: 'Carrier & Vendor Performance', to: '/partners', iconKey: 'partners' },
    ],
  },
  {
    heading: 'REDUCE',
    items: [
      { label: 'Reduction Opportunities', to: '/recommendations', iconKey: 'recommendations' },
      { label: 'Action Tracker', to: '/actions', iconKey: 'actions' },
      { label: 'Air Freight Watch', to: '/air-watch', iconKey: 'air' },
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
