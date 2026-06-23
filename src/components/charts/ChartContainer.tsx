import { Box, Card, CardContent, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export function ChartContainer({
  title,
  subtitle,
  action,
  children,
  height,
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  height?: number;
}) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        {(title || action) && (
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
            <Box>
              {title && (
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {title}
                </Typography>
              )}
              {subtitle && (
                <Typography variant="caption" color="text.secondary">
                  {subtitle}
                </Typography>
              )}
            </Box>
            {action}
          </Stack>
        )}
        <Box sx={{ height }}>{children}</Box>
      </CardContent>
    </Card>
  );
}
