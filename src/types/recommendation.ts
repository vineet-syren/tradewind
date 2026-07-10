import type { ApproachKind, Complexity, Controllability, ModeLabel } from './common';
import type { PersonaId } from './persona';

export type ActionType =
  | 'mode-shift'
  | 'route-swap'
  | 'origin-port'
  | 'dest-port'
  | 'consolidation'
  | 'lsp-swap'
  | 'vendor-intervention'
  | 'air-avoidance';

export interface EvidenceItem {
  label: string;
  value: string;
  comparison?: string;
}

export type RecStatus = 'suggested' | 'accepted' | 'in-progress' | 'dismissed' | 'snoozed';

/** A CO₂e reduction action — the output of the action engine. */
export interface Recommendation {
  id: string;
  laneId?: string;
  shipmentId?: string;
  laneLabel: string;
  customer: string;
  origin: string;
  destPort: string;
  region: string;
  productCategory: string;
  vendor: string;
  lsp: string;
  type: ActionType;
  agent: string;
  approach: ApproachKind;
  title: string;
  rationale: string;
  estCo2eSavingTonnes: number;
  estCo2eSavingPct: number;
  costImpactUsd: number;
  costImpactLabel: string;
  /** Marginal abatement cost, USD per tonne CO₂e avoided (negative = saves money). */
  macUsdPerTonne?: number;
  /** Transport-mode chain today vs after the change — for a plain "Now → Change to" view. */
  fromModePath?: ModeLabel[];
  toModePath?: ModeLabel[];
  transitImpactDays: number;
  slaImpact: string;
  confidence: number;
  complexity: Complexity;
  controllability: Controllability;
  ownerPersona: PersonaId;
  priorityScore: number;
  status: RecStatus;
  evidence: EvidenceItem[];
  airAvoidable?: boolean | null;
}
