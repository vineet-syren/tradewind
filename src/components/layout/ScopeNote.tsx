import { Chip, Stack, Tooltip } from '@mui/material';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import FilterAltRoundedIcon from '@mui/icons-material/FilterAltRounded';
import { useAppSelector } from '@/app/store/hooks';
import { getPersona } from '@/constants/personas';

/** Small badge showing the active persona lens + any active filters. */
export function ScopeNote() {
  const persona = useAppSelector((s) => s.persona.current);
  const filters = useAppSelector((s) => s.filters.value);
  const activeFilterCount = Object.values(filters).filter(
    (v) => v != null && (Array.isArray(v) ? v.length > 0 : String(v).length > 0),
  ).length;
  const p = getPersona(persona);
  return (
    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
      <Tooltip title={p.lens}>
        <Chip icon={<VisibilityRoundedIcon />} label={`Viewing as ${p.name}`} variant="outlined" size="small" />
      </Tooltip>
      {activeFilterCount > 0 && (
        <Chip
          icon={<FilterAltRoundedIcon />}
          label={`${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''}`}
          color="primary"
          variant="outlined"
          size="small"
        />
      )}
    </Stack>
  );
}
