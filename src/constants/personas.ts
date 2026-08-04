/**
 * Persona registry — the "Viewing as" switcher. Both personas see the whole
 * network; the persona changes the lens (landing KPIs, default page, copilot
 * tone), not the row set.
 *
 * There is no procurement persona because the workbook names no vendor,
 * processor or carrier — there would be nothing for that role to act on.
 */
import type { PersonaDef, PersonaId } from '@/types';

export const PERSONAS: PersonaDef[] = [
  {
    id: 'logistics',
    name: 'Logistics / Supply Chain Lead',
    role: 'Chooses the gateway, mode and sailing for each shipment.',
    lens: 'What to change on the freight that has not moved yet.',
  },
  {
    id: 'cso',
    name: 'Chief Sustainability Officer',
    role: 'Owns the reported footprint and its evidence.',
    lens: 'The reported total, its trend, and what it ties back to.',
  },
];

export const DEFAULT_PERSONA: PersonaId = 'logistics';

export function getPersona(id: PersonaId): PersonaDef {
  return PERSONAS.find((p) => p.id === id) ?? PERSONAS[0];
}
