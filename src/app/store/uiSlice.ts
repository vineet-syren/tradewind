import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface UiState {
  sidebarOpen: boolean;
  themeMode: 'light' | 'dark';
  /** Lane open in the detail drawer, if any. */
  selectedLaneId: string | null;
  /** Shipment open in the detail drawer, if any. Mutually exclusive with the lane. */
  selectedShipmentId: string | null;
}

const initialState: UiState = {
  sidebarOpen: true,
  themeMode: 'light',
  selectedLaneId: null,
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
    setSelectedLane(state, action: PayloadAction<string | null>) {
      state.selectedLaneId = action.payload;
      state.selectedShipmentId = null;
    },
    setSelectedShipment(state, action: PayloadAction<string | null>) {
      state.selectedShipmentId = action.payload;
      state.selectedLaneId = null;
    },
    closeDrawer(state) {
      state.selectedLaneId = null;
      state.selectedShipmentId = null;
    },
  },
});

export const { toggleSidebar, setSidebarOpen, toggleTheme, setSelectedLane, setSelectedShipment, closeDrawer } =
  uiSlice.actions;
export default uiSlice.reducer;
