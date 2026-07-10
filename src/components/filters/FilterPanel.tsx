import { useEffect, useState } from 'react';
import { Badge, Button, Card, CardContent, Popover, Stack, TextField, Typography } from '@mui/material';
import ClearRoundedIcon from '@mui/icons-material/ClearRounded';
import FilterAltRoundedIcon from '@mui/icons-material/FilterAltRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { MultiSelectFilter } from './MultiSelectFilter';
import { DateRangeFilter } from './DateRangeFilter';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { clearFilters, countActiveFilters, patchFilters } from '@/app/store/filtersSlice';
import type { ModeLabel } from '@/types';

/**
 * Global filter bar — one single row (period + dimensions + search) with the
 * Clear button pinned outside the scroll area so it is always reachable.
 * Vendor / carrier / origin-port live behind "More" to keep the row sane.
 */
export function FilterPanel({ showSearch = true }: { showSearch?: boolean }) {
  const ds = useDataSource();
  const dispatch = useAppDispatch();
  const filters = useAppSelector((s) => s.filters.value);
  const { data: opts } = useAsync(() => ds.getFilterOptions(), []);
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null);

  // Debounced search — one fetch when typing settles, not one per keystroke.
  const [searchDraft, setSearchDraft] = useState(filters.search ?? '');
  const debouncedSearch = useDebouncedValue(searchDraft, 350);
  useEffect(() => {
    if ((filters.search ?? '') !== debouncedSearch) dispatch(patchFilters({ search: debouncedSearch || undefined }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only fire when the debounced value settles
  }, [debouncedSearch]);
  useEffect(() => {
    // External changes (Clear, persisted state) flow back into the draft.
    setSearchDraft(filters.search ?? '');
  }, [filters.search]);

  const activeCount = countActiveFilters(filters);
  const moreCount = (filters.vendors?.length ? 1 : 0) + (filters.lsps?.length ? 1 : 0) + (filters.originPorts?.length ? 1 : 0);

  if (!opts) return null;

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
        <Stack direction="row" alignItems="center" useFlexGap gap={1}>
          <Stack
            direction="row"
            alignItems="center"
            useFlexGap
            gap={1.25}
            sx={{
              flexGrow: 1,
              minWidth: 0,
              flexWrap: 'nowrap',
              overflowX: 'auto',
              // Floating field labels rise ~12px above the input border — pad the
              // scroll container generously so they are never clipped by overflow.
              pt: 1.75,
              pb: 0.5,
              '&::-webkit-scrollbar': { height: 6 },
            }}
          >
            <FilterAltRoundedIcon fontSize="small" sx={{ color: 'primary.main', flexShrink: 0 }} />
            <DateRangeFilter value={{ dateFrom: filters.dateFrom, dateTo: filters.dateTo }} onChange={(patch) => dispatch(patchFilters(patch))} />
            <MultiSelectFilter label="Region" options={opts.regions} value={filters.regions ?? []} onChange={(v) => dispatch(patchFilters({ regions: v }))} width={138} />
            <MultiSelectFilter label="Market" options={opts.markets} value={filters.markets ?? []} onChange={(v) => dispatch(patchFilters({ markets: v }))} width={138} />
            <MultiSelectFilter label="Product" options={opts.productCategories} value={filters.productCategories ?? []} onChange={(v) => dispatch(patchFilters({ productCategories: v }))} width={148} />
            <MultiSelectFilter label="Mode" options={opts.modes} value={filters.modes ?? []} onChange={(v) => dispatch(patchFilters({ modes: v as ModeLabel[] }))} width={120} />
            <MultiSelectFilter label="Customer" options={opts.customers} value={filters.customers ?? []} onChange={(v) => dispatch(patchFilters({ customers: v }))} width={150} />
            {showSearch && (
              <TextField
                size="small"
                label="Search"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                sx={{ width: 148, flexShrink: 0 }}
              />
            )}
          </Stack>

          {/* Pinned controls — always visible regardless of horizontal scroll. */}
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flexShrink: 0, pt: 1 }}>
            <Badge badgeContent={moreCount} color="primary">
              <Button
                size="small"
                color="inherit"
                startIcon={<TuneRoundedIcon />}
                onClick={(e) => setMoreAnchor(e.currentTarget)}
                sx={{ whiteSpace: 'nowrap' }}
              >
                More
              </Button>
            </Badge>
            {activeCount > 0 && (
              <Button
                size="small"
                color="inherit"
                startIcon={<ClearRoundedIcon />}
                onClick={() => dispatch(clearFilters())}
                sx={{ whiteSpace: 'nowrap' }}
              >
                Clear ({activeCount})
              </Button>
            )}
          </Stack>
        </Stack>

        <Popover
          open={Boolean(moreAnchor)}
          anchorEl={moreAnchor}
          onClose={() => setMoreAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{ paper: { sx: { p: 2, width: 300, borderRadius: 3 } } }}
        >
          <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.08em', color: 'text.secondary', display: 'block', mb: 1.5 }}>
            MORE FILTERS
          </Typography>
          <Stack spacing={1.5}>
            <MultiSelectFilter label="Vendor" options={opts.vendors} value={filters.vendors ?? []} onChange={(v) => dispatch(patchFilters({ vendors: v }))} width={264} />
            <MultiSelectFilter label="Carrier / LSP" options={opts.lsps} value={filters.lsps ?? []} onChange={(v) => dispatch(patchFilters({ lsps: v }))} width={264} />
            <MultiSelectFilter label="Origin port" options={opts.originPorts} value={filters.originPorts ?? []} onChange={(v) => dispatch(patchFilters({ originPorts: v }))} width={264} />
          </Stack>
        </Popover>
      </CardContent>
    </Card>
  );
}
