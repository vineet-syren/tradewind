import type { Intent } from './common';

/** A "what changed" feed event for the Command Center. */
export interface PulseEvent {
  id: string;
  laneId?: string;
  region: string;
  kind: string;
  summary: string;
  intent: Intent;
  timestamp: string;
}
