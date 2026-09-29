import { fireEvent, render, screen } from '@testing-library/react';
import { ScriptsMarkerRoutes } from '../test/ScriptsMarkerRoutes';
import { App as AntApp, ConfigProvider } from 'antd';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import HomePage from './HomePage';
import { handlers } from '../mocks/handlers';
import { resetBackendDb } from '../mocks/backendDb';

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => localStorage.clear());
afterEach(() => {
  resetBackendDb();
  server.resetHandlers();
});
afterAll(() => server.close());

function renderPage() {
  return render(
    <ConfigProvider>
      <AntApp>
        <ScriptsMarkerRoutes initialPath="/">
          <HomePage />
        </ScriptsMarkerRoutes>
      </AntApp>
    </ConfigProvider>,
  );
}

describe('HomePage（真实后端契约）', () => {
  it('renders backend projects with translated fields and statistics counters', async () => {
    renderPage();

    expect((await screen.findAllByText('逆命木叶')).length).toBeGreaterThan(0);
    // 统计计数走聚合接口 /api/general/allProjectStatistics（一次拿全）
    expect(await screen.findByText(/角色 2 · 剧本 1 · 视频 0 · 分镜 3/)).toBeInTheDocument();
    // 类型 / 风格 / 比例 / 质量各是一个胶囊标签
    expect(screen.getByText('女频-轻小说')).toBeInTheDocument();
    expect(screen.getByText('赛博朋克电影')).toBeInTheDocument();
    expect(screen.getByText('9:16')).toBeInTheDocument();
    expect(screen.getByText('2K')).toBeInTheDocument();
    // 项目简介此前只在新建弹窗里收集、从不渲染，现在应该显示在卡片上
    expect(screen.getByText('知晓结局的穿越者试图改写宿命')).toBeInTheDocument();
    // 操作入口常显（原来只在 hover 时出现）
    expect(screen.getByText('项目设置')).toBeInTheDocument();
    expect(screen.getByText('删除')).toBeInTheDocument();
  });

  it('点击项目卡直达该项目剧本列表（而非创作页）', async () => {
    render(
      <ConfigProvider>
        <AntApp>
          <ScriptsMarkerRoutes initialPath="/">
            <HomePage />
          </ScriptsMarkerRoutes>
        </AntApp>
      </ConfigProvider>,
    );

    const titles = await screen.findAllByText('逆命木叶');
    fireEvent.click(titles[0]);

    expect(await screen.findByText('scripts-page-marker')).toBeInTheDocument();
  });

  it('点卡片上的操作按钮不会连带触发卡片跳转', async () => {
    renderPage();

    // 操作按钮在卡片内部，必须 stopPropagation，否则会误跳转到剧本列表。
    // 弹窗标题与卡片按钮同名，所以这里断言的是弹窗独有的「保 存」（antd 会给两个汉字自动加空格）
    fireEvent.click(await screen.findByText('项目设置'));

    expect(await screen.findByText('保 存')).toBeInTheDocument();
    expect(screen.queryByText('scripts-page-marker')).not.toBeInTheDocument();
  });

  it('shows friendly empty state when the backend has no projects', async () => {
    server.use(
      http.post('/api/project/getProject', () =>
        HttpResponse.json({ code: 200, data: [], message: '成功' }),
      ),
    );

    renderPage();

    expect(await screen.findByText('还没有项目')).toBeInTheDocument();
    expect(screen.getByText('新建第一个项目')).toBeInTheDocument();
  });

  describe('首次运行引导', () => {
    it('没有项目且未读过引导时弹出，「跳过」后写入标记并不再出现', async () => {
      server.use(
        http.post('/api/project/getProject', () =>
          HttpResponse.json({ code: 200, data: [], message: '成功' }),
        ),
      );

      const { unmount } = renderPage();

      expect(await screen.findByText('欢迎使用 DeepSFV')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /跳过引导/ }));
      expect(localStorage.getItem('deepsfv-onboarding-done')).toBe('1');

      // 重挂载后不该再弹
      unmount();
      renderPage();
      await screen.findByText('还没有项目');
      expect(screen.queryByText('欢迎使用 DeepSFV')).not.toBeInTheDocument();
    });

    it('后端一个模型供应商都没启用时也弹（此时建了项目也生成不出内容）', async () => {
      server.use(
        http.post('/api/modelSelect/getModelList', () =>
          HttpResponse.json({ code: 200, data: [], message: '成功' }),
        ),
      );

      renderPage();

      expect(await screen.findByText('欢迎使用 DeepSFV')).toBeInTheDocument();
    });

    it('已有项目且模型可用时不打扰', async () => {
      renderPage();

      // 等首页真正渲染完（项目卡 + 计数）
      expect(await screen.findByText(/角色 2 · 剧本 1 · 视频 0 · 分镜 3/)).toBeInTheDocument();
      expect(screen.queryByText('欢迎使用 DeepSFV')).not.toBeInTheDocument();
    });
  });
});