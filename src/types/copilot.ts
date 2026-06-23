import type { Intent } from './common';
import type { KpiMetric } from './metrics';
import type { Lane } from './lane';
import type { Recommendation } from './recommendation';
import type { HotspotRow } from './hotspot';
import type { ModeSplitRow } from './footprint';
import type { Scenario } from './lane';
import type { PersonaId } from './persona';

export interface CopilotSuggestion {
  id: string;
  prompt: string;
}

export interface CopilotInsight {
  label: string;
  value: string;
  intent?: Intent;
}

/** The data view the copilot chooses to render with its answer. */
export interface CopilotView {
  kind: 'kpis' | 'hotspots' | 'lanes' | 'recommendations' | 'modeSplit' | 'scenario' | 'none';
  title?: string;
  kpis?: KpiMetric[];
  hotspots?: HotspotRow[];
  lanes?: Lane[];
  recommendations?: Recommendation[];
  modeSplit?: ModeSplitRow[];
  scenarios?: { current: Scenario; optimal: Scenario; balanced: Scenario; best: Scenario };
}

export interface CopilotAction {
  id: string;
  label: string;
  type: string;
  laneId?: string;
  shipmentId?: string;
  recommendationId?: string;
  ownerPersona?: PersonaId;
  savingTonnes?: number;
}

export interface CopilotResult {
  id?: string;
  headline: string;
  answer: string;
  insights: CopilotInsight[];
  view: CopilotView;
  actions: CopilotAction[];
  followups: string[];
}
