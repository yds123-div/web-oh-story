import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { App as AntApp, ConfigProvider } from 'antd';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import EpisodesPage from './EpisodesPage';
import { WorkflowGate } from '../components/WorkflowGate';
import { WorkflowStepProvider } from '../hooks/useWorkflowStep';
import { handlers } from '../mocks/handlers';
import { addBackendScript, DEMO_PROJECT_ID, resetBackendDb } from '../mocks/backendDb';

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  resetBackendDb();
  server.resetHandlers();
  localStorage.clear();
});
afterAll(() => server.close());

function renderPage() {
  return render(
    <ConfigProvider>
      <AntApp>
        <MemoryRouter initialEntries={[`/project/${DEMO_PROJECT_ID}/episodes`]}>
          <Routes>
            <Route
              path="/project/:id/episodes"
              element={
                <WorkflowStepProvider>
                  <WorkflowGate page="episodes">
                    <EpisodesPage />
                  </WorkflowGate>
                </WorkflowStepProvider>
              }
            />
            <Route path="/project/:id/episode/:episodeId" element={<div>分镜工作区</div>} />
          </Routes>
        </MemoryRouter>
      </AntApp>
    </ConfigProvider>,
  );
}

describe('EpisodesPage 分集视频（剧本即分集）', () => {
  it('每个后端剧本就是一集，展示该剧本的分镜数与总时长', async () => {
    renderPage();

    expect(await screen.findByText(/第1集：第1集·异世囚笼/)).toBeInTheDocument();
    expect(screen.getByText(/共 3 个分镜 · 总时长 00:12/)).toBeInTheDocument();
  });

  it('新增剧本后成为新的一集（无分镜时提示进入后新建）', async () => {
    addBackendScript({ projectId: DEMO_PROJECT_ID, name: '第2集·月下对峙', content: '第二集内容' });
    renderPage();

    expect(await screen.findByText(/第2集：第2集·月下对峙/)).toBeInTheDocument();
    expect(screen.getByText('还没有分镜 · 进入后新建')).toBeInTheDocument();
  });

  it('点击分集带真实 scriptId 进入分镜工作区', async () => {
    renderPage();

    const card = await screen.findByText(/第1集：第1集·异世囚笼/);
    fireEvent.click(card.closest('button')!);

    expect(await screen.findByText('分镜工作区')).toBeInTheDocument();
  });

  it('后端失败时给出明确提示而不是白屏', async () => {
    server.use(
      http.post('/api/script/getScrptApi', () =>
        HttpResponse.json({ code: 400, data: null, message: '查询失败' }, { status: 400 }),
      ),
    );
    renderPage();

    // 剧本查询失败 → 门控页先拦下并给重试入口
    expect(await screen.findByText(/无法确认项目进度/)).toBeInTheDocument();
  });

  it('项目还没有剧本时被门控送回剧本列表（本页不空渲染）', async () => {
    server.use(
      http.post('/api/script/getScrptApi', () => HttpResponse.json({ code: 200, data: [], message: '成功' })),
      http.post('/api/cornerScape/getAllAssets', () => HttpResponse.json({ code: 200, data: [], message: '成功' })),
    );
    render(
      <ConfigProvider>
        <AntApp>
          <MemoryRouter initialEntries={[`/project/${DEMO_PROJECT_ID}/episodes`]}>
            <Routes>
              <Route
                path="/project/:id/episodes"
                element={
                  <WorkflowStepProvider>
                    <WorkflowGate page="episodes">
                      <EpisodesPage />
                    </WorkflowGate>
                  </WorkflowStepProvider>
                }
              />
              <Route path="/project/:id/scripts" element={<div>剧本列表</div>} />
            </Routes>
          </MemoryRouter>
        </AntApp>
      </ConfigProvider>,
    );

    expect(await screen.findByText('剧本列表')).toBeInTheDocument();
  });
});
