import { useMemo, useState } from 'react';
import { Autocomplete, Box, Button, Card, CardContent, Chip, MenuItem, Snackbar, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { KpiCard } from '@/components/cards/KpiCard';
import { TableSkeleton } from '@/components/loaders/Skeletons';
import { EmptyState } from '@/components/shared/EmptyState';
import { RecommendationCard } from '@/modules/decarbonization/components/RecommendationCard';
import { AuditLog } from '@/modules/decarbonization/components/AuditLog';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { adoptDecision, assignRecommendationOwner, dismissRecommendation, executeRecommendation, snoozeRecommendation } from '@/app/store/actionsSlice';
import { setSelectedLane } from '@/app/store/uiSlice';
import { PERSONAS } from '@/constants/personas';
import { APPROACH_LABEL } from '@/constants/app';
import type { ApproachKind, KpiMetric, Lane, Recommendation } from '@/types';
import { formatTonnes } from '@/utils/format';

type GroupKey = 'priority' | 'thisWeek' | 'delegated' | 'snoozed' | 'executed';
const GROUPS: { key: GroupKey; label: string }[] = [
  { key: 'priority', label: 'Priority' },
  { key: 'thisWeek', label: 'This Quarter' },
  { key: 'delegated', label: 'Delegated' },
  { key: 'snoozed', label: 'Snoozed' },
  { key: 'executed', label: 'Executed' },
];
const OWNER_OPTIONS = PERSONAS.map((p) => p.name);
const APPROACHES: ApproachKind[] = ['best_co2', 'balanced', 'optimal'];

/** Action tracker — decisions, delegation and the audit trail, folded into the hub. */
export function ActionsPanel() {
  const ds = useDataSource();
  const dispatch = useAppDispatch();
  const persona = useAppSelector((s) => s.persona.current);
  const filters = useAppSelector((s) => s.filters.value);
  const { executedRecIds, dismissedRecIds, snoozedRecIds, delegatedRecIds, decisions, log } = useAppSelector((s) => s.actions);

  const { data: recs, status } = useAsync(() => ds.getRecommendations({ persona, filters }), [persona, filters]);
  const { data: lanes } = useAsync(() => ds.getLanes({ filters }), [filters]);

  const groups = useMemo(() => {
    const open: Recommendation[] = [];
    const snoozed: Recommendation[] = [];
    const delegated: Recommendation[] = [];
    const executed: Recommendation[] = [];
    for (const r of recs ?? []) {
      if (dismissedRecIds.includes(r.id)) continue;
      if (executedRecIds.includes(r.id)) executed.push(r);
      else if (snoozedRecIds.includes(r.id)) snoozed.push(r);
      else if (delegatedRecIds[r.id]) delegated.push(r);
      else open.push(r);
    }
    const priority = open.filter((r, i) => i < 8 || r.type === 'air-avoidance' || r.estCo2eSavingTonnes >= 6);
    const prioritySet = new Set(priority.map((r) => r.id));
    const thisWeek = open.filter((r) => !prioritySet.has(r.id));
    return { priority, thisWeek, delegated, snoozed, executed };
  }, [recs, executedRecIds, dismissedRecIds, snoozedRecIds, delegatedRecIds]);

  const [tab, setTab] = useState<GroupKey>('priority');
  const [toast, setToast] = useState<string | null>(null);
  const visible = groups[tab];

  const queuedSaving = (recs ?? []).filter((r) => executedRecIds.includes(r.id)).reduce((s, r) => s + r.estCo2eSavingTonnes, 0);

  const kpis: KpiMetric[] = [
    { id: 'priority', label: 'Priority actions', value: groups.priority.length, unit: 'number', intent: groups.priority.length ? 'risk' : 'neutral', icon: 'risk', hint: 'high-impact, awaiting decision' },
    { id: 'executed', label: 'Executed this session', value: executedRecIds.length, unit: 'number', intent: 'positive', icon: 'green', hint: 'tasks created' },
    { id: 'queued', label: 'CO₂e saving queued', value: queuedSaving, unit: 'tonnes', display: `${formatTonnes(queuedSaving)}/yr`, intent: 'opportunity', icon: 'savings', hint: 'from executed actions' },
    { id: 'decisions', label: 'Decisions logged', value: decisions.length, unit: 'number', intent: 'neutral', icon: 'lanes', hint: 'lane approach adopted' },
  ];

  const [lane, setLane] = useState<Lane | null>(null);
  const [approach, setApproach] = useState<ApproachKind>('best_co2');
  const [note, setNote] = useState('');

  const savingFor = (l: Lane, a: ApproachKind): number => {
    const per = a === 'best_co2' ? l.currentPerShipmentTonnes - l.bestPerShipmentTonnes : a === 'balanced' ? l.currentPerShipmentTonnes - l.balancedPerShipmentTonnes : 0;
    return Math.max(0, per) * l.annualFrequency;
  };

  const submitDecision = () => {
    if (!lane) return;
    dispatch(adoptDecision({ laneId: lane.laneId, laneLabel: lane.label, approach, savingTonnes: savingFor(lane, approach), note: note || undefined }));
    setToast(`Decision logged · ${APPROACH_LABEL[approach]} on ${lane.label}`);
    setLane(null);
    setNote('');
  };

  return (
    <Box>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, mb: 3 }}>
        {kpis.map((m) => <KpiCard key={m.id} metric={m} />)}
      </Box>

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '1.6fr 1fr' } }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Execute priorities</Typography>
          <Typography variant="caption" color="text.secondary">Grouped by urgency · execute, delegate, snooze or dismiss</Typography>
          <Tabs value={tab} onChange={(_, v) => setTab(v as GroupKey)} variant="scrollable" scrollButtons="auto" sx={{ mt: 1.5, minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0.5 } }}>
            {GROUPS.map((g) => (
              <Tab key={g.key} value={g.key} label={<Stack direction="row" spacing={0.75} alignItems="center"><span>{g.label}</span><Chip size="small" label={groups[g.key].length} sx={{ height: 18, fontSize: 11 }} /></Stack>} />
            ))}
          </Tabs>
          <Stack spacing={1.5} sx={{ mt: 2 }}>
            {status === 'loading' && <TableSkeleton rows={4} />}
            {status === 'success' && visible.length === 0 && <EmptyState title="Nothing here" description={`No ${GROUPS.find((g) => g.key === tab)?.label.toLowerCase()} actions in scope.`} />}
            {visible.map((r) => (
              <RecommendationCard
                key={r.id}
                rec={r}
                executed={executedRecIds.includes(r.id)}
                snoozed={snoozedRecIds.includes(r.id)}
                delegate={delegatedRecIds[r.id]}
                ownerOptions={OWNER_OPTIONS}
                onExecute={() => { dispatch(executeRecommendation(r)); setToast(`Executed · ${formatTonnes(r.estCo2eSavingTonnes)}/yr queued`); }}
                onSnooze={() => { dispatch(snoozeRecommendation(r)); setToast('Snoozed'); }}
                onDismiss={() => { dispatch(dismissRecommendation(r.id)); setToast('Dismissed'); }}
                onAssign={(o) => { dispatch(assignRecommendationOwner({ rec: r, assignee: o })); setToast(`Delegated to ${o}`); }}
                onOpenLane={r.laneId ? () => dispatch(setSelectedLane(r.laneId!)) : undefined}
              />
            ))}
          </Stack>
        </Box>

        <Stack spacing={2}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Log a lane decision</Typography>
              <Typography variant="caption" color="text.secondary">Adopt an approach for a lane — recorded as ESG evidence</Typography>
              <Stack spacing={1.75} sx={{ mt: 2 }}>
                <Autocomplete size="small" options={lanes ?? []} getOptionLabel={(o) => o.label} value={lane} onChange={(_, v) => setLane(v)} isOptionEqualToValue={(o, v) => o.laneId === v.laneId} renderInput={(params) => <TextField {...params} label="Lane" placeholder="Search lanes" />} />
                <TextField select size="small" label="Approach" value={approach} onChange={(e) => setApproach(e.target.value as ApproachKind)}>
                  {APPROACHES.map((a) => <MenuItem key={a} value={a}>{APPROACH_LABEL[a]}</MenuItem>)}
                </TextField>
                {lane && <Typography variant="caption" color="primary.main" sx={{ fontWeight: 600 }}>Estimated saving: {formatTonnes(savingFor(lane, approach))}/yr</Typography>}
                <TextField size="small" label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2} />
                <Button variant="contained" startIcon={<SaveRoundedIcon />} disabled={!lane} onClick={submitDecision}>Log decision</Button>
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>Audit trail</Typography>
              <AuditLog entries={log} />
            </CardContent>
          </Card>
        </Stack>
      </Box>

      <Snackbar open={Boolean(toast)} autoHideDuration={2600} onClose={() => setToast(null)} message={toast ?? ''} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
}
