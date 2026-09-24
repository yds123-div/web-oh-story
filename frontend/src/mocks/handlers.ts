import { delay, http, HttpResponse } from 'msw';
import {
  createOutlineTask,
  createNovelTask,
  createCreativeTask,
  finalizeOutlineRecord,
  getCreditsBalance,
  getOutlineRecord,
  getProject,
  listNotificationRecords,
  listTemplateRecords,
} from './db';
import {
  addBackendAsset,
  addBackendProject,
  addBackendScript,
  addBackendStoryboard,
  cancelBackendImage,
  deleteBackendAsset,
  deleteBackendProject,
  deleteBackendScripts,
  deleteBackendStoryboard,
  deleteBackendStoryboards,
  findBackendProject,
  getBackendAssetPage,
  getBackendAssets,
  getBackendProjects,
  getBackendScripts,
  getBackendScriptStates,
  getBackendStoryboardCharacters,
  getBackendStoryboards,
  getBackendTaskById,
  getBackendTasks,
  getProjectStatistics,
  runAssetImageGeneration,
  runBatchPolishStateMachine,
  runExtractStateMachine,
  runSinglePolish,
  saveBackendAssetImage,
  updateBackendAsset,
  updateBackendProject,
  updateBackendScript,
  updateBackendStoryboard,
} from './backendDb';

function netDelay(ms: number): Promise<void> {
  if (import.meta.env.MODE === 'test') return Promise.resolve();
  return delay(ms);
}

/** 后端信封：HTTP 恒 200，成败看 code */
function envelope(data: unknown, message = '成功') {
  return HttpResponse.json({ code: 200, data, message });
}

/** 后端业务失败信封：HTTP 400 + `{code, data:null, message}`（storyboard 系列接口的真实行为） */
function failEnvelope(message: string) {
  return HttpResponse.json({ code: 400, data: null, message }, { status: 400 });
}

/** 复刻后端 validateFields 失败形状：HTTP 400 + `{message: '参数错误', errors}`（非信封） */
function validateBody(
  body: Record<string, unknown>,
  shape: Record<
    string,
    'string' | 'number' | 'optionalNumber' | 'optionalString' | 'numberArray' | 'nullableString'
  >,
) {
  const errors: string[] = [];
  for (const [field, rule] of Object.entries(shape)) {
    const value = body[field];
    if (rule === 'number' && typeof value !== 'number') errors.push(`字段 ${field} 应为数字`);
    if (rule === 'string' && typeof value !== 'string') errors.push(`字段 ${field} 应为字符串`);
    if (rule === 'optionalNumber' && value != null && typeof value !== 'number') errors.push(`字段 ${field} 应为数字`);
    if (rule === 'optionalString' && value != null && typeof value !== 'string') errors.push(`字段 ${field} 应为字符串`);
    // 复刻 z.string().nullable()：键必须存在，且为字符串或 null
    if (rule === 'nullableString' && value !== null && typeof value !== 'string') {
      errors.push(`字段 ${field} 应为字符串`);
    }
    // 复刻 zod 的 z.array(z.number())：键必须存在且为数字数组
    if (
      rule === 'numberArray' &&
      (!Array.isArray(value) || value.some((v) => typeof v !== 'number'))
    ) {
      errors.push(`字段 ${field} 应为数字数组`);
    }
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

  // ===== 资产（后端契约：o_assets / o_image）=====

  http.post('/api/assets/getAssetsApi', async ({ request }) => {
    await netDelay(60);
    const body = (await request.json()) as Record<string, unknown>;
    const invalid = validateBody(body, {
      projectId: 'number',
      type: 'string',
      name: 'optionalString',
      page: 'number',
      limit: 'number',
    });
    if (invalid) return invalid;
    const name = typeof body.name === 'string' && body.name ? body.name : undefined;
    return envelope(
      getBackendAssetPage(Number(body.projectId), String(body.type), name, Number(body.page), Number(body.limit)),
    );
  }),

  http.post('/api/assets/addAssets', async ({ request }) => {
    await netDelay(60);
    const body = (await request.json()) as Record<string, unknown>;
    const invalid = validateBody(body, {
      name: 'string',
      describe: 'string',
      type: 'string',
      projectId: 'number',
      remark: 'optionalString',
      prompt: 'optionalString',
    });
    if (invalid) return invalid;
    addBackendAsset({
      projectId: Number(body.projectId),
      name: String(body.name),
      describe: String(body.describe),
      type: String(body.type) as 'role' | 'scene' | 'tool',
      prompt: body.prompt != null ? String(body.prompt) : null,
      remark: body.remark != null ? String(body.remark) : null,
    });
    return envelope({ message: '新增资产成功' }, '新增资产成功');
  }),

  http.post('/api/assets/updateAssets', async ({ request }) => {
    await netDelay(60);
    const body = (await request.json()) as Record<string, unknown>;
    const invalid = validateBody(body, {
      id: 'number',
      name: 'string',
      describe: 'string',
      remark: 'optionalString',
      prompt: 'optionalString',
    });
    if (invalid) return invalid;
    updateBackendAsset(Number(body.id), {
      name: String(body.name),
      describe: String(body.describe),
      prompt: body.prompt != null ? String(body.prompt) : null,
      remark: body.remark != null ? String(body.remark) : null,
    });
    return envelope({ message: '更新资产成功' }, '更新资产成功');
  }),

  http.post('/api/assets/delAssets', async ({ request }) => {
    await netDelay(60);
    const body = (await request.json()) as Record<string, unknown>;
    const invalid = validateBody(body, { id: 'number' });
    if (invalid) return invalid;
    deleteBackendAsset(Number(body.id));
    return envelope({ message: '删除资产成功' }, '删除资产成功');
  }),

  http.post('/api/assets/saveAssets', async ({ request }) => {
    await netDelay(80);
    const body = (await request.json()) as Record<string, unknown>;
    const invalid = validateBody(body, {
      id: 'number',
      projectId: 'number',
      base64: 'optionalString',
      type: 'string',
      prompt: 'optionalString',
      imageId: 'optionalNumber',
    });
    if (invalid) return invalid;
    // 后端只认 role/scene/tool 枚举
    if (!['role', 'scene', 'tool'].includes(String(body.type))) {
      return HttpResponse.json({ message: '参数错误', errors: ['字段 type 应为 role/scene/tool'] }, { status: 400 });
    }
    // 对齐真实后端：base64 缺省时走 prompt-only 更新（imageId 可选）
    saveBackendAssetImage({
      assetId: Number(body.id),
      base64: body.base64 != null ? String(body.base64) : null,
      type: String(body.type),
      prompt: body.prompt != null ? String(body.prompt) : null,
      imageId: body.imageId != null ? Number(body.imageId) : null,
    });
    return envelope({ message: '保存资产图片成功' }, '保存资产图片成功');
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

  // ===== 资产 AI：润色与生图（后端 assetsGenerate 契约）=====

  // 单个润色（同步：等文本模型返回新 prompt）
  http.post('/api/assetsGenerate/polishAssetsPrompt', async ({ request }) => {
    await netDelay(80);
    const body = (await request.json()) as Record<string, unknown>;
    const invalid = validateBody(body, {
      assetsId: 'number',
      projectId: 'number',
      type: 'string',
      name: 'string',
      describe: 'string',
    });
    if (invalid) return invalid;
    const prompt = runSinglePolish(Number(body.assetsId));
    if (prompt == null) {
      return HttpResponse.json(
        { message: '参数错误', errors: ['资产不存在'] },
        { status: 400 },
      );
    }
    return envelope({ prompt, assetsId: Number(body.assetsId) }, '润色成功');
  }),

  // 批量润色（异步受理：后台并发生成，进度经资产列表的 promptState 轮询）
  http.post('/api/assetsGenerate/batchPolishAssetsPrompt', async ({ request }) => {
    await netDelay(80);
    const body = (await request.json()) as Record<string, unknown>;
    const invalid = validateBody(body, {
      projectId: 'number',
      concurrentCount: 'optionalNumber',
      otherTextPrompt: 'string',
    });
    if (invalid) return invalid;
    const items = body.items;
    // 复刻 zod z.array(z.object(...))：非空数组、每项 assetsId 为数字
    const itemsValid =
      Array.isArray(items) &&
      items.length > 0 &&
      items.every(
        (item) =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as Record<string, unknown>).assetsId === 'number',
      );
    if (!itemsValid) {
      return HttpResponse.json(
        { message: '参数错误', errors: ['字段 items 应为资产数组'] },
        { status: 400 },
      );
    }
    const ids = (items as { assetsId: number }[]).map((item) => Number(item.assetsId));
    runBatchPolishStateMachine(ids);
    return envelope({ total: ids.length }, '开始批量润色');
  }),

  // 资产生图（同步：图像 key 未配置时失败，失败原因走信封 message）
  http.post('/api/assetsGenerate/generateAssets', async ({ request }) => {
    await netDelay(80);
    const body = (await request.json()) as Record<string, unknown>;
    const invalid = validateBody(body, {
      projectId: 'number',
      model: 'string',
      resolution: 'string',
      id: 'number',
      type: 'string',
      name: 'string',
      prompt: 'string',
      base64: 'optionalString',
    });
    if (invalid) return invalid;
    // 后端 zod 枚举
    if (!['role', 'scene', 'tool', 'storyboard'].includes(String(body.type))) {
      return HttpResponse.json(
        { message: '参数错误', errors: ['字段 type 应为 role/scene/tool/storyboard'] },
        { status: 400 },
      );
    }
    const result = runAssetImageGeneration({
      assetId: Number(body.id),
      type: String(body.type),
      model: String(body.model),
      resolution: String(body.resolution),
    });
    if (!result.ok) {
      return HttpResponse.json(
        { code: 400, data: null, message: result.reason },
        { status: 400 },
      );
    }
    return envelope({ path: result.path, assetsId: Number(body.id) }, '生成成功');
  }),

  // 取消生图（把进行中的 o_image 置「生成失败」）
  http.post('/api/assetsGenerate/cancelGenerate', async ({ request }) => {
    await netDelay(60);
    const body = (await request.json()) as Record<string, unknown>;
    const invalid = validateBody(body, { id: 'number' });
    if (invalid) return invalid;
    if (!cancelBackendImage(Number(body.id))) {
      return HttpResponse.json(
        { message: '参数错误', errors: ['图片记录不存在'] },
        { status: 400 },
      );
    }
    return envelope({ message: '取消成功' }, '取消成功');
  }),

  // ===== 剧本（后端 o_script 契约：zod 四字段必填 / 批量删除）=====

  http.post('/api/script/getScrptApi', async ({ request }) => {
    await netDelay(80);
    const body = (await request.json()) as Record<string, unknown>;
    const invalid = validateBody(body, { projectId: 'number', name: 'optionalString' });
    if (invalid) return invalid;
    const name = typeof body.name === 'string' && body.name ? body.name : undefined;
    return envelope(getBackendScripts(Number(body.projectId), name));
  }),

  http.post('/api/script/addScript', async ({ request }) => {
    await netDelay(80);
    const body = (await request.json()) as Record<string, unknown>;
    const invalid = validateBody(body, {
      projectId: 'number',
      name: 'string',
      content: 'string',
      assets: 'numberArray',
    });
    if (invalid) return invalid;
    addBackendScript({
      projectId: Number(body.projectId),
      name: String(body.name),
      content: String(body.content),
    });
    return envelope({ message: '添加剧本成功' }, '添加剧本成功');
  }),

  http.post('/api/script/updateScript', async ({ request }) => {
    await netDelay(80);
    const body = (await request.json()) as Record<string, unknown>;
    const invalid = validateBody(body, {
      id: 'number',
      name: 'string',
      content: 'string',
      assets: 'numberArray',
    });
    if (invalid) return invalid;
    updateBackendScript(Number(body.id), {
      name: String(body.name),
      content: String(body.content),
    });
    return envelope({ message: '编辑剧本成功' }, '编辑剧本成功');
  }),

  http.post('/api/script/delScript', async ({ request }) => {
    await netDelay(80);
    const body = (await request.json()) as Record<string, unknown>;
    const invalid = validateBody(body, { ids: 'numberArray' });
    if (invalid) return invalid;
    deleteBackendScripts((body.ids as number[]).map(Number));
    return envelope({ message: '删除剧本成功' }, '删除剧本成功');
  }),

  http.post('/api/script/extractAssets', async ({ request }) => {
    await netDelay(80);
    const body = (await request.json()) as Record<string, unknown>;
    const invalid = validateBody(body, {
      scriptIds: 'numberArray',
      projectId: 'number',
      groupSize: 'optionalNumber',
    });
    if (invalid) return invalid;
    const scriptIds = body.scriptIds as number[];
    if (scriptIds.length === 0) {
      return HttpResponse.json({ message: '请先选择剧本' }, { status: 400 });
    }
    // 镜像后端：置等待后立即返回，后台异步走 等待→提取中→成功（模拟 LLM 写资产）
    runExtractStateMachine(Number(body.projectId), scriptIds);
    return envelope({ message: '开始提取资产' }, '开始提取资产');
  }),

  http.post('/api/script/pollScriptAssets', async ({ request }) => {
    await netDelay(60);
    const body = (await request.json()) as Record<string,unknown>;
    const invalid = validateBody(body, { ids: 'numberArray' });
    if (invalid) return invalid;
    return envelope(getBackendScriptStates(body.ids as number[]));
  }),

  // 门控数据源（getAllAssets：项目全部父资产，排除 clip/audio）
  http.post('/api/cornerScape/getAllAssets', async ({ request }) => {
    await netDelay(60);
    const body = (await request.json()) as Record<string, unknown>;
    const invalid = validateBody(body, { projectId: 'number' });
    if (invalid) return invalid;
    return envelope(getBackendAssets(Number(body.projectId)));
  }),

  // ===== 分镜（后端契约：o_storyboard / o_assets2Storyboard）=====

  // 读模型：只回 prompt/duration/filePath/characters/index（不含 videoDesc 与 state）
  http.post('/api/production/getStoryboardData', async ({ request }) => {
    await netDelay(60);
    const body = (await request.json()) as Record<string, unknown>;
    const invalid = validateBody(body, { scriptId: 'number', projectId: 'number' });
    if (invalid) return invalid;
    const rows = getBackendStoryboards(Number(body.projectId), Number(body.scriptId));
    return envelope(
      rows.map((s) => ({
        id: String(s.id),
        createTime: s.createTime || undefined,
        duration: s.duration ? Number(s.duration) : undefined,
        // 复刻后端 u.oss.getSmallImageUrl：静态托管路径 + 小图尺寸参数
        filePath: s.filePath ? `http://localhost:10588/oss${s.filePath}?size=20` : undefined,
        prompt: s.prompt ?? undefined,
        scriptId: s.scriptId ?? undefined,
        characters: getBackendStoryboardCharacters(s.id),
        index: null,
      })),
    );
  }),

  // 新增分镜（后端同事务建 o_videoTrack，只返回新分镜 id）
  http.post('/api/production/storyboard/addStoryboard', async ({ request }) => {
    await netDelay(60);
    const body = (await request.json()) as Record<string, unknown>;
    const invalid = validateBody(body, {
      prompt: 'string',
      duration: 'number',
      state: 'string',
      videoDesc: 'string',
      shouldGenerateImage: 'number',
      src: 'nullableString',
      scriptId: 'number',
      projectId: 'number',
    });
    if (invalid) return invalid;
    const id = addBackendStoryboard({
      scriptId: Number(body.scriptId),
      projectId: Number(body.projectId),
      prompt: String(body.prompt),
      videoDesc: String(body.videoDesc),
      duration: Number(body.duration),
      state: String(body.state),
      // 复刻后端：入参的 shouldGenerateImage 被忽略，按 src 是否为空自行决定
      shouldGenerateImage: body.src ? 1 : 0,
    });
    return envelope({ id });
  }),

  // 编辑分镜（后端整行覆盖 prompt + videoDesc；命中 0 行也回成功）
  http.post('/api/production/storyboard/editStoryboardInfo', async ({ request }) => {
    await netDelay(60);
    const body = (await request.json()) as Record<string, unknown>;
    const invalid = validateBody(body, { id: 'number', prompt: 'string', videoDesc: 'string' });
    if (invalid) return invalid;
    updateBackendStoryboard(Number(body.id), {
      prompt: String(body.prompt),
      videoDesc: String(body.videoDesc),
    });
    return envelope({ message: '更新提示词成功' });
  }),

  // 删单个分镜（后端 removeFrame：连带清关联，分镜不存在时业务失败）
  http.post('/api/production/storyboard/removeFrame', async ({ request }) => {
    await netDelay(60);
    const body = (await request.json()) as Record<string, unknown>;
    const invalid = validateBody(body, { id: 'number' });
    if (invalid) return invalid;
    if (!deleteBackendStoryboard(Number(body.id))) return failEnvelope('未找到该分镜');
    return envelope({ message: '视频删除成功' });
  }),

  // 批量删分镜（后端 batchDelete：ids 空或按 projectId 一条没命中都是业务失败）
  http.post('/api/production/storyboard/batchDelete', async ({ request }) => {
    await netDelay(60);
    const body = (await request.json()) as Record<string, unknown>;
    const invalid = validateBody(body, { ids: 'numberArray', projectId: 'number' });
    if (invalid) return invalid;
    const ids = body.ids as number[];
    if (!ids.length) return failEnvelope('请先选择分镜');
    const removed = deleteBackendStoryboards(ids, Number(body.projectId));
    if (!removed) return failEnvelope('当前选择分镜不存在');
    return envelope({ message: '视频删除成功' });
  }),
];
