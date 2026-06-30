import { lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';

// Route-level code splitting: each page is its own lazy chunk.
const CommandCenterPage = lazy(() => import('@/modules/decarbonization/pages/CommandCenterPage'));
const RouteModeDecisioningPage = lazy(() => import('@/modules/decarbonization/pages/RouteModeDecisioningPage'));
const ShipmentLedgerPage = lazy(() => import('@/modules/decarbonization/pages/ShipmentLedgerPage'));
const HotspotsPage = lazy(() => import('@/modules/decarbonization/pages/HotspotsPage'));
const ProductCustomerLanesPage = lazy(() => import('@/modules/decarbonization/pages/ProductCustomerLanesPage'));
const PartnerInfluencePage = lazy(() => import('@/modules/decarbonization/pages/PartnerInfluencePage'));
const ActionCenterPage = lazy(() => import('@/modules/decarbonization/pages/ActionCenterPage'));
const RecommendationsPage = lazy(() => import('@/modules/decarbonization/pages/RecommendationsPage'));
const SchedulerPage = lazy(() => import('@/modules/decarbonization/pages/SchedulerPage'));
const EvidencePackPage = lazy(() => import('@/modules/decarbonization/pages/EvidencePackPage'));
const MethodologyPage = lazy(() => import('@/modules/decarbonization/pages/MethodologyPage'));

export function AppRouter() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<CommandCenterPage />} />
          <Route path="/decisioning" element={<RouteModeDecisioningPage />} />
          <Route path="/ledger" element={<ShipmentLedgerPage />} />
          <Route path="/hotspots" element={<HotspotsPage />} />
          <Route path="/lanes" element={<ProductCustomerLanesPage />} />
          <Route path="/partners" element={<PartnerInfluencePage />} />
          <Route path="/actions" element={<ActionCenterPage />} />
          <Route path="/recommendations" element={<RecommendationsPage />} />
          <Route path="/scheduler" element={<SchedulerPage />} />
          <Route path="/evidence" element={<EvidencePackPage />} />
          <Route path="/methodology" element={<MethodologyPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
