import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { PersonaId } from '@/types';
import { DEFAULT_PERSONA } from '@/constants/personas';

interface PersonaState {
  current: PersonaId;
}

const initialState: PersonaState = { current: DEFAULT_PERSONA };

const personaSlice = createSlice({
  name: 'persona',
  initialState,
  reducers: {
    setPersona(state, action: PayloadAction<PersonaId>) {
      state.current = action.payload;
    },
  },
});

export const { setPersona } = personaSlice.actions;
export default personaSlice.reducer;
