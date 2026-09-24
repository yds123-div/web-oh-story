import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { App as AntApp, ConfigProvider } from 'antd';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { vi } from 'vitest';
import StudioPage from './StudioPage';
import { WorkflowGate } from '../components/WorkflowGate';
import { WorkflowStepProvider } from '../hooks/useWorkflowStep';
import { handlers } from '../mocks/handlers';
import {
  DEMO_PROJECT_ID,
  resetBackendDb,
  setBackendImageVendorEnabled,
  setBackendVideoPromptFailReason,
} from '../mocks/backendDb';

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

// 生图轮询间隔 2.5s、视频轮询间隔 5s（页面按生产节奏配的），断言要给够时间
const IMAGE_WAIT = { timeout: 15_000 };
const VIDEO_WAIT = { timeout: 25_000 };

function cardTextsAll(): string[] {
  return Array.from(document.querySelectorAll('.ds-sbCard')).map((c) => c.textContent ?? '');
}

async function waitForCards(count: number): Promise<void> {
  await waitFor(() => expect(document.querySelectorAll('.ds-sbCard')).toHaveLength(count));
}

describe('StudioPage 分镜图片链路', () => {
  it('批量生成图片（无 key）：失败原因内联在卡片上、可重试、不阻塞页面', async () => {
    renderPage();
    await waitForCards(3);

    fireEvent.click(screen.getByRole('button', { name: /生成图片/ }));

    await waitFor(() => expect(cardTextsAll()[0]).toContain('生图失败'), IMAGE_WAIT);
    expect(cardTextsAll()[0]).toContain('图像供应商未配置 key');
    // 失败不阻塞：分镜卡照常可编辑可删除
    expect(screen.getAllByRole('button', { name: /编\s*辑/ })).toHaveLength(3);

    // 每张失败的卡片都带「重试生图」
    expect(screen.getAllByRole('button', { name: /重试生图/ })).toHaveLength(3);
    fireEvent.click(screen.getAllByRole('button', { name: /重试生图/ })[0]!);
    await waitFor(() => expect(cardTextsAll()[0]).toContain('生图失败'), IMAGE_WAIT);
  });

  it('批量生成图片（key 到位）：缩略图出现，刷新后仍在', async () => {
    setBackendImageVendorEnabled(true);
    const view = renderPage();
    await waitForCards(3);

    fireEvent.click(screen.getByRole('button', { name: /生成图片/ }));

    await waitFor(
      () => {
        const thumbs = Array.from(document.querySelectorAll('.ds-sbThumb'));
        expect(thumbs.every((t) => t.querySelector('img') != null)).toBe(true);
      },
      IMAGE_WAIT,
    );

    view.unmount();
    renderPage();
    await waitForCards(3);
    const thumbs = Array.from(document.querySelectorAll('.ds-sbThumb'));
    expect(thumbs.every((t) => t.querySelector('img') != null)).toBe(true);
  });

  it('「只补未出图的」在全部已出图时不重复提交', async () => {
    setBackendImageVendorEnabled(true);
    renderPage();
    await waitForCards(3);

    fireEvent.click(screen.getByRole('button', { name: /生成图片/ }));
    await waitFor(
      () => expect(screen.getAllByText('图片已生成')).toHaveLength(3),
      IMAGE_WAIT,
    );

    // 三条都已出图 → 目标为空，只提示不提交
    fireEvent.click(screen.getByRole('button', { name: /只补未出图的/ }));
    expect(await screen.findByText('没有可生成的分镜')).toBeInTheDocument();
  });

  it('预览拼图：弹窗里显示后端拼好的 data URL 图', async () => {
    setBackendImageVendorEnabled(true);
    renderPage();
    await waitForCards(3);

    fireEvent.click(screen.getByRole('button', { name: /生成图片/ }));
    await waitFor(() => expect(screen.getAllByText('图片已生成')).toHaveLength(3), IMAGE_WAIT);

    fireEvent.click(screen.getByRole('button', { name: /预览拼图/ }));
    const img = await screen.findByAltText('分镜拼图预览');
    expect(img.getAttribute('src')).toContain('data:image/jpeg;base64,');
  });

  it('下载拼图：把后端回的 PNG 交给浏览器下载', async () => {
    setBackendImageVendorEnabled(true);
    // jsdom 没有 createObjectURL，直接挂到 URL 上并在用例结束时摘掉
    const urlWithBlob = URL as unknown as {
      createObjectURL?: (blob: Blob) => string;
      revokeObjectURL?: (url: string) => void;
    };
    const createObjectURL = vi.fn(() => 'blob:storyboard');
    const revokeObjectURL = vi.fn();
    urlWithBlob.createObjectURL = createObjectURL;
    urlWithBlob.revokeObjectURL = revokeObjectURL;
    const clicked: string[] = [];
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        clicked.push(this.download);
      });

    try {
      renderPage();
      await waitForCards(3);
      fireEvent.click(screen.getByRole('button', { name: /生成图片/ }));
      await waitFor(() => expect(screen.getAllByText('图片已生成')).toHaveLength(3), IMAGE_WAIT);

      fireEvent.click(screen.getByRole('button', { name: /下载拼图/ }));

      await waitFor(() => expect(clicked).toEqual(['storyboard-preview.png']));
      expect(createObjectURL).toHaveBeenCalledOnce();
      expect(revokeObjectURL).toHaveBeenCalledOnce();
    } finally {
      clickSpy.mockRestore();
      delete urlWithBlob.createObjectURL;
      delete urlWithBlob.revokeObjectURL;
    }
  });
});

describe('StudioPage 单分镜的视频提示词与视频', () => {
  it('生成视频提示词：文本模型结果持久化到轨道，可编辑后重读', async () => {
    const view = renderPage();
    await waitForCards(3);

    fireEvent.click(screen.getAllByRole('button', { name: /生成提示词/ })[0]!);

    await waitFor(() => expect(cardTextsAll()[0]).toContain('镜头'), { timeout: 8000 });
    expect(cardTextsAll()[0]).toContain('提示词已生成');

    // 改提示词 → 保存 → 重新挂载后仍是改过的值
    fireEvent.click(screen.getAllByRole('button', { name: /改提示词/ })[0]!);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: '手工改过的提示词' } });
    fireEvent.click(within(dialog).getByRole('button', { name: SAVE_BTN }));
    await waitFor(() => expect(cardTextsAll()[0]).toContain('手工改过的提示词'));

    view.unmount();
    renderPage();
    await waitForCards(3);
    expect(cardTextsAll()[0]).toContain('手工改过的提示词');
  });

  it('提示词生成失败时展示后端原因（不假装成功）', async () => {
    setBackendVideoPromptFailReason('视觉手册未定义');
    renderPage();
    await waitForCards(3);

    fireEvent.click(screen.getAllByRole('button', { name: /生成提示词/ })[0]!);

    await waitFor(() => expect(cardTextsAll()[0]).toContain('提示词生成失败'), { timeout: 8000 });
    expect(cardTextsAll()[0]).toContain('视觉手册未定义');
  });

  it('生成视频（无 key）：提交后轮询到失败态，原因挂在卡片上', async () => {
    renderPage();
    await waitForCards(3);

    fireEvent.click(screen.getAllByRole('button', { name: /生成提示词/ })[0]!);
    await waitFor(() => expect(cardTextsAll()[0]).toContain('提示词已生成'), { timeout: 8000 });

    fireEvent.click(screen.getAllByRole('button', { name: /生成视频/ })[0]!);

    await waitFor(() => expect(cardTextsAll()[0]).toContain('视频生成失败'), VIDEO_WAIT);
    expect(cardTextsAll()[0]).toContain('缺少API Key');
  });

  it('没生成提示词时不能生成视频（按钮禁用）', async () => {
    renderPage();
    await waitForCards(3);

    const videoButtons = screen.getAllByRole('button', { name: /生成视频/ });
    expect(videoButtons).toHaveLength(3);
    expect(videoButtons[0]).toBeDisabled();
  });
});

describe('StudioPage 工作区存档（FlowData 整体存取）', () => {
  const ARCHIVE_BTN = /工作区存档/;
  const SAVE_ARCHIVE_BTN = /保存存档/;
  const SCRIPT_PLAN_PLACEHOLDER = /这一集怎么拍/;
  const STORYBOARD_TABLE_PLACEHOLDER = /分镜表（表格或清单均可）/;

  const openArchive = async () => {
    fireEvent.click(await screen.findByRole('button', { name: ARCHIVE_BTN }));
  };

  it('无存档：后端默认文档下页面照常可用（剧本原文来自后端、编辑状态为空、分镜仍是真实数据）', async () => {
    renderPage();
    await waitForCards(3);

    await openArchive();

    // 默认档的 storyboard 恒为空数组，但分镜面板走 getStoryboardData，三条分镜照常渲染
    expect(screen.getByTestId('archive-script')).toHaveTextContent('木叶，夜晚长廊');
    expect(screen.getByPlaceholderText(SCRIPT_PLAN_PLACEHOLDER)).toHaveValue('');
    expect(screen.getByPlaceholderText(STORYBOARD_TABLE_PLACEHOLDER)).toHaveValue('');
    expect(screen.getAllByRole('button', { name: /上移分镜/ })).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: /编\s*辑/ })).toHaveLength(3);
  });

  it('编辑拍摄计划与分镜表后整体保存，刷新后恢复', async () => {
    const view = renderPage();
    await waitForCards(3);
    await openArchive();

    fireEvent.change(screen.getByPlaceholderText(SCRIPT_PLAN_PLACEHOLDER), {
      target: { value: '第1集：冷调长廊起手，压低情绪' },
    });
    fireEvent.change(screen.getByPlaceholderText(STORYBOARD_TABLE_PLACEHOLDER), {
      target: { value: '| 1 | 长廊夜景 | 4s |' },
    });
    // 改动后页头出现「未保存」标记
    expect(screen.getByRole('button', { name: /保存存档（未保存）/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: SAVE_ARCHIVE_BTN }));
    expect(await screen.findByText('存档已保存，刷新后仍是现在的状态')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: SAVE_ARCHIVE_BTN })).toBeInTheDocument();

    // 重新挂载 = 刷新页面：编辑状态来自后端存档而非本地 state
    view.unmount();
    renderPage();
    await waitForCards(3);
    await openArchive();

    expect(await screen.findByDisplayValue('第1集：冷调长廊起手，压低情绪')).toBeInTheDocument();
    expect(screen.getByDisplayValue('| 1 | 长廊夜景 | 4s |')).toBeInTheDocument();
  });

  it('调整分镜顺序后整体保存，刷新后顺序保持（写侧回写 o_storyboard.index）', async () => {
    const view = renderPage();
    await waitForCards(3);

    // 第 1 条下移 → 本地顺序变成 [2, 1, 3]
    fireEvent.click(screen.getAllByRole('button', { name: /下移分镜/ })[0]!);
    await waitFor(() => expect(cardTextsAll()[0]).toContain('林晚回头'));

    fireEvent.click(screen.getByRole('button', { name: SAVE_ARCHIVE_BTN }));
    expect(await screen.findByText('存档已保存，刷新后仍是现在的状态')).toBeInTheDocument();

    view.unmount();
    renderPage();
    await waitForCards(3);

    expect(cardTextsAll()[0]).toContain('林晚回头');
    expect(cardTextsAll()[1]).toContain('长廊夜景');
    expect(cardTextsAll()[2]).toContain('两人对视');
  });

  it('分镜增删后标记存档未保存（存档里的分镜段与顺序已过期）', async () => {
    renderPage();
    await waitForCards(3);

    fireEvent.click(screen.getAllByRole('button', { name: /删\s*除/ })[0]!);
    clickConfirmOk();

    await waitForCards(2);
    expect(screen.getByRole('button', { name: /保存存档（未保存）/ })).toBeInTheDocument();
  });

  it('存档读取失败不阻塞分镜工作区（不白屏），并说明原因', async () => {
    server.use(
      http.post('/api/production/getFlowData', () =>
        HttpResponse.json({ code: 400, data: null, message: '参数错误' }, { status: 400 }),
      ),
    );
    renderPage();
    await waitForCards(3);

    await openArchive();

    expect(await screen.findByText(/存档读取失败/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /编\s*辑/ })).toHaveLength(3);
    // 存档不可用时保存按钮禁用，不假装能存
    expect(screen.getByRole('button', { name: SAVE_ARCHIVE_BTN })).toBeDisabled();
  });

  it('保存失败时展示后端原因（不谎报成功）', async () => {
    server.use(
      http.post('/api/production/saveFlowData', () =>
        HttpResponse.json({ code: 400, data: null, message: '存档写入失败' }, { status: 400 }),
      ),
    );
    renderPage();
    await waitForCards(3);
    await openArchive();

    fireEvent.change(screen.getByPlaceholderText(SCRIPT_PLAN_PLACEHOLDER), {
      target: { value: '写不进去的计划' },
    });
    fireEvent.click(screen.getByRole('button', { name: SAVE_ARCHIVE_BTN }));

    expect(await screen.findByText('存档写入失败')).toBeInTheDocument();
    // 仍处于未保存态
    expect(screen.getByRole('button', { name: /保存存档（未保存）/ })).toBeInTheDocument();
  });

  it('切换剧本时存档随路由重载，不会串档', async () => {
    const view = renderPage();
    await waitForCards(3);
    await openArchive();
    fireEvent.change(screen.getByPlaceholderText(SCRIPT_PLAN_PLACEHOLDER), {
      target: { value: '第1集的计划' },
    });
    fireEvent.click(screen.getByRole('button', { name: SAVE_ARCHIVE_BTN }));
    await screen.findByText('存档已保存，刷新后仍是现在的状态');

    // 另一个剧本（id=2，无存档）：不该看到第 1 集的拍摄计划
    view.unmount();
    renderPage('2');
    await waitFor(() => expect(screen.queryAllByRole('button', { name: /编\s*辑/ })).toHaveLength(0));
    await openArchive();
    expect(screen.getByPlaceholderText(SCRIPT_PLAN_PLACEHOLDER)).toHaveValue('');
  });
});
