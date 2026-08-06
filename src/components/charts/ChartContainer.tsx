import { useState } from 'react';
import { Box, Card, CardContent, Chip, Collapse, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import InboxRoundedIcon from '@mui/icons-material/InboxRounded';
import type { ReactNode } from 'react';
import { MetricHelp } from './MetricHelp';
import { METRIC_GUIDE } from '@/constants/metricGuide';
import type { Derivation } from '@/utils/derivations';

/** Render `**bold**` segments in insight strings as highlighted text. */
function richText(text: string): ReactNode {
  const parts = text.split('**');
  if (parts.length < 3) return text;
  return parts.map((part, i) => (i % 2 === 1 ? <Box key={i} component="strong" sx={{ color: 'text.primary', fontWeight: 700 }}>{part}</Box> : part));
}

export function ChartContainer({
  title,
  subtitle,
  action,
  icon,
  children,
  height,
  insights,
  fill = false,
  isEmpty = false,
  emptyMessage = 'Nothing matches the current filters. Clear one and this comes back.',
  guideKey,
  derivation,
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  /** Optional glyph shown in a tinted chip beside the title. */
  icon?: ReactNode;
  children: ReactNode;
  height?: number;
  /** Deterministic findings computed from the chart's own data — renders the "Insights" toggle. */
  insights?: string[];
  /**
   * True when the chart has no rows to draw. A chart with nothing in it renders
   * as a tall blank panel, which reads as a broken page rather than an empty
   * one — so say so instead, in the space the chart would have taken.
   */
  isEmpty?: boolean;
  emptyMessage?: string;
  /**
   * Key into `METRIC_GUIDE` — renders the "?" beside Insights, explaining what
   * the chart means, how it is calculated and a worked example.
   */
  guideKey?: string;
  /** Live arithmetic behind this chart's figures, from the rows in view. */
  derivation?: Derivation;
  /**
   * Give the body whatever height is left in a parent of definite height, so a
   * scrollable child (a long table) fills the card instead of the card growing
   * to fit it. Needs an ancestor that actually has a height to give.
   */
  fill?: boolean;
}) {
  const theme = useTheme();
  const [showInsights, setShowInsights] = useState(false);
  const hasInsights = Boolean(insights && insights.length > 0);
  const guide = guideKey ? METRIC_GUIDE[guideKey] : undefined;

  return (
    // A card in a grid row stretches to the tallest card in that row. When this
    // one's chart is shorter, the body grows and centres it rather than leaving
    // the chart pinned to the top of the extra space — cheap insurance against
    // the dead-space problem reappearing on some future pairing.
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        // Grow into spare height, but never shrink below what the content needs —
        // Card sets `overflow: hidden`, so shrinking clips rather than scrolls.
        ...(fill && { height: 'auto', flexGrow: 1, flexShrink: 0 }),
      }}
    >
      <CardContent
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          ...(fill && { flexGrow: 1, flexShrink: 0, minHeight: 0 }),
        }}
      >
        {(title || action || hasInsights || guide) && (
          // Wraps rather than compressing. In a narrow pane the title, the "?",
          // the Insights chip and two select boxes cannot sit on one line, and
          // an unwrapped row crushed the heading to one word per line inside a
          // 350px-tall header. Letting the controls drop below is the only
          // arrangement that stays readable at every pane width.
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="flex-start"
            spacing={1}
            rowGap={1}
            flexWrap="wrap"
            useFlexGap
            sx={{ mb: 1.5 }}
          >
            <Stack direction="row" spacing={1.25} alignItems="flex-start" sx={{ flex: '1 1 240px', minWidth: 0 }}>
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
              <Box sx={{ minWidth: 0 }}>
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
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" rowGap={1} useFlexGap sx={{ flexShrink: 0, ml: 'auto' }}>
              {guide && <MetricHelp guide={guide} derivation={derivation} />}
              {hasInsights && (
                <Chip
                  size="small"
                  clickable
                  icon={<AutoAwesomeRoundedIcon sx={{ fontSize: 14 }} />}
                  label="Insights"
                  title="Computed deterministically from the data in view — reproducible, no generative AI"
                  onClick={() => setShowInsights((v) => !v)}
                  sx={{
                    fontWeight: 700,
                    color: showInsights ? '#fff' : 'primary.main',
                    bgcolor: showInsights ? 'primary.main' : alpha(theme.palette.primary.main, 0.08),
                    '& .MuiChip-icon': { color: 'inherit' },
                    '&:hover': { bgcolor: showInsights ? 'primary.dark' : alpha(theme.palette.primary.main, 0.16) },
                  }}
                />
              )}
              {action}
            </Stack>
          </Stack>
        )}
        {hasInsights && (
          <Collapse in={showInsights} unmountOnExit>
            <Box
              sx={{
                mb: 1.5,
                p: 1.5,
                borderRadius: 2,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.25)}`,
                background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.06)}, ${alpha(theme.palette.primary.main, 0.02)})`,
              }}
            >
              <Stack spacing={0.75}>
                {insights!.map((text, i) => (
                  <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
                    <Box sx={{ mt: '7px', width: 5, height: 5, borderRadius: '50%', bgcolor: 'primary.main', flexShrink: 0 }} />
                    <Typography variant="caption" sx={{ lineHeight: 1.55 }}>
                      {richText(text)}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
              <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.disabled', fontSize: 11.5 }}>
                ✦ Computed from the data currently in view — deterministic and reproducible
              </Typography>
            </Box>
          </Collapse>
        )}
        {isEmpty ? (
          <Stack
            spacing={1}
            alignItems="center"
            justifyContent="center"
            sx={{ py: 4, px: 2, textAlign: 'center', ...(fill && { flex: 1, minHeight: 0 }) }}
          >
            <InboxRoundedIcon sx={{ fontSize: 30, color: 'text.disabled' }} />
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
              {emptyMessage}
            </Typography>
          </Stack>
        ) : (
          <Box
            sx={{
              height,
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              ...(fill ? {} : { justifyContent: 'center' }),
              '& > *': { minWidth: 0 },
            }}
          >
            {children}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
