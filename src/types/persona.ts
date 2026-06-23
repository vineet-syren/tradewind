/** Persona registry — the "Viewing as" switcher. */
export type PersonaId = 'cso' | 'logistics' | 'analyst' | 'procurement';

export interface PersonaScope {
  /** All personas see the whole company footprint; the lens differs. */
  kind: 'all';
}

export interface PersonaDef {
  id: PersonaId;
  name: string;
  role: string;
  /** What this persona optimizes for — drives landing cards & copilot tone. */
  lens: string;
  scope: PersonaScope;
}
