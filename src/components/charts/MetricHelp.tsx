import { useEffect, useRef, useState } from 'react';
import { Box, Chip, ClickAwayListener, Divider, Fade, IconButton, Popper, Stack, Tooltip, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import CalculateRoundedIcon from '@mui/icons-material/CalculateRounded';
import LightbulbRoundedIcon from '@mui/icons-material/LightbulbRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import type { MetricGuide } from '@/constants/metricGuide';
import type { Derivation } from '@/utils/derivations';
import { WorkbookRefDialog } from '@/components/shared/WorkbookRefDialog';

/**
 * The "?" beside a chart or KPI: what it means, how it is calculated, the live
 * arithmetic behind the figure on screen, and why it matters.
 *
 * Built on Popper rather than Popover, which matters for two reasons that were
 * not obvious until this was used at a narrow width. Popover renders a modal
 * with a backdrop, so keeping the page usable under a hover-opened panel meant
 * disabling pointer events on the root and re-enabling them on the paper — and
 * the pointer then crosses a dead gap between button and panel, which loses the
 * hover. Popover also does not reposition when it would overflow the viewport,
 * so a "?" near a right edge opened a panel that was clipped or off-screen and
 * looked like nothing had happened at all.
 *
 * Popper has no backdrop, flips and shifts to stay on screen, and leaves the
 * page interactive underneath. Hover opens it, a short close delay lets the
 * pointer travel into it, and clicking pins it so the cell references inside can
 * be used without it vanishing.
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
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [openRefs, setOpenRefs] = useState<string[] | null>(null);
  // Closing is deferred so the pointer can cross the gap into the panel.
  const closeTimer = useRef<number | undefined>(undefined);
  /**
   * Pinned state, mirrored into a ref.
   *
   * A close is scheduled on a timer, and the callback that eventually runs was
   * created in an earlier render — so reading `pinned` from that closure gives
   * whatever it was when the timer was set, not what it is when it fires. Click
   * to pin, and a close scheduled a moment earlier still fires and shuts the
   * panel, which is indistinguishable from the button doing nothing. The ref is
   * always current, so the guard is always right.
   */
  const pinnedRef = useRef(false);
  const setPinnedBoth = (v: boolean) => {
    pinnedRef.current = v;
    setPinned(v);
  };

  const cancelClose = () => window.clearTimeout(closeTimer.current);
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => {
      if (!pinnedRef.current) setOpen(false);
    }, 200);
  };
  const close = () => {
    cancelClose();
    setPinnedBoth(false);
    setOpen(false);
  };

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  return (
    <>
      <Tooltip title={open ? '' : 'What is this? How is it calculated?'} disableInteractive>
        <IconButton
          ref={anchorRef}
          aria-label={`Explain: ${guide.title}`}
          aria-expanded={open}
          size="small"
          onMouseEnter={() => {
            cancelClose();
            setOpen(true);
          }}
          onMouseLeave={scheduleClose}
          onFocus={() => setOpen(true)}
          onClick={() => {
            cancelClose();
            // Click always ends with the panel open and pinned, except when it
            // is already pinned — then it closes. A click that merely toggled
            // `open` would close a panel the hover had just opened, which is
            // exactly the "nothing happens when I click it" symptom.
            if (pinnedRef.current) {
              close();
            } else {
              setOpen(true);
              setPinnedBoth(true);
            }
          }}
          sx={{
            p: size === 'tiny' ? 0.25 : 0.4,
            color: open ? 'primary.main' : 'text.disabled',
            '&:hover': { color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.08) },
          }}
        >
          <HelpOutlineRoundedIcon sx={{ fontSize: size === 'tiny' ? 15 : 17 }} />
        </IconButton>
      </Tooltip>

      <Popper
        open={open}
        anchorEl={anchorRef.current}
        placement="bottom-end"
        transition
        // Above dialogs' anchors but below a dialog itself, so opening a cell
        // reference from inside the panel puts the dialog on top.
        sx={{ zIndex: theme.zIndex.modal - 1 }}
        modifiers={[
          { name: 'offset', options: { offset: [0, 8] } },
          // Flip and shift rather than overflowing — the whole reason a "?" near
          // the right edge used to open a panel nobody could see.
          { name: 'flip', options: { padding: 12 } },
          { name: 'preventOverflow', options: { padding: 12, altAxis: true } },
        ]}
      >
        {({ TransitionProps }) => (
          <Fade {...TransitionProps} timeout={140}>
            <Box
              onMouseEnter={cancelClose}
              onMouseLeave={scheduleClose}
              sx={{
                width: 460,
                maxWidth: 'calc(100vw - 24px)',
                maxHeight: '78vh',
                overflowY: 'auto',
                borderRadius: 3,
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                boxShadow: '0 16px 48px rgba(15,23,42,.22)',
              }}
            >
              {/* The anchor is outside the panel, so a click on the "?" itself
                  counts as "away" and would close the panel the same click just
                  pinned — the button then appears to do nothing at all. Exclude
                  it, and let its own handler own the toggle. */}
              <ClickAwayListener
                onClickAway={(event) => {
                  if (anchorRef.current?.contains(event.target as Node)) return;
                  if (pinnedRef.current) close();
                }}
              >
                <Box sx={{ p: 2.25 }}>
                  <Stack direction="row" alignItems="flex-start" spacing={1} sx={{ mb: 1.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, flexGrow: 1 }}>
                      {guide.title}
                    </Typography>
                    {pinned ? (
                      <IconButton size="small" onClick={close} aria-label="Close explanation" sx={{ mt: -0.5, mr: -0.5 }}>
                        <CloseRoundedIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    ) : (
                      <Chip
                        size="small"
                        label="Click ? to keep open"
                        sx={{ height: 20, fontSize: 10, fontWeight: 700, color: 'text.secondary' }}
                      />
                    )}
                  </Stack>

                  <Section icon={<MenuBookRoundedIcon sx={{ fontSize: 15 }} />} title="What this shows">
                    {guide.what}
                  </Section>

                  <Section icon={<CalculateRoundedIcon sx={{ fontSize: 15 }} />} title="How it is calculated">
                    {guide.how}
                  </Section>

                  {/* The worked example is the part that earns trust, so it gets
                      the monospace treatment and its own tinted block rather than
                      being buried as another paragraph. */}
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
                              <Typography variant="caption" sx={{ display: 'block', fontWeight: step.isTotal ? 800 : 500, lineHeight: 1.5 }}>
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
              </ClickAwayListener>
            </Box>
          </Fade>
        )}
      </Popper>

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
