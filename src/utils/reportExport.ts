/**
 * Report export.
 *
 * The ESG pack has to leave the browser in a form an auditor can open and check,
 * so it is emitted as CSV: every figure, its unit, and the workbook cell range
 * behind it, in the same order as the page. Nothing is rounded on the way out
 * beyond the precision already shown, and nothing that is not in the workbook
 * appears in the file.
 */
import type { EmissionFactorRow, EsgEvidence, ReportingYearFootprint } from '@/types';

/** RFC-4180 quoting — commas, quotes and newlines all survive a round trip. */
function cell(v: string | number | null | undefined): string {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const row = (cells: (string | number | null | undefined)[]) => cells.map(cell).join(',');

/** One reporting year as CSV sections, in the order the page presents them. */
function yearSection(y: ReportingYearFootprint): string[] {
  const lines: string[] = [
    '',
    row([`REPORTING YEAR ${y.reportingYear}`]),
    row(['Workbook tab', y.tab]),
    row(['Dispatch window', `${y.from} to ${y.to}`]),
    '',
    row(['Metric', 'Value', 'Unit']),
    row(['CO2e reported', y.allLegsCo2eTonnes, 'tonnes']),
    row(['CO2e printed in the workbook (cell D53)', y.reportedCo2eTonnes, 'tonnes']),
    row(['Freight moved', y.weightTonnes, 'tonnes']),
    row(['Transport intensity', y.intensity, 'g CO2e per tonne-km']),
    row(['Movements', y.shipments, 'count']),
    row(['— export shipments', y.exportShipments, 'count']),
    row(['— first-mile collection runs', y.collectionShipments, 'count']),
    row(['Road leg CO2e', y.roadCo2eTonnes, 'tonnes']),
    row(['Rail leg CO2e', y.railCo2eTonnes, 'tonnes']),
    row(['Ocean leg CO2e', y.oceanCo2eTonnes, 'tonnes']),
    // The four leg figures above exhaust the year exactly; the line below is a
    // different cut of the same movements and must not be added to them.
    row(['Air leg CO2e', y.airCo2eTonnes, 'tonnes']),
    row(['Air shipments', y.airShipments, 'count']),
    row(['CO2e of shipments that flew (incl. road leg to airport)', y.flownShipmentCo2eTonnes, 'tonnes']),
    row(['Avoidable on optimised routes', y.avoidableTonnes, 'tonnes']),
    '',
    row([`RECONCILIATION — ${y.reportingYear}`]),
    row(['Line', 'CO2e (tonnes)', 'Note']),
    ...y.reconciliation.map((s) => row([s.label, s.co2eTonnes, s.note])),
  ];
  if (y.reconciliationNote) lines.push(row(['Summary', '', y.reconciliationNote]));

  const splits: [string, typeof y.byCategory][] = [
    ['BY PRODUCT CATEGORY', y.byCategory],
    ['BY DESTINATION PORT', y.byDestPort],
    ['BY GATEWAY PORT', y.byGateway],
    ['BY TRANSPORT MODE', y.byMode],
  ];
  for (const [title, rows] of splits) {
    lines.push('', row([`${title} — ${y.reportingYear}`]), row(['Label', 'CO2e (tonnes)', 'Share (%)', 'Weight (tonnes)', 'Movements']));
    lines.push(...rows.map((r) => row([r.label, r.co2eTonnes, r.pct, r.weightTonnes, r.shipments])));
  }
  return lines;
}

/**
 * The whole pack as one CSV. `years` is already scoped to the selection, and
 * only ever contains reporting years read from the workbook.
 */
export function buildEsgCsv({
  evidence,
  years,
  factors,
  generatedOn,
}: {
  evidence: EsgEvidence;
  years: ReportingYearFootprint[];
  factors: EmissionFactorRow[];
  generatedOn: string;
}): string {
  const lines: string[] = [
    row(['Terova — Scope 3 Category 9, downstream transportation & distribution']),
    row(['Source workbook', evidence.workbook]),
    row(['Workbook title', evidence.workbookTitle]),
    row(['Reporting years in this file', years.map((y) => y.reportingYear).join(' / ')]),
    row(['Generated', generatedOn]),
    row(['Basis', 'Every figure below is read from the source workbook. No synthetic, modelled or forecast row is included.']),
    '',
    row(['METHODOLOGY']),
    row(['Calculation', evidence.methodology.formula]),
    row(['Road basis', evidence.methodology.roadBasis]),
    row(['Factors', evidence.methodology.factors]),
    row(['Distances', evidence.methodology.distance]),
    row(['Boundary', evidence.methodology.boundary]),
    row(['Scope', evidence.methodology.scope]),
    '',
    row(['EMISSION FACTORS']),
    row(['Mode', 'Factor', 'Unit', 'Charged', 'Workbook cell']),
    ...factors.map((f) =>
      row([f.mode, f.value, f.unit, f.basis === 'per-truck-km' ? 'per truck run' : 'per tonne carried', f.sourceRef]),
    ),
  ];

  for (const y of years) lines.push(...yearSection(y));

  lines.push('', row(["SOURCE WORKBOOK'S OWN DATA NOTES"]), ...evidence.dataSourceNotes.map((n) => row([n])));
  lines.push('', row(['STATED ASSUMPTIONS']), ...evidence.assumptions.map((a) => row([a])));
  return lines.join('\n');
}

/** Hand a generated file to the browser's downloader. */
export function downloadTextFile(filename: string, contents: string, mime = 'text/csv;charset=utf-8') {
  // Leading BOM so Excel opens the file as UTF-8 and the ₂ in "CO₂e" survives.
  const blob = new Blob([`\uFEFF${contents}`], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the click has definitely been handled.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
