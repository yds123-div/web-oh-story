import { vi } from 'vitest';
import { setupServer } from 'msw/node';
import {
  addScript,
  batchGenerateTrackVideoPrompts,
  batchGenerateTrackVideos,
  createAsset,
  createProject,
  createStoryboard,
  createVideoTrack,
  deleteAsset,
  deleteProject,
  deleteStoryboard,
  deleteStoryboards,
  deleteTrackVideo,
  deleteVideoTrack,
  downloadStoryboardPreview,
  batchPolishAssetPrompts,
  cancelAssetImageGeneration,
  fetchWorkbench,
  generateAssetImage,
  generateStoryboardImages,
  generateTrackVideo,
  generateTrackVideoPrompt,
  polishAssetPrompt,
  pollStoryboardImages,
  pollStoryboardImagesUntilSettled,
  pollVideoPromptsUntilSettled,
  pollVideosUntilSettled,
  previewStoryboardImages,
  selectTrackVideo,
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
  updateTrackVideoDuration,
  updateTrackVideoPrompt,
  uploadAssetImage,
} from '../lib/api';
import {
  DEMO_PROJECT_ID,
  resetBackendDb,
  setBackendImageVendorEnabled,
  setBackendVideoVendorEnabled,
} from './backendDb';
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

describe('MSW 分镜图片契约（镜像后端 production/storyboard）', () => {
  const projectId = String(DEMO_PROJECT_ID);
  const scriptId = '1';

  async function storyboardIds(): Promise<string[]> {
    return (await listStoryboards(projectId, scriptId)).map((s) => s.id);
  }

  /**
   * 这条刻意绕过 API client 直接打 handler：客户端恒发 compulsory:true，
   * 正是为了绕开这个后端行为。用例本身是那份决定的证据。
   */
  it('后端契约：compulsory 缺省时 shouldGenerateImage=0 的分镜被跳过（前端因此恒发 true）', async () => {
    const ids = await storyboardIds();
    const res = await fetch('/api/production/storyboard/batchGenerateImage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: Number(projectId), scriptId: Number(scriptId), storyboardIds: ids.map(Number) }),
    });
    const body = (await res.json()) as { data: { id: number; state: string; shouldGenerateImage: number }[] };

    // 种子分镜 1 与 3 的 shouldGenerateImage=0（建时 src 为空），只有 2 是 1
    expect(body.data.map((r) => `${r.id}:${r.state}`)).toEqual(['1:未生成', '2:生成中', '3:未生成']);
    expect(body.data.map((r) => r.shouldGenerateImage)).toEqual([0, 1, 0]);

    // 被跳过的两条停在「未生成」；被受理的那条整行不出现在轮询结果里（= 生成中）
    const tick = await pollStoryboardImages(ids);
    expect(tick.map((s) => `${s.id}:${s.status}`).sort()).toEqual(['1:none', '3:none']);
    // 等状态机跑完也没有第 2 条的图——它压根没被受理
    await pollStoryboardImagesUntilSettled(ids, { onTick: () => {}, intervalMs: 10 });
    const settled = await pollStoryboardImages(ids);
    expect(settled.every((s) => s.imageUrl === null)).toBe(true);
  });

  it('批量生图（客户端恒发 compulsory:true）：全部分镜都进入生成并最终出图', async () => {
    const ids = await storyboardIds();
    await generateStoryboardImages({ projectId, scriptId, storyboardIds: ids });

    const states: string[] = [];
    await pollStoryboardImagesUntilSettled(ids, {
      onTick: (tick) => states.splice(0, states.length, ...tick.map((s) => `${s.id}:${s.status}`)),
      intervalMs: 10,
    });

    // 图像供应商默认未配 key：全部落到「生成失败」并带原因
    expect(states.sort()).toEqual(['1:failed', '2:failed', '3:failed']);
    const failed = await pollStoryboardImages(ids);
    expect(failed.every((s) => s.errorReason === '图像供应商未配置 key')).toBe(true);
    expect(failed.every((s) => s.imageUrl === null)).toBe(true);
  });

  it('图像 key 到位（setBackendImageVendorEnabled）后能真出图，预览与下载可用', async () => {
    setBackendImageVendorEnabled(true);
    const ids = await storyboardIds();

    await generateStoryboardImages({ projectId, scriptId, storyboardIds: ids });
    await pollStoryboardImagesUntilSettled(ids, { onTick: () => {}, intervalMs: 10 });

    const done = await pollStoryboardImages(ids);
    expect(done.every((s) => s.status === 'done')).toBe(true);
    expect(done.every((s) => s.imageUrl?.includes('/oss/'))).toBe(true);

    const preview = await previewStoryboardImages(ids);
    expect(preview?.startsWith('data:image/jpeg;base64,')).toBe(true);
    const blob = await downloadStoryboardPreview(ids);
    expect(blob?.type).toBe('image/png');

    // 没有一张有效图时：预览回 null、下载回 null（后端 204）
    await expect(previewStoryboardImages(['99999'])).resolves.toBeNull();
    await expect(downloadStoryboardPreview(['99999'])).resolves.toBeNull();
  });

  it('重查分镜列表后缩略图就是刚生成的图（刷新不丢）', async () => {
    setBackendImageVendorEnabled(true);
    const ids = await storyboardIds();
    await generateStoryboardImages({ projectId, scriptId, storyboardIds: ids });
    await pollStoryboardImagesUntilSettled(ids, { onTick: () => {}, intervalMs: 10 });

    const storyboards = await listStoryboards(projectId, scriptId);
    expect(storyboards.every((s) => s.imageUrl?.includes('/oss/'))).toBe(true);
  });
});

describe('MSW 工作台契约（镜像后端 production/workbench）', () => {
  const projectId = String(DEMO_PROJECT_ID);
  const scriptId = '1';

  it('读模型：轨道与分镜一一对应，提示词/生图/视频三列状态各自翻译', async () => {
    const { tracks, storyboards } = await fetchWorkbench(projectId, scriptId);

    expect(tracks).toHaveLength(3);
    expect(tracks.map((t) => t.storyboardId)).toEqual(['1', '2', '3']);
    expect(tracks.map((t) => t.number)).toEqual([1, 2, 3]);
    // 种子轨道没写 duration，回退到分镜时长
    expect(tracks.map((t) => t.durationSec)).toEqual([4, 3, 5]);
    expect(tracks.every((t) => t.promptStatus === 'none')).toBe(true);
    expect(storyboards.map((s) => s.status)).toEqual(['none', 'none', 'none']);
    // 分镜 2 种子里带缩略图
    expect(storyboards[1]?.imageUrl).toContain('/oss/1/storyboard/mock-2.png');
  });

  it('单个轨道生成提示词：同步落库并持久化，可编辑后重读', async () => {
    const { tracks } = await fetchWorkbench(projectId, scriptId);
    const trackId = tracks[0]!.id;

    const prompt = await generateTrackVideoPrompt({
      trackId,
      storyboardId: tracks[0]!.storyboardId!,
      projectId,
      model: 'volcengine:doubao-seedance-2-0-260128',
      mode: 'text',
    });
    expect(prompt).toContain('镜头');

    const after = await fetchWorkbench(projectId, scriptId);
    expect(after.tracks[0]).toMatchObject({ videoPrompt: prompt, promptStatus: 'done' });

    await updateTrackVideoPrompt(trackId, '手动改过的提示词');
    const edited = await fetchWorkbench(projectId, scriptId);
    expect(edited.tracks[0]).toMatchObject({ videoPrompt: '手动改过的提示词', promptStatus: 'done' });
  });

  it('批量生成提示词：受理后进入生成中，轮询到终态后各轨道提示词落库', async () => {
    const { tracks } = await fetchWorkbench(projectId, scriptId);
    const ids = tracks.map((t) => t.id);

    await batchGenerateTrackVideoPrompts({
      projectId,
      tracks: tracks.map((t) => ({ trackId: t.id, storyboardId: t.storyboardId! })),
      model: 'volcengine:doubao-seedance-2-0-260128',
      mode: 'text',
    });

    await pollVideoPromptsUntilSettled(
      { projectId, scriptId, trackIds: ids },
      { onTick: () => {}, intervalMs: 10 },
    );

    const after = await fetchWorkbench(projectId, scriptId);
    expect(after.tracks.every((t) => t.promptStatus === 'done')).toBe(true);
    expect(after.tracks.every((t) => t.videoPrompt.length > 0)).toBe(true);
  });

  it('视频生成（无 key）：失败原因清晰，可重试，版本可选择与切换', async () => {
    const { tracks } = await fetchWorkbench(projectId, scriptId);
    const track = tracks[0]!;

    const videoId = await generateTrackVideo({
      projectId,
      scriptId,
      trackId: track.id,
      storyboardId: track.storyboardId!,
      prompt: '镜头1：电影感中景',
      model: 'volcengine:doubao-seedance-2-0-260128',
      mode: 'text',
      resolution: '720p',
      durationSec: 4,
    });

    await pollVideosUntilSettled({ projectId, scriptId, videoIds: [videoId] }, { onTick: () => {}, intervalMs: 10 });

    const failed = await fetchWorkbench(projectId, scriptId);
    const versions = failed.tracks[0]!.videos;
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ status: 'failed', url: null, errorReason: '缺少API Key' });

    // 再点一次是新的版本（不是覆盖），失败态可重试
    const retryId = await generateTrackVideo({
      projectId,
      scriptId,
      trackId: track.id,
      storyboardId: track.storyboardId!,
      prompt: '镜头1：电影感中景',
      model: 'volcengine:doubao-seedance-2-0-260128',
      mode: 'text',
      resolution: '720p',
      durationSec: 4,
    });
    await pollVideosUntilSettled({ projectId, scriptId, videoIds: [retryId] }, { onTick: () => {}, intervalMs: 10 });
    expect((await fetchWorkbench(projectId, scriptId)).tracks[0]!.videos).toHaveLength(2);
  });

  it('视频 key 到位后：生成成功并可切换选中版本，删除版本后选中态被清空', async () => {
    setBackendVideoVendorEnabled(true);
    const { tracks } = await fetchWorkbench(projectId, scriptId);
    const track = tracks[0]!;
    const genBody = {
      projectId,
      scriptId,
      trackId: track.id,
      storyboardId: track.storyboardId!,
      prompt: '镜头1：电影感中景',
      model: 'volcengine:doubao-seedance-2-0-260128',
      mode: 'text',
      resolution: '720p',
      durationSec: 4,
    };

    const first = await generateTrackVideo(genBody);
    const second = await generateTrackVideo(genBody);
    await pollVideosUntilSettled({ projectId, scriptId, videoIds: [first, second] }, { onTick: () => {}, intervalMs: 10 });

    const done = await fetchWorkbench(projectId, scriptId);
    expect(done.tracks[0]!.videos.map((v) => v.status)).toEqual(['done', 'done']);
    expect(done.tracks[0]!.videos.every((v) => v.url?.includes('/oss/'))).toBe(true);

    // 默认没选任何版本
    expect(done.tracks[0]!.selectedVideoId).toBeNull();

    await selectTrackVideo(track.id, second);
    expect((await fetchWorkbench(projectId, scriptId)).tracks[0]!.selectedVideoId).toBe(second);

    // 切到另一版
    await selectTrackVideo(track.id, first);
    expect((await fetchWorkbench(projectId, scriptId)).tracks[0]!.selectedVideoId).toBe(first);

    // 删掉正在使用的版本 → 选中态回到未选择
    await deleteTrackVideo(first);
    const afterDelete = await fetchWorkbench(projectId, scriptId);
    expect(afterDelete.tracks[0]!.selectedVideoId).toBeNull();
    expect(afterDelete.tracks[0]!.videos).toHaveLength(1);
  });

  it('批量生成视频：每个轨道各落一版，返回 videoId 与 trackId 对应关系', async () => {
    const { tracks } = await fetchWorkbench(projectId, scriptId);
    const created = await batchGenerateTrackVideos({
      projectId,
      scriptId,
      tracks: tracks.map((t) => ({
        trackId: t.id,
        storyboardId: t.storyboardId!,
        prompt: '镜头提示词',
        durationSec: t.durationSec ?? 4,
      })),
      model: 'volcengine:doubao-seedance-2-0-260128',
      mode: 'text',
      resolution: '720p',
    });

    expect(created.map((c) => c.trackId)).toEqual(tracks.map((t) => t.id));
    await pollVideosUntilSettled(
      { projectId, scriptId, videoIds: created.map((c) => c.videoId) },
      { onTick: () => {}, intervalMs: 10 },
    );

    const after = await fetchWorkbench(projectId, scriptId);
    expect(after.tracks.every((t) => t.videos.length === 1)).toBe(true);
  });

  it('轨道时长可改（updateVideoDuration 落库后读模型跟着变）', async () => {
    const { tracks } = await fetchWorkbench(projectId, scriptId);
    await updateTrackVideoDuration(tracks[0]!.id, 8);

    const after = await fetchWorkbench(projectId, scriptId);
    expect(after.tracks[0]!.durationSec).toBe(8);
  });

  it('删除分镜后轨道会变成孤立轨道（后端 removeFrame 的真实行为，可手工清理）', async () => {
    const before = await fetchWorkbench(projectId, scriptId);
    const removedTrackId = before.tracks[0]!.id;
    await deleteStoryboard(before.tracks[0]!.storyboardId!);

    const after = await fetchWorkbench(projectId, scriptId);
    // 轨道数不变：后端只在「该 track 名下只有一条分镜」时才删轨道，
    // 而 addStoryboard 建的分镜 track 列为 NULL，判断永远不成立
    expect(after.tracks).toHaveLength(3);
    const orphan = after.tracks.find((t) => t.id === removedTrackId)!;
    expect(orphan).toMatchObject({ storyboardId: null, number: null, description: '' });

    // 剩下的分镜序号重排，但轨道自己的 id 不变
    expect(after.tracks.map((t) => t.storyboardId)).toEqual([null, '2', '3']);
    expect(after.tracks.slice(1).map((t) => t.number)).toEqual([1, 2]);

    // deleteTrack 是这条孤立轨道的清理路径
    await deleteVideoTrack(removedTrackId);
    expect((await fetchWorkbench(projectId, scriptId)).tracks).toHaveLength(2);
  });

  it('addTrack / deleteTrack 已接好（页面不调用，仅契约保真）', async () => {
    const trackId = await createVideoTrack(projectId, scriptId, 5);
    const withTrack = await fetchWorkbench(projectId, scriptId);
    const orphan = withTrack.tracks.find((t) => t.id === trackId)!;
    expect(orphan).toMatchObject({ storyboardId: null, number: null, durationSec: 5 });

    await deleteVideoTrack(trackId);
    const after = await fetchWorkbench(projectId, scriptId);
    expect(after.tracks.find((t) => t.id === trackId)).toBeUndefined();
  });

  it('项目没配视频模型时读模型给出可读原因（后端用 400 套了成功信封）', async () => {
    await createProject({ ...NEW_PROJECT_BODY, videoModel: '' });
    const projects = await listProjects();
    const blank = projects.projects.reduce((a, b) => (Number(b.id) > Number(a.id) ? b : a));

    await expect(fetchWorkbench(blank.id, scriptId)).rejects.toThrow('项目未配置视频模型');
  });
});
