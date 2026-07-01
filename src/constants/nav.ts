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
      { label: 'Carbon Overview', to: '/overview', iconKey: 'overview' },
    ],
  },
  {
    heading: 'CARBON INVENTORY',
    items: [
      { label: 'Scope 1 · Direct', to: '/scope-1', iconKey: 'scope1' },
      { label: 'Scope 2 · Energy', to: '/scope-2', iconKey: 'scope2' },
      { label: 'Scope 3 · Value chain', to: '/scope-3', iconKey: 'scope3' },
    ],
  },
  {
    heading: 'TRANSPORTATION · SCOPE 3 CAT. 9',
    items: [
      { label: 'Control Tower', to: '/control-tower', iconKey: 'atlas' },
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
