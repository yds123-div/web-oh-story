import type { PatchSegmentBody } from '../types/api';
import { delay, http, HttpResponse } from 'msw';
import {
  completeAssetsRecord,
  createAssetImageTask,
  createEpisodeExportTask,
  createEpisodeSplitTask,
  createOutlineTask,
  createNovelTask,
  createSegmentRecord,
  createSegmentVideoTask,
  createCreativeTask,
  finalizeOutlineRecord,
  getCreditsBalance,
  getEpisodeRecord,
  getOutlineRecord,
  getProject,
  getWorkflowRecord,
  isModelId,
  listAssetRecords,
  listEpisodeRecords,
  listModelRecords,
  listNotificationRecords,
  listSegmentRecords,
  listTemplateRecords,
  patchAssetRecord,
  patchSegmentRecord,
} from './db';
import {
  addBackendProject,
  deleteBackendProject,
  findBackendProject,
  getBackendProjects,
  getBackendTaskById,
  getBackendTasks,
  getProjectStatistics,
  updateBackendProject,
} from './backendDb';

function netDelay(ms: number): Promise<void> {
  if (import.meta.env.MODE === 'test') return Promise.resolve();
  return delay(ms);
}

/** 后端信封：HTTP 恒 200，成败看 code */
function envelope(data: unknown, message = '成功') {
  return HttpResponse.json({ code: 200, data, message });
}

/** 复刻后端 validateFields 失败形状：HTTP 400 + `{message: '参数错误', errors}`（非信封） */
function validateBody(
  body: Record<string, unknown>,
  shape: Record<string, 'string' | 'number' | 'optionalNumber' | 'optionalString'>,
) {
  const errors: string[] = [];
  for (const [field, rule] of Object.entries(shape)) {
    const value = body[field];
    if (rule === 'number' && typeof value !== 'number') errors.push(`字段 ${field} 应为数字`);
    if (rule === 'string' && typeof value !== 'string') errors.push(`字段 ${field} 应为字符串`);
    if (rule === 'optionalNumber' && value != null && typeof value !== 'number') errors.push(`字段 ${field} 应为数字`);
    if (rule === 'optionalString' && value != null && typeof value !== 'string') errors.push(`字段 ${field} 应为字符串`);
  }
  if (errors.length === 0) return null;
  return HttpResponse.json({ message: '参数错误', errors }, { status: 400 });
}

export const handlers = [
  // 登录（按后端真实契约：POST + 信封，token 带 Bearer 前缀）
  http.post('/api/login/login', async () => {
    await netDelay(60);
    return HttpResponse.json({
      code: 200,
      data: { token: 'Bearer dev-placeholder-token', name: 'admin', id: 1 },
      message: '登录成功',
    });
  }),

  // ===== 项目（后端契约：o_project）=====

  http.post('/api/project/getProject', async () => {
    await netDelay(80);
    return envelope(getBackendProjects());
  }),

  http.post('/api/project/addProject', async ({ request }) => {
    await netDelay(80);
    const body = (await request.json()) as Record<string, unknown>;
    const invalid = validateBody(body, {
      projectType: 'string',
      name: 'string',
      intro: 'string',
      type: 'string',
      artStyle: 'string',
      directorManual: 'string',
      videoRatio: 'string',
      imageModel: 'string',
      videoModel: 'string',
      imageQuality: 'string',
      mode: 'string',
    });
    if (invalid) return invalid;
    addBackendProject({
      projectType: String(body.projectType),
      name: String(body.name),
      intro: String(body.intro),
      type: String(body.type),
      artStyle: String(body.artStyle),
      directorManual: String(body.directorManual),
      videoRatio: String(body.videoRatio),
      imageModel: String(body.imageModel),
      videoModel: String(body.videoModel),
      imageQuality: String(body.imageQuality),
      mode: String(body.mode),
    });
    return envelope({ message: '新增项目成功' }, '新增项目成功');
  }),

  http.post('/api/project/editProject', async ({ request }) => {
    await netDelay(80);
    const body = (await request.json()) as Record<string, unknown>;
    const invalid = validateBody(body, {
      id: 'number',
      name: 'string',
      intro: 'string',
      type: 'string',
      artStyle: 'string',
      directorManual: 'string',
      videoRatio: 'string',
      imageModel: 'string',
      videoModel: 'string',
      imageQuality: 'string',
      projectType: 'string',
      mode: 'string',
    });
    if (invalid) return invalid;
    updateBackendProject(Number(body.id), {
      name: String(body.name),
      intro: String(body.intro),
      type: String(body.type),
      artStyle: String(body.artStyle),
      directorManual: String(body.directorManual),
      videoRatio: String(body.videoRatio),
      imageModel: String(body.imageModel),
      videoModel: String(body.videoModel),
      imageQuality: String(body.imageQuality),
      projectType: String(body.projectType),
      mode: String(body.mode),
    });
    return envelope({ message: '编辑项目成功' }, '编辑项目成功');
  }),

  http.post('/api/project/delProject', async ({ request }) => {
    await netDelay(80);
    const body = (await request.json()) as Record<string, unknown>;
    const invalid = validateBody(body, { id: 'number' });
    if (invalid) return invalid;
    deleteBackendProject(Number(body.id));
    return envelope({ message: '删除项目成功' }, '删除项目成功');
  }),

  http.post('/api/general/getSingleProject', async ({ request }) => {
    await netDelay(60);
    const body = (await request.json()) as Record<string, unknown>;
    const invalid = validateBody(body, { id: 'number' });
    if (invalid) return invalid;
    const found = getBackendProjects().filter((p) => p.id === Number(body.id));
    return envelope(found);
  }),

  http.post('/api/general/generalStatistics', async ({ request }) => {
    await netDelay(60);
    const body = (await request.json()) as Record<string, unknown>;
    const invalid = validateBody(body, { projectId: 'number' });
    if (invalid) return invalid;
    return envelope(getProjectStatistics(Number(body.projectId)));
  }),

  // ===== 任务中心（后端契约：o_tasks）=====

  http.post('/api/task/getTaskApi', async ({ request }) => {
    await netDelay(80);
    const body = (await request.json()) as Record<string, unknown>;
    const invalid = validateBody(body, {
      state: 'optionalString',
      taskClass: 'optionalString',
      projectId: 'optionalNumber',
      page: 'number',
      limit: 'number',
    });
    if (invalid) return invalid;
    const page = Number(body.page ?? 1);
    const limit = Number(body.limit ?? 10);
    const filtered = getBackendTasks()
      .filter((t) => (body.taskClass ? t.taskClass === body.taskClass : true))
      .filter((t) => (body.state ? t.state === body.state : true))
      .filter((t) => (body.projectId != null ? t.projectId === Number(body.projectId) : true))
      .sort((a, b) => b.id - a.id);
    // 复刻后端 leftJoin o_project + `select("o_tasks.*", "o_project.*")`：
    // 重名列 id 会被项目 id 覆盖（join 不上时为 null），name 为项目名
    const rows = filtered
      .slice((page - 1) * limit, page * limit)
      .map((t) => {
        const project = t.projectId != null ? findBackendProject(t.projectId) : null;
        return { ...t, id: project?.id ?? null, name: project?.name ?? null };
      });
    return envelope({ data: rows, total: filtered.length });
  }),

  http.post('/api/task/getTaskCategories', async () => {
    await netDelay(40);
    const classes = [...new Set(getBackendTasks().map((t) => t.taskClass).filter(Boolean))];
    return envelope(classes.map((taskClass) => ({ taskClass })));
  }),

  http.post('/api/task/getProject', async () => {
    await netDelay(40);
    return envelope(getBackendProjects().map((p) => ({ id: p.id, name: p.name })));
  }),

  http.post('/api/task/taskDetails', async ({ request }) => {
    await netDelay(40);
    const body = (await request.json()) as Record<string, unknown>;
    const invalid = validateBody(body, { taskId: 'number' });
    if (invalid) return invalid;
    return envelope(getBackendTaskById(Number(body.taskId)));
  }),

  http.get('/api/credits', async () => {
    await netDelay(60);
    return HttpResponse.json({ balance: getCreditsBalance() });
  }),

  http.post('/api/projects/:id/outline-tasks', async ({ params, request }) => {
    await netDelay(120);
    const project = getProject(String(params.id));
    if (!project) {
      return HttpResponse.json({ message: '项目不存在' }, { status: 404 });
    }
    const body = (await request.json()) as { sourceType?: string; text?: string; fileName?: string };
    if (body.sourceType !== 'paste' && body.sourceType !== 'file') {
      return HttpResponse.json({ message: 'sourceType 无效' }, { status: 400 });
    }
    const task = createOutlineTask(project.id);
    return HttpResponse.json({ taskId: task.taskId }, { status: 202 });
  }),

  http.post('/api/projects/:id/novel-tasks', async ({ params, request }) => {
    await netDelay(120);
    const project = getProject(String(params.id));
    if (!project) {
      return HttpResponse.json({ message: '项目不存在' }, { status: 404 });
    }
    const body = (await request.json()) as { sourceType?: string; text?: string; fileName?: string };
    if (body.sourceType !== 'paste' && body.sourceType !== 'file') {
      return HttpResponse.json({ message: 'sourceType 无效' }, { status: 400 });
    }
    const task = createNovelTask(project.id);
    return HttpResponse.json({ taskId: task.taskId }, { status: 202 });
  }),

  http.get('/api/projects/:id/outline', async ({ params }) => {
    await netDelay(80);
    const outline = getOutlineRecord(String(params.id));
    if (!outline) {
      return HttpResponse.json({ message: '大纲不存在' }, { status: 404 });
    }
    return HttpResponse.json(outline);
  }),

  http.post('/api/projects/:id/outline/finalize', async ({ params }) => {
    await netDelay(80);
    const workflow = finalizeOutlineRecord(String(params.id));
    if (!workflow) {
      return HttpResponse.json({ message: '大纲不存在' }, { status: 404 });
    }
    return HttpResponse.json(workflow);
  }),

  http.patch('/api/projects/:id/outline/screenplay', async ({ params, request }) => {
    await netDelay(80);
    const body = (await request.json()) as { screenplay?: string };
    if (typeof body.screenplay !== 'string') {
      return HttpResponse.json({ message: 'screenplay 无效' }, { status: 400 });
    }
    const outline = getOutlineRecord(String(params.id));
    if (!outline) {
      return HttpResponse.json({ message: '大纲不存在' }, { status: 404 });
    }
    outline.screenplay = body.screenplay;
    return HttpResponse.json(outline);
  }),

  http.get('/api/projects/:id/workflow', async ({ params }) => {
    await netDelay(40);
    const workflow = getWorkflowRecord(String(params.id));
    if (!workflow) {
      return HttpResponse.json({ message: '项目不存在' }, { status: 404 });
    }
    return HttpResponse.json(workflow);
  }),

  http.get('/api/projects/:id/assets', async ({ params }) => {
    await netDelay(80);
    const list = listAssetRecords(String(params.id));
    if (!list) {
      return HttpResponse.json({ message: '项目不存在' }, { status: 404 });
    }
    return HttpResponse.json({ assets: list });
  }),

  http.post('/api/assets/:id/image-tasks', async ({ params }) => {
    await netDelay(120);
    const task = createAssetImageTask(String(params.id));
    if (!task) {
      return HttpResponse.json({ message: '资产不存在' }, { status: 404 });
    }
    return HttpResponse.json({ taskId: task.taskId }, { status: 202 });
  }),

  http.patch('/api/assets/:id', async ({ params, request }) => {
    await netDelay(80);
    const body = (await request.json()) as { consistencyLocked?: boolean; currentAlt?: number };
    if (body.consistencyLocked !== undefined && typeof body.consistencyLocked !== 'boolean') {
      return HttpResponse.json({ message: 'consistencyLocked 无效' }, { status: 400 });
    }
    if (body.currentAlt !== undefined && typeof body.currentAlt !== 'number') {
      return HttpResponse.json({ message: 'currentAlt 无效' }, { status: 400 });
    }
    const updated = patchAssetRecord(String(params.id), body);
    if (!updated) {
      return HttpResponse.json({ message: '资产不存在' }, { status: 404 });
    }
    return HttpResponse.json(updated);
  }),

  http.post('/api/projects/:id/assets/complete', async ({ params }) => {
    await netDelay(80);
    const workflow = completeAssetsRecord(String(params.id));
    if (!workflow) {
      return HttpResponse.json({ message: '请先完成剧本定稿' }, { status: 400 });
    }
    return HttpResponse.json(workflow);
  }),

  http.post('/api/projects/:id/episode-split-tasks', async ({ params }) => {
    await netDelay(120);
    const task = createEpisodeSplitTask(String(params.id));
    if (!task) {
      return HttpResponse.json({ message: '请先完成资产步骤' }, { status: 400 });
    }
    return HttpResponse.json({ taskId: task.taskId }, { status: 202 });
  }),

  http.get('/api/projects/:id/episodes', async ({ params }) => {
    await netDelay(80);
    const list = listEpisodeRecords(String(params.id));
    if (!list) {
      return HttpResponse.json({ message: '项目不存在' }, { status: 404 });
    }
    return HttpResponse.json({ episodes: list });
  }),

  http.get('/api/models', async () => {
    await netDelay(40);
    return HttpResponse.json({ models: listModelRecords() });
  }),

  http.get('/api/episodes/:episodeId', async ({ params }) => {
    await netDelay(80);
    const episode = getEpisodeRecord(String(params.episodeId));
    if (!episode) {
      return HttpResponse.json({ message: '分集不存在' }, { status: 404 });
    }
    return HttpResponse.json(episode);
  }),

  http.get('/api/episodes/:episodeId/segments', async ({ params }) => {
    await netDelay(80);
    const list = listSegmentRecords(String(params.episodeId));
    if (!list) {
      return HttpResponse.json({ message: '分集不存在' }, { status: 404 });
    }
    return HttpResponse.json({ segments: list });
  }),

  http.patch('/api/segments/:id', async ({ params, request }) => {
    await netDelay(80);
    const body = (await request.json()) as PatchSegmentBody;
    const updated = patchSegmentRecord(String(params.id), body);
    if (!updated) {
      return HttpResponse.json({ message: '片段不存在' }, { status: 404 });
    }
    return HttpResponse.json(updated);
  }),

  http.post('/api/episodes/:episodeId/segments', async ({ params, request }) => {
    await netDelay(80);
    const body = (await request.json()) as { prompt: string; durationSec: number; title: string };
    const created = createSegmentRecord(String(params.episodeId), body);
    if (!created) {
      return HttpResponse.json({ message: '分集不存在' }, { status: 404 });
    }
    return HttpResponse.json(created, { status: 201 });
  }),

  http.post('/api/segments/:id/video-tasks', async ({ params, request }) => {
    await netDelay(120);
    const body = (await request.json()) as { model?: string };
    if (!body.model || !isModelId(body.model)) {
      return HttpResponse.json({ message: 'model 无效' }, { status: 400 });
    }
    const task = createSegmentVideoTask(String(params.id), body.model);
    if (!task) {
      return HttpResponse.json({ message: '片段不存在' }, { status: 404 });
    }
    return HttpResponse.json({ taskId: task.taskId }, { status: 202 });
  }),

  http.post('/api/episodes/:episodeId/export-tasks', async ({ params }) => {
    await netDelay(120);
    const task = createEpisodeExportTask(String(params.episodeId));
    if (!task) {
      return HttpResponse.json({ message: '分集不存在或尚未拆分' }, { status: 400 });
    }
    return HttpResponse.json({ taskId: task.taskId }, { status: 202 });
  }),

  http.get('/api/templates', async () => {
    await netDelay(80);
    return HttpResponse.json({ templates: listTemplateRecords() });
  }),

  http.get('/api/notifications', async () => {
    await netDelay(60);
    return HttpResponse.json({ notifications: listNotificationRecords() });
  }),

  http.post('/api/creative-tasks', async ({ request }) => {
    await netDelay(120);
    const body = (await request.json()) as { kind?: string; prompt?: string };
    if (!body.kind || (body.kind !== 'image' && body.kind !== 'video')) {
      return HttpResponse.json({ message: 'kind 无效' }, { status: 400 });
    }
    if (!body.prompt || typeof body.prompt !== 'string') {
      return HttpResponse.json({ message: 'prompt 无效' }, { status: 400 });
    }
    const task = createCreativeTask(body.kind === 'image' ? 'creative-image' : 'creative-video');
    return HttpResponse.json({ taskId: task.taskId }, { status: 202 });
  }),

  // ===== 剧本（后端 o_script）=====

  http.post('/api/script/getScrptApi', async ({ request }) => {
    await netDelay(80);
    const body = (await request.json()) as Record<string, unknown>;
    const invalid = validateBody(body, { projectId: 'optionalNumber' });
    if (invalid) return invalid;
    // Mock 数据：返回测试剧本
    const mockScripts = body.projectId
      ? [
          {
            id: Date.now(),
            projectId: Number(body.projectId),
            name: '第1集·异世囚笼',
            content: '【木叶长廊 内 夜】\n木叶，夜晚长廊，月光冷白。\n△ 林晚扶着廊柱，指尖颤抖，眼神茫然又痛苦，身着木叶制式素色和服。\n林晚（低声独白）：明明只是在家看火影……一睁眼，就来到了这里。\n△ 鼬缓步从阴影走出，红瞳微光，神色淡漠。\n鼬：深夜在此，有何目的。长老安排你，来监视我？',
            extractState: 0,
            errorReason: null,
            createTime: Date.now(),
          },
        ]
      : [];
    return envelope(mockScripts);
  }),

  http.post('/api/script/addScript', async ({ request }) => {
    await netDelay(80);
    const body = (await request.json()) as Record<string, unknown>;
    const invalid = validateBody(body, {
      projectId: 'number',
      name: 'string',
      content: 'string',
    });
    if (invalid) return invalid;
    return envelope({ message: '新增剧本成功' }, '新增剧本成功');
  }),

  http.post('/api/script/updateScript', async ({ request }) => {
    await netDelay(80);
    const body = (await request.json()) as Record<string, unknown>;
    const invalid = validateBody(body, {
      id: 'number',
      name: 'optionalString',
      content: 'optionalString',
    });
    if (invalid) return invalid;
    return envelope({ message: '更新剧本成功' }, '更新剧本成功');
  }),

  http.post('/api/script/delScript', async ({ request }) => {
    await netDelay(80);
    const body = (await request.json()) as Record<string, unknown>;
    const invalid = validateBody(body, { id: 'number' });
    if (invalid) return invalid;
    return envelope({ message: '删除剧本成功' }, '删除剧本成功');
  }),
];
