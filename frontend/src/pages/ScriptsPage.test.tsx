import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { App as AntApp, ConfigProvider } from 'antd';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import ScriptsPage from './ScriptsPage';
import { WorkflowStepProvider } from '../hooks/useWorkflowStep';
import { handlers } from '../mocks/handlers';
import { DEMO_PROJECT_ID, resetBackendDb, runExtractStateMachine } from '../mocks/backendDb';

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
        <MemoryRouter initialEntries={[`/project/${DEMO_PROJECT_ID}/scripts`]}>
          <Routes>
            <Route
              path="/project/:id/scripts"
              element={
                <WorkflowStepProvider>
                  <ScriptsPage />
                </WorkflowStepProvider>
              }
            />
          </Routes>
        </MemoryRouter>
      </AntApp>
    </ConfigProvider>,
  );
}

describe('ScriptsPage 剧本列表', () => {
  it('渲染后端剧本：未提取标签与真实字数', async () => {
    renderPage();

    expect(await screen.findByText('第1集·异世囚笼')).toBeInTheDocument();
    expect(screen.getByText('未提取')).toBeInTheDocument();
    // 底栏「添加剧本」动作按钮（不再是语义含糊的「上一步」）
    expect(screen.getByText('＋ 添加剧本')).toBeInTheDocument();
    // 种子剧本正文字数标签
    expect(screen.getByText(/字$/)).toBeInTheDocument();
  });

  it('点 AI 提取资产走真实链路：等待 → 已提取', async () => {
    renderPage();

    const extractButton = await screen.findByText('🤖 AI 提取资产');
    fireEvent.click(extractButton);

    // MSW 模拟后端异步状态机（等待/提取中 → 成功，~400ms）；
    // 页面轮询间隔 2.5s，放宽 findBy 超时到 6s
    expect(await screen.findByText('已提取', {}, { timeout: 6000 })).toBeInTheDocument();
    // 完成提示
    expect(await screen.findByText(/资产提取完成/, {}, { timeout: 2000 })).toBeInTheDocument();
  });

  it('提取失败：展示后端失败原因，可重新发起', async () => {
    // 覆盖 extractAssets：状态机走失败分支（后端返回 errorReason）
    server.use(
      http.post('/api/script/extractAssets', async () => {
        runExtractStateMachine(DEMO_PROJECT_ID, [1], { failReason: '模型限流，请重试' });
        return HttpResponse.json({ code: 200, data: '开始提取资产', message: '成功' });
      }),
    );

    renderPage();

    const extractButton = await screen.findByText('🤖 AI 提取资产');
    fireEvent.click(extractButton);

    // 失败标签 + 后端原因
    expect(await screen.findByText('提取失败', {}, { timeout: 6000 })).toBeInTheDocument();
    expect(screen.getByText('提取失败：模型限流，请重试')).toBeInTheDocument();
    // 可重新发起：按钮再次出现
    expect(screen.getByText('🤖 AI 提取资产')).toBeInTheDocument();
  });
});
