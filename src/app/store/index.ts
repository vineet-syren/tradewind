import { configureStore } from '@reduxjs/toolkit';
import uiReducer from './uiSlice';
import personaReducer from './personaSlice';
import filtersReducer from './filtersSlice';
import actionsReducer from './actionsSlice';

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    persona: personaReducer,
    filters: filtersReducer,
    actions: actionsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
