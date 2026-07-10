import { Button, Stack, Typography } from '@mui/material';
import { useAppDispatch } from '@/app/store/hooks';
import { patchFilters } from '@/app/store/filtersSlice';
import { APP_TODAY, addDaysISO } from '@/constants/app';

const STARTERS = [
  { label: 'All actuals to date', patch: { dateTo: APP_TODAY } },
  { label: 'Last 12 months', patch: { dateFrom: addDaysISO(APP_TODAY, -365), dateTo: APP_TODAY } },
  { label: 'Next 90 days (plan)', patch: { dateFrom: addDaysISO(APP_TODAY, 1), dateTo: addDaysISO(APP_TODAY, 90) } },
];

/** One-click starter scopes for the filter-gated empty states — no dead ends. */
export function ScopePrompt() {
  const dispatch = useAppDispatch();
  return (
    <Stack alignItems="center" spacing={1} sx={{ pb: 4 }}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent="center">
        {STARTERS.map((s) => (
          <Button key={s.label} size="small" variant="outlined" onClick={() => dispatch(patchFilters(s.patch))}>
            {s.label}
          </Button>
        ))}
      </Stack>
      <Typography variant="caption" color="text.secondary">
        …or pick any period, region, market, product, mode or customer above.
      </Typography>
    </Stack>
  );
}
