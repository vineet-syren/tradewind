import { Box, Card, CardContent, Skeleton, Stack } from '@mui/material';

export function KpiSkeleton({ count = 4 }: { count?: number }) {
  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: `repeat(${count}, 1fr)` } }}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent>
            <Skeleton width="60%" height={14} />
            <Skeleton width="45%" height={34} sx={{ mt: 1 }} />
            <Skeleton width="70%" height={12} sx={{ mt: 0.5 }} />
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Stack spacing={1}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} variant="rounded" height={52} />
      ))}
    </Stack>
  );
}

export function ChartSkeleton({ height = 280 }: { height?: number }) {
  return <Skeleton variant="rounded" height={height} />;
}
