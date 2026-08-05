import { useMemo, useState } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
} from '@mui/material';
import type { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  align?: 'left' | 'right' | 'center';
  width?: number | string;
  render: (row: T) => ReactNode;
  /** Value used for sorting when the column is sortable. */
  sortValue?: (row: T) => number | string;
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  dense = true,
  initialSortKey,
  maxHeight,
  maxHeightCss,
  selectedRowKey,
  fill = false,
}: {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  dense?: boolean;
  initialSortKey?: string;
  maxHeight?: number;
  /** CSS max-height (e.g. a `calc(...)` string) — wins over `maxHeight` when set. */
  maxHeightCss?: string;
  selectedRowKey?: string | null;
  /**
   * Take whatever height a flex-column parent has left and scroll inside it,
   * rather than sizing to the rows. Wins over both max-height props.
   */
  fill?: boolean;
}) {
  const [sortKey, setSortKey] = useState<string | undefined>(initialSortKey);
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return rows;
    const sv = col.sortValue;
    return [...rows].sort((a, b) => {
      const va = sv(a);
      const vb = sv(b);
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return dir === 'asc' ? cmp : -cmp;
    });
  }, [rows, columns, sortKey, dir]);

  const handleSort = (key: string) => {
    if (sortKey === key) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setDir('desc');
    }
  };

  return (
    <TableContainer sx={fill ? { flex: 1, minHeight: 0 } : { maxHeight: maxHeightCss ?? maxHeight }}>
      <Table size={dense ? 'small' : 'medium'} stickyHeader={fill || Boolean(maxHeightCss ?? maxHeight)}>
        <TableHead>
          <TableRow>
            {columns.map((c) => (
              <TableCell key={c.key} align={c.align} sx={{ width: c.width }}>
                {c.sortValue ? (
                  <TableSortLabel active={sortKey === c.key} direction={sortKey === c.key ? dir : 'desc'} onClick={() => handleSort(c.key)}>
                    {c.header}
                  </TableSortLabel>
                ) : (
                  c.header
                )}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {sorted.map((row, i) => {
            const key = getRowKey(row, i);
            const isSelected = selectedRowKey != null && key === selectedRowKey;
            return (
            <TableRow
              key={key}
              hover={Boolean(onRowClick)}
              selected={isSelected}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
              sx={{
                cursor: onRowClick ? 'pointer' : 'default',
                '&.Mui-selected, &.Mui-selected:hover': { bgcolor: 'action.selected' },
                '&:focus-visible': { outline: (t) => `2px solid ${t.palette.primary.main}`, outlineOffset: -2 },
              }}
            >
              {columns.map((c) => (
                <TableCell key={c.key} align={c.align}>
                  <Box component="span">{c.render(row)}</Box>
                </TableCell>
              ))}
            </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
