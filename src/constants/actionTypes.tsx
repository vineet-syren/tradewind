import type { ReactElement } from 'react';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import AltRouteRoundedIcon from '@mui/icons-material/AltRouteRounded';
import AnchorRoundedIcon from '@mui/icons-material/AnchorRounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded';
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded';
import AirplanemodeInactiveRoundedIcon from '@mui/icons-material/AirplanemodeInactiveRounded';

/** Plain-English meaning of each reduction action type — shown wherever an action appears. */
export const TYPE_META: Record<string, { label: string; desc: string; icon: ReactElement }> = {
  'mode-shift': { label: 'Mode shift', desc: 'Move legs onto a lower-carbon mode — e.g. inland road → rail, or air → ocean.', icon: <SwapHorizRoundedIcon /> },
  'route-swap': { label: 'Route optimization', desc: 'Keep the modes, but take a lower-emission path or port pairing on this lane.', icon: <AltRouteRoundedIcon /> },
  'origin-port': { label: 'Origin gateway', desc: 'Ship out via a nearer or lower-carbon origin port to shorten the inland leg.', icon: <AnchorRoundedIcon /> },
  'dest-port': { label: 'Destination gateway', desc: 'Land the cargo at a port closer to the customer to cut the delivery leg.', icon: <PlaceRoundedIcon /> },
  consolidation: { label: 'Consolidation', desc: 'Combine part-loads into fewer, fuller containers on this lane.', icon: <Inventory2RoundedIcon /> },
  'lsp-swap': { label: 'Carrier switch', desc: 'Move this volume to a lower-intensity carrier / logistics partner.', icon: <LocalShippingRoundedIcon /> },
  'vendor-intervention': { label: 'Vendor governance', desc: 'Engage the vendor to change how they book and route this lane.', icon: <HandshakeRoundedIcon /> },
  'air-avoidance': { label: 'Air avoidance', desc: 'Plan earlier so urgent air freight can move by ocean or rail instead.', icon: <AirplanemodeInactiveRoundedIcon /> },
};
