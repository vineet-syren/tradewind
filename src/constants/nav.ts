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
 * Four pages, deliberately. The logistics lead lands on the decision queue; the
 * CSO lands on the report. Hotspots and Lanes are the two "where is it" views
 * both roles share.
 */
export const NAV_GROUPS: NavGroupDef[] = [
  {
    heading: '',
    items: [
      { label: 'Decisions', to: '/decisions', iconKey: 'decisioning', personas: ['logistics'] },
      { label: 'Emission Hotspots', to: '/hotspots', iconKey: 'hotspots' },
      { label: 'Lanes', to: '/lanes', iconKey: 'lanes' },
    ],
  },
  {
    heading: 'REPORT',
    items: [{ label: 'Footprint & Evidence', to: '/evidence', iconKey: 'evidence' }],
  },
];

/** Nav groups visible to a persona (groups with no remaining items are dropped). */
export function navGroupsForPersona(persona: PersonaId): NavGroupDef[] {
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.personas || i.personas.includes(persona)),
  })).filter((g) => g.items.length > 0);
}

/** Where each role should land: the lead on decisions, the CSO on the report. */
const PERSONA_HOME: Record<PersonaId, string> = {
  logistics: '/decisions',
  cso: '/evidence',
};

export function personaHomePath(persona: PersonaId): string {
  const home = PERSONA_HOME[persona];
  const visible = navGroupsForPersona(persona).flatMap((g) => g.items.map((i) => i.to));
  return visible.includes(home) ? home : (visible[0] ?? '/hotspots');
}
