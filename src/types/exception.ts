import type { Severity } from './common';

/** Air-watch + data-quality exceptions. */
export interface ExceptionItem {
  id: string;
  kind: 'air' | 'data-quality';
  severity: Severity;
  shipmentId?: string;
  laneLabel: string;
  customer: string;
  region: string;
  title: string;
  detail: string;
  classification: string;
  co2eTonnes: number;
  detectedAt: string;
}
