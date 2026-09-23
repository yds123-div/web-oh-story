import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App as AntApp, ConfigProvider } from 'antd';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import HomePage from './HomePage';
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
          <HomePage />
        </MemoryRouter>
      </AntApp>
    </ConfigProvider>,
  );
}

describe('HomePage（真实后端契约）', () => {
  it('renders backend projects with translated fields and statistics counters', async () => {
    renderPage();

    // 项目名出现在封面与卡片正文两处
    expect((await screen.findAllByText('逆命木叶')).length).toBeGreaterThan(0);
    // 统计计数来自 /api/general/generalStatistics
    expect(await screen.findByText(/角色 2 · 剧本 1 · 视频 0 · 分镜 3/)).toBeInTheDocument();
    expect(screen.getByText('女频-轻小说 · 2K')).toBeInTheDocument();
    expect(screen.getByText(/9:16 · 赛博朋克电影/)).toBeInTheDocument();
    // 操作入口：重命名 / 删除（归档已随无后端支撑一并移除）
    expect(screen.getByText('✎ 重命名')).toBeInTheDocument();
    expect(screen.getByText('🗑 删除')).toBeInTheDocument();
    expect(screen.queryByText('📦 归档')).not.toBeInTheDocument();
  });

  it('shows friendly empty state when the backend has no projects', async () => {
    server.use(
      http.post('/api/project/getProject', () =>
        HttpResponse.json({ code: 200, data: [], message: '成功' }),
      ),
    );

    renderPage();

    expect(await screen.findByText('还没有项目')).toBeInTheDocument();
    expect(screen.getByText('＋ 新建第一个项目')).toBeInTheDocument();
  });
});
