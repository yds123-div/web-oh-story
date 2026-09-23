import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App as AntApp, ConfigProvider } from 'antd';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import TaskCenterPage from './TaskCenterPage';
import { handlers } from '../mocks/handlers';
import { resetBackendDb } from '../mocks/backendDb';

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  resetBackendDb();
  server.resetHandlers();
});
afterAll(() => server.close());

function renderPage() {
  return render(
    <ConfigProvider>
      <AntApp>
        <MemoryRouter>
          <TaskCenterPage />
        </MemoryRouter>
      </AntApp>
    </ConfigProvider>,
  );
}

describe('TaskCenterPage（真实后端契约）', () => {
  it('renders backend tasks with project, state and failure reason', async () => {
    renderPage();

    expect(await screen.findByText('剧本资产提取')).toBeInTheDocument();
    expect(screen.getByText('视频生成')).toBeInTheDocument();
    expect(screen.getByText('提取《逆命木叶》第 1 集资产')).toBeInTheDocument();
    // join 出来的项目名（两条任务同属该项目）
    expect((await screen.findAllByText('逆命木叶')).length).toBeGreaterThan(0);
    // 失败任务展示失败原因
    expect(screen.getByText('供应商未配置 key')).toBeInTheDocument();
    expect(screen.getAllByText('进行中').length).toBeGreaterThan(0);
    expect(screen.getByText(/共 3 条/)).toBeInTheDocument();
  });

  it('opens the task detail modal with all fields', async () => {
    renderPage();

    fireEvent.click((await screen.findAllByText('详情'))[0]);

    expect(await screen.findByText('任务详情')).toBeInTheDocument();
    // 首行为最新任务（按 id 倒序）：9003 · 分镜图片生成；描述同时出现在表格与弹窗中
    expect((await screen.findAllByText('系统维护前的遗留任务')).length).toBeGreaterThan(1);
    expect(screen.getByText('Seedream-4.0')).toBeInTheDocument();
  });

  it('shows empty state when there are no tasks', async () => {
    server.use(
      http.post('/api/task/getTaskApi', () =>
        HttpResponse.json({ code: 200, data: { data: [], total: 0 }, message: '成功' }),
      ),
    );

    renderPage();

    expect(await screen.findByText('暂无任务')).toBeInTheDocument();
  });
});
