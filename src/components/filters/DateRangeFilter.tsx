import { MenuItem, Stack, TextField } from '@mui/material';
import { APP_TODAY, addDaysISO } from '@/constants/app';

export interface DateRange {
  dateFrom?: string;
  dateTo?: string;
}

const YEAR = APP_TODAY.slice(0, 4);

/** Named presets, computed off the app's frozen "today". */
const PRESETS: { id: string; label: string; range: DateRange }[] = [
  { id: 'all', label: 'All actuals', range: {} },
  { id: 'last90', label: 'Last 90 days', range: { dateFrom: addDaysISO(APP_TODAY, -90), dateTo: APP_TODAY } },
  { id: 'last12m', label: 'Last 12 months', range: { dateFrom: addDaysISO(APP_TODAY, -365), dateTo: APP_TODAY } },
  { id: 'ytd', label: 'Year to date', range: { dateFrom: `${YEAR}-01-01`, dateTo: APP_TODAY } },
  { id: 'plan90', label: 'Next 90 days (plan)', range: { dateFrom: addDaysISO(APP_TODAY, 1), dateTo: addDaysISO(APP_TODAY, 90) } },
];

function matchPreset(v: DateRange): string {
  if (!v.dateFrom && !v.dateTo) return 'all';
  const hit = PRESETS.find((p) => p.range.dateFrom === v.dateFrom && p.range.dateTo === v.dateTo);
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
    <Stack direction="row" alignItems="center" useFlexGap gap={1}>
      <TextField
        select
        size="small"
        label="Range"
        value={preset}
        onChange={(e) => {
          const p = PRESETS.find((x) => x.id === e.target.value);
          if (p) onChange({ dateFrom: p.range.dateFrom, dateTo: p.range.dateTo });
        }}
        sx={{ width: 168 }}
      >
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
        sx={{ width: 150 }}
      />
      <TextField
        type="date"
        size="small"
        label="To"
        value={value.dateTo ?? ''}
        onChange={(e) => onChange({ dateFrom: value.dateFrom, dateTo: e.target.value || undefined })}
        InputLabelProps={{ shrink: true }}
        sx={{ width: 150 }}
      />
    </Stack>
  );
}
