import { useState, type MouseEvent } from 'react';
import { Box, Chip, Divider, IconButton, Popover, Stack, Tooltip, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import CalculateRoundedIcon from '@mui/icons-material/CalculateRounded';
import LightbulbRoundedIcon from '@mui/icons-material/LightbulbRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import type { MetricGuide } from '@/constants/metricGuide';
import type { Derivation } from '@/utils/derivations';
import { WorkbookRefDialog } from '@/components/shared/WorkbookRefDialog';

/**
 * The "?" beside a chart or KPI: what it means, how it is calculated, one real
 * worked example, and why it matters.
 *
 * Opens on hover as well as click. Hovering is how someone skims six charts
 * looking for the one they need; clicking is how they pin it open to read the
 * example properly, and to select text out of it for a report. The panel stays
 * open while the pointer is inside it so a hover-opened panel can still be read.
 */
export function MetricHelp({
  guide,
  size = 'small',
  derivation,
}: {
  guide: MetricGuide;
  size?: 'small' | 'tiny';
  /**
   * How this figure was built from the rows currently in view. The guide's
   * worked example teaches the method on fixed numbers; this shows the same
   * arithmetic on the live data, with each contributing line's workbook cell.
   */
  derivation?: Derivation;
}) {
  const theme = useTheme();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [pinned, setPinned] = useState(false);
  const [openRefs, setOpenRefs] = useState<string[] | null>(null);

  const close = () => {
    setAnchor(null);
    setPinned(false);
  };

  return (
    <>
      <Tooltip title={pinned ? '' : 'What is this? How is it calculated?'}>
        <IconButton
          aria-label={`Explain: ${guide.title}`}
          size="small"
          onMouseEnter={(e: MouseEvent<HTMLElement>) => !pinned && setAnchor(e.currentTarget)}
          onMouseLeave={() => !pinned && setAnchor(null)}
          onClick={(e: MouseEvent<HTMLElement>) => {
            setAnchor(e.currentTarget);
            setPinned((p) => !p);
          }}
          sx={{
            p: size === 'tiny' ? 0.25 : 0.4,
            color: anchor ? 'primary.main' : 'text.disabled',
            '&:hover': { color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.08) },
          }}
        >
          <HelpOutlineRoundedIcon sx={{ fontSize: size === 'tiny' ? 15 : 17 }} />
        </IconButton>
      </Tooltip>

      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        // Hover-opened: let the pointer through to the page beneath, but keep
        // the panel itself interactive so it can be read and selected.
        sx={{ pointerEvents: pinned ? 'auto' : 'none' }}
        slotProps={{
          paper: {
            onMouseEnter: () => setAnchor((a) => a),
            onMouseLeave: () => !pinned && setAnchor(null),
            sx: {
              pointerEvents: 'auto',
              width: 460,
              maxWidth: '94vw',
              maxHeight: '80vh',
              borderRadius: 3,
              mt: 0.75,
              boxShadow: '0 16px 48px rgba(15,23,42,.22)',
            },
          },
        }}
        disableRestoreFocus
      >
        <Box sx={{ p: 2.25 }}>
          <Stack direction="row" alignItems="flex-start" spacing={1} sx={{ mb: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, flexGrow: 1 }}>
              {guide.title}
            </Typography>
            <Chip
              size="small"
              label={pinned ? 'Click ? to close' : 'Click ? to pin'}
              sx={{ height: 20, fontSize: 10, fontWeight: 700, color: 'text.secondary' }}
            />
          </Stack>

          <Section icon={<MenuBookRoundedIcon sx={{ fontSize: 15 }} />} title="What this shows">
            {guide.what}
          </Section>

          <Section icon={<CalculateRoundedIcon sx={{ fontSize: 15 }} />} title="How it is calculated">
            {guide.how}
          </Section>

          {/* The worked example is the part that earns trust, so it gets the
              monospace treatment and its own tinted block rather than being
              buried as another paragraph. */}
          <Box
            sx={{
              mt: 1.5,
              p: 1.5,
              borderRadius: 2,
              bgcolor: alpha(theme.palette.primary.main, 0.05),
              border: 1,
              borderColor: alpha(theme.palette.primary.main, 0.2),
            }}
          >
            <Typography
              variant="caption"
              sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', fontSize: 10, color: 'primary.main', display: 'block', mb: 0.75 }}
            >
              Worked example · real figures from the workbook
            </Typography>
            <Stack spacing={0.6}>
              {guide.example.map((line, i) => (
                <Typography
                  key={i}
                  variant="caption"
                  sx={{
                    display: 'block',
                    lineHeight: 1.6,
                    // Calculation lines are set in mono so the arithmetic lines
                    // up and can be checked at a glance.
                    fontFamily: /[=×÷]/.test(line) ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined,
                    fontSize: /[=×÷]/.test(line) ? 11.5 : 12,
                    color: /[=×÷]/.test(line) ? 'text.primary' : 'text.secondary',
                  }}
                >
                  {line}
                </Typography>
              ))}
            </Stack>
          </Box>

          {/* The same arithmetic, on the rows actually in view. Pinning is
              required to click a cell reference, since a hover-opened panel
              lets the pointer through to the page beneath. */}
          {derivation && (
            <Box sx={{ mt: 1.5 }}>
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.4 }}>
                <ReceiptLongRoundedIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', fontSize: 10, color: 'text.secondary' }}
                >
                  This figure, from the data in view
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75, lineHeight: 1.6 }}>
                {derivation.scope}
              </Typography>
              <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                {derivation.steps.map((step, i) => (
                  <Stack
                    key={i}
                    direction="row"
                    spacing={1}
                    alignItems="baseline"
                    sx={{
                      px: 1.25,
                      py: 0.75,
                      borderTop: i === 0 ? 0 : 1,
                      borderColor: 'divider',
                      bgcolor: step.isTotal ? alpha(theme.palette.primary.main, 0.06) : undefined,
                    }}
                  >
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography
                        variant="caption"
                        sx={{ display: 'block', fontWeight: step.isTotal ? 800 : 500, lineHeight: 1.5 }}
                      >
                        {step.label}
                      </Typography>
                      {step.expression && (
                        <Typography
                          variant="caption"
                          sx={{
                            display: 'block',
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                            fontSize: 11,
                            color: 'text.secondary',
                          }}
                        >
                          {step.expression}
                        </Typography>
                      )}
                      {step.refs?.length ? (
                        <Typography
                          component="button"
                          type="button"
                          variant="caption"
                          onClick={() => {
                            setPinned(true);
                            setOpenRefs(step.refs ?? null);
                          }}
                          sx={{
                            border: 0,
                            p: 0,
                            bgcolor: 'transparent',
                            cursor: 'pointer',
                            fontFamily: 'monospace',
                            fontSize: 10.5,
                            color: 'text.disabled',
                            textDecorationLine: 'underline',
                            textDecorationStyle: 'dotted',
                            '&:hover': { color: 'primary.main' },
                          }}
                        >
                          {step.refs.join(' · ')}
                        </Typography>
                      ) : null}
                    </Box>
                    {step.value && (
                      <Typography
                        variant="caption"
                        sx={{ fontWeight: step.isTotal ? 800 : 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
                      >
                        {step.value}
                      </Typography>
                    )}
                  </Stack>
                ))}
              </Box>
              {derivation.note && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75, lineHeight: 1.6 }}>
                  {derivation.note}
                </Typography>
              )}
            </Box>
          )}

          <Section icon={<LightbulbRoundedIcon sx={{ fontSize: 15 }} />} title="Why it matters">
            {guide.soWhat}
          </Section>

          {guide.caveat && (
            <Box
              sx={{
                mt: 1.5,
                p: 1.25,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.warning.main, 0.08),
                border: 1,
                borderColor: alpha(theme.palette.warning.main, 0.3),
              }}
            >
              <Stack direction="row" spacing={0.75} alignItems="flex-start">
                <WarningAmberRoundedIcon sx={{ fontSize: 15, color: 'warning.dark', mt: '1px' }} />
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 800, display: 'block', color: 'warning.dark' }}>
                    Read with care
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                    {guide.caveat}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          )}

          {guide.terms && guide.terms.length > 0 && (
            <>
              <Divider sx={{ my: 1.75 }} />
              <Typography
                variant="caption"
                sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', fontSize: 10, color: 'text.secondary', display: 'block', mb: 0.75 }}
              >
                Terms used here
              </Typography>
              <Stack spacing={1}>
                {guide.terms.map((t) => (
                  <Box key={t.term}>
                    <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
                      {t.term}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                      {t.definition}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </>
          )}
        </Box>
      </Popover>
      <WorkbookRefDialog refs={openRefs} onClose={() => setOpenRefs(null)} />
    </>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mt: 1.5 }}>
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.4 }}>
        <Box sx={{ color: 'text.secondary', display: 'flex' }}>{icon}</Box>
        <Typography
          variant="caption"
          sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', fontSize: 10, color: 'text.secondary' }}
        >
          {title}
        </Typography>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.65, display: 'block' }}>
        {children}
      </Typography>
    </Box>
  );
}
