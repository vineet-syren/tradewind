/**
 * Persona registry — the "Viewing as" switcher. The workbook records movements,
 * not commercial partners, so the two personas it can genuinely serve are the
 * logistics lead who chooses routes and the CSO who reports the footprint.
 */
export type PersonaId = 'logistics' | 'cso';

export interface PersonaDef {
  id: PersonaId;
  name: string;
  role: string;
  /** What this persona optimizes for — drives landing cards & copilot tone. */
  lens: string;
}
