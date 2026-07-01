import { lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';

// Route-level code splitting: each page is its own lazy chunk.
const CommandCenterPage = lazy(() => import('@/modules/decarbonization/pages/CommandCenterPage'));
const CarbonOverviewPage = lazy(() => import('@/modules/decarbonization/pages/CarbonOverviewPage'));
const ScopeDetailPage = lazy(() => import('@/modules/decarbonization/pages/ScopeDetailPage'));
const ControlTowerPage = lazy(() => import('@/modules/decarbonization/pages/ControlTowerPage'));
const HotspotsPage = lazy(() => import('@/modules/decarbonization/pages/HotspotsPage'));
const ProductCustomerLanesPage = lazy(() => import('@/modules/decarbonization/pages/ProductCustomerLanesPage'));
const PartnerInfluencePage = lazy(() => import('@/modules/decarbonization/pages/PartnerInfluencePage'));
const EvidencePackPage = lazy(() => import('@/modules/decarbonization/pages/EvidencePackPage'));
const MethodologyPage = lazy(() => import('@/modules/decarbonization/pages/MethodologyPage'));

export function AppRouter() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<CommandCenterPage />} />
          <Route path="/overview" element={<CarbonOverviewPage />} />
          <Route path="/scope-1" element={<ScopeDetailPage />} />
          <Route path="/scope-2" element={<ScopeDetailPage />} />
          <Route path="/scope-3" element={<ScopeDetailPage />} />
          <Route path="/control-tower" element={<ControlTowerPage />} />
          {/* Everything operational now lives in the Control Tower */}
          <Route path="/shipments" element={<Navigate to="/control-tower" replace />} />
          <Route path="/decisioning" element={<Navigate to="/control-tower" replace />} />
          <Route path="/ledger" element={<Navigate to="/control-tower" replace />} />
          <Route path="/actions" element={<Navigate to="/control-tower" replace />} />
          <Route path="/planner" element={<Navigate to="/control-tower" replace />} />
          <Route path="/recommendations" element={<Navigate to="/control-tower" replace />} />
          <Route path="/scheduler" element={<Navigate to="/control-tower" replace />} />
          <Route path="/hotspots" element={<HotspotsPage />} />
          <Route path="/lanes" element={<ProductCustomerLanesPage />} />
          <Route path="/partners" element={<PartnerInfluencePage />} />
          <Route path="/evidence" element={<EvidencePackPage />} />
          <Route path="/methodology" element={<MethodologyPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
