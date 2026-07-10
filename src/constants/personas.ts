/**
 * Persona registry — the "Viewing as" switcher. Terova's footprint is a single
 * company network, so every persona sees the whole footprint; the persona
 * changes the *lens* (landing cards, default emphasis, copilot tone), not the
 * row set. Row scoping is done via the filter panel.
 */
import type { PersonaDef, PersonaId } from '@/types';

export const PERSONAS: PersonaDef[] = [
  {
    id: 'cso',
    name: 'Chief Sustainability Officer',
    role: 'Whole-network footprint, reduction ambition and ESG evidence.',
    lens: 'Total CO₂e, progress to the 10–20% ambition, credible reporting.',
    scope: { kind: 'all' },
  },
  {
    id: 'logistics',
    name: 'Logistics / Supply Chain Lead',
    role: 'Route, mode and port decisions across outbound lanes.',
    lens: 'Highest-impact lane actions, mode shift and air governance.',
    scope: { kind: 'all' },
  },
  {
    id: 'procurement',
    name: 'Procurement / Vendor Management',
    role: 'Vendor, processor and LSP influence and governance.',
    lens: 'Partner contribution and influenceable reduction.',
    scope: { kind: 'all' },
  },
];

export const DEFAULT_PERSONA: PersonaId = 'cso';

export function getPersona(id: PersonaId): PersonaDef {
  return PERSONAS.find((p) => p.id === id) ?? PERSONAS[0];
}
