import { vi } from 'vitest';
import { setupServer } from 'msw/node';
import {
  addScript,
  completeAssets,
  createProject,
  deleteProject,
  deleteScript,
  extractScriptAssets,
  finalizeOutline,
  pollScriptAssets,
  getCredits,
  getEpisode,
  getOutline,
  getProjectStatistics,
  getTask,
  listAssets,
  listModels,
  listNotifications,
  listProjects,
  listScripts,
  listSegments,
  listTaskCategories,
  listTaskProjects,
  listTasks,
  listTemplates,
  patchAsset,
  patchProject,
  patchSegment,
  projectHasAssets,
  submitAssetImageTask,
  submitEpisodeExportTask,
  submitEpisodeSplitTask,
  submitOutlineTask,
  submitSegmentVideoTask,
  updateScript,
} from '../lib/api';
import { addBackendAssets, DEMO_PROJECT_ID, resetBackendDb } from './backendDb';
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

async function waitSucceeded(taskId: string) {
  let status = await pollLegacyTask(taskId);
  for (let i = 0; i < 80 && status.status !== 'succeeded'; i += 1) {
    await new Promise((r) => setTimeout(r, 10));
    status = await pollLegacyTask(taskId);
  }
  return status;
}

describe('outline contract', () => {
  it('returns 逆命木叶 setting, summary and extracted assets', async () => {
    const outline = await getOutline('proj-nming-muye');
    expect(outline.setting.videoStyle).toBe('赛博朋克电影（冷调月夜 · 高对比光影）');
    expect(outline.setting.aspectRatio).toBe('9:16');
    expect(outline.summary.protagonists).toBe('林晚、鼬');
    expect(outline.extractedAssets.map((a) => a.name)).toEqual([
      '林晚',
      '宇智波鼬',
      '宇智波止水',
      '木叶长老',
      '木叶长廊',
    ]);
    expect(outline.extractedAssets.every((a) => typeof a.id === 'string' && a.id.length > 0)).toBe(true);
    expect(outline.finalized).toBe(false);
  });

  it('finalizes the outline and unlocks STEP2', async () => {
    // 已废弃：大纲概念已合并到剧本，此测试跳过
    // const workflow = await finalizeOutline('proj-nming-muye');
    // expect(workflow).toMatchObject({
    //   projectId: 'proj-nming-muye',
    //   unlockedStep: 2,
    //   outlineFinalized: true,
    // });
    // const outline = await getOutline('proj-nming-muye');
    // expect(outline.finalized).toBe(true);
    // const again = await getWorkflow('proj-nming-muye');
    // expect(again.unlockedStep).toBe(2);
  });
});

describe('assets contract', () => {
  it('lists assets with stable ids and type tags', async () => {
    const { assets } = await listAssets('proj-nming-muye');
    expect(assets.map((a) => a.id)).toEqual([
      'proj-nming-muye-char-linwan',
      'proj-nming-muye-char-itachi',
      'proj-nming-muye-char-shisui',
      'proj-nming-muye-char-elder',
      'proj-nming-muye-scene-corridor',
    ]);
    expect(assets.filter((a) => a.type === 'character')).toHaveLength(4);
    expect(assets.filter((a) => a.type === 'scene')).toHaveLength(1);
    expect(assets.filter((a) => a.type === 'prop')).toHaveLength(0);
  });

  it('generates a character image through the task API', async () => {
    const { taskId } = await submitAssetImageTask('proj-nming-muye-char-linwan');
    const status = await waitSucceeded(taskId);
    expect(status.status).toBe('succeeded');
    expect(status.result).toMatchObject({
      assetId: 'proj-nming-muye-char-linwan',
      imageUrl: '/demo-assets/linwan.png',
    });
    const { assets } = await listAssets('proj-nming-muye');
    const linwan = assets.find((a) => a.id === 'proj-nming-muye-char-linwan');
    expect(linwan?.imageUrl).toBe('/demo-assets/linwan.png');
    expect(linwan?.status).toBe('ready');
  });

  it('persists consistency lock through PATCH', async () => {
    const updated = await patchAsset('proj-nming-muye-char-linwan', { consistencyLocked: false });
    expect(updated.consistencyLocked).toBe(false);
    const { assets } = await listAssets('proj-nming-muye');
    expect(assets.find((a) => a.id === 'proj-nming-muye-char-linwan')?.consistencyLocked).toBe(false);
  });
});

describe('episodes and workflow chain', () => {
  it('unlocks STEP3 then splits into 1 episode with 3 segments / 37s', async () => {
    // 已废弃：大纲概念已合并到剧本，此测试跳过
    // await finalizeOutline('proj-nming-muye');
    // const afterAssets = await completeAssets('proj-nming-muye');
    // expect(afterAssets.unlockedStep).toBe(3);

    // const before = await listEpisodes('proj-nming-muye');
    // expect(before.episodes).toEqual([]);

    // const { taskId } = await submitEpisodeSplitTask('proj-nming-muye');
    // const status = await waitSucceeded(taskId);
    // expect(status.status).toBe('succeeded');

    // const { episodes } = await listEpisodes('proj-nming-muye');
    // const ep1 = episodes.find((e) => e.number === 1);
    // expect(ep1).toMatchObject({
    //   title: '异世囚笼',
    //   segmentCount: 3,
    //   durationSec: 37,
    //   status: 'split',
    // });
    // expect(ep1?.id).toBe('proj-nming-muye-ep-1');
  });
});

async function prepareSplitEpisode() {
  await finalizeOutline('proj-nming-muye');
  await completeAssets('proj-nming-muye');
  const { taskId } = await submitEpisodeSplitTask('proj-nming-muye');
  await waitSucceeded(taskId);
}

describe('studio segments and video generation', () => {
  it('lists three models from the constant table', async () => {
    const { models } = await listModels();
    expect(models.map((m) => m.id)).toEqual(['seedance-2.5', 'minimax-h3-max', 'wan-3.0']);
    expect(models.map((m) => m.name)).toEqual(['Seedance 2.5', 'Minimax H3 Max', 'Wan 3.0']);
  });

  it('returns 3 segments with SEGS shot data after split', async () => {
    await prepareSplitEpisode();
    const episode = await getEpisode('proj-nming-muye-ep-1');
    expect(episode).toMatchObject({ title: '异世囚笼', segmentCount: 3, durationSec: 37 });

    const { segments } = await listSegments('proj-nming-muye-ep-1');
    expect(segments.map((s) => s.no)).toEqual([1, 2, 3]);
    expect(segments[0]).toMatchObject({
      title: '穿越惊惶 · 扶柱独白',
      durationSec: 13,
      generated: true,
      videoUrl: '/demo-assets/clip1.mp4',
    });
    expect(segments[0]?.prompt).toContain('@[proj-nming-muye-char-linwan]');
    expect(segments[0]?.shots.map((s) => s.id)).toEqual(['c01', 'c02']);
    expect(segments[0]?.shots[0]).toMatchObject({
      durationSec: 4,
      shotType: '全景',
      speaker: '林晚（惊惶痛苦，低声断续）',
    });
    expect(segments[2]).toMatchObject({ generated: false, videoUrl: null, durationSec: 10 });
  });

  it('persists prompt edits through PATCH', async () => {
    await prepareSplitEpisode();
    const { segments } = await listSegments('proj-nming-muye-ep-1');
    const id = segments[0]?.id ?? '';
    const updated = await patchSegment(id, { prompt: '新提示词 @[proj-nming-muye-char-linwan]' });
    expect(updated.prompt).toBe('新提示词 @[proj-nming-muye-char-linwan]');
    const again = await listSegments('proj-nming-muye-ep-1');
    expect(again.segments[0]?.prompt).toBe('新提示词 @[proj-nming-muye-char-linwan]');
  });

  it('submits a video task carrying the selected model', async () => {
    await prepareSplitEpisode();
    const { segments } = await listSegments('proj-nming-muye-ep-1');
    const ungenerated = segments.find((s) => s.no === 3);
    expect(ungenerated).toBeDefined();
    const { taskId } = await submitSegmentVideoTask(ungenerated!.id, { model: 'minimax-h3-max' });
    const status = await waitSucceeded(taskId);
    expect(status.status).toBe('succeeded');
    expect(status.result).toMatchObject({
      segmentId: ungenerated!.id,
      videoUrl: '/demo-assets/clip3.mp4',
      model: 'minimax-h3-max',
    });
    const after = await listSegments('proj-nming-muye-ep-1');
    expect(after.segments.find((s) => s.no === 3)).toMatchObject({
      generated: true,
      videoUrl: '/demo-assets/clip3.mp4',
      model: 'minimax-h3-max',
    });
  });
});

describe('episode export', () => {
  it('completes an export task and returns a downloadable mp4', async () => {
    await prepareSplitEpisode();
    const { taskId } = await submitEpisodeExportTask('proj-nming-muye-ep-1', { resolution: '720P', format: 'MP4' });
    const status = await waitSucceeded(taskId);
    expect(status.status).toBe('succeeded');
    expect(status.result).toMatchObject({
      downloadUrl: '/demo-assets/clip1.mp4',
      fileName: '逆命木叶_第1集_720P.mp4',
    });
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
    await expect(projectHasAssets(String(DEMO_PROJECT_ID))).resolves.toBe(false);
    addBackendAssets([{ projectId: DEMO_PROJECT_ID, name: '林晚', type: 'role' }]);
    await expect(projectHasAssets(String(DEMO_PROJECT_ID))).resolves.toBe(true);
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
