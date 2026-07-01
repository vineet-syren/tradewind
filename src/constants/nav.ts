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
    items: [
      { label: 'Carbon Copilot', to: '/', iconKey: 'copilot' },
      { label: 'Control Tower', to: '/control-tower', iconKey: 'atlas' },
    ],
  },
  {
    heading: 'ANALYZE',
    items: [
      { label: 'Emission Hotspots', to: '/hotspots', iconKey: 'hotspots' },
      { label: 'Customer & Product Lanes', to: '/lanes', iconKey: 'lanes' },
      { label: 'Carrier & Vendor Performance', to: '/partners', iconKey: 'partners' },
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
