import { Box, Card, CardContent, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export function ChartContainer({
  title,
  subtitle,
  action,
  icon,
  children,
  height,
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  /** Optional glyph shown in a tinted chip beside the title. */
  icon?: ReactNode;
  children: ReactNode;
  height?: number;
}) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        {(title || action) && (
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1} sx={{ mb: 1.5 }}>
            <Stack direction="row" spacing={1.25} alignItems="flex-start">
              {icon && (
                <Box
                  sx={{
                    flexShrink: 0,
                    width: 30,
                    height: 30,
                    borderRadius: 1.5,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: 'action.hover',
                    color: 'primary.main',
                    mt: 0.25,
                  }}
                >
                  {icon}
                </Box>
              )}
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
            </Stack>
            {action}
          </Stack>
        )}
        <Box sx={{ height }}>{children}</Box>
      </CardContent>
    </Card>
  );
}
