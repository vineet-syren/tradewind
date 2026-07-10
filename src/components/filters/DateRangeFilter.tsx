import { MenuItem, Stack, TextField } from '@mui/material';
import { APP_TODAY, addDaysISO } from '@/constants/app';

export interface DateRange {
  dateFrom?: string;
  dateTo?: string;
}

const YEAR = APP_TODAY.slice(0, 4);
const BASELINE_YEAR = 2020;

// Full historical years, most recent first — but NOT the current year, which is
// covered by "Year to date" (actuals) + "To be planned" (upcoming).
const YEAR_PRESETS: { id: string; label: string; range: DateRange }[] = Array.from(
  { length: Number(YEAR) - BASELINE_YEAR },
  (_, i) => {
    const y = Number(YEAR) - 1 - i;
    return { id: `y${y}`, label: String(y), range: { dateFrom: `${y}-01-01`, dateTo: `${y}-12-31` } };
  },
);

/**
 * Named presets, anchored to the app's frozen today. A trimmed, unambiguous set:
 * this year's actuals (year to date), the upcoming planning window (to be
 * planned), then each prior full year.
 */
const PRESETS: { id: string; label: string; range: DateRange }[] = [
  // Everything shipped to date — the full historical timeline (no future/planned).
  { id: 'actuals', label: 'All actuals', range: { dateTo: APP_TODAY } },
  { id: 'ytd', label: 'Year to date', range: { dateFrom: `${YEAR}-01-01`, dateTo: APP_TODAY } },
  { id: 'plan90', label: 'To be planned', range: { dateFrom: addDaysISO(APP_TODAY, 1), dateTo: addDaysISO(APP_TODAY, 90) } },
  ...YEAR_PRESETS,
];

function matchPreset(v: DateRange): string {
  if (!v.dateFrom && !v.dateTo) return 'none';
  const hit = PRESETS.find((p) => (p.range.dateFrom ?? '') === (v.dateFrom ?? '') && (p.range.dateTo ?? '') === (v.dateTo ?? ''));
  return hit ? hit.id : 'custom';
}

/**
 * Date-range filter — a quick preset plus explicit From/To inputs, the way a
 * real user scopes a worklist by time. Presets are anchored to the app's
 * frozen today (2026-06-30) and include a forward window for planning.
 */
export function DateRangeFilter({ value, onChange }: { value: DateRange; onChange: (patch: DateRange) => void }) {
  const preset = matchPreset(value);
  return (
    <Stack direction="row" alignItems="center" useFlexGap gap={1} sx={{ flexWrap: 'nowrap', flexShrink: 0 }}>
      <TextField
        select
        size="small"
        label="Range"
        value={preset}
        onChange={(e) => {
          const p = PRESETS.find((x) => x.id === e.target.value);
          if (p) onChange({ dateFrom: p.range.dateFrom, dateTo: p.range.dateTo });
        }}
        sx={{ width: 148, flexShrink: 0 }}
      >
        {preset === 'none' && (
          <MenuItem value="none" disabled>
            Any time
          </MenuItem>
        )}
        {PRESETS.map((p) => (
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
