import { useState } from 'react';
import { Badge, Box, Chip, Divider, IconButton, Popover, Stack, Tooltip, Typography } from '@mui/material';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { useAppDispatch } from '@/app/store/hooks';
import { setSelectedShipment } from '@/app/store/uiSlice';
import { SEVERITY_COLORS } from '@/app/config/chartColors';
import { formatDate, formatTonnes } from '@/utils/format';

const MAX_SHOWN = 8;

/**
 * Alerts & notifications — the exceptions inbox (air-watch + data-quality),
 * surfaced from the top bar so nothing waits for someone to open a page.
 */
export function AlertsBell() {
  const ds = useDataSource();
  const dispatch = useAppDispatch();
  const { data: exceptions } = useAsync(() => ds.getExceptions(), []);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const items = exceptions ?? [];
  const highCount = items.filter((e) => e.severity === 'High').length;

  return (
    <>
      <Tooltip title="Alerts & notifications">
        <IconButton onClick={(e) => setAnchor(e.currentTarget)} aria-label={`Alerts and notifications: ${items.length} open, ${highCount} high severity`}>
          <Badge badgeContent={items.length} color={highCount > 0 ? 'error' : 'primary'} max={99}>
            <NotificationsRoundedIcon />
          </Badge>
        </IconButton>
      </Tooltip>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 400, maxWidth: '94vw', borderRadius: 3, mt: 1 } } }}
      >
        <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, pt: 1.5, pb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Alerts & notifications
          </Typography>
          {highCount > 0 && <Chip size="small" color="error" label={`${highCount} high`} />}
          <Typography variant="caption" sx={{ color: 'text.secondary', ml: 'auto' }}>
            {items.length} open
          </Typography>
        </Stack>
        <Divider />
        {items.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2.5, textAlign: 'center' }}>
            No open exceptions — air-watch and data-quality checks are clear.
          </Typography>
        ) : (
          <Stack sx={{ maxHeight: 420, overflowY: 'auto', py: 0.5 }}>
            {items.slice(0, MAX_SHOWN).map((e) => (
              <Stack
                key={e.id}
                direction="row"
                spacing={1.25}
                alignItems="flex-start"
                onClick={() => {
                  if (e.shipmentId) {
                    dispatch(setSelectedShipment(e.shipmentId));
                    setAnchor(null);
                  }
                }}
                sx={{
                  px: 2,
                  py: 1,
                  cursor: e.shipmentId ? 'pointer' : 'default',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', mt: 0.9, flexShrink: 0, bgcolor: SEVERITY_COLORS[e.severity as keyof typeof SEVERITY_COLORS] ?? 'text.disabled' }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                    {e.title}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                    {e.laneLabel} · {e.customer} · {formatTonnes(e.co2eTonnes)} · {formatDate(e.detectedAt.slice(0, 10))}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}>
                    {e.detail}
                  </Typography>
                </Box>
              </Stack>
            ))}
            {items.length > MAX_SHOWN && (
              <Typography variant="caption" sx={{ color: 'text.secondary', px: 2, py: 1 }}>
                +{items.length - MAX_SHOWN} more — click any alert to open its shipment.
              </Typography>
            )}
          </Stack>
        )}
        <Divider />
        <Typography variant="caption" sx={{ display: 'block', px: 2, py: 1, color: 'text.disabled' }}>
          ✦ Air-watch & data-quality exceptions, computed from your shipment data
        </Typography>
      </Popover>
    </>
  );
}
