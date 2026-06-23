import { useState } from 'react';
import { Button, ListItemText, Menu, MenuItem, Typography } from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import { PERSONAS, getPersona } from '@/constants/personas';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { setPersona } from '@/app/store/personaSlice';
import type { PersonaId } from '@/types';

export function PersonaSwitcher() {
  const dispatch = useAppDispatch();
  const current = useAppSelector((s) => s.persona.current);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const p = getPersona(current);

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        color="inherit"
        startIcon={<PersonRoundedIcon />}
        endIcon={<ExpandMoreRoundedIcon />}
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{ textTransform: 'none', maxWidth: { xs: 150, sm: 260 } }}
      >
        <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
          {p.name}
        </Typography>
      </Button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {PERSONAS.map((persona) => (
          <MenuItem
            key={persona.id}
            selected={persona.id === current}
            onClick={() => {
              dispatch(setPersona(persona.id as PersonaId));
              setAnchor(null);
            }}
            sx={{ maxWidth: 340 }}
          >
            <ListItemText
              primary={persona.name}
              secondary={persona.role}
              primaryTypographyProps={{ fontWeight: 600 }}
              secondaryTypographyProps={{ variant: 'caption' }}
            />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
