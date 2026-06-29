import { AppBar, Box, IconButton, Toolbar, Tooltip } from '@mui/material';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import { BrandMark } from './BrandMark';
import { PersonaSwitcher } from './PersonaSwitcher';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { toggleSidebar, toggleTheme } from '@/app/store/uiSlice';

export function TopBar() {
  const dispatch = useAppDispatch();
  const themeMode = useAppSelector((s) => s.ui.themeMode);

  return (
    <AppBar
      position="fixed"
      elevation={0}
      color="default"
      sx={{
        zIndex: (t) => t.zIndex.drawer + 1,
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Toolbar sx={{ gap: 1 }}>
        <IconButton edge="start" onClick={() => dispatch(toggleSidebar())} aria-label="Toggle navigation">
          <MenuRoundedIcon />
        </IconButton>
        <BrandMark />

        <Box sx={{ flexGrow: 1 }} />

        <Box
          sx={{
            display: { xs: 'none', md: 'flex' },
            alignItems: 'center',
            gap: 0.75,
            px: 1.25,
            py: 0.5,
            borderRadius: 999,
            border: 1,
            borderColor: 'divider',
          }}
        >
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main', animation: 'tw-pulse 2s infinite' }} />
          <Box component="span" sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 600 }}>
            Agents ready
          </Box>
        </Box>

        <PersonaSwitcher />

        <Tooltip title={themeMode === 'light' ? 'Dark mode' : 'Light mode'}>
          <IconButton onClick={() => dispatch(toggleTheme())} aria-label="Toggle colour mode">
            {themeMode === 'light' ? <DarkModeRoundedIcon /> : <LightModeRoundedIcon />}
          </IconButton>
        </Tooltip>
      </Toolbar>
    </AppBar>
  );
}
