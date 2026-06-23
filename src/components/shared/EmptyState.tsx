import { Box, Stack, Typography } from '@mui/material';
import InboxRoundedIcon from '@mui/icons-material/InboxRounded';
import type { ReactNode } from 'react';

export function EmptyState({ title, description, icon }: { title: string; description?: string; icon?: ReactNode }) {
  return (
    <Stack alignItems="center" spacing={1} sx={{ py: 5, px: 2, textAlign: 'center' }}>
      <Box sx={{ color: 'text.disabled' }}>{icon ?? <InboxRoundedIcon sx={{ fontSize: 40 }} />}</Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
          {description}
        </Typography>
      )}
    </Stack>
  );
}
