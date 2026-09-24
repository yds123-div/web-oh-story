import { vi } from 'vitest';
import { setupServer } from 'msw/node';
import {
  addScript,
  createAsset,
  createProject,
  createStoryboard,
  deleteAsset,
  deleteProject,
  deleteStoryboard,
  deleteStoryboards,
  batchPolishAssetPrompts,
  cancelAssetImageGeneration,
  generateAssetImage,
  polishAssetPrompt,
  deleteScript,
  extractScriptAssets,
  pollScriptAssets,
  getCredits,
  getProjectStatistics,
  getTask,
  listAssets,
  listEpisodes,
  listNotifications,
  listProjects,
  listScripts,
  listStoryboards,
  listTaskCategories,
  listTaskProjects,
  listTasks,
  listTemplates,
  patchProject,
  projectHasAssets,
  submitOutlineTask,
  updateAsset,
  updateScript,
  updateStoryboard,
  uploadAssetImage,
} from '../lib/api';
import { DEMO_PROJECT_ID, resetBackendDb, setBackendImageVendorEnabled } from './backendDb';
import { getTaskRecord, resetDb } from './db';
import { handlers } from './handlers';

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  resetDb();
  resetBackendDb();
  server.resetHandlers();
});
afterAll(() => server.close());

const NEW_PROJECT_BODY = {
  name: '新剧本',
  type: '女频-轻小说',
  artStyle: '赛博朋克电影',
  videoRatio: '9:16',
  imageModel: 'Seedream-4.0',
  videoModel: 'Seedance 2.0',
  imageQuality: '2K',
};

describe('MSW project and credits contracts', () => {
  it('lists seeded projects including 逆命木叶 with string ids', async () => {
    const data = await listProjects();
    expect(data.projects.map((p) => p.name)).toContain('逆命木叶');
    expect(data.projects.every((p) => typeof p.id === 'string' && p.id.length > 0)).toBe(true);
  });

  it('creates a project that then appears in the list', async () => {
    const created = await createProject(NEW_PROJECT_BODY);
    expect(created.name).toBe('新剧本');
    const data = await listProjects();
    expect(data.projects.map((p) => p.name)).toContain('新剧本');
  });

  it('renames a project and persists it', async () => {
    const updated = await patchProject(String(DEMO_PROJECT_ID), { name: '逆命木叶·改' });
    expect(updated.name).toBe('逆命木叶·改');
    const data = await listProjects();
    const found = data.projects.find((p) => p.id === String(DEMO_PROJECT_ID));
    expect(found?.name).toBe('逆命木叶·改');
  });

  it('deletes the created project so it disappears from the list', async () => {
    const created = await createProject(NEW_PROJECT_BODY);
    await deleteProject(created.id);
    const data = await listProjects();
    expect(data.projects.some((p) => p.id === created.id)).toBe(false);
  });

  it('returns statistics counters for the demo project', async () => {
    const stats = await getProjectStatistics(String(DEMO_PROJECT_ID));
    expect(stats).toEqual({ roleCount: 2, scriptCount: 1, videoCount: 0, storyboardCount: 3 });
  });

  it('returns credit balance 940', async () => {
    const credits = await getCredits();
    expect(credits.balance).toBe(940);
  });
});

describe('MSW task center contracts', () => {
  it('lists tasks with joined project names and translated state', async () => {
    const data = await listTasks({ page: 1, limit: 10 });
    expect(data.total).toBe(3);
    const failed = data.tasks.find((t) => t.state === 'failed');
    expect(failed).toMatchObject({
      taskClass: '剧本资产提取',
      projectName: '逆命木叶',
      stateText: '生成失败',
      reason: '供应商未配置 key',
    });
    // join 不上的任务：项目为空，状态照常翻译
    const orphan = data.tasks.find((t) => t.projectId === null);
    expect(orphan).toMatchObject({ state: 'running', projectName: null });
  });

  it('filters by state and taskClass', async () => {
    const succeeded = await listTasks({ state: 'succeeded', page: 1, limit: 10 });
    expect(succeeded.total).toBe(1);
    expect(succeeded.tasks[0]?.taskClass).toBe('视频生成');
    const byClass = await listTasks({ taskClass: '剧本资产提取', page: 1, limit: 10 });
    expect(byClass.total).toBe(1);
  });

  it('exposes distinct task classes and the project dropdown', async () => {
    await expect(listTaskCategories()).resolves.toEqual(
      expect.arrayContaining(['剧本资产提取', '视频生成', '分镜图片生成']),
    );
    const projects = await listTaskProjects();
    expect(projects).toEqual([{ id: String(DEMO_PROJECT_ID), name: '逆命木叶' }]);
  });

  it('returns a task detail as TaskStatus via getTask', async () => {
    const status = await getTask('9001');
    expect(status).toMatchObject({ taskId: '9001', status: 'failed', error: '供应商未配置 key' });
  });
});

describe('outline task polling contract', () => {
  it('returns a taskId and reaches succeeded with progress', async () => {
    const { taskId } = await submitOutlineTask('proj-nming-muye', {
      sourceType: 'paste',
      text: '林晚扶着廊柱，指尖颤抖。鼬从阴影走出。',
    });
    expect(taskId).toMatch(/^task-/);

    let status = await pollLegacyTask(taskId);
    for (let i = 0; i < 80 && status.status !== 'succeeded'; i += 1) {
      await new Promise((r) => setTimeout(r, 10));
      status = await pollLegacyTask(taskId);
    }

    expect(status.status).toBe('succeeded');
    expect(status.progress).toBe(100);
    expect(status.result).toMatchObject({ projectId: 'proj-nming-muye' });
  });
});

/** 旧 REST mock 任务流的内部轮询（getTask 已接后端任务契约） */
async function pollLegacyTask(taskId: string) {
  const status = getTaskRecord(taskId);
  if (!status) throw new Error(`任务不存在: ${taskId}`);
  return status;
}

describe('assets contract（后端契约：o_assets / o_image）', () => {
  it('getAssetsApi: 类型映射 + 分页 total', async () => {
    const result = await listAssets(String(DEMO_PROJECT_ID), {
      type: 'character',
      page: 1,
      limit: 12,
    });
    expect(result.assets.map((a) => a.name).sort()).toEqual(['宇智波鼬', '林晚']);
    expect(result.total).toBe(2);
    expect(result.assets.every((a) => a.type === 'character')).toBe(true);
  });

  it('addAssets → updateAssets → delAssets 全程持久化', async () => {
    await createAsset({
      projectId: String(DEMO_PROJECT_ID),
      type: 'prop',
      name: '苦无',
      description: '忍者的投掷武器',
    });
    const created = (
      await listAssets(String(DEMO_PROJECT_ID), { type: 'prop' })
    ).assets.find((a) => a.name === '苦无')!;
    expect(created).toBeDefined();

    await updateAsset({
      id: created.id,
      name: '苦无·改',
      description: '改良的投掷武器',
      prompt: created.prompt,
      remark: created.remark,
    });
    const afterUpdate = await listAssets(String(DEMO_PROJECT_ID), { type: 'prop' });
    expect(afterUpdate.assets.find((a) => a.id === created.id)).toMatchObject({
      name: '苦无·改',
      description: '改良的投掷武器',
    });

    await deleteAsset(created.id);
    const afterDelete = await listAssets(String(DEMO_PROJECT_ID), { type: 'prop' });
    expect(afterDelete.assets.some((a) => a.id === created.id)).toBe(false);
  });

  it('saveAssets 上传图片后 imageUrl 指向静态托管路径（mock 回 data URL）', async () => {
    const { assets: before } = await listAssets(String(DEMO_PROJECT_ID), { type: 'character' });
    const linwan = before.find((a) => a.name === '林晚')!;

    await uploadAssetImage({
      assetId: linwan.id,
      projectId: String(DEMO_PROJECT_ID),
      type: 'character',
      base64: 'data:image/png;base64,iVBORw0KGgo=',
      prompt: linwan.prompt,
    });

    const { assets: after } = await listAssets(String(DEMO_PROJECT_ID), { type: 'character' });
    expect(after.find((a) => a.id === linwan.id)?.imageUrl).toBe('data:image/png;base64,iVBORw0KGgo=');
  });
});

describe('MSW script contracts（镜像后端 zod 校验）', () => {
  it('lists seeded scripts for the demo project with status none（手动新增不写 extractState）', async () => {
    const { scripts } = await listScripts(String(DEMO_PROJECT_ID));
    expect(scripts.map((s) => s.name)).toContain('第1集·异世囚笼');
    expect(scripts[0].extractStatus).toBe('none');
  });

  it('adds a script then appears in the list（自增 id 而非时间戳）', async () => {
    await addScript({
      projectId: String(DEMO_PROJECT_ID),
      name: '第2集·月下对峙',
      content: '第二集内容',
    });
    const { scripts } = await listScripts(String(DEMO_PROJECT_ID));
    const added = scripts.find((s) => s.name === '第2集·月下对峙');
    expect(added).toBeDefined();
    // id 是自增小整数（1、2…），不是 Date.now() 时间戳
    expect(Number(added!.id)).toBeLessThan(1000);
    expect(added!.extractStatus).toBe('none');
  });

  it('rejects addScript missing the assets key（后端 zod 必填，HTTP 400 非信封）', async () => {
    const res = await fetch('/api/script/addScript', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: DEMO_PROJECT_ID, name: 'x', content: 'y' }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { message?: string };
    expect(body.message).toBe('参数错误');
  });

  it('rejects delScript with a single id instead of ids array', async () => {
    const res = await fetch('/api/script/delScript', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 1 }),
    });
    expect(res.status).toBe(400);
  });

  it('updates then deletes a script and both persist', async () => {
    await addScript({ projectId: String(DEMO_PROJECT_ID), name: '待编辑', content: '旧内容' });
    const { scripts } = await listScripts(String(DEMO_PROJECT_ID));
    const target = scripts.find((s) => s.name === '待编辑')!;

    await updateScript({ id: target.id, name: '已编辑', content: '新内容' });
    const afterUpdate = await listScripts(String(DEMO_PROJECT_ID));
    expect(afterUpdate.scripts.find((s) => s.id === target.id)).toMatchObject({
      name: '已编辑',
      content: '新内容',
    });

    await deleteScript(target.id);
    const afterDelete = await listScripts(String(DEMO_PROJECT_ID));
    expect(afterDelete.scripts.some((s) => s.id === target.id)).toBe(false);
  });

  it('rejects extractAssets missing scriptIds（zod 校验，HTTP 400）', async () => {
    const res = await fetch('/api/script/extractAssets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: DEMO_PROJECT_ID }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects extractAssets with an empty scriptIds array', async () => {
    await expect(extractScriptAssets(String(DEMO_PROJECT_ID), [])).rejects.toMatchObject({
      name: 'HttpError',
      status: 400,
    });
  });

  it('runs the waiting → done state machine and writes assets', async () => {
    const { scripts } = await listScripts(String(DEMO_PROJECT_ID));
    const scriptId = scripts[0].id;

    await extractScriptAssets(String(DEMO_PROJECT_ID), [scriptId]);

    // 后端先把剧本置为等待(2)即返回
    const immediate = await pollScriptAssets([scriptId]);
    expect(['waiting', 'extracting']).toContain(immediate[0].extractStatus);

    // 异步提取完成后状态转 done，且 getAllAssets 能查到 AI 写入的资产
    await vi.waitFor(
      async () => {
        const states = await pollScriptAssets([scriptId]);
        expect(states[0].extractStatus).toBe('done');
      },
      { interval: 100, timeout: 3000 },
    );
    await expect(projectHasAssets(String(DEMO_PROJECT_ID))).resolves.toBe(true);
  });

  it('projectHasAssets reflects getAllAssets（门控数据源）', async () => {
    // 种子项目自带资产
    await expect(projectHasAssets(String(DEMO_PROJECT_ID))).resolves.toBe(true);
    // 无资产项目 → false
    await expect(projectHasAssets('999999')).resolves.toBe(false);
  });
});

describe('MSW storyboard contracts（镜像后端 o_storyboard 契约）', () => {
  const projectId = String(DEMO_PROJECT_ID);
  /** 种子剧本 id=1（第1集·异世囚笼） */
  const scriptId = '1';

  it('lists seeded storyboards with characters and thumbnail', async () => {
    const storyboards = await listStoryboards(projectId, scriptId);

    expect(storyboards.map((s) => s.prompt)).toEqual([
      '长廊夜景：林晚独自伫立，月光透过木窗洒下',
      '林晚回头，叫住长廊尽头经过的宇智波鼬',
      '两人对视，鼬神色冷漠，林晚欲言又止',
    ]);
    // 关联资产按后端 characters 翻译（role/scene → 前端枚举）
    expect(storyboards[0]?.characters.map((c) => [c.name, c.type])).toEqual([
      ['林晚', 'character'],
      ['木叶长廊', 'scene'],
    ]);
    // 第二个分镜有缩略图，其余为 null（无图占位分支）
    expect(storyboards[1]?.imageUrl).toBe('http://localhost:10588/oss/1/storyboard/mock-2.png?size=20');
    expect(storyboards[0]?.imageUrl).toBeNull();
    expect(storyboards[2]?.characters).toEqual([]);
  });

  it('creates a storyboard that survives a re-read（刷新不丢）', async () => {
    const id = await createStoryboard({
      projectId,
      scriptId,
      prompt: '远景，固定机位，林晚独自伫立',
      durationSec: 4,
    });

    const storyboards = await listStoryboards(projectId, scriptId);
    const created = storyboards.find((s) => s.id === id);
    expect(created).toMatchObject({
      prompt: '远景，固定机位，林晚独自伫立',
      durationSec: 4,
      imageUrl: null,
      characters: [],
    });
    // 新分镜排在最后：本 mock 按 id 升序排（真实后端 orderBy index，而 addStoryboard
    // 不写 index、留 NULL —— 实测同样落在末尾，但 SQLite 对全 NULL 排序无硬保证）
    expect(storyboards[storyboards.length - 1]?.id).toBe(id);
  });

  it('rejects addStoryboard missing the required videoDesc field', async () => {
    const res = await fetch('/api/production/storyboard/addStoryboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'x', duration: 4, state: '未生成', shouldGenerateImage: 0, src: null, scriptId: 1, projectId: 1 }),
    });
    expect(res.status).toBe(400);
  });

  it('updates the prompt and persists it', async () => {
    const [first] = await listStoryboards(projectId, scriptId);
    await updateStoryboard({ id: first!.id, prompt: '改后的描述' });

    const after = await listStoryboards(projectId, scriptId);
    expect(after[0]?.prompt).toBe('改后的描述');
  });

  it('deletes a single storyboard and reports missing ones with the backend reason', async () => {
    const [first] = await listStoryboards(projectId, scriptId);
    await deleteStoryboard(first!.id);

    const after = await listStoryboards(projectId, scriptId);
    expect(after.some((s) => s.id === first!.id)).toBe(false);

    await expect(deleteStoryboard(first!.id)).rejects.toThrow('未找到该分镜');
  });

  it('batch deletes by project and rejects an empty selection', async () => {
    const before = await listStoryboards(projectId, scriptId);
    await deleteStoryboards(projectId, [before[0]!.id, before[1]!.id]);

    const after = await listStoryboards(projectId, scriptId);
    expect(after.map((s) => s.id)).toEqual([before[2]!.id]);

    await expect(deleteStoryboards(projectId, [])).rejects.toThrow('请先选择分镜');
  });

  it('listEpisodes aggregates storyboards per script（剧本即分集）', async () => {
    const { episodes } = await listEpisodes(projectId);

    expect(episodes).toHaveLength(1);
    expect(episodes[0]).toMatchObject({
      id: scriptId,
      number: 1,
      title: '第1集·异世囚笼',
      storyboardCount: 3,
      // 4 + 3 + 5
      durationSec: 12,
      coverUrl: 'http://localhost:10588/oss/1/storyboard/mock-2.png?size=20',
    });
  });
});

describe('templates and notifications', () => {
  it('lists official example templates including 星环之外', async () => {
    const { templates } = await listTemplates();
    expect(templates.map((t) => t.name)).toContain('星环之外');
    expect(templates.find((t) => t.name === '星环之外')?.scriptText.length).toBeGreaterThan(20);
    expect(templates.every((t) => t.tags.length > 0)).toBe(true);
  });

  it('lists DeepSFV notifications without Hogee copy', async () => {
    const { notifications } = await listNotifications();
    expect(notifications.length).toBeGreaterThanOrEqual(4);
    expect(notifications.some((n) => n.title.includes('Seedance 2.5'))).toBe(true);
    expect(notifications.every((n) => !n.title.includes('Hogee'))).toBe(true);
  });
});

describe('MSW asset AI contracts（润色 / 生图，镜像后端 assetsGenerate）', () => {
  const projectId = String(DEMO_PROJECT_ID);

  function findAssetRow(id: string) {
    return listAssets(projectId, { type: 'character' }).then(({ assets }) =>
      assets.find((a) => a.id === id),
    );
  }

  it('单个润色：同步返回新提示词并持久化（promptState=done）', async () => {
    const prompt = await polishAssetPrompt({
      assetId: '101',
      projectId,
      type: 'character',
      name: '林晚',
      description: '现代穿越者',
    });

    expect(prompt).toContain('林晚');
    const row = (await findAssetRow('101'))!;
    expect(row.prompt).toBe(prompt);
    expect(row.promptState).toBe('done');
  });

  it('批量润色：受理即置 running，后台状态机到点写 done + 提示词', async () => {
    await batchPolishAssetPrompts(projectId, [
      { assetId: '101', type: 'character', name: '林晚', description: '现代穿越者' },
      { assetId: '102', type: 'character', name: '宇智波鼬', description: '忍者' },
    ]);

    // 受理后立刻查：全部进入生成中
    const during = await listAssets(projectId, { type: 'character' });
    expect(during.assets.map((a) => a.promptState)).toEqual(['running', 'running']);

    // 状态机定时器到点后：完成并写回提示词
    let settled: Awaited<ReturnType<typeof listAssets>> | null = null;
    for (let i = 0; i < 80; i += 1) {
      await new Promise((r) => setTimeout(r, 10));
      settled = await listAssets(projectId, { type: 'character' });
      if (settled.assets.every((a) => a.promptState !== 'running')) break;
    }
    expect(settled!.assets.map((a) => a.promptState)).toEqual(['done', 'done']);
    expect(settled!.assets.every((a) => a.prompt != null)).toBe(true);
  });

  it('生图（图像 key 未配置，默认态）：失败原因透出，资产行落失败态', async () => {
    await expect(
      generateAssetImage({
        assetId: '101',
        projectId,
        type: 'character',
        name: '林晚',
        description: '现代穿越者',
        model: '1:Seedream-4.0',
        resolution: '2K',
        prompt: '赛博朋克少女四视图',
      }),
    ).rejects.toMatchObject({ message: '图像供应商未配置 key' });

    const row = (await findAssetRow('101'))!;
    expect(row.imageState).toBe('failed');
    expect(row.imageId).not.toBeNull();
  });

  it('生图（图像 key 已配置）：返回图片 URL 并落已完成态；cancelGenerate 把它置失败', async () => {
    setBackendImageVendorEnabled(true);

    const result = await generateAssetImage({
      assetId: '101',
      projectId,
      type: 'character',
      name: '林晚',
      description: '现代穿越者',
      model: '1:Seedream-4.0',
      resolution: '2K',
      prompt: '赛博朋克少女四视图',
    });
    expect(result.imageUrl).toContain('/oss/');

    const row = (await findAssetRow('101'))!;
    expect(row.imageState).toBe('done');
    expect(row.imageUrl).toBe(result.imageUrl);

    await cancelAssetImageGeneration(row.imageId!);
    const cancelled = (await findAssetRow('101'))!;
    expect(cancelled.imageState).toBe('failed');
  });
});
