import { Suspense } from 'react';
import { Box, Drawer, Toolbar, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Outlet } from 'react-router-dom';
import { TopBar } from './TopBar';
import { SidebarNav } from './SidebarNav';
import { DrawerHost } from './DrawerHost';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { setSidebarOpen } from '@/app/store/uiSlice';
import { RouteFallback } from '@/components/loaders/RouteFallback';
import { brandTokens } from '@/app/config/theme';

const DRAWER_WIDTH = 256;

/** App shell: fixed top bar, collapsible navy sidebar, content outlet, hosts. */
export function AppShell() {
  const dispatch = useAppDispatch();
  const sidebarOpen = useAppSelector((s) => s.ui.sidebarOpen);
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const navyPaperSx = {
    boxSizing: 'border-box' as const,
    bgcolor: brandTokens.sidebarBg,
    color: brandTokens.sidebarText,
    borderRight: `1px solid ${brandTokens.line}`,
    overflowX: 'hidden' as const,
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <TopBar />

      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          width: sidebarOpen ? DRAWER_WIDTH : 0,
          flexShrink: 0,
          whiteSpace: 'nowrap',
          '& .MuiDrawer-paper': {
            ...navyPaperSx,
            width: sidebarOpen ? DRAWER_WIDTH : 0,
            transition: (t) =>
              t.transitions.create('width', {
                easing: t.transitions.easing.sharp,
                duration: sidebarOpen ? t.transitions.duration.enteringScreen : t.transitions.duration.leavingScreen,
              }),
          },
        }}
        open
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto', py: 1.25 }}>
          <SidebarNav />
        </Box>
      </Drawer>

      <Drawer
        variant="temporary"
        open={sidebarOpen && !isDesktop}
        onClose={() => dispatch(setSidebarOpen(false))}
        ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, ...navyPaperSx } }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto', py: 1.25 }}>
          <SidebarNav onNavigate={() => dispatch(setSidebarOpen(false))} />
        </Box>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0 }}>
        <Toolbar />
        <Box sx={{ p: { xs: 2, md: 3.5 }, maxWidth: 1520, mx: 'auto' }}>
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </Box>
      </Box>

      <DrawerHost />
    </Box>
  );
}
