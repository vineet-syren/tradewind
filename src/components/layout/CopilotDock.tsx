import { useEffect, useRef, useState } from 'react';
import {
  Badge,
  Box,
  Chip,
  CircularProgress,
  Fab,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { AgentResponseCard } from '@/modules/decarbonization/components/AgentResponseCard';
import { useDataSource } from '@/hooks/useDataSource';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { setSelectedLane } from '@/app/store/uiSlice';
import { getPersona } from '@/constants/personas';
import type { CopilotResult, PersonaId } from '@/types';

/**
 * Suggested questions per persona — every one routes to an intent the assistant
 * can actually answer (decisions, gateways, air, hotspots, mode split, trend).
 */
const PROMPTS_BY_PERSONA: Record<PersonaId, string[]> = {
  logistics: [
    'What should I change on the shipments still to be planned?',
    'Why is the Chennai gateway heavier than Nhava Sheva?',
    'What did air freight cost us in CO₂e?',
    'Where is our transport CO₂e concentrated?',
  ],
  cso: [
    'How does the latest year compare with the baseline?',
    'Where is our transport CO₂e concentrated?',
    'What did air freight cost us in CO₂e?',
    'Show me the mode split',
  ],
  analyst: [
    'Where is our transport CO₂e concentrated?',
    'Show me the mode split',
    'How does the latest year compare with the baseline?',
    'Why is the Chennai gateway heavier than Nhava Sheva?',
  ],
};

let seq = 0;
const nextId = () => `cc-${Date.now()}-${seq++}`;

/**
 * Ask Tradewind — a right-docked chat widget available on every page. Collapses
 * to a floating bubble and expands to a panel; the conversation and open/closed
 * state persist across navigation because the dock lives in the app shell.
 * Same features as the old landing page — prompt, persona-aware suggestions,
 * and grounded answers with their views.
 */
export function CopilotDock() {
  const ds = useDataSource();
  const dispatch = useAppDispatch();
  const theme = useTheme();
  const persona = useAppSelector((s) => s.persona.current);

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [answers, setAnswers] = useState<{ id: string; query: string; result: CopilotResult }[]>([]);
  const bodyRef = useRef<HTMLDivElement>(null);

  const p = getPersona(persona);
  const prompts = PROMPTS_BY_PERSONA[persona] ?? PROMPTS_BY_PERSONA.cso;
  const empty = answers.length === 0 && !thinking;

  // Switching persona resets the conversation (its answers were role-scoped).
  useEffect(() => {
    setAnswers([]);
    setInput('');
    setThinking(false);
  }, [persona]);

  // Keep the newest message in view.
  useEffect(() => {
    if (open) bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
  }, [answers, thinking, open]);

  const ask = async (q: string) => {
    const query = q.trim();
    if (!query || thinking) return;
    setInput('');
    setThinking(true);
    setPending(query);
    try {
      const result = await ds.askCopilot(query, persona);
      setAnswers((prev) => [...prev, { id: nextId(), query, result }]);
    } finally {
      setThinking(false);
      setPending(null);
    }
  };

  // Minimized — a labelled bubble, bottom-right, with a dot when a chat is live.
  if (!open) {
    return (
      <Tooltip title="Ask Tradewind — your carbon assistant" placement="left">
        <Fab
          className="tw-copilot-dock"
          color="primary"
          variant="extended"
          onClick={() => setOpen(true)}
          sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: (t) => t.zIndex.drawer - 1, fontWeight: 700, boxShadow: 6 }}
        >
          <Badge color="error" variant="dot" invisible={answers.length === 0} sx={{ '& .MuiBadge-badge': { top: 2, right: 2 } }}>
            <AutoAwesomeRoundedIcon sx={{ mr: 1 }} />
          </Badge>
          Ask Tradewind
        </Fab>
      </Tooltip>
    );
  }

  // Expanded — a docked chat panel, bottom-right (near full-width on mobile).
  return (
    <Paper
      elevation={12}
      className="tw-copilot-dock"
      sx={{
        position: 'fixed',
        zIndex: (t) => t.zIndex.drawer - 1,
        bottom: { xs: 0, sm: 24 },
        right: { xs: 0, sm: 24 },
        width: { xs: '100vw', sm: 420 },
        height: { xs: '100vh', sm: 'min(680px, calc(100vh - 96px))' },
        display: 'flex',
        flexDirection: 'column',
        borderRadius: { xs: 0, sm: 3 },
        overflow: 'hidden',
        border: 1,
        borderColor: 'divider',
      }}
    >
      {/* Header */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ px: 2, py: 1.5, bgcolor: (t) => alpha(t.palette.primary.main, theme.palette.mode === 'dark' ? 0.18 : 0.08), borderBottom: 1, borderColor: 'divider' }}
      >
        <AutoAwesomeRoundedIcon color="primary" />
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            Ask Tradewind
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {p.name}
          </Typography>
        </Box>
        {answers.length > 0 && (
          <Tooltip title="New conversation">
            <IconButton size="small" onClick={() => setAnswers([])} aria-label="New conversation">
              <RefreshRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Minimize">
          <IconButton size="small" onClick={() => setOpen(false)} aria-label="Minimize assistant">
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Conversation / empty state */}
      <Box ref={bodyRef} sx={{ flexGrow: 1, overflowY: 'auto', px: 2, py: 2 }}>
        {empty ? (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Ask about your downstream transport emissions — footprint, hotspots, air freight, partners or reduction suggestions.
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Try one of these to start
            </Typography>
            <Stack direction="row" flexWrap="wrap" useFlexGap gap={0.75}>
              {prompts.map((q) => (
                <Chip key={q} label={q} variant="outlined" onClick={() => ask(q)} sx={{ cursor: 'pointer', fontWeight: 500 }} />
              ))}
            </Stack>
          </Stack>
        ) : (
          <Stack spacing={2}>
            {answers.map(({ id, query, result }) => (
              <Stack key={id} spacing={1.25}>
                <UserBubble persona={p.name} query={query} />
                <AgentResponseCard result={result} onOpenLane={(laneId) => dispatch(setSelectedLane(laneId))} onFollowup={(q) => ask(q)} />
              </Stack>
            ))}
            {thinking && pending && (
              <Stack spacing={1.25}>
                <UserBubble persona={p.name} query={pending} />
                <Stack direction="row" spacing={1} alignItems="center" sx={{ pl: 1, py: 1 }}>
                  <CircularProgress size={16} />
                  <Typography variant="body2" color="text.secondary">
                    Computing from your network data…
                  </Typography>
                </Stack>
              </Stack>
            )}
          </Stack>
        )}
      </Box>

      {/* Input */}
      <Box sx={{ borderTop: 1, borderColor: 'divider', px: 2, pt: 1.5, pb: 2 }}>
        <TextField
          fullWidth
          size="small"
          placeholder={prompts[0]}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void ask(input);
            }
          }}
          InputProps={{
            sx: { borderRadius: 999, pl: 2, pr: 0.5, py: 0.25 },
            endAdornment: (
              <IconButton
                color="primary"
                onClick={() => ask(input)}
                disabled={!input.trim() || thinking}
                aria-label="Send"
                sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.dark' }, '&.Mui-disabled': { bgcolor: 'action.disabledBackground' } }}
              >
                <SendRoundedIcon fontSize="small" />
              </IconButton>
            ),
          }}
        />
      </Box>
    </Paper>
  );
}

function UserBubble({ persona, query }: { persona: string; query: string }) {
  return (
    <Stack direction="row" justifyContent="flex-end">
      <Box sx={{ maxWidth: '90%', bgcolor: (t) => alpha(t.palette.primary.main, 0.08), border: 1, borderColor: (t) => alpha(t.palette.primary.main, 0.22), borderRadius: 2, borderTopRightRadius: 4, px: 1.75, py: 1 }}>
        <Typography variant="caption" color="primary.main" sx={{ display: 'block', mb: 0.25, fontWeight: 700, letterSpacing: '0.04em' }}>
          {persona} asked
        </Typography>
        <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
          {query}
        </Typography>
      </Box>
    </Stack>
  );
}
