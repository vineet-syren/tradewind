import { useMemo } from 'react';
import { MenuItem, Stack, TextField } from '@mui/material';
import { APP_TODAY, addDaysISO } from '@/constants/app';

export interface DateRange {
  dateFrom?: string;
  dateTo?: string;
}

/**
 * A reporting year label ("FY23-24") as its Jul→Jun date window.
 *
 * The whole application works in the workbook's own reporting years, so the
 * presets do too — offering calendar years here would cut every one of them in
 * half. The list is built from the years the data actually holds rather than
 * from a date range, so no empty year can appear in the menu.
 */
function fyPreset(label: string): { id: string; label: string; range: DateRange } | null {
  const m = /^FY(\d{2})-(\d{2})$/.exec(label.trim());
  if (!m) return null;
  const start = 2000 + Number(m[1]);
  return { id: `fy${start}`, label, range: { dateFrom: `${start}-07-01`, dateTo: `${start + 1}-06-30` } };
}

/**
 * Named presets, anchored to the app's today: everything already shipped, the
 * forward book, then each reporting year present in the data.
 */
function buildPresets(reportingYears: string[]): { id: string; label: string; range: DateRange }[] {
  return [
    // Everything shipped to date — the full historical record, no forward book.
    { id: 'actuals', label: 'All actuals', range: { dateTo: addDaysISO(APP_TODAY, -1) } },
    // From today forward. No end date, so the whole forward book is in scope.
    { id: 'planned', label: 'To be planned', range: { dateFrom: APP_TODAY } },
    ...[...reportingYears]
      .sort((a, b) => b.localeCompare(a))
      .map(fyPreset)
      .filter((p): p is NonNullable<typeof p> => p !== null),
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
  reportingYears = [],
}: {
  value: DateRange;
  onChange: (patch: DateRange) => void;
  /** Reporting years present in the data — one preset each, newest first. */
  reportingYears?: string[];
}) {
  const presets = useMemo(() => buildPresets(reportingYears), [reportingYears]);
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
