import type { ReactElement } from 'react';
import SpaceDashboardRoundedIcon from '@mui/icons-material/SpaceDashboardRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import LocalFireDepartmentRoundedIcon from '@mui/icons-material/LocalFireDepartmentRounded';
import AltRouteRoundedIcon from '@mui/icons-material/AltRouteRounded';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import Diversity3RoundedIcon from '@mui/icons-material/Diversity3Rounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import TipsAndUpdatesRoundedIcon from '@mui/icons-material/TipsAndUpdatesRounded';
import FlightRoundedIcon from '@mui/icons-material/FlightRounded';
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded';
import FunctionsRoundedIcon from '@mui/icons-material/FunctionsRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import DirectionsBoatRoundedIcon from '@mui/icons-material/DirectionsBoatRounded';
import TrainRoundedIcon from '@mui/icons-material/TrainRounded';
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded';
import DirectionsCarRoundedIcon from '@mui/icons-material/DirectionsCarRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import type { SvgIconProps } from '@mui/material/SvgIcon';

const REGISTRY: Record<string, (p: SvgIconProps) => ReactElement> = {
  command: (p) => <SpaceDashboardRoundedIcon {...p} />,
  copilot: (p) => <AutoAwesomeRoundedIcon {...p} />,
  hotspots: (p) => <LocalFireDepartmentRoundedIcon {...p} />,
  decisioning: (p) => <AltRouteRoundedIcon {...p} />,
  ledger: (p) => <ReceiptLongRoundedIcon {...p} />,
  lanes: (p) => <GridViewRoundedIcon {...p} />,
  partners: (p) => <Diversity3RoundedIcon {...p} />,
  actions: (p) => <BoltRoundedIcon {...p} />,
  recommendations: (p) => <TipsAndUpdatesRoundedIcon {...p} />,
  scheduler: (p) => <CalendarMonthRoundedIcon {...p} />,
  air: (p) => <FlightRoundedIcon {...p} />,
  evidence: (p) => <FactCheckRoundedIcon {...p} />,
  methodology: (p) => <FunctionsRoundedIcon {...p} />,
  consolidation: (p) => <Inventory2RoundedIcon {...p} />,
};

export function NavIcon({ iconKey, ...props }: { iconKey: string } & SvgIconProps): ReactElement {
  const make = REGISTRY[iconKey] ?? ((p: SvgIconProps) => <HelpOutlineRoundedIcon {...p} />);
  return make(props);
}

const MODE_ICONS: Record<string, (p: SvgIconProps) => ReactElement> = {
  Ocean: (p) => <DirectionsBoatRoundedIcon {...p} />,
  ocean: (p) => <DirectionsBoatRoundedIcon {...p} />,
  Rail: (p) => <TrainRoundedIcon {...p} />,
  rail: (p) => <TrainRoundedIcon {...p} />,
  Road: (p) => <LocalShippingRoundedIcon {...p} />,
  road: (p) => <LocalShippingRoundedIcon {...p} />,
  Air: (p) => <FlightRoundedIcon {...p} />,
  air: (p) => <FlightRoundedIcon {...p} />,
  Car: (p) => <DirectionsCarRoundedIcon {...p} />,
};

export function ModeIcon({ mode, ...props }: { mode: string } & SvgIconProps): ReactElement {
  const make = MODE_ICONS[mode] ?? ((p: SvgIconProps) => <LocalShippingRoundedIcon {...p} />);
  return make(props);
}
