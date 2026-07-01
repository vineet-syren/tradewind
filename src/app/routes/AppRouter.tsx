import { lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';

// Route-level code splitting: each page is its own lazy chunk.
const CommandCenterPage = lazy(() => import('@/modules/decarbonization/pages/CommandCenterPage'));
const ShipmentAtlasPage = lazy(() => import('@/modules/decarbonization/pages/ShipmentAtlasPage'));
const HotspotsPage = lazy(() => import('@/modules/decarbonization/pages/HotspotsPage'));
const ProductCustomerLanesPage = lazy(() => import('@/modules/decarbonization/pages/ProductCustomerLanesPage'));
const PartnerInfluencePage = lazy(() => import('@/modules/decarbonization/pages/PartnerInfluencePage'));
const ActionCenterPage = lazy(() => import('@/modules/decarbonization/pages/ActionCenterPage'));
const ReductionPlannerPage = lazy(() => import('@/modules/decarbonization/pages/ReductionPlannerPage'));
const EvidencePackPage = lazy(() => import('@/modules/decarbonization/pages/EvidencePackPage'));
const MethodologyPage = lazy(() => import('@/modules/decarbonization/pages/MethodologyPage'));

export function AppRouter() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<CommandCenterPage />} />
          <Route path="/shipments" element={<ShipmentAtlasPage />} />
          <Route path="/decisioning" element={<Navigate to="/shipments" replace />} />
          <Route path="/ledger" element={<Navigate to="/shipments" replace />} />
          <Route path="/hotspots" element={<HotspotsPage />} />
          <Route path="/lanes" element={<ProductCustomerLanesPage />} />
          <Route path="/partners" element={<PartnerInfluencePage />} />
          <Route path="/actions" element={<ActionCenterPage />} />
          <Route path="/planner" element={<ReductionPlannerPage />} />
          <Route path="/recommendations" element={<Navigate to="/planner" replace />} />
          <Route path="/scheduler" element={<Navigate to="/planner" replace />} />
          <Route path="/evidence" element={<EvidencePackPage />} />
          <Route path="/methodology" element={<MethodologyPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
