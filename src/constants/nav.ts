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
 * - Analyst: the analytical slices and the report.
 *
 * ESG Reporting is the exception and is open to all three: it is the one page
 * whose figures get quoted outside the business, so every persona reads the
 * same one rather than a role-specific version of it.
 *
 * "Carrier & Vendor Performance" is deliberately absent: the source workbook
 * names no vendor, processor or carrier, so there is nothing real to rank.
 */
// "Ask Tradewind" is not a page — it lives as a right-docked chat widget
// (CopilotDock) available everywhere, so it is intentionally absent here.
export const NAV_GROUPS: NavGroupDef[] = [
  {
    heading: '',
    items: [
      { label: 'Control Tower', to: '/control-tower', iconKey: 'atlas', personas: ['logistics'] },
      { label: 'Emission Hotspots', to: '/hotspots', iconKey: 'hotspots' },
      { label: 'Product & Destination Lanes', to: '/lanes', iconKey: 'lanes' },
    ],
  },
  {
    heading: 'REPORT',
    // Open to every persona. The reported footprint is one company figure that
    // the logistics lead has to plan against as much as the CSO has to sign, and
    // the year selector and the export are the same for all three.
    items: [{ label: 'ESG Reporting', to: '/evidence', iconKey: 'evidence' }],
  },
];

/** Nav groups visible to a persona (groups with no remaining items are dropped). */
export function navGroupsForPersona(persona: PersonaId): NavGroupDef[] {
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.personas || i.personas.includes(persona)),
  })).filter((g) => g.items.length > 0);
}

/** Where each role lands: the lead on the tower, the CSO on the report. */
const PERSONA_HOME: Record<PersonaId, string> = {
  logistics: '/control-tower',
  cso: '/evidence',
  analyst: '/hotspots',
};

export function personaHomePath(persona: PersonaId): string {
  const home = PERSONA_HOME[persona];
  const visible = navGroupsForPersona(persona).flatMap((g) => g.items.map((i) => i.to));
  return visible.includes(home) ? home : (visible[0] ?? '/hotspots');
}
