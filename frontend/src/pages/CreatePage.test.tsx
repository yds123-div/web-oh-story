import { fireEvent, render, screen } from '@testing-library/react';
import { App as AntApp, ConfigProvider } from 'antd';
import { setupServer } from 'msw/node';
import CreatePage from './CreatePage';
import { ScriptsMarkerRoutes } from '../test/ScriptsMarkerRoutes';
import { handlers } from '../mocks/handlers';
import { DEMO_PROJECT_ID, resetBackendDb } from '../mocks/backendDb';

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  resetBackendDb();
  server.resetHandlers();
  localStorage.clear();
});
afterAll(() => server.close());

function renderWithRoutes(initialEntry: string) {
  return render(
    <ConfigProvider>
      <AntApp>
        <ScriptsMarkerRoutes initialPath={initialEntry}>
          <CreatePage />
        </ScriptsMarkerRoutes>
      </AntApp>
    </ConfigProvider>,
  );
}

describe('CreatePage 打开已有项目', () => {
  it('还原后端保存的项目配置', async () => {
    renderWithRoutes(`/create?projectId=${DEMO_PROJECT_ID}`);

    expect(await screen.findByText('📌 项目配置（已保存）')).toBeInTheDocument();
    // 故事类型同时出现在还原卡片与右侧参数面板
    expect((await screen.findAllByText('女频-轻小说')).length).toBeGreaterThan(1);
    // 视频风格同时出现在还原卡片与右侧风格库下拉
    expect((await screen.findAllByText('赛博朋克电影')).length).toBeGreaterThan(1);
    expect(screen.getByText('知晓结局的穿越者试图改写宿命')).toBeInTheDocument();
    expect(screen.getByText('图像模型 Seedream-4.0')).toBeInTheDocument();
  });

  it('免提交逃生口：点击「查看该项目剧本列表」直达列表', async () => {
    renderWithRoutes(`/create?projectId=${DEMO_PROJECT_ID}`);

    fireEvent.click(await screen.findByText('查看该项目剧本列表 →'));
    expect(await screen.findByText('scripts-page-marker')).toBeInTheDocument();
  });
});

describe('CreatePage 无项目上下文', () => {
  it('在下拉里选中已有项目后出现逃生口，点击直达该项目列表', async () => {
    renderWithRoutes('/create');

    // 默认新建项目，无逃生口
    expect(screen.queryByText('查看该项目剧本列表 →')).not.toBeInTheDocument();

    // 下拉选择种子项目（页面有多个 Select，用初始值文本定位"选择项目"）
    const projectSelector = screen
      .getByText('＋ 新建项目（用左侧参数创建）')
      .closest('.ant-select')!
      .querySelector('.ant-select-selector')!;
    fireEvent.mouseDown(projectSelector);
    fireEvent.click(await screen.findByText('逆命木叶'));

    fireEvent.click(await screen.findByText('查看该项目剧本列表 →'));
    expect(await screen.findByText('scripts-page-marker')).toBeInTheDocument();
  });
});
