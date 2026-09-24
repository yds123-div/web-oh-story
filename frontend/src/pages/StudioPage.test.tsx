import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { App as AntApp, ConfigProvider } from 'antd';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import StudioPage from './StudioPage';
import { WorkflowGate } from '../components/WorkflowGate';
import { WorkflowStepProvider } from '../hooks/useWorkflowStep';
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

/** 种子剧本 id=1（第1集·异世囚笼），工作室路由的 :episodeId 复用它 */
const SCRIPT_ID = '1';

function renderPage(scriptId = SCRIPT_ID) {
  return render(
    <ConfigProvider>
      <AntApp>
        <MemoryRouter initialEntries={[`/project/${DEMO_PROJECT_ID}/episode/${scriptId}`]}>
          <Routes>
            <Route
              path="/project/:id/episode/:episodeId"
              element={
                <WorkflowStepProvider>
                  <WorkflowGate page="studio">
                    <StudioPage />
                  </WorkflowGate>
                </WorkflowStepProvider>
              }
            />
          </Routes>
        </MemoryRouter>
      </AntApp>
    </ConfigProvider>,
  );
}

// antd Button 汉字间会插空格，断言统一用宽松正则
const CREATE_BTN = /创\s*建/;
const SAVE_BTN = /保\s*存/;

/** antd modal.confirm 的确定按钮在 .ant-modal-confirm 内 */
function clickConfirmOk(): void {
  const ok = document.querySelector('.ant-modal-confirm .ant-btn-dangerous');
  expect(ok).not.toBeNull();
  fireEvent.click(ok!);
}

function cardTexts(): string[] {
  return Array.from(document.querySelectorAll('.ds-sbCard')).map((c) => c.textContent ?? '');
}

describe('StudioPage 分镜工作区', () => {
  it('渲染后端真实分镜：描述、时长、关联资产与无图占位', async () => {
    renderPage();

    await waitFor(() => expect(document.querySelectorAll('.ds-sbCard')).toHaveLength(3));

    const cards = cardTexts();
    expect(cards[0]).toContain('长廊夜景：林晚独自伫立，月光透过木窗洒下');
    expect(cards[0]).toContain('4s');
    // 关联资产按后端 characters 展示
    expect(cards[0]).toContain('林晚');
    expect(cards[0]).toContain('木叶长廊');
    // 页头统计来自真实分镜
    expect(screen.getByText(/总分镜数/).parentElement?.textContent).toContain('3');

    // 只有第二个分镜有缩略图，其余走占位而非报错
    const thumbs = Array.from(document.querySelectorAll('.ds-sbThumb'));
    expect(thumbs.map((t) => t.querySelector('img') != null)).toEqual([false, true, false]);
    expect(thumbs[0]?.querySelector('.em')?.textContent).toBe('⬚');
  });

  it('新建分镜：描述与时长立即持久化，刷新后仍在', async () => {
    const view = renderPage();
    await waitFor(() => expect(document.querySelectorAll('.ds-sbCard')).toHaveLength(3));

    fireEvent.click(screen.getByRole('button', { name: /新建分镜/ }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByPlaceholderText(/画面内容/), {
      target: { value: '林晚回头，叫住宇智波鼬' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: CREATE_BTN }));

    await waitFor(() => expect(document.querySelectorAll('.ds-sbCard')).toHaveLength(4));
    expect(cardTexts()[3]).toContain('林晚回头，叫住宇智波鼬');
    // 景别/运镜拼进描述文本（后端无独立字段）
    expect(cardTexts()[3]).toContain('中景，固定机位，林晚回头，叫住宇智波鼬');

    // 重新挂载 = 刷新页面：数据来自后端而非本地 state
    view.unmount();
    renderPage();
    await waitFor(() => expect(document.querySelectorAll('.ds-sbCard')).toHaveLength(4));
    expect(cardTexts()[3]).toContain('林晚回头，叫住宇智波鼬');
  });

  it('编辑分镜描述立即持久化', async () => {
    renderPage();
    await waitFor(() => expect(document.querySelectorAll('.ds-sbCard')).toHaveLength(3));

    fireEvent.click(screen.getAllByRole('button', { name: /编\s*辑/ })[0]!);

    const dialog = await screen.findByRole('dialog');
    const textarea = within(dialog).getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '改后的描述' } });
    fireEvent.click(within(dialog).getByRole('button', { name: SAVE_BTN }));

    await waitFor(() => expect(cardTexts()[0]).toContain('改后的描述'));
  });

  it('删除单个分镜后立即从列表消失', async () => {
    renderPage();
    await waitFor(() => expect(document.querySelectorAll('.ds-sbCard')).toHaveLength(3));

    fireEvent.click(screen.getAllByRole('button', { name: /删\s*除/ })[0]!);
    clickConfirmOk();

    await waitFor(() => expect(document.querySelectorAll('.ds-sbCard')).toHaveLength(2));
    expect(cardTexts()[0]).not.toContain('长廊夜景：林晚独自伫立');
  });

  it('批量删除勾选的分镜', async () => {
    renderPage();
    await waitFor(() => expect(document.querySelectorAll('.ds-sbCard')).toHaveLength(3));

    fireEvent.click(screen.getByRole('button', { name: /批量操作/ }));
    const checkboxes = await screen.findAllByRole('checkbox');
    fireEvent.click(checkboxes[0]!);
    fireEvent.click(checkboxes[1]!);
    fireEvent.click(screen.getByRole('button', { name: /删除选中/ }));
    clickConfirmOk();

    await waitFor(() => expect(document.querySelectorAll('.ds-sbCard')).toHaveLength(1));
    expect(cardTexts()[0]).toContain('两人对视，鼬神色冷漠，林晚欲言又止');
  });

  it('后端业务失败时展示真实原因（删已被删掉的分镜）', async () => {
    server.use(
      http.post('/api/production/storyboard/removeFrame', () =>
        HttpResponse.json({ code: 400, data: null, message: '未找到该分镜' }, { status: 400 }),
      ),
    );
    renderPage();
    await waitFor(() => expect(document.querySelectorAll('.ds-sbCard')).toHaveLength(3));

    fireEvent.click(screen.getAllByRole('button', { name: /删\s*除/ })[0]!);
    clickConfirmOk();

    expect(await screen.findByText('未找到该分镜')).toBeInTheDocument();
  });

  it('剧本还没有分镜时给空态引导', async () => {
    server.use(http.post('/api/production/getStoryboardData', () => HttpResponse.json({ code: 200, data: [], message: '成功' })));
    renderPage();

    expect(await screen.findByText(/这个剧本还没有分镜/)).toBeInTheDocument();
  });
});
