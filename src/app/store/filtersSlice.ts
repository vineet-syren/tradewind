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

/**
 * A filter counts as applied iff it is a non-empty array or a truthy scalar —
 * `patchFilters` leaves empty keys behind, so key existence is not reliable.
 */
export function countActiveFilters(filters: ShipmentFilters): number {
  return Object.values(filters).filter((v) => (Array.isArray(v) ? v.length > 0 : Boolean(v))).length;
}
