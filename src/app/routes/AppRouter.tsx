import { lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { useAppSelector } from '@/app/store/hooks';
import { personaHomePath } from '@/constants/nav';

// Route-level code splitting: each page is its own lazy chunk.
const ControlTowerPage = lazy(() => import('@/modules/decarbonization/pages/ControlTowerPage'));
const HotspotsPage = lazy(() => import('@/modules/decarbonization/pages/HotspotsPage'));
const ProductCustomerLanesPage = lazy(() => import('@/modules/decarbonization/pages/ProductCustomerLanesPage'));
const PartnerInfluencePage = lazy(() => import('@/modules/decarbonization/pages/PartnerInfluencePage'));
const EvidencePackPage = lazy(() => import('@/modules/decarbonization/pages/EvidencePackPage'));

/** "/" lands on the first page the active persona's role can see. */
function PersonaHome() {
  const persona = useAppSelector((s) => s.persona.current);
  return <Navigate to={personaHomePath(persona)} replace />;
}

export function AppRouter() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<PersonaHome />} />
          {/* Scope 3 downstream transportation is the whole product — old inventory routes fold into it */}
          <Route path="/overview" element={<Navigate to="/" replace />} />
          <Route path="/scope-1" element={<Navigate to="/control-tower" replace />} />
          <Route path="/scope-2" element={<Navigate to="/control-tower" replace />} />
          <Route path="/scope-3" element={<Navigate to="/control-tower" replace />} />
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
          {/* Methodology & Factors removed from the product */}
          <Route path="/methodology" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
