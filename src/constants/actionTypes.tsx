import type { ReactElement } from 'react';
import TrainRoundedIcon from '@mui/icons-material/TrainRounded';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import DirectionsBoatRoundedIcon from '@mui/icons-material/DirectionsBoatRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';

/**
 * Plain-English meaning of each action type — shown wherever an action appears.
 * These are the only four the workbook can evidence.
 */
export const TYPE_META: Record<string, { label: string; desc: string; icon: ReactElement }> = {
  'gateway-swap': {
    label: 'Different gateway',
    desc: 'Leave India through another port, on the inland chain that port already uses. Trades a long truck run for a short one plus rail.',
    icon: <TrainRoundedIcon />,
  },
  'shorter-sea': {
    label: 'Shorter sailing',
    desc: 'Same two ports, but the shorter sea distance the workbook has already recorded for that pair.',
    icon: <RouteRoundedIcon />,
  },
  'sea-instead-of-air': {
    label: 'Sea instead of air',
    desc: 'Move the freight on the ocean routing already used to that country. Far slower, and a fraction of the carbon.',
    icon: <DirectionsBoatRoundedIcon />,
  },
  consolidate: {
    label: 'Share the truck',
    desc: 'Put same-day loads bound for the same gateway on one truck run. Road carbon is charged per run, so the run is what you save.',
    icon: <Inventory2RoundedIcon />,
  },
};
