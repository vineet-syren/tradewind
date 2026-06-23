import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ShipmentFilters } from '@/types';

interface FiltersState {
  value: ShipmentFilters;
}

const initialState: FiltersState = { value: {} };

const filtersSlice = createSlice({
  name: 'filters',
  initialState,
  reducers: {
    setFilters(state, action: PayloadAction<ShipmentFilters>) {
      state.value = action.payload;
    },
    patchFilters(state, action: PayloadAction<Partial<ShipmentFilters>>) {
      state.value = { ...state.value, ...action.payload };
    },
    clearFilters(state) {
      state.value = {};
    },
  },
});

export const { setFilters, patchFilters, clearFilters } = filtersSlice.actions;
export default filtersSlice.reducer;
