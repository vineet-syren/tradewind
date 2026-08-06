import type { Mode } from './common';

/**
 * One row of the source spreadsheet, addressable by its cell range.
 *
 * This is the bottom of the chain. Every figure in the application carries a
 * `sourceRef` like "2022-2024!AM4:AX4"; resolving it lands here, on the row as
 * the sheet holds it. `co2eTonnes` is the workbook's own printed value, never a
 * recomputation — the point of being able to open a cell is to see what it says,
 * not to see what we would have made it say.
 */
export interface WorkbookRow {
  /** "<tab>!<range>" — the same string carried by every figure in the app. */
  ref: string;
  tab: string;
  range: string;
  /** Which block of the tab the row sits in — the sheet's own layout. */
  block: 'collection' | 'inland' | 'waterway' | 'airway';
  mode: Mode;
  reportingYear: string;
  date: string | null;
  item: string | null;
  qtyKg: number | null;
  source: string | null;
  dest: string | null;
  distanceKm: number | null;
  /** Nautical miles, where the sheet records them for a sailing. */
  distanceNm: number | null;
  emissionFactor: number | null;
  efUnit: string;
  efBasis: 'per-truck-km' | 'per-tonne-km';
  co2eTonnes: number | null;
  fuelKl: number | null;
  fuelType: string | null;
  trips: number | null;
  container: string | null;
  distPerTripKm: number | null;
  slNo: number | null;
}

export interface WorkbookBlock {
  key: string;
  label: string;
  /** Spreadsheet column span, e.g. "AM:AW". */
  columns: string;
}

export interface WorkbookTab {
  tab: string;
  reportingYear: string;
  from: string | null;
  to: string | null;
  rows: number;
  /** The total the tab prints for itself, and where it prints it. */
  printedTotalCo2eTonnes: number;
  printedTotalCell: string;
  blocks: WorkbookBlock[];
}

/** The workbook made addressable — tab metadata plus every row by cell range. */
export interface WorkbookIndex {
  file: string;
  title: string;
  dataSourceNotes: string[];
  tabs: WorkbookTab[];
  rows: Record<string, WorkbookRow>;
}
