import type { Severity } from './common';

/**
 * Things worth a second look, all found in the workbook itself:
 *  - `air`            a shipment that flew
 *  - `low-load`       a dedicated truck run for a fraction of a load
 *  - `data-quality`   a duplicated or self-contradicting row
 */
export interface ExceptionItem {
  id: string;
  kind: 'air' | 'low-load' | 'data-quality';
  severity: Severity;
  shipmentId?: string;
  laneLabel: string;
  region: string;
  title: string;
  detail: string;
  co2eTonnes: number;
  /** CO₂e recoverable if this is fixed; 0 when it is only a data issue. */
  avoidableTonnes: number;
  /** Workbook cell range so the finding can be checked at source. */
  sourceRef: string;
}
