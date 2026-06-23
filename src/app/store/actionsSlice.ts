import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ActionLogEntry, ApproachKind, CopilotAction, DecisionWriteback, Recommendation } from '@/types';

export interface ActionsState {
  executedRecIds: string[];
  dismissedRecIds: string[];
  snoozedRecIds: string[];
  delegatedRecIds: Record<string, string>;
  decisions: DecisionWriteback[];
  log: ActionLogEntry[];
}

const initialState: ActionsState = {
  executedRecIds: [],
  dismissedRecIds: [],
  snoozedRecIds: [],
  delegatedRecIds: {},
  decisions: [],
  log: [],
};

const now = () => new Date().toISOString();
let seq = 0;
const logId = () => `log-${Date.now()}-${seq++}`;

const actionsSlice = createSlice({
  name: 'actions',
  initialState,
  reducers: {
    executeRecommendation(state, action: PayloadAction<Recommendation>) {
      const r = action.payload;
      if (!state.executedRecIds.includes(r.id)) state.executedRecIds.push(r.id);
      state.snoozedRecIds = state.snoozedRecIds.filter((id) => id !== r.id);
      state.log.unshift({
        id: logId(),
        recommendationId: r.id,
        laneId: r.laneId,
        shipmentId: r.shipmentId,
        label: r.title,
        type: r.type,
        state: 'task-created',
        actor: state.delegatedRecIds[r.id] ?? 'You',
        ownerPersona: r.ownerPersona,
        approach: r.approach,
        savingTonnes: r.estCo2eSavingTonnes,
        timestamp: now(),
      });
    },
    dismissRecommendation(state, action: PayloadAction<string>) {
      if (!state.dismissedRecIds.includes(action.payload)) state.dismissedRecIds.push(action.payload);
    },
    snoozeRecommendation(state, action: PayloadAction<Recommendation>) {
      const id = action.payload.id;
      if (!state.snoozedRecIds.includes(id)) state.snoozedRecIds.push(id);
    },
    unsnoozeRecommendation(state, action: PayloadAction<string>) {
      state.snoozedRecIds = state.snoozedRecIds.filter((id) => id !== action.payload);
    },
    assignRecommendationOwner(state, action: PayloadAction<{ rec: Recommendation; assignee: string }>) {
      const { rec, assignee } = action.payload;
      state.delegatedRecIds[rec.id] = assignee;
      state.log.unshift({
        id: logId(),
        recommendationId: rec.id,
        laneId: rec.laneId,
        label: `Delegated: ${rec.title}`,
        type: rec.type,
        state: 'planned',
        actor: assignee,
        ownerPersona: rec.ownerPersona,
        savingTonnes: rec.estCo2eSavingTonnes,
        timestamp: now(),
      });
    },
    adoptDecision(
      state,
      action: PayloadAction<{ laneId: string; laneLabel: string; approach: ApproachKind; savingTonnes?: number; note?: string }>,
    ) {
      const { laneId, laneLabel, approach, savingTonnes, note } = action.payload;
      state.decisions.unshift({ laneId, laneLabel, approach, savingTonnes, note, timestamp: now() });
      state.log.unshift({
        id: logId(),
        laneId,
        label: `Adopted ${approach.replace('_', ' ')} on ${laneLabel}`,
        type: 'decision',
        state: 'logged',
        actor: 'You',
        approach,
        savingTonnes,
        timestamp: now(),
      });
    },
    executeCopilotAction(state, action: PayloadAction<CopilotAction>) {
      const a = action.payload;
      if (a.recommendationId && !state.executedRecIds.includes(a.recommendationId))
        state.executedRecIds.push(a.recommendationId);
      state.log.unshift({
        id: logId(),
        recommendationId: a.recommendationId,
        laneId: a.laneId,
        shipmentId: a.shipmentId,
        label: a.label,
        type: a.type,
        state: 'task-created',
        actor: 'You',
        ownerPersona: a.ownerPersona,
        savingTonnes: a.savingTonnes,
        timestamp: now(),
      });
    },
  },
});

export const {
  executeRecommendation,
  dismissRecommendation,
  snoozeRecommendation,
  unsnoozeRecommendation,
  assignRecommendationOwner,
  adoptDecision,
  executeCopilotAction,
} = actionsSlice.actions;
export default actionsSlice.reducer;
