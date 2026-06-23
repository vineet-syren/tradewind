import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { PageHeader } from '@/components/layout/PageHeader';
import { ScopeNote } from '@/components/layout/ScopeNote';
import { FilterPanel } from '@/components/filters/FilterPanel';
import { KpiCard } from '@/components/cards/KpiCard';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { ModeSplitDonut } from '@/components/charts/ModeSplitDonut';
import { KpiSkeleton, ChartSkeleton } from '@/components/loaders/Skeletons';
import { AgentResponseCard } from '@/modules/decarbonization/components/AgentResponseCard';
import { LaneCard } from '@/modules/decarbonization/components/LaneCard';
import { PulseFeed } from '@/modules/decarbonization/components/PulseFeed';
import { AuditLog } from '@/modules/decarbonization/components/AuditLog';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { setSelectedLane } from '@/app/store/uiSlice';
import { executeCopilotAction, executeRecommendation } from '@/app/store/actionsSlice';
import { getPersona } from '@/constants/personas';
import { AGENT_CATALOG } from '@/constants/agents';
import { NavIcon } from '@/components/layout/iconRegistry';
import type { CopilotAction, CopilotResult, PersonaId } from '@/types';

const PROMPTS_BY_PERSONA: Record<PersonaId, string[]> = {
  cso: ['What is our progress toward the 15% ambition?', 'Where are my biggest hotspots?', 'Recommend the best CO₂ actions', 'Show me the mode split'],
  logistics: ['Which lanes have the highest reduction potential?', 'Show me avoidable air shipments', 'Which lanes can shift road to rail?', 'Recommend the best CO₂ actions'],
  analyst: ['Where are my biggest hotspots?', 'Which customers should we prioritize?', 'What is our progress to the ambition?', 'Show me avoidable air shipments'],
  procurement: ['Which LSP is above fleet-average intensity?', 'Show me partner-influenceable saving', 'Show me vendor hotspots', 'Recommend the best CO₂ actions'],
};

let seq = 0;
const nextId = () => `cc-${Date.now()}-${seq++}`;

export default function CommandCenterPage() {
  const ds = useDataSource();
  const dispatch = useAppDispatch();
  const persona = useAppSelector((s) => s.persona.current);
  const filters = useAppSelector((s) => s.filters.value);
  const sessionLog = useAppSelector((s) => s.actions.log);

  const { data: kpis, status: kpiStatus } = useAsync(() => ds.getFocusKpis({ persona, filters }), [persona, filters]);
  const { data: footprint } = useAsync(() => ds.getFootprint({ persona, filters }), [persona, filters]);
  const { data: pulse } = useAsync(() => ds.getPulse({ persona, filters }), [persona, filters]);

  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [answers, setAnswers] = useState<{ id: string; query: string; result: CopilotResult }[]>([]);
  const [auditOpen, setAuditOpen] = useState(false);

  const p = getPersona(persona);
  const empty = answers.length === 0 && !thinking;

  useEffect(() => {
    setAnswers([]);
    setInput('');
    setThinking(false);
  }, [persona]);

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

  const onExecuteAction = (a: CopilotAction) => dispatch(executeCopilotAction(a));
  const onExecuteRec = (recId: string) => {
    for (const a of answers) {
      const rec = a.result.view.recommendations?.find((r) => r.id === recId);
      if (rec) {
        dispatch(executeRecommendation(rec));
        return;
      }
    }
  };

  return (
    <Box>
      <PageHeader
        overline={`Command Center · ${p.name}`}
        title="Steer every shipment to its lowest-carbon lane"
        subtitle={p.lens}
        actions={<ScopeNote />}
      />

      <FilterPanel />

      {/* Prompt hero */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ py: { xs: 3, md: 3.5 }, px: { xs: 2.5, md: 5 } }}>
          <Stack spacing={2.25} alignItems="center" sx={{ maxWidth: 780, mx: 'auto' }}>
            <Typography variant="h6" align="center" sx={{ fontWeight: 700 }}>
              Ask Tradewind about your downstream transport emissions
            </Typography>
            <TextField
              fullWidth
              placeholder="e.g. Which lanes have the highest reduction potential?"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void ask(input);
                }
              }}
              InputProps={{
                sx: { borderRadius: 999, pl: 2.5, pr: 1, py: 0.5, fontSize: 15 },
                endAdornment: (
                  <IconButton
                    color="primary"
                    onClick={() => ask(input)}
                    disabled={!input.trim() || thinking}
                    sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.dark' }, '&.Mui-disabled': { bgcolor: 'action.disabledBackground' } }}
                  >
                    <SendRoundedIcon fontSize="small" />
                  </IconButton>
                ),
              }}
            />
            <Stack direction="row" flexWrap="wrap" useFlexGap gap={1} justifyContent="center">
              {PROMPTS_BY_PERSONA[persona].map((q) => (
                <Chip key={q} label={q} variant="outlined" onClick={() => ask(q)} sx={{ cursor: 'pointer', fontWeight: 500 }} />
              ))}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Conversation */}
      {(answers.length > 0 || thinking) && (
        <Stack spacing={2.5} sx={{ mb: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Conversation
            </Typography>
            <Button size="small" variant="text" onClick={() => setAnswers([])}>
              New question
            </Button>
          </Stack>
          {answers.map(({ id, query, result }) => (
            <Stack key={id} spacing={1.25}>
              <UserBubble persona={p.name} query={query} />
              <AgentResponseCard
                result={result}
                onExecuteAction={onExecuteAction}
                onExecuteRec={onExecuteRec}
                onOpenLane={(laneId) => dispatch(setSelectedLane(laneId))}
                onFollowup={(q) => ask(q)}
              />
            </Stack>
          ))}
          {thinking && pending && (
            <Stack spacing={1.25}>
              <UserBubble persona={p.name} query={pending} />
              <Stack direction="row" spacing={1} alignItems="center" sx={{ pl: 1, py: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">
                  Tradewind is analyzing your network…
                </Typography>
              </Stack>
            </Stack>
          )}
        </Stack>
      )}

      {/* Focus panel */}
      {empty && (
        <Stack spacing={3}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.25 }}>
              Your focus
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Role-aware highlights · changes with persona and filters
            </Typography>
            <Box sx={{ mt: 1.5 }}>
              {kpiStatus === 'loading' || !kpis ? (
                <KpiSkeleton count={4} />
              ) : (
                <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' } }}>
                  {kpis.map((m) => (
                    <KpiCard key={m.id} metric={m} />
                  ))}
                </Box>
              )}
            </Box>
          </Box>

          <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '1.6fr 1fr' } }}>
            <Stack spacing={2.5}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
                  Priority lanes to decarbonize
                </Typography>
                {!footprint ? (
                  <ChartSkeleton height={200} />
                ) : (
                  <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                    {footprint.topLanes.slice(0, 4).map((l) => (
                      <LaneCard key={l.laneId} lane={l} onClick={() => dispatch(setSelectedLane(l.laneId))} />
                    ))}
                  </Box>
                )}
              </Box>
              {footprint && (
                <ChartContainer title="CO₂e by mode" subtitle="Ocean-led, with air as the governed exception">
                  <ModeSplitDonut data={footprint.modeSplit} />
                </ChartContainer>
              )}
            </Stack>

            <Stack spacing={2.5}>
              <ChartContainer title="What changed" subtitle="Network pulse">
                {pulse ? <PulseFeed events={pulse} max={7} /> : <ChartSkeleton height={200} />}
              </ChartContainer>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
                    Decisioning agents
                  </Typography>
                  <Stack spacing={1.25}>
                    {AGENT_CATALOG.slice(0, 5).map((a) => (
                      <Stack key={a.id} direction="row" spacing={1.25} alignItems="center">
                        <Box sx={{ width: 32, height: 32, borderRadius: 2, bgcolor: (t) => alpha(t.palette.primary.main, 0.12), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <NavIcon iconKey={a.iconKey} fontSize="small" color="primary" />
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                            {a.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {a.role}
                          </Typography>
                        </Box>
                      </Stack>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          </Box>
        </Stack>
      )}

      {/* Audit footer */}
      <Box sx={{ mt: 4 }}>
        <Button
          fullWidth
          variant="text"
          color="inherit"
          onClick={() => setAuditOpen((v) => !v)}
          startIcon={<HistoryRoundedIcon />}
          endIcon={<ExpandMoreRoundedIcon sx={{ transform: auditOpen ? 'rotate(180deg)' : 'none', transition: '.2s' }} />}
          sx={{ justifyContent: 'space-between', color: 'text.secondary', fontWeight: 600 }}
        >
          Action audit log · {sessionLog.length} this session
        </Button>
        <Collapse in={auditOpen}>
          <Card sx={{ mt: 1 }}>
            <CardContent>
              <AuditLog entries={sessionLog} />
            </CardContent>
          </Card>
        </Collapse>
      </Box>
    </Box>
  );
}

function UserBubble({ persona, query }: { persona: string; query: string }) {
  return (
    <Stack direction="row" justifyContent="flex-end" sx={{ pl: { xs: 0, md: 6 } }}>
      <Box sx={{ maxWidth: '85%', bgcolor: (t) => alpha(t.palette.primary.main, 0.08), border: 1, borderColor: (t) => alpha(t.palette.primary.main, 0.22), borderRadius: 2, borderTopRightRadius: 4, px: 2, py: 1.25 }}>
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
