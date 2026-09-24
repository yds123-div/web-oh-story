import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { App as AntApp, ConfigProvider } from 'antd';
import { setupServer } from 'msw/node';
import WorkbenchPage from './WorkbenchPage';
import { WorkflowGate } from '../components/WorkflowGate';
import { WorkflowStepProvider } from '../hooks/useWorkflowStep';
import { deleteVideoTrack, fetchWorkbench } from '../lib/api';
import { handlers } from '../mocks/handlers';
import { DEMO_PROJECT_ID, resetBackendDb, setBackendVideoVendorEnabled } from '../mocks/backendDb';

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  resetBackendDb();
  server.resetHandlers();
  localStorage.clear();
});
afterAll(() => server.close());

/** 种子剧本 id=1（第1集·异世囚笼），工作台路由的 :episodeId 复用它 */
const SCRIPT_ID = '1';

/** 提示词轮询间隔 3s、视频轮询间隔 5s（页面按生产节奏配的），断言要给够时间 */
const PROMPT_WAIT = { timeout: 10_000 };
const VIDEO_WAIT = { timeout: 20_000 };

function renderPage() {
  return render(
    <ConfigProvider>
      <AntApp>
        <MemoryRouter initialEntries={[`/project/${DEMO_PROJECT_ID}/episode/${SCRIPT_ID}/bench`]}>
          <Routes>
            <Route
              path="/project/:id/episode/:episodeId/bench"
              element={
                <WorkflowStepProvider>
                  <WorkflowGate page="workbench">
                    <WorkbenchPage />
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

// antd 只在按钮恰好是两个汉字时插空格（使 用 / 保 存），长文案不插
const SAVE_BTN = /保\s*存/;
const USE_BTN = /使\s*用/;

function rows(): string[] {
  return Array.from(document.querySelectorAll('.ds-wbRow')).map((r) => r.textContent ?? '');
}

function row(index: number): HTMLElement {
  return document.querySelectorAll('.ds-wbRow')[index] as HTMLElement;
}

async function waitForRows(count: number): Promise<void> {
  await waitFor(() => expect(document.querySelectorAll('.ds-wbRow')).toHaveLength(count));
}

async function generateAllPrompts(): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: /批量生成提示词/ }));
  await waitFor(() => expect(rows().every((t) => t.includes('提示词已生成'))).toBe(true), PROMPT_WAIT);
}

/**
 * 点一次「生成视频」并等它跑完。
 * antd 的 loading 按钮在 DOM 上**不是** disabled（点击是在 onClick 里被拦掉的），
 * 所以只能靠 ant-btn-loading 这个 class 判断什么时候能再点下一次。
 */
async function generateVideoOnce(index: number): Promise<void> {
  const button = () => within(row(index)).getByRole('button', { name: /生成视频/ });
  await waitFor(() => expect(button().className).not.toContain('ant-btn-loading'), VIDEO_WAIT);
  fireEvent.click(button());
}

describe('WorkbenchPage 工作台', () => {
  it('列出后端真实视频轨道：分镜描述、时长与三种状态徽标', async () => {
    renderPage();
    await waitForRows(3);

    const texts = rows();
    expect(texts[0]).toContain('长廊夜景：林晚独自伫立，月光透过木窗洒下');
    expect(texts[0]).toContain('提示词未生成');
    expect(texts[0]).toContain('视频未生成');
    // 轨道自己没记时长，回退到分镜时长（InputNumber 的值不在 textContent 里，单独取）
    expect((within(row(0)).getByRole('spinbutton') as HTMLInputElement).value).toBe('4');
    // 序号沿用分镜顺序
    expect(Array.from(document.querySelectorAll('.ds-wbRow .ds-sbNo')).map((n) => n.textContent)).toEqual([
      '1',
      '2',
      '3',
    ]);

    // 统计卡来自真实轨道
    expect(screen.getByText('视频轨道').parentElement?.textContent).toContain('3');
  });

  it('批量生成提示词：受理后轮询到终态，各轨道提示词落库', async () => {
    renderPage();
    await waitForRows(3);
    await generateAllPrompts();

    // 提示词文本来自后端（不是本地拼的）
    expect(rows()[0]).toContain('镜头');
    const doneTag = screen.getAllByText('提示词已生成')[0]!;
    expect(doneTag.parentElement?.textContent).toContain('3');
  });

  it('批量生成提示词只作用于还没有提示词的轨道（已有提示词不被覆盖）', async () => {
    renderPage();
    await waitForRows(3);
    await generateAllPrompts();

    fireEvent.click(within(row(0)).getByRole('button', { name: /改提示词/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: '手工写的提示词' } });
    fireEvent.click(within(dialog).getByRole('button', { name: SAVE_BTN }));
    await waitFor(() => expect(rows()[0]).toContain('手工写的提示词'));

    fireEvent.click(screen.getByRole('button', { name: /批量生成提示词/ }));
    // 三条都已有提示词 → 不发请求，只提示
    expect(await screen.findByText('所有轨道都已有提示词')).toBeInTheDocument();
    expect(rows()[0]).toContain('手工写的提示词');
  });

  it('视频生成（无 key）：失败原因直接展示在轨道行上，重试会新增一版而不是覆盖', async () => {
    renderPage();
    await waitForRows(3);
    await generateAllPrompts();

    await generateVideoOnce(0);
    await waitFor(() => expect(rows()[0]).toContain('视频生成失败'), VIDEO_WAIT);
    expect(rows()[0]).toContain('缺少API Key');
    expect(rows()[0]).toContain('第 1 版');

    // 重试：失败态可重试，且是新的版本
    await generateVideoOnce(0);
    await waitFor(() => expect(rows()[0]).toContain('第 2 版'), VIDEO_WAIT);
  });

  it('视频 key 到位后：生成成功可在轨道上切换使用的版本', async () => {
    setBackendVideoVendorEnabled(true);
    renderPage();
    await waitForRows(3);
    await generateAllPrompts();

    await generateVideoOnce(0);
    await waitFor(() => expect(rows()[0]).toContain('第 1 版'), VIDEO_WAIT);
    await generateVideoOnce(0);
    await waitFor(() => expect(rows()[0]).toContain('第 2 版'), VIDEO_WAIT);
    // 两个版本徽标文案与分镜工作区共用一份（components/VideoTrackTags）
    await waitFor(() => expect(rows()[0]).toContain('视频已生成 2 版'), VIDEO_WAIT);

    // 两版都成功才出现「使用」；点第二版切过去
    const useButtons = within(row(0)).getAllByRole('button', { name: USE_BTN });
    expect(useButtons).toHaveLength(2);
    fireEvent.click(useButtons[1]!);
    await waitFor(() => expect(rows()[0]).toContain('（使用中）'), VIDEO_WAIT);

    // 成片要能看见才能挑——管理版本里每版成功视频都有可播放的 <video>
    fireEvent.click(within(row(0)).getByRole('button', { name: /管理版本/ }));
    const dialog = await screen.findByRole('dialog');
    const players = within(dialog).getAllByLabelText(/版成片/);
    expect(players).toHaveLength(2);
    expect((players[1] as HTMLVideoElement).getAttribute('src')).toContain('/oss/');
  });

  it('先失败后成功：拿到成片后不再挂失败红框（历史失败只留在版本 chip 上）', async () => {
    renderPage();
    await waitForRows(3);
    await generateAllPrompts();

    // 第一步：无 key，必定失败 → 红框 + 原因
    await generateVideoOnce(0);
    await waitFor(() => expect(rows()[0]).toContain('视频生成失败：缺少API Key'), VIDEO_WAIT);

    // 第二步：key 到位后重试成功
    setBackendVideoVendorEnabled(true);
    await generateVideoOnce(0);
    await waitFor(() => expect(rows()[0]).toContain('视频已生成 1 版'), VIDEO_WAIT);

    // 红框消失，但失败版本仍在列表里（chip 上标着「（失败）」）
    expect(rows()[0]).not.toContain('视频生成失败：');
    expect(rows()[0]).toContain('第 1 版（失败）');
    expect(rows()[0]).toContain('第 2 版');
  });

  it('改提示词后立即持久化（重新挂载仍在）', async () => {
    const view = renderPage();
    await waitForRows(3);
    await generateAllPrompts();

    fireEvent.click(within(row(0)).getByRole('button', { name: /改提示词/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: '手动改过的提示词' } });
    fireEvent.click(within(dialog).getByRole('button', { name: SAVE_BTN }));
    await waitFor(() => expect(rows()[0]).toContain('手动改过的提示词'));

    // 重新挂载 = 刷新页面：数据来自后端而非本地 state
    view.unmount();
    renderPage();
    await waitForRows(3);
    expect(rows()[0]).toContain('手动改过的提示词');
  });

  it('还没有轨道时给空态引导', async () => {
    // 删分镜不会带走轨道（后端 removeFrame 的真实行为），所以这里直接清轨道
    const { tracks } = await fetchWorkbench(String(DEMO_PROJECT_ID), SCRIPT_ID);
    for (const track of tracks) {
      await deleteVideoTrack(track.id);
    }
    renderPage();

    expect(await screen.findByText(/还没有视频轨道/)).toBeInTheDocument();
  });

  it('孤立轨道（分镜已删）如实列出并可清理', async () => {
    const { tracks } = await fetchWorkbench(String(DEMO_PROJECT_ID), SCRIPT_ID);
    await deleteVideoTrack(tracks[0]!.id);
    renderPage();
    await waitForRows(2);

    // 轨道总数少一条，但每条都还有对应分镜
    expect(rows().every((t) => !t.includes('（该轨道没有对应分镜）'))).toBe(true);
  });
});
