import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layout/AppLayout';
import { WorkflowGate } from './components/WorkflowGate';

const HomePage = lazy(() => import('./pages/HomePage'));
const CreativePage = lazy(() => import('./pages/CreativePage'));
const CreatePage = lazy(() => import('./pages/CreatePage'));
const OutlinePage = lazy(() => import('./pages/OutlinePage'));
const AssetsPage = lazy(() => import('./pages/AssetsPage'));
const EpisodesPage = lazy(() => import('./pages/EpisodesPage'));
const StudioPage = lazy(() => import('./pages/StudioPage'));
const CanvasPage = lazy(() => import('./pages/CanvasPage'));
const PlazaPage = lazy(() => import('./pages/PlazaPage'));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/creative" element={<CreativePage />} />
            <Route path="/create" element={<CreatePage />} />
            <Route path="/canvas" element={<CanvasPage />} />
            <Route path="/plaza" element={<PlazaPage />} />
            <Route path="/project/:id/outline" element={<OutlinePage />} />
            <Route
              path="/project/:id/assets"
              element={
                <WorkflowGate page="assets">
                  <AssetsPage />
                </WorkflowGate>
              }
            />
            <Route
              path="/project/:id/episodes"
              element={
                <WorkflowGate page="episodes">
                  <EpisodesPage />
                </WorkflowGate>
              }
            />
            <Route
              path="/project/:id/episode/:episodeId"
              element={
                <WorkflowGate page="episodes">
                  <StudioPage />
                </WorkflowGate>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
