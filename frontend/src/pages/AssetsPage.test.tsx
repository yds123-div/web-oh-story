import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { App as AntApp, ConfigProvider } from 'antd';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import AssetsPage from './AssetsPage';
import { WorkflowGate } from '../components/WorkflowGate';
import { WorkflowStepProvider } from '../hooks/useWorkflowStep';
import { handlers } from '../mocks/handlers';
import {
  addBackendProject,
  addBackendScript,
  DEMO_PROJECT_ID,
  resetBackendDb,
} from '../mocks/backendDb';

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  resetBackendDb();
  server.resetHandlers();
  localStorage.clear();
});
afterAll(() => server.close());

/** 指定项目 id 渲染（现造数据的新项目用例） */
function renderWithId(projectId: number | string) {
  return render(
    <ConfigProvider>
      <AntApp>
        <MemoryRouter initialEntries={[`/project/${projectId}/assets`]}>
          <Routes>
            <Route
              path="/project/:id/assets"
              element={
                <WorkflowStepProvider>
                  <WorkflowGate page="assets">
                    <AssetsPage />
                  </WorkflowGate>
                </WorkflowStepProvider>
              }
            />
          </Routes>
        </MemoryRouter>
      </AntApp>
    </ConfigProvider>
  );
}

/** 种子项目（默认） */
function renderPage() {
  return renderWithId(DEMO_PROJECT_ID);
}



/** 类型卡片上的计数（antd 两字按钮会插空格，且页头步骤也有数字，故按卡片作用域取） */
function statCount(label: RegExp): string {
  const card = screen.getAllByRole('button').find((b) => label.test(b.textContent ?? ''))!;
  return card.querySelector('.ct')!.textContent!;
}

/** antd modal.confirm 的确定按钮在 .ant-modal-confirm 内 */
function clickConfirmOk(): void {
  const ok = document.querySelector('.ant-modal-confirm .ant-btn-dangerous');
  expect(ok).not.toBeNull();
  fireEvent.click(ok!);
}

// antd Button 两个汉字之间会自动插空格（"删 除"/"创 建"…），断言统一用宽松正则
const CREATE_BTN = /创\s*建/;
const SAVE_BTN = /保\s*存/;
const DELETE_BTN = /删\s*除/;
const RETRY_BTN = /重\s*试/;

describe('AssetsPage 资产工坊', () => {
  it('渲染后端真实资产（角色卡 + 计数）', async () => {
    renderPage();

    expect(await screen.findByText('林晚')).toBeInTheDocument();
    expect(screen.getByText('宇智波鼬')).toBeInTheDocument();
    // 类型卡片计数（角色 2 / 道具 0）
    expect(statCount(/全部角色/)).toBe('2');
    expect(statCount(/全部道具/)).toBe('0');
  });

  it('按类型切换筛选：角色 → 场景', async () => {
    renderPage();

    expect(await screen.findByText('林晚')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /全部场景/ }));

    expect(await screen.findByText('木叶长廊')).toBeInTheDocument();
    expect(screen.queryByText('林晚')).not.toBeInTheDocument();
  });

  it('手工新增资产立即持久化并出现在列表', async () => {
    renderPage();

    expect(await screen.findByText('林晚')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '＋ 新增资产' }));

    fireEvent.change(screen.getByPlaceholderText('资产名称'), {
      target: { value: '宇智波止水' },
    });
    fireEvent.click(screen.getByRole('button', { name: CREATE_BTN }));

    expect(await screen.findByText('宇智波止水')).toBeInTheDocument();
    // 角色计数 2 → 3
    expect(statCount(/全部角色/)).toBe('3');
  });

  it('编辑资产（改名）立即持久化', async () => {
    renderPage();

    const editButtons = await screen.findAllByRole('button', { name: /编辑/ });
    fireEvent.click(editButtons[0]!);

    const nameInput = await screen.findByDisplayValue('林晚');
    fireEvent.change(nameInput, { target: { value: '林晚·改名' } });
    fireEvent.click(screen.getByRole('button', { name: SAVE_BTN }));

    expect(await screen.findByText('林晚·改名')).toBeInTheDocument();
  });

  it('删除资产立即持久化，列表即时更新', async () => {
    renderPage();

    expect(await screen.findByText('宇智波鼬')).toBeInTheDocument();
    // 卡片上的删除按钮（弹窗确定按钮此时不存在）
    const deleteButtons = screen.getAllByRole('button', { name: DELETE_BTN });
    fireEvent.click(deleteButtons[1]!);

    // antd confirm modal 渲染后点确定（标题文本同时出现在 title/aria 两处，不按文本断言）
    await screen.findByRole('dialog', {}, { timeout: 2000 });
    clickConfirmOk();

    // onOk 是异步（deleteAsset 完成后才更新本地列表）
    await waitFor(() => expect(screen.queryByText('宇智波鼬')).not.toBeInTheDocument());
  });

  it('上传图片（base64）后在资产卡上显示', async () => {
    renderPage();

    expect(await screen.findByText('林晚')).toBeInTheDocument();
    const uploadButtons = await screen.findAllByRole('button', { name: /上传图片/ });
    fireEvent.click(uploadButtons[0]!);

    // 隐藏 input 选中图片
    const file = new File(['png-bytes'], 'linwan.png', { type: 'image/png' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    // 上传成功重查：资产卡 img alt=资产名
    const img = await screen.findByAltText('林晚', {}, { timeout: 3000 });
    expect((img as HTMLImageElement).src).toContain('data:image/png');
  });

  it('道具为空时显示空状态（与加载失败区分）', async () => {
    renderPage();

    expect(await screen.findByText('林晚')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /全部道具/ }));

    expect(await screen.findByText(/还没有道具/)).toBeInTheDocument();
    // AI 提取入口（跳剧本页，本 ticket 只需不报错）
    expect(screen.getByRole('button', { name: /AI 提取资产/ })).toBeInTheDocument();
  });

  it('列表请求业务失败时显示失败态与重试', async () => {
    server.use(
      http.post('/api/assets/getAssetsApi', async () =>
        HttpResponse.json({ code: 400, data: null, message: '后端不可用' }),
      ),
    );

    renderPage();

    expect(await screen.findByText('加载资产失败')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: RETRY_BTN })).toBeInTheDocument();
  });
});

describe('AssetsPage 资产 AI 能力（润色 / 生图 / 提取）', () => {
  it('单个润色：点击后新提示词出现在卡片上并标记已润色', async () => {
    renderPage();

    expect(await screen.findByText('林晚')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /润色提示词/ })[0]!);

    // mock 后端同步返回润色结果并持久化；卡片显示提示词摘要与已润色徽标
    expect(await screen.findByText(/提示词：【林晚】/)).toBeInTheDocument();
    expect(screen.getAllByText('提示词已润色').length).toBeGreaterThan(0);
  });

  it('生图（图像 key 未配置）：失败原因内联展示，可重试，不阻塞页面', async () => {
    renderPage();

    expect(await screen.findByText('林晚')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /生成形象/ })[0]!);

    // 失败原因清晰展示（默认态：图像供应商未配置 key）
    expect(await screen.findByText(/生成失败：图像供应商未配置 key/)).toBeInTheDocument();
    // 失败徽标 + 重试按钮仍在（另一张卡的按钮不受影响）
    expect(screen.getAllByText('生成失败').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /生成形象/ }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /批量润色提示词/ })).toBeEnabled();
  });

  it('批量润色：受理后进入润色中，轮询到终态后提示词全部落卡', async () => {
    renderPage();

    expect(await screen.findByText('林晚')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /批量润色提示词/ }));

    // 受理即置「润色中」（当前筛选下两张角色卡都进入润色中）
    await waitFor(() => expect(screen.getAllByText('润色中').length).toBe(2));

    // 轮询（页间隔 2s）+ mock 状态机（200ms）→ 全部完成并回写提示词
    await waitFor(
      () => {
        const doneTags = screen.getAllByText('提示词已润色');
        expect(doneTags.length).toBe(2);
      },
      { timeout: 9000 },
    );
    expect(screen.getByText(/提示词：【林晚】/)).toBeInTheDocument();
  }, 15000);

  it('空项目在本页发起 AI 提取：显示进行中横幅，完成后资产自动出现', async () => {
    // 现造真实数据：新项目 + 1 个未提取剧本（有剧本无资产 → 门控放行资产页）
    const project = addBackendProject({
      projectType: 'script',
      name: '提取演示项目',
      intro: '',
      type: '女频-轻小说',
      artStyle: '赛博朋克电影',
      directorManual: '',
      videoRatio: '9:16',
      imageModel: 'Seedream-4.0',
      videoModel: 'Seedance 2.0',
      imageQuality: '2K',
      mode: 'text',
    });
    addBackendScript({ projectId: project.id, name: '第1集·异世囚笼', content: '林晚扶着廊柱。' });

    renderWithId(project.id);
    expect(await screen.findByText(/还没有角色/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /AI 提取资产/ }));
    // 提交后显示进行中状态
    expect(await screen.findByText(/AI 正在通读剧本，提取角色与场景/)).toBeInTheDocument();

    // 轮询到成功：资产（角色）自动出现在资产工坊
    expect(await screen.findByText('林晚', {}, { timeout: 9000 })).toBeInTheDocument();
  }, 15000);
});
