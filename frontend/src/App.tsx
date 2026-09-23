import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layout/AppLayout';
import { WorkflowGate } from './components/WorkflowGate';
import { PlaceholderPage } from './pages/PlaceholderPage';

const HomePage = lazy(() => import('./pages/HomePage'));
const IdeaPage = lazy(() => import('./pages/IdeaPage'));
const CreatePage = lazy(() => import('./pages/CreatePage'));
const TaskCenterPage = lazy(() => import('./pages/TaskCenterPage'));
const OutlinePage = lazy(() => import('./pages/OutlinePage'));
const AssetsPage = lazy(() => import('./pages/AssetsPage'));
const EpisodesPage = lazy(() => import('./pages/EpisodesPage'));
const StudioPage = lazy(() => import('./pages/StudioPage'));
const CanvasPage = lazy(() => import('./pages/CanvasPage'));
const PlazaPage = lazy(() => import('./pages/PlazaPage'));
const SpacePage = lazy(() => import('./pages/SpacePage'));
const NodeCanvasPage = lazy(() => import('./pages/NodeCanvasPage'));

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Suspense fallback={null}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/idea" element={<IdeaPage />} />
            <Route
              path="/creative/chat"
              element={
                <PlaceholderPage
                  title="创意对话"
                  hint="创意对话（对话式生图 / 生视频 / 图片编辑工作流）将在二期接入后端后开放"
                />
              }
            />
            <Route path="/create" element={<CreatePage />} />
            <Route path="/tasks" element={<TaskCenterPage />} />
            <Route path="/canvas" element={<CanvasPage />} />
            <Route path="/canvas/:id" element={<NodeCanvasPage />} />
            <Route path="/node" element={<NodeCanvasPage />} />
            <Route path="/plaza" element={<PlazaPage />} />
            <Route path="/space" element={<SpacePage />} />
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
                <WorkflowGate page="studio">
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
