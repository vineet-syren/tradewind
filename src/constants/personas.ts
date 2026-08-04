/**
 * Persona registry — the "Viewing as" switcher. Terova's footprint is a single
 * company network, so every persona sees the whole footprint; the persona
 * changes the *lens* (landing page, default emphasis, copilot tone), not the
 * row set. Row scoping is done via the filter panel.
 */
import type { PersonaDef, PersonaId } from '@/types';

export const PERSONAS: PersonaDef[] = [
  {
    id: 'cso',
    name: 'Chief Sustainability Officer',
    role: 'Owns the reported footprint and its evidence.',
    lens: 'The reported total, its trend, and what it ties back to in the source workbook.',
  },
  {
    id: 'logistics',
    name: 'Logistics / Supply Chain Lead',
    role: 'Chooses the gateway, mode and sailing for each shipment.',
    lens: 'Highest-impact route changes, gateway choice and air governance.',
  },
  {
    id: 'analyst',
    name: 'Sustainability Analyst',
    role: 'Slices the footprint and prepares the numbers.',
    lens: 'Hotspots by product, port and mode, and the month-by-month trend.',
  },
];

export const DEFAULT_PERSONA: PersonaId = 'logistics';

export function getPersona(id: PersonaId): PersonaDef {
  return PERSONAS.find((p) => p.id === id) ?? PERSONAS[0];
}
