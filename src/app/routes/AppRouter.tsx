import { lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { useAppSelector } from '@/app/store/hooks';
import { personaHomePath } from '@/constants/nav';

// Route-level code splitting: each page is its own lazy chunk.
const DecisionsPage = lazy(() => import('@/modules/decarbonization/pages/DecisionsPage'));
const HotspotsPage = lazy(() => import('@/modules/decarbonization/pages/HotspotsPage'));
const LanesPage = lazy(() => import('@/modules/decarbonization/pages/LanesPage'));
const EvidencePackPage = lazy(() => import('@/modules/decarbonization/pages/EvidencePackPage'));

/** "/" lands on the page the active persona's role starts from. */
function PersonaHome() {
  const persona = useAppSelector((s) => s.persona.current);
  return <Navigate to={personaHomePath(persona)} replace />;
}

const TO_HOME = ['/overview', '/scope-1', '/scope-2', '/scope-3', '/methodology'];
const TO_DECISIONS = ['/control-tower', '/shipments', '/decisioning', '/ledger', '/actions', '/planner', '/recommendations', '/scheduler'];

export function AppRouter() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<PersonaHome />} />
          <Route path="/decisions" element={<DecisionsPage />} />
          <Route path="/hotspots" element={<HotspotsPage />} />
          <Route path="/lanes" element={<LanesPage />} />
          <Route path="/evidence" element={<EvidencePackPage />} />

          {/* Older paths fold into the four pages the workbook can support. */}
          {TO_HOME.map((p) => (
            <Route key={p} path={p} element={<Navigate to="/" replace />} />
          ))}
          {TO_DECISIONS.map((p) => (
            <Route key={p} path={p} element={<Navigate to="/decisions" replace />} />
          ))}
          {/* Carrier & vendor performance is gone: the workbook names no partner. */}
          <Route path="/partners" element={<Navigate to="/hotspots" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
