import type { Complexity, ModeLabel, OptionKind } from './common';
import type { PersonaId } from './persona';

/**
 * The action types the workbook can evidence. Each maps 1:1 onto an
 * `OptionKind` so a recommendation is always "take option X on shipment Y".
 */
export type ActionType =
  | 'shorter-first-mile'
  | 'gateway-swap'
  | 'shorter-sea'
  | 'sea-instead-of-air'
  | 'consolidate';

export interface EvidenceItem {
  label: string;
  value: string;
  comparison?: string;
}

export type RecStatus = 'suggested' | 'accepted' | 'dismissed';

/** One decision to make: a shipment, the option to take, and what it saves. */
export interface Recommendation {
  id: string;
  laneId: string;
  shipmentId?: string;
  laneLabel: string;
  origin: string;
  gateway: string | null;
  destPort: string;
  region: string;
  category: string;
  type: ActionType;
  optionKind: OptionKind;
  /** Exact `RouteOption.id` this recommends — `optionKind` alone is ambiguous. */
  optionId: string;
  title: string;
  /** One sentence a logistics lead can act on without opening anything else. */
  rationale: string;
  /** The workbook fact that makes this option real, e.g. "used on 33 shipments". */
  proof: string;
  proofRefs: string[];
  estCo2eSavingTonnes: number;
  estCo2eSavingPct: number;
  /** Change in estimated transit; positive means slower. */
  transitImpactDays: number;
  fromModePath: ModeLabel[];
  toModePath: ModeLabel[];
  complexity: Complexity;
  ownerPersona: PersonaId;
  /** Rank key — CO₂e saved, so the queue is ordered by what it is worth. */
  priorityScore: number;
  status: RecStatus;
  /** Shipment date the decision applies to; drives "decide by" urgency. */
  shipmentDate?: string;
  evidence: EvidenceItem[];
}
