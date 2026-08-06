import { useMemo } from 'react';
import { MenuItem, Stack, TextField } from '@mui/material';
import { APP_TODAY, addDaysISO } from '@/constants/app';
import type { ReportingYearWindow } from '@/types';

export interface DateRange {
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Named presets, anchored to the app's today: everything already shipped, the
 * forward book, then each reporting year present in the data.
 *
 * Each year's range is the span the workbook actually records for that tab, not
 * a Jul→Jun window guessed from the label. The tabs do not tile cleanly —
 * FY21-22 ends 12 May 2022 while FY22-23 starts 1 Jun 2022 — so a guessed window
 * swept June 2022 shipments into "FY21-22" and the page then disagreed with
 * itself about how many shipments that year held.
 */
function buildPresets(windows: ReportingYearWindow[]): { id: string; label: string; range: DateRange }[] {
  return [
    // Everything shipped to date — the full historical record, no forward book.
    { id: 'actuals', label: 'All actuals', range: { dateTo: addDaysISO(APP_TODAY, -1) } },
    // From today forward. No end date, so the whole forward book is in scope.
    { id: 'planned', label: 'To be planned', range: { dateFrom: APP_TODAY } },
    ...[...windows]
      .sort((a, b) => b.reportingYear.localeCompare(a.reportingYear))
      .map((w) => ({
        id: `fy-${w.reportingYear}`,
        label: w.reportingYear,
        range: { dateFrom: w.from, dateTo: w.to },
      })),
  ];
}

/**
 * Date-range filter — a quick preset plus explicit From/To inputs, the way a
 * real user scopes a worklist by time. Presets are anchored to the app's today
 * and include a forward window for planning.
 */
export function DateRangeFilter({
  value,
  onChange,
  reportingYearWindows = [],
}: {
  value: DateRange;
  onChange: (patch: DateRange) => void;
  /** Reporting years and the dates they span — one preset each, newest first. */
  reportingYearWindows?: ReportingYearWindow[];
}) {
  const presets = useMemo(() => buildPresets(reportingYearWindows), [reportingYearWindows]);
  const preset = (() => {
    if (!value.dateFrom && !value.dateTo) return 'none';
    const hit = presets.find(
      (p) => (p.range.dateFrom ?? '') === (value.dateFrom ?? '') && (p.range.dateTo ?? '') === (value.dateTo ?? ''),
    );
    return hit ? hit.id : 'custom';
  })();
  return (
    <Stack direction="row" alignItems="center" useFlexGap gap={1} sx={{ flexWrap: 'nowrap', flexShrink: 0 }}>
      <TextField
        select
        size="small"
        label="Range"
        value={preset}
        onChange={(e) => {
          const p = presets.find((x) => x.id === e.target.value);
          if (p) onChange({ dateFrom: p.range.dateFrom, dateTo: p.range.dateTo });
        }}
        // Wide enough for the longest preset label — a narrower field truncated
        // "To be planned" to an ellipsis.
        sx={{ width: 176, flexShrink: 0 }}
      >
        {preset === 'none' && (
          <MenuItem value="none" disabled>
            Any time
          </MenuItem>
        )}
        {presets.map((p) => (
          <MenuItem key={p.id} value={p.id}>{p.label}</MenuItem>
        ))}
        {preset === 'custom' && <MenuItem value="custom">Custom range</MenuItem>}
      </TextField>
      <TextField
        type="date"
        size="small"
        label="From"
        value={value.dateFrom ?? ''}
        onChange={(e) => onChange({ dateFrom: e.target.value || undefined, dateTo: value.dateTo })}
        InputLabelProps={{ shrink: true }}
        sx={{ width: 150, flexShrink: 0 }}
      />
      <TextField
        type="date"
        size="small"
        label="To"
        value={value.dateTo ?? ''}
        onChange={(e) => onChange({ dateFrom: value.dateFrom, dateTo: e.target.value || undefined })}
        InputLabelProps={{ shrink: true }}
        sx={{ width: 150, flexShrink: 0 }}
      />
    </Stack>
  );
}
