/**
 * Persona registry — the "Viewing as" switcher. Every persona sees the whole
 * company footprint; the persona changes the lens (landing page, focus KPIs,
 * copilot tone), not the row set.
 *
 * There is no procurement persona because the workbook names no vendor,
 * processor or carrier — that role would have nothing to act on.
 */
export type PersonaId = 'cso' | 'logistics' | 'analyst';

export interface PersonaDef {
  id: PersonaId;
  name: string;
  role: string;
  /** What this persona optimizes for — drives landing cards & copilot tone. */
  lens: string;
}
