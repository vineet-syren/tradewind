import { Box, Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material';
import ClearRoundedIcon from '@mui/icons-material/ClearRounded';
import { MultiSelectFilter } from './MultiSelectFilter';
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

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Stack direction="row" alignItems="center" flexWrap="wrap" useFlexGap gap={1.25}>
          <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.08em', color: 'text.secondary', mr: 0.5 }}>
            FILTERS
          </Typography>
          <MultiSelectFilter label="Region" options={opts.regions} value={filters.regions ?? []} onChange={(v) => dispatch(patchFilters({ regions: v }))} width={170} />
          <MultiSelectFilter label="Market" options={opts.markets} value={filters.markets ?? []} onChange={(v) => dispatch(patchFilters({ markets: v }))} width={170} />
          <MultiSelectFilter label="Product" options={opts.productCategories} value={filters.productCategories ?? []} onChange={(v) => dispatch(patchFilters({ productCategories: v }))} width={190} />
          <MultiSelectFilter label="Mode" options={opts.modes} value={filters.modes ?? []} onChange={(v) => dispatch(patchFilters({ modes: v as ModeLabel[] }))} width={150} />
          <MultiSelectFilter label="Customer" options={opts.customers} value={filters.customers ?? []} onChange={(v) => dispatch(patchFilters({ customers: v }))} width={200} />
          <MultiSelectFilter label="Year" options={opts.years} value={filters.years ?? []} onChange={(v) => dispatch(patchFilters({ years: v }))} width={130} format={(v) => String(v)} />
          {showSearch && (
            <TextField
              size="small"
              label="Search"
              value={filters.search ?? ''}
              onChange={(e) => dispatch(patchFilters({ search: e.target.value }))}
              sx={{ width: 180 }}
            />
          )}
          <Box sx={{ flexGrow: 1 }} />
          {activeCount > 0 && (
            <Button size="small" color="inherit" startIcon={<ClearRoundedIcon />} onClick={() => dispatch(clearFilters())}>
              Clear ({activeCount})
            </Button>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
