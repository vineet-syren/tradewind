import { useState } from 'react';
import { Box, Button, Menu, MenuItem, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { PERSONAS, getPersona } from '@/constants/personas';
import { PersonaAvatar, PERSONA_COLOR } from './PersonaAvatar';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { setPersona } from '@/app/store/personaSlice';
import type { PersonaId } from '@/types';

export function PersonaSwitcher() {
  const dispatch = useAppDispatch();
  const current = useAppSelector((s) => s.persona.current);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const p = getPersona(current);
  const color = PERSONA_COLOR[p.id] ?? '#4f46e5';

  return (
    <>
      <Button
        size="small"
        color="inherit"
        endIcon={<ExpandMoreRoundedIcon sx={{ color: 'text.secondary' }} />}
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{
          textTransform: 'none',
          maxWidth: { xs: 170, sm: 300 },
          border: 1,
          borderColor: 'divider',
          borderRadius: 99,
          pl: 0.5,
          pr: 1.25,
          py: 0.4,
          bgcolor: 'background.paper',
          '&:hover': { borderColor: color, bgcolor: alpha(color, 0.04) },
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
          <PersonaAvatar personaId={p.id} size={26} />
          <Box sx={{ minWidth: 0, textAlign: 'left', display: { xs: 'none', sm: 'block' } }}>
            <Typography variant="body2" noWrap sx={{ fontWeight: 700, lineHeight: 1.15 }}>
              {p.name}
            </Typography>
            <Typography variant="caption" noWrap sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.1, fontSize: 10 }}>
              Viewing lens
            </Typography>
          </Box>
        </Stack>
      </Button>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        slotProps={{ paper: { sx: { width: 380, maxWidth: '92vw', borderRadius: 3, mt: 1, boxShadow: '0 12px 40px rgba(17,24,39,.14)' } } }}
      >
        <Typography variant="caption" sx={{ px: 2, pt: 1, pb: 0.5, display: 'block', fontWeight: 700, letterSpacing: '0.1em', color: 'text.secondary' }}>
          VIEW AS
        </Typography>
        {PERSONAS.map((persona) => {
          const c = PERSONA_COLOR[persona.id] ?? '#4f46e5';
          const active = persona.id === current;
          return (
            <MenuItem
              key={persona.id}
              selected={active}
              onClick={() => {
                dispatch(setPersona(persona.id as PersonaId));
                setAnchor(null);
              }}
              sx={{
                alignItems: 'flex-start',
                gap: 1.25,
                py: 1.1,
                mx: 1,
                mb: 0.25,
                borderRadius: 2,
                whiteSpace: 'normal',
                '&.Mui-selected': { bgcolor: alpha(c, 0.08), '&:hover': { bgcolor: alpha(c, 0.12) } },
              }}
            >
              <PersonaAvatar personaId={persona.id} size={34} />
              <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {persona.name}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.35 }}>
                  {persona.role}
                </Typography>
              </Box>
              {active && <CheckCircleRoundedIcon sx={{ fontSize: 20, color: c, mt: 0.5, flexShrink: 0 }} />}
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
