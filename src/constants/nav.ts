/** Sidebar navigation config — menu as metadata. Sidebar + router derive from here. */
import type { PersonaId } from '@/types';

export interface NavItemDef {
  label: string;
  to: string;
  iconKey: string;
  /** Personas that see this item. Omitted = visible to every role. */
  personas?: PersonaId[];
}

export interface NavGroupDef {
  heading: string;
  items: NavItemDef[];
}

/**
 * Role-based visibility — each persona sees only the pages their job needs:
 * - CSO: whole-network visibility + reporting (no day-to-day ops tower).
 * - Logistics lead: the operational tower + route/hotspot visibility.
 * - Program owner: hotspots, lanes and the ESG report they run monthly.
 * - Procurement: partners and the lanes their vendors/carriers run.
 */
// "Ask Tradewind" is no longer a page — it lives as a right-docked chat widget
// (CopilotDock) available on every page, so it is intentionally absent here.
export const NAV_GROUPS: NavGroupDef[] = [
  {
    heading: '',
    items: [
      { label: 'Control Tower', to: '/control-tower', iconKey: 'atlas', personas: ['logistics'] },
      { label: 'Emission Hotspots', to: '/hotspots', iconKey: 'hotspots', personas: ['cso', 'logistics'] },
      { label: 'Customer & Product Lanes', to: '/lanes', iconKey: 'lanes', personas: ['cso', 'logistics', 'procurement'] },
      { label: 'Carrier & Vendor Performance', to: '/partners', iconKey: 'partners', personas: ['procurement', 'logistics'] },
    ],
  },
  {
    heading: 'REPORT',
    items: [{ label: 'ESG Reporting', to: '/evidence', iconKey: 'evidence', personas: ['cso'] }],
  },
];

/** Nav groups visible to a persona (groups with no remaining items are dropped). */
export function navGroupsForPersona(persona: PersonaId): NavGroupDef[] {
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.personas || i.personas.includes(persona)),
  })).filter((g) => g.items.length > 0);
}

/** The landing page for a persona — the first nav item their role can see. */
export function personaHomePath(persona: PersonaId): string {
  return navGroupsForPersona(persona)[0]?.items[0]?.to ?? '/lanes';
}
