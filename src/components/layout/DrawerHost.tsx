import { Box, Drawer, IconButton, Toolbar } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { closeDrawer } from '@/app/store/uiSlice';
import { LaneDetailContent } from '@/modules/decarbonization/components/LaneDetailContent';
import { ShipmentDetailContent } from '@/modules/decarbonization/components/ShipmentDetailContent';

/** Right-side detail drawer for Lane 360 / Shipment 360. */
export function DrawerHost() {
  const dispatch = useAppDispatch();
  const laneId = useAppSelector((s) => s.ui.selectedLaneId);
  const laneReadOnly = useAppSelector((s) => s.ui.laneReadOnly);
  const shipmentId = useAppSelector((s) => s.ui.selectedShipmentId);
  const open = Boolean(laneId || shipmentId);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={() => dispatch(closeDrawer())}
      PaperProps={{ sx: { width: { xs: '100%', sm: 480, md: 560 }, maxWidth: '100%' } }}
    >
      <Toolbar />
      <Box sx={{ position: 'relative', p: { xs: 2, md: 3 }, overflowY: 'auto' }}>
        <IconButton onClick={() => dispatch(closeDrawer())} sx={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }} aria-label="Close">
          <CloseRoundedIcon />
        </IconButton>
        {laneId && <LaneDetailContent laneId={laneId} readOnly={laneReadOnly} />}
        {shipmentId && <ShipmentDetailContent shipmentId={shipmentId} />}
      </Box>
    </Drawer>
  );
}
