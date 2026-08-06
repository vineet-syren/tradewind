import { Box, Card, CardContent, Stack, Typography } from '@mui/material';
import { alpha, useTheme, type Theme } from '@mui/material/styles';
import type { SvgIconComponent } from '@mui/icons-material';
import ArrowDownwardRounded from '@mui/icons-material/ArrowDownwardRounded';
import ArrowUpwardRounded from '@mui/icons-material/ArrowUpwardRounded';
import InsightsRounded from '@mui/icons-material/InsightsRounded';
import Co2Rounded from '@mui/icons-material/Co2Rounded';
import SpeedRounded from '@mui/icons-material/SpeedRounded';
import PieChartRounded from '@mui/icons-material/PieChartRounded';
import FlightRounded from '@mui/icons-material/FlightRounded';
import StorefrontRounded from '@mui/icons-material/StorefrontRounded';
import Inventory2Rounded from '@mui/icons-material/Inventory2Rounded';
import SavingsRounded from '@mui/icons-material/SavingsRounded';
import EnergySavingsLeafRounded from '@mui/icons-material/EnergySavingsLeafRounded';
import WarningAmberRounded from '@mui/icons-material/WarningAmberRounded';
import GroupsRounded from '@mui/icons-material/GroupsRounded';
import LocalShippingRounded from '@mui/icons-material/LocalShippingRounded';
import FactoryRounded from '@mui/icons-material/FactoryRounded';
import RouteRounded from '@mui/icons-material/RouteRounded';
import StraightenRounded from '@mui/icons-material/StraightenRounded';
import type { Intent, KpiMetric } from '@/types';
import { formatMetric } from '@/utils/format';
import { MetricHelp } from '@/components/charts/MetricHelp';
import { KPI_GUIDE } from '@/constants/metricGuide';
import type { Derivation } from '@/utils/derivations';

/** Semantic icon keys → glyphs, so pages can label a KPI with a short string. */
const ICONS: Record<string, SvgIconComponent> = {
  co2e: Co2Rounded,
  intensity: SpeedRounded,
  concentration: PieChartRounded,
  air: FlightRounded,
  customer: StorefrontRounded,
  product: Inventory2Rounded,
  savings: SavingsRounded,
  green: EnergySavingsLeafRounded,
  risk: WarningAmberRounded,
  partners: GroupsRounded,
  carrier: LocalShippingRounded,
  vendor: FactoryRounded,
  lanes: RouteRounded,
  distance: StraightenRounded,
};

/** Resolve an intent to a {main, soft} colour pair from the theme. */
function intentColor(theme: Theme, intent: Intent): { main: string; soft: string } {
  const map: Record<Intent, string> = {
    positive: theme.palette.success.main,
    negative: theme.palette.error.main,
    risk: theme.palette.error.main,
    opportunity: theme.palette.primary.main,
    neutral: theme.palette.text.secondary,
  };
  const main = map[intent] ?? theme.palette.text.secondary;
  return { main, soft: alpha(main, 0.12) };
}

/** A single KPI tile — icon chip, headline value, and a trend pill or hint. */
export function KpiCard({ metric, derivation }: { metric: KpiMetric; derivation?: Derivation }) {
  const theme = useTheme();
  const c = intentColor(theme, metric.intent);
  const Icon = ICONS[metric.icon ?? ''] ?? InsightsRounded;
  // Tiles are keyed by their own id, so a page gets the explainer for free
  // wherever the metric already carries a known id.
  const guide = KPI_GUIDE[metric.id];

  const hasDelta = metric.deltaPct != null;
  const up = (metric.deltaPct ?? 0) >= 0;
  const good = metric.betterWhenLower ? !up : up;
  const deltaColor = good ? theme.palette.success.main : theme.palette.error.main;
  const DeltaArrow = up ? ArrowUpwardRounded : ArrowDownwardRounded;

  return (
    <Card sx={{ position: 'relative', height: '100%', overflow: 'hidden', borderLeft: `4px solid ${c.main}` }}>
      <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={0.5}>
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: 10, pt: 0.25 }}
          >
            {metric.label}
          </Typography>
          {/* The "?" sits next to the tile's own icon, so the explanation for a
              headline number is reachable from the number itself. */}
          {guide && (
            <Box sx={{ ml: 'auto', mt: -0.25 }}>
              <MetricHelp guide={guide} size="tiny" derivation={derivation} />
            </Box>
          )}
          <Box
            sx={{
              flexShrink: 0,
              width: 34,
              height: 34,
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              bgcolor: c.soft,
              color: c.main,
            }}
          >
            <Icon sx={{ fontSize: 19 }} />
          </Box>
        </Stack>

        <Typography variant="h5" sx={{ mt: 1, fontWeight: 700, letterSpacing: '-0.01em' }}>
          {metric.display ?? formatMetric(metric.value, metric.unit)}
        </Typography>

        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.75, minHeight: 22 }} useFlexGap flexWrap="wrap">
          {hasDelta && (
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.25,
                px: 0.75,
                py: 0.125,
                borderRadius: 999,
                bgcolor: alpha(deltaColor, 0.12),
                color: deltaColor,
                fontWeight: 700,
                fontSize: 11.5,
                lineHeight: 1.6,
              }}
            >
              <DeltaArrow sx={{ fontSize: 13 }} />
              {Math.abs(metric.deltaPct as number).toFixed(1)}%
            </Box>
          )}
          {(metric.deltaLabel || metric.hint) && (
            <Typography variant="caption" sx={{ color: hasDelta ? 'text.secondary' : c.main, lineHeight: 1.35 }}>
              {hasDelta ? metric.deltaLabel : metric.hint}
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
