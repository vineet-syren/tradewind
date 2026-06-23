import { Stack, Typography } from '@mui/material';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import type { ActionLogEntry } from '@/types';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatRelative, formatTonnes } from '@/utils/format';

const STATE_LABEL: Record<string, string> = {
  'task-created': 'Task created',
  executed: 'Executed',
  planned: 'Delegated',
  logged: 'Logged',
};

export function AuditLog({ entries }: { entries: ActionLogEntry[] }) {
  if (!entries.length)
    return <EmptyState title="No actions yet" description="Executed actions and decisions appear here with a full audit trail." icon={<HistoryRoundedIcon sx={{ fontSize: 38 }} />} />;
  return (
    <Stack spacing={1.25}>
      {entries.map((e) => (
        <Stack key={e.id} direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Stack sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.35 }}>
              {e.label}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {STATE_LABEL[e.state] ?? e.state} · {e.actor}
              {e.savingTonnes ? ` · ${formatTonnes(e.savingTonnes)}/yr` : ''}
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            {formatRelative(e.timestamp)}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}
