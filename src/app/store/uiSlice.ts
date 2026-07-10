import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface UiState {
  sidebarOpen: boolean;
  themeMode: 'light' | 'dark';
  selectedLaneId: string | null;
  /** True when Lane 360 was opened from a shipped/in-transit shipment — route decision is locked. */
  laneReadOnly: boolean;
  selectedShipmentId: string | null;
}

const initialState: UiState = {
  sidebarOpen: true,
  themeMode: 'light',
  selectedLaneId: null,
  laneReadOnly: false,
  selectedShipmentId: null,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen(state, action: PayloadAction<boolean>) {
      state.sidebarOpen = action.payload;
    },
    toggleTheme(state) {
      state.themeMode = state.themeMode === 'light' ? 'dark' : 'light';
    },
    setSelectedLane(state, action: PayloadAction<string | { laneId: string; readOnly?: boolean } | null>) {
      const p = action.payload;
      if (p && typeof p === 'object') {
        state.selectedLaneId = p.laneId;
        state.laneReadOnly = Boolean(p.readOnly);
      } else {
        state.selectedLaneId = p;
        state.laneReadOnly = false;
      }
      state.selectedShipmentId = null;
    },
    setSelectedShipment(state, action: PayloadAction<string | null>) {
      state.selectedShipmentId = action.payload;
      state.selectedLaneId = null;
      state.laneReadOnly = false;
    },
    closeDrawer(state) {
      state.selectedLaneId = null;
      state.selectedShipmentId = null;
      state.laneReadOnly = false;
    },
  },
});

export const {
  toggleSidebar,
  setSidebarOpen,
  toggleTheme,
  setSelectedLane,
  setSelectedShipment,
  closeDrawer,
} = uiSlice.actions;
export default uiSlice.reducer;
