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
    heading: 'DECARBONIZE',
    items: [{ label: 'Command Center', to: '/', iconKey: 'command' }],
  },
  {
    heading: 'INTELLIGENCE',
    items: [
      { label: 'Baseline & Hotspots', to: '/hotspots', iconKey: 'hotspots' },
      { label: 'Route & Mode Decisioning', to: '/decisioning', iconKey: 'decisioning' },
      { label: 'Product–Customer Lanes', to: '/lanes', iconKey: 'lanes' },
      { label: 'Partner Influence', to: '/partners', iconKey: 'partners' },
    ],
  },
  {
    heading: 'CONCIERGE',
    items: [
      { label: 'Action Center', to: '/actions', iconKey: 'actions' },
      { label: 'Recommendations', to: '/recommendations', iconKey: 'recommendations' },
      { label: 'Air Watch & Exceptions', to: '/air-watch', iconKey: 'air' },
      { label: 'ESG Evidence Pack', to: '/evidence', iconKey: 'evidence' },
    ],
  },
  {
    heading: 'REFERENCE',
    items: [{ label: 'Methodology & Factors', to: '/methodology', iconKey: 'methodology' }],
  },
];
