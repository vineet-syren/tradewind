import type { PersonaId } from './persona';
import type { ApproachKind } from './common';

export type ActionState = 'task-created' | 'executed' | 'planned' | 'logged';

/** An executed action / decision recorded in the in-app audit trail. */
export interface ActionLogEntry {
  id: string;
  recommendationId?: string;
  laneId?: string;
  shipmentId?: string;
  label: string;
  type: string;
  state: ActionState;
  actor: string;
  ownerPersona?: PersonaId;
  approach?: ApproachKind;
  savingTonnes?: number;
  timestamp: string;
}

/** A decision write-back (e.g. "adopt Best-for-CO₂ on this lane"). */
export interface DecisionWriteback {
  laneId: string;
  laneLabel: string;
  approach: ApproachKind;
  note?: string;
  savingTonnes?: number;
  timestamp: string;
}
