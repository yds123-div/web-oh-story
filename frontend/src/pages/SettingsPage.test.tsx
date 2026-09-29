import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App as AntApp, ConfigProvider } from 'antd';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import SettingsPage from './SettingsPage';
import { handlers } from '../mocks/handlers';
import { getMockMemoryClearedCount, getMockMemoryConfig, resetBackendDb } from '../mocks/backendDb';
import { getSettingsKey } from '../lib/http';

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => sessionStorage.clear());
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
          <SettingsPage />
        </MemoryRouter>
      </AntApp>
    </ConfigProvider>,
  );
}

/**
 * 把探针接口改成「必须带对口令」的状态，镜像后端配了 SETTINGS_ACCESS_KEY 时的行为。
 *
 * 只拦 dbInfo 而不是用通配符拦整组：msw v2 的 resolver 不能靠返回 undefined 让给后面的
 * handler，通配符会直接把整组接口吃掉。而页面是否上锁本来就只由这一次探针决定。
 */
function gateSettingsApi(correctKey: string) {
  server.use(
    http.get('/api/setting/dbConfig/dbInfo', ({ request }) =>
      request.headers.get('x-settings-key') === correctKey
        ? HttpResponse.json({ code: 200, data: [], message: '成功' })
        : HttpResponse.json({ message: '需要设置中心访问口令' }, { status: 403 }),
    ),
  );
}

describe('SettingsPage（设置中心）', () => {
  it('后端未上锁时直接渲染面板，不出现解锁提示', async () => {
    renderPage();

    expect(await screen.findByText('设置')).toBeInTheDocument();
    // 默认落在「界面设置」
    expect(await screen.findByText('主题')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('设置中心口令')).not.toBeInTheDocument();
  });

  it('列出全部 10 项设置，且每一项都可点', async () => {
    renderPage();
    await screen.findByText('主题');

    const labels = [
      '模型服务',
      '模型映射',
      'Agent配置',
      '提示词管理',
      'Skills技能管理',
      'Agent记忆配置',
      '界面设置',
      '数据库操作',
      '开发者选项',
      '登录配置',
    ];
    expect(labels).toHaveLength(10);
    for (const label of labels) {
      expect(screen.getByText(label).closest('button')).not.toBeDisabled();
    }
  });

  it('后端上锁时要求口令；口令正确后放行并写入 sessionStorage', async () => {
    gateSettingsApi('s3cret');
    renderPage();

    expect(await screen.findByText('设置中心已上锁')).toBeInTheDocument();
    expect(screen.queryByText('主题')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('设置中心口令'), { target: { value: 's3cret' } });
    fireEvent.click(screen.getByRole('button', { name: /解\s*锁/ }));

    expect(await screen.findByText('主题')).toBeInTheDocument();
    expect(getSettingsKey()).toBe('s3cret');
  });

  it('口令错误时保持上锁，不进面板', async () => {
    gateSettingsApi('s3cret');
    renderPage();
    await screen.findByText('设置中心已上锁');

    fireEvent.change(screen.getByPlaceholderText('设置中心口令'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /解\s*锁/ }));

    // 仍停在解锁态（面板未渲染）
    expect(await screen.findByText('设置中心已上锁')).toBeInTheDocument();
    expect(screen.queryByText('主题')).not.toBeInTheDocument();
  });

  it('提示词面板能改到自定义内容并保存', async () => {
    renderPage();
    await screen.findByText('主题');

    fireEvent.click(screen.getByText('提示词管理'));
    expect(await screen.findByText('事件提取')).toBeInTheDocument();
    // 已自定义的行与内置行区分显示
    expect(screen.getByText('已自定义')).toBeInTheDocument();

    fireEvent.click(screen.getByText('事件提取'));
    const textarea = await screen.findByRole('textbox');
    expect(textarea).toHaveValue('# 事件提取指令\n内置原文');
    fireEvent.change(textarea, { target: { value: '# 改过的版本' } });
    fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));

    expect(await screen.findByText('已保存自定义提示词')).toBeInTheDocument();
  });

  it('登录配置：密码不回显、且接口也不再回传该字段', async () => {
    renderPage();
    await screen.findByText('主题');

    fireEvent.click(screen.getByText('登录配置'));

    expect(await screen.findByText(/密码存储强度有限/)).toBeInTheDocument();
    // 账号名现在是可编辑输入框的值（不再单独做一条 Descriptions），异步拉取后才填上
    expect(await screen.findByDisplayValue('admin')).toBeInTheDocument();
    expect(screen.queryByText('admin123')).not.toBeInTheDocument();
  });

  it('登录配置能改账号名（密码留空即不改）', async () => {
    renderPage();
    await screen.findByText('主题');
    fireEvent.click(screen.getByText('登录配置'));

    // 输入框的初始值同样是异步填进来的
    const nameInput = await screen.findByDisplayValue('admin');
    fireEvent.change(nameInput, { target: { value: 'operator' } });
    fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));

    expect(await screen.findByText('账号名已更新')).toBeInTheDocument();
  });

  it('两次密码不一致时拦住，不发请求', async () => {
    renderPage();
    await screen.findByText('主题');
    fireEvent.click(screen.getByText('登录配置'));
    await screen.findByDisplayValue('admin');

    // 「新密码（留空 = 不改）」与「确认新密码」都以「新密码」结尾，必须锚定开头
    fireEvent.change(screen.getByLabelText(/^新密码/), { target: { value: 'aaa11111' } });
    fireEvent.change(screen.getByLabelText('确认新密码'), { target: { value: 'bbb22222' } });
    fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));

    expect(await screen.findByText('两次输入的密码不一致')).toBeInTheDocument();
    expect(screen.queryByText('账号名已更新')).not.toBeInTheDocument();
  });
});

describe('模型服务面板', () => {
  async function openVendorPanel() {
    renderPage();
    await screen.findByText('主题');
    fireEvent.click(screen.getByText('模型服务'));
    await screen.findByText('DP 自建服务');
  }

  it('按供应商声明渲染输入项，密码字段用密码框', async () => {
    await openVendorPanel();

    // 两家供应商的输入项都按各自 inputs 渲染（DP 两条、火山一条）
    expect(await screen.findByPlaceholderText('sk-dp-...')).toHaveValue('sk-dp-test');
    expect(screen.getByDisplayValue('http://localhost/dp')).toBeInTheDocument();
    // password 类型走密码框，不回显明文
    expect(screen.getByPlaceholderText('sk-dp-...')).toHaveAttribute('type', 'password');
    // 适配器源码不渲染
    expect(screen.queryByText(/供应商适配器源码/)).not.toBeInTheDocument();
  });

  it('能停用供应商', async () => {
    await openVendorPanel();

    // 火山引擎初始停用，切换会打到 enableVendor
    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[0]);

    expect(await screen.findByText(/已(启用|停用) DP 自建服务/)).toBeInTheDocument();
  });

  it('连通测试：选模型后跑测试，图像结果渲染成预览图', async () => {
    await openVendorPanel();

    fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
    fireEvent.click(await screen.findByTitle('Z-Image-Turbo（image）'));
    fireEvent.click(screen.getByRole('button', { name: /测\s*试/ }));

    expect(await screen.findByAltText('连通测试结果')).toBeInTheDocument();
    expect(await screen.findByText('测试通过')).toBeInTheDocument();
  });
});

describe('Agent配置面板', () => {
  async function openAgentPanel() {
    renderPage();
    await screen.findByText('主题');
    fireEvent.click(screen.getByText('Agent配置'));
    await screen.findByText('顶层（简易配置生效）');
  }

  it('顶层与子 agent 分两张表，且 universalAi 只出现一次', async () => {
    await openAgentPanel();

    expect(screen.getByText('顶层（简易配置生效）')).toBeInTheDocument();
    expect(screen.getByText(/子 agent（高级配置生效）/)).toBeInTheDocument();
    expect(screen.getByText('scriptAgent')).toBeInTheDocument();
    expect(screen.getByText('scriptAgent:decisionAgent')).toBeInTheDocument();

    // 后端把 universalAi 同时塞进两张表；界面去重后只应出现一次
    expect(screen.getAllByText('universalAi')).toHaveLength(1);
  });

  it('简易模式下提示缺 modelName 的顶层行', async () => {
    await openAgentPanel();

    expect(screen.getByText('简易配置下有顶层行没配模型')).toBeInTheDocument();
    // 断言告警整句（ttsDubbing 在表格 key 列也出现，单独匹配会撞车）
    expect(screen.getByText(/这些行缺 modelName，用到时会报错：ttsDubbing/)).toBeInTheDocument();
    // 表格里那行也该如实标成未配置
    expect(screen.getAllByText('未配置').length).toBeGreaterThan(0);
  });

  it('切到高级配置后提示缺 modelName 的子 agent', async () => {
    await openAgentPanel();

    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(await screen.findByTitle('高级配置（逐个子 agent）'));

    expect(await screen.findByText('高级配置下有子 agent 没配模型')).toBeInTheDocument();
    expect(await screen.findByText(/高级配置模式下，未找到对应的模型配置/)).toBeInTheDocument();
  });
});
describe('模型映射面板', () => {
  async function openModelMap() {
    renderPage();
    await screen.findByText('主题');
    fireEvent.click(screen.getByText('模型映射'));
    await screen.findByText('MiniMax-H3');
  }

  it('列出可绑定的视频模型与模板文件', async () => {
    await openModelMap();

    expect(screen.getByText('MiniMax-H3')).toBeInTheDocument();
    expect(screen.getByText('Seedance 2.0')).toBeInTheDocument();
    // 模板文件区（第二个子面板）
    expect(screen.getByText(/video\/seedance2Multi-parameterMode\.md/)).toBeInTheDocument();
    // 初始都未绑定
    expect(screen.getAllByText('未绑定').length).toBe(2);
  });

  it('把模板绑到模型上，刷新后显示为已绑定', async () => {
    await openModelMap();

    fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
    fireEvent.click(await screen.findByTitle('universalMulti-parameterMode（video）'));
    fireEvent.click(screen.getAllByRole('button', { name: /绑\s*定/ })[0]);

    expect(await screen.findByText(/已把「universalMulti-parameterMode」绑到 minimax-h3/)).toBeInTheDocument();
    // 表里那一行不再是未绑定
    expect(await screen.findByText('universalMulti-parameterMode')).toBeInTheDocument();
  });
});

describe('Skills技能管理面板', () => {
  it('按顶层目录分组列出技能文件，并能打开保存', async () => {
    renderPage();
    await screen.findByText('主题');
    fireEvent.click(screen.getByText('Skills技能管理'));

    expect(await screen.findByText('script_agent_decision.md')).toBeInTheDocument();
    expect(screen.getByText(/^art_skills · 2$/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('script_agent_decision.md'));

    const textarea = await screen.findByRole('textbox');
    expect(textarea).toHaveValue('# script_agent_decision.md\n\n技能内容');
    fireEvent.change(textarea, { target: { value: '# 改过的技能' } });
    fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));

    expect(await screen.findByText('已保存')).toBeInTheDocument();
  });
});

describe('Agent记忆配置面板', () => {
  async function openMemory() {
    renderPage();
    await screen.findByText('主题');
    fireEvent.click(screen.getByText('Agent记忆配置'));
    await screen.findByDisplayValue('500');
  }

  it('按后端默认值渲染 8 个字段', async () => {
    await openMemory();

    // 数字字段用后端的 DEFAULTS 回填
    expect(screen.getByDisplayValue('500')).toBeInTheDocument(); // summaryMaxLength
    expect(screen.getByDisplayValue('10')).toBeInTheDocument(); // summaryLimit
    // onnx 路径数组拼成用 / 分隔的字符串
    expect(screen.getByDisplayValue('all-MiniLM-L6-v2/onnx/model_fp16.onnx')).toBeInTheDocument();
  });

  it('保存后重新读回的是新值（后端持久化）', async () => {
    await openMemory();

    fireEvent.change(screen.getByDisplayValue('500'), { target: { value: '800' } });
    fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));

    expect(await screen.findByText('已保存')).toBeInTheDocument();
    expect(getMockMemoryConfig().summaryMaxLength).toBe(800);
    // reload 之后界面显示新值，而不是被打回默认
    expect(await screen.findByDisplayValue('800')).toBeInTheDocument();
  });

  it('清空记忆要二次确认，确认后才打到后端', async () => {
    await openMemory();

    fireEvent.click(screen.getByRole('button', { name: /清空全部记忆/ }));
    // antd 的 confirm 会把标题同时渲染进 .ant-modal-title 与 .ant-modal-confirm-title，故用 findAll
    expect((await screen.findAllByText('清空全部 Agent 记忆？')).length).toBeGreaterThan(0);
    expect(getMockMemoryClearedCount()).toBe(0);

    // 面板自己的按钮叫「清空全部记忆」，会和确认框的「清 空」撞名，用 ^...$ 精确匹配
    fireEvent.click(screen.getByRole('button', { name: /^清\s*空$/ }));

    expect(await screen.findByText('已清空记忆')).toBeInTheDocument();
    expect(getMockMemoryClearedCount()).toBe(1);
  });
});
