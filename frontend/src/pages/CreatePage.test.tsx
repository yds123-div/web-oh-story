import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App as AntApp, ConfigProvider } from 'antd';
import { setupServer } from 'msw/node';
import CreatePage from './CreatePage';
import { handlers } from '../mocks/handlers';
import { resetBackendDb, DEMO_PROJECT_ID } from '../mocks/backendDb';

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
        <MemoryRouter initialEntries={[`/create?projectId=${DEMO_PROJECT_ID}`]}>
          <CreatePage />
        </MemoryRouter>
      </AntApp>
    </ConfigProvider>,
  );
}

describe('CreatePage 打开已有项目', () => {
  it('还原后端保存的项目配置', async () => {
    renderPage();

    expect(await screen.findByText('📌 项目配置（已保存）')).toBeInTheDocument();
    // 故事类型同时出现在还原卡片与右侧参数面板
    expect((await screen.findAllByText('女频-轻小说')).length).toBeGreaterThan(1);
    // 视频风格同时出现在还原卡片与右侧风格库下拉
    expect((await screen.findAllByText('赛博朋克电影')).length).toBeGreaterThan(1);
    expect(screen.getByText('知晓结局的穿越者试图改写宿命')).toBeInTheDocument();
    expect(screen.getByText('图像模型 Seedream-4.0')).toBeInTheDocument();
  });
});
