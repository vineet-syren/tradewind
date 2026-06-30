import { Box, Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material';
import ClearRoundedIcon from '@mui/icons-material/ClearRounded';
import { MultiSelectFilter } from './MultiSelectFilter';
import { DateRangeFilter } from './DateRangeFilter';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { clearFilters, patchFilters } from '@/app/store/filtersSlice';
import type { ModeLabel } from '@/types';

/** Global filter bar — dispatches to the filters slice; every page reads it. */
export function FilterPanel({ showSearch = true }: { showSearch?: boolean }) {
  const ds = useDataSource();
  const dispatch = useAppDispatch();
  const filters = useAppSelector((s) => s.filters.value);
  const { data: opts } = useAsync(() => ds.getFilterOptions(), []);

  const activeCount = Object.values(filters).filter((v) => (Array.isArray(v) ? v.length > 0 : Boolean(v))).length;

  if (!opts) return null;

  const labelSx = { fontWeight: 700, letterSpacing: '0.08em', color: 'text.secondary', mr: 0.5, minWidth: 52 } as const;

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Stack spacing={1.25}>
          {/* Period first — set the statement window, then refine below */}
          <Stack direction="row" alignItems="center" flexWrap="wrap" useFlexGap gap={1.25}>
            <Typography variant="caption" sx={labelSx}>PERIOD</Typography>
            <DateRangeFilter value={{ dateFrom: filters.dateFrom, dateTo: filters.dateTo }} onChange={(patch) => dispatch(patchFilters(patch))} />
            <Box sx={{ flexGrow: 1 }} />
            {activeCount > 0 && (
              <Button size="small" color="inherit" startIcon={<ClearRoundedIcon />} onClick={() => dispatch(clearFilters())}>
                Clear ({activeCount})
              </Button>
            )}
          </Stack>
          {/* Dimension filters */}
          <Stack direction="row" alignItems="center" flexWrap="wrap" useFlexGap gap={1.25}>
            <Typography variant="caption" sx={labelSx}>FILTERS</Typography>
            <MultiSelectFilter label="Region" options={opts.regions} value={filters.regions ?? []} onChange={(v) => dispatch(patchFilters({ regions: v }))} width={170} />
            <MultiSelectFilter label="Market" options={opts.markets} value={filters.markets ?? []} onChange={(v) => dispatch(patchFilters({ markets: v }))} width={170} />
            <MultiSelectFilter label="Product" options={opts.productCategories} value={filters.productCategories ?? []} onChange={(v) => dispatch(patchFilters({ productCategories: v }))} width={190} />
            <MultiSelectFilter label="Mode" options={opts.modes} value={filters.modes ?? []} onChange={(v) => dispatch(patchFilters({ modes: v as ModeLabel[] }))} width={150} />
            <MultiSelectFilter label="Customer" options={opts.customers} value={filters.customers ?? []} onChange={(v) => dispatch(patchFilters({ customers: v }))} width={200} />
            {showSearch && (
              <TextField
                size="small"
                label="Search"
                value={filters.search ?? ''}
                onChange={(e) => dispatch(patchFilters({ search: e.target.value }))}
                sx={{ width: 180 }}
              />
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
