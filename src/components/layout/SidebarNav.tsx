import { Box, List, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import { NavLink } from 'react-router-dom';
import { NAV_GROUPS } from '@/constants/nav';
import { NavIcon } from './iconRegistry';
import { brandTokens } from '@/app/config/theme';

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Box sx={{ px: 1.5 }}>
      {NAV_GROUPS.map((group) => (
        <Box key={group.heading || group.items[0]?.to} sx={{ mb: 1.5 }}>
          {group.heading && (
            <Typography
              sx={{
                px: 1.5,
                py: 1,
                fontSize: 10,
                letterSpacing: '0.14em',
                fontWeight: 700,
                color: brandTokens.sidebarMuted,
              }}
            >
              {group.heading}
            </Typography>
          )}
          <List dense disablePadding>
            {group.items.map((item) => (
              <ListItemButton
                key={item.to}
                component={NavLink}
                to={item.to}
                end={item.to === '/'}
                onClick={onNavigate}
                sx={{
                  borderRadius: 2,
                  mb: 0.25,
                  color: brandTokens.sidebarText,
                  '& .MuiListItemIcon-root': { color: brandTokens.sidebarMuted, minWidth: 34 },
                  '&.active': {
                    bgcolor: 'rgba(47,184,166,0.16)',
                    color: '#FFFFFF',
                    '& .MuiListItemIcon-root': { color: brandTokens.tealLight },
                  },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
                }}
              >
                <ListItemIcon>
                  <NavIcon iconKey={item.iconKey} fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{ fontSize: 13.5, fontWeight: 500, whiteSpace: 'normal', lineHeight: 1.2 }}
                />
              </ListItemButton>
            ))}
          </List>
        </Box>
      ))}
    </Box>
  );
}
