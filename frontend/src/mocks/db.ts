import type {
  AppNotification,
  Asset,
  Outline,
  Project,
  TaskStatus,
  Template,
  WorkflowState,
  WorkflowStep,
} from '../types/api';

const DEMO_PROJECT_ID = 'proj-nming-muye';

// 示例资源挂在 Vite base 下（本地 /demo-assets，服务器 /deepsfv-dev/demo-assets）
const DA = `${import.meta.env.BASE_URL}demo-assets`;

// crypto.randomUUID 仅在安全上下文可用；HTTP + IP 访问的生产环境里会 undefined
function randomId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

type TaskKind = 'outline' | 'novel' | 'creative-image' | 'creative-video';

type InternalTask = TaskStatus & {
  kind: TaskKind;
  projectId?: string;
  assetId?: string;
};

function seedProjects(): Project[] {
  return [
    {
      id: DEMO_PROJECT_ID,
      name: '逆命木叶',
      intro: '知晓结局的穿越者试图改写宿命',
      projectType: 'script',
      type: '女频-轻小说',
      artStyle: '赛博朋克电影',
      directorManual: '',
      videoRatio: '9:16',
      imageModel: 'Seedream-4.0',
      videoModel: 'Seedance 2.0',
      imageQuality: '2K',
      mode: 'text',
      createTime: '2026-09-17T18:20:00.000Z',
    },
    {
      id: 'proj-naruto-brawl',
      name: '火影乱斗',
      intro: '',
      projectType: 'script',
      type: '热血战斗',
      artStyle: '国漫写实',
      directorManual: '',
      videoRatio: '16:9',
      imageModel: 'Seedream-4.0',
      videoModel: 'Seedance 2.0',
      imageQuality: '2K',
      mode: 'text',
      createTime: '2026-09-16T21:04:00.000Z',
    },
  ];
}

const SCREENPLAY = `第一集：异世囚笼

【木叶长廊 内 夜】

木叶，夜晚长廊，月光冷白。
△ 林晚扶着廊柱，指尖颤抖，眼神茫然又痛苦，身着木叶制式素色和服。
林晚（低声独白）：明明只是在家看火影……一睁眼，就来到了这里。我知道所有人的结局，唯独不知道，自己该怎么活下去。
△ 鼬缓步从阴影走出，红瞳微光，神色淡漠。
鼬：深夜在此，有何目的。长老安排你，来监视我？
林晚（猛地抬头，眼眶泛红，声音发颤）：我不是来监视你的！鼬，我知道你将要背负什么，我不想看你走向那条绝路！
鼬（淡淡勾起唇角，带着悲凉）：预言？外来之人，不要妄言命运。
△ 鼬转身，衣摆扫过地面，不留一丝温情。
鼬：离我远一点，否则，你会被拖入深渊。
△ 黑屏字幕：我知晓你的悲剧，却无法改写。`;

function cloneAsset(asset: Asset): Asset {
  return { ...asset };
}
/** 演示资产的 AI 生成状态默认值（旧 mock 契约，无后端状态列） */
const DEMO_AI_STATE = {
  promptState: 'none',
  promptErrorReason: null,
  imageId: null,
  imageState: 'none',
} as const;

function nmingAssets(projectId: string): Asset[] {
  return [
    {
      id: `${projectId}-char-linwan`,
      projectId,
      type: 'character',
      name: '林晚',
      description: '现代穿越者，成为木叶孤女，知晓结局试图拯救鼬，却陷入权力漩涡。',
      imageUrl: `${DA}/linwan.png`,
      prompt: null,
      remark: null,
      ...DEMO_AI_STATE,
    },
    {
      id: `${projectId}-char-itachi`,
      projectId,
      type: 'character',
      name: '宇智波鼬',
      description: '背负灭族悲剧的忍者，心思深沉，因任务与宿命被迫推开林晚。',
      imageUrl: `${DA}/itachi.png`,
      prompt: null,
      remark: null,
      ...DEMO_AI_STATE,
    },
    {
      id: `${projectId}-char-shisui`,
      projectId,
      type: 'character',
      name: '宇智波止水',
      description: '温柔守护型，暗中相救林晚，看穿她的心事并默默付出。',
      imageUrl: null,
      prompt: null,
      remark: null,
      ...DEMO_AI_STATE,
    },
    {
      id: `${projectId}-char-elder`,
      projectId,
      type: 'character',
      name: '木叶长老',
      description: '猜忌宇智波一族，利用林晚作为监视棋子挑起矛盾。',
      imageUrl: null,
      prompt: null,
      remark: null,
      ...DEMO_AI_STATE,
    },
    {
      id: `${projectId}-scene-corridor`,
      projectId,
      type: 'scene',
      name: '木叶长廊',
      description: '传统日式木质长廊，林晚与鼬深夜对峙的场所（月夜冷调）。',
      imageUrl: `${DA}/corridor.jpg`,
      prompt: null,
      remark: null,
      ...DEMO_AI_STATE,
    },
  ];
}

function nmingOutline(projectId: string, projectName: string, finalized: boolean): Outline {
  return {
    projectId,
    projectName,
    finalized,
    setting: {
      videoStyle: '赛博朋克电影（冷调月夜 · 高对比光影）',
      aspectRatio: '9:16',
      resolution: '720P（会员可 1080P / 4K）',
      model: 'S 2.0-fast',
    },
    summary: {
      protagonists: '林晚、鼬',
      genre: '女频 - 轻小说',
      synopsis:
        '现代女孩林晚意外穿越到木叶村，成为一名普通的村落成员。由于知晓宇智波鼬即将背负罪名走向毁灭的悲惨宿命，她试图用自己的预知能力去拯救对方。然而，她的突然出现和反常举动引起了村落高层的怀疑，鼬也用冷漠将她推开。林晚在危机四伏的忍者世界里，不仅要艰难求生，还要寻找打破死局、逆转悲剧的方法。',
      background:
        '架空的二次元忍者世界，时间线处于木叶村宇智波一族惨案发生前夕。村内暗流涌动，高层与大家族之间充满政治博弈，忍者受制于严苛的村规与宿命。',
      setting:
        '视觉环境以传统日式木质长廊与建筑为主，常伴清冷月光与沉重阴影，角色身着制式素色和服或忍者服；世界观具有强烈宿命论特征，外来穿越者的先知视角与原住民的既定命运相互排斥，泄露未来会被视为危险的情报刺探；核心角色拥有被称为「写轮眼」的血继限界，发动时瞳孔呈红色微光，是力量与家族悲剧的核心视觉象征。',
    },
    extractedAssets: nmingAssets(projectId),
    screenplayTitle: '第1集 · 异世囚笼',
    screenplay: SCREENPLAY,
  };
}

function officialTemplates(): Template[] {
  return [
    {
      id: 'tpl-star-beyond',
      name: '星环之外',
      subtitle: '自由画布 · 9:16',
      tags: ['科幻', '废土'],
      coverUrl: `${DA}/corridor.jpg`,
      coverFilter: 'hue-rotate(200deg) saturate(1.5) brightness(.9)',
      style: '赛博朋克电影',
      aspectRatio: '9:16',
      scriptText:
        '【星港外环 外 夜】\n废土星港的霓虹在沙尘里碎成光斑。\n△ 女驾驶员扶着舷窗，呼吸器起雾。\n独白：星环之外没有航图，只有被放逐的人。',
    },
    {
      id: 'tpl-blood-origin',
      name: '末日血源',
      subtitle: '原创短剧 · 12集',
      tags: ['大女主', '废土'],
      coverUrl: `${DA}/corridor.jpg`,
      coverFilter: 'hue-rotate(-30deg) saturate(1.8) contrast(1.2)',
      style: '赛博朋克电影',
      aspectRatio: '9:16',
      scriptText:
        '【避难所 内 夜】\n铁门被砸响。\n△ 女主把幼妹推进暗道，自己转身面对裂开的门缝。\n女主：今晚之后，血脉只为活人燃烧。',
    },
    {
      id: 'tpl-true-heiress',
      name: '真千金觉醒',
      subtitle: '原创短剧 · 8集',
      tags: ['复仇', '爽文'],
      coverUrl: `${DA}/linwan.png`,
      coverFilter: 'saturate(1.5) brightness(1.05)',
      style: '国漫写实',
      aspectRatio: '9:16',
      scriptText:
        '【宴会厅 内 夜】\n假千金当众揭穿她的身世。\n△ 女主抬眼，笑意冷下来。\n女主：DNA 报告在律师手里。从今晚起，请叫我真千金。',
    },
    {
      id: 'tpl-fatal-memory',
      name: '致命记忆',
      subtitle: '原创短剧 · 10集',
      tags: ['大女主', '悬疑烧脑'],
      coverUrl: `${DA}/itachi.png`,
      coverFilter: 'hue-rotate(220deg) contrast(1.25)',
      style: '赛博朋克电影',
      aspectRatio: '9:16',
      scriptText:
        '【审讯室 内 日】\n她不记得昨夜。\n△ 监控回放里，她自己推开了那扇门。\n女主：如果记忆是伪造的，那凶手会不会就是我。',
    },
    {
      id: 'tpl-qin-scheme',
      name: '谋断大秦',
      subtitle: '原创短剧 · 15集',
      tags: ['权谋', '爽文'],
      coverUrl: `${DA}/itachi.png`,
      coverFilter: 'sepia(.55) contrast(1.15)',
      style: '国漫写实',
      aspectRatio: '9:16',
      scriptText:
        '【咸阳宫 内 日】\n质子当殿受辱，群臣窃笑。\n△ 他低头，袖中玉玦被捏出一道白痕。\n男主：今日之辱，我会一笔一笔讨回。',
    },
    {
      id: 'tpl-silent-return',
      name: '归途无声',
      subtitle: '原创短剧 · 6集',
      tags: ['治愈', '大女主'],
      coverUrl: `${DA}/linwan.png`,
      coverFilter: 'brightness(1.15) saturate(.85)',
      style: '国漫写实',
      aspectRatio: '9:16',
      scriptText:
        '【小镇车站 外 晨】\n她提着旧行李箱下车，没有人来接。\n△ 风把站台的银杏吹成金色。\n女主：先把灯打开，再把日子过回去。',
    },
    {
      id: 'tpl-dragon-vein',
      name: '龙脉觉醒',
      subtitle: '原创短剧 · 9集',
      tags: ['大女主', '逆袭'],
      coverUrl: `${DA}/corridor.jpg`,
      coverFilter: 'saturate(1.6) hue-rotate(30deg)',
      style: '国漫写实',
      aspectRatio: '9:16',
      scriptText:
        '【宗门大殿 内 夜】\n废灵根被当众剥夺名籍。\n△ 她掌心忽然亮起金纹。\n女主：龙脉醒了。从今天起，谁都别再替我决定命运。',
    },
  ];
}

function seedNotifications(): AppNotification[] {
  return [
    { id: 'ntf-1', icon: '✅', title: '片段 1 视频已生成（480P · 13s）', time: '2 分钟前', read: false },
    { id: 'ntf-2', icon: '🎭', title: '形象资产已生成：4 角色 + 1 场景，一致性已锁定', time: '1 小时前', read: false },
    { id: 'ntf-3', icon: '◆', title: '积分消耗 ◆60 · 进入片段编辑器', time: '1 小时前', read: false },
    { id: 'ntf-4', icon: '🎬', title: '分集拆分完成：第1集 · 异世囚笼（3 片段 / 37s）', time: '昨天', read: true },
    { id: 'ntf-5', icon: '📢', title: '系统公告：Seedance 2.5 视频模型已全量开放', time: '昨天', read: true },
    { id: 'ntf-6', icon: '💡', title: '新模板上架：官方示例《星环之外》可一键套用', time: '2 天前', read: true },
  ];
}

function defaultWorkflow(projectId: string): WorkflowState {
  return {
    projectId,
    unlockedStep: 1,
    outlineFinalized: false,
    assetsCompleted: false,
  };
}

let projects = seedProjects();
let creditsBalance = 940;

let outlines = new Map<string, Outline>();
let assets = new Map<string, Asset>();
let workflows = new Map<string, WorkflowState>();
let notifications = seedNotifications();

const tasks = new Map<string, InternalTask>();
const taskTimers = new Map<string, ReturnType<typeof setTimeout>>();

function putAssets(list: Asset[]): void {
  for (const asset of list) assets.set(asset.id, cloneAsset(asset));
}

function assetsForProject(projectId: string): Asset[] {
  return [...assets.values()].filter((a) => a.projectId === projectId).map(cloneAsset);
}

function ensureOutlineAndAssets(projectId: string): Outline | undefined {
  const existing = outlines.get(projectId);
  if (existing) return cloneOutline(existing);
  const project = projects.find((p) => p.id === projectId);
  if (!project) return undefined;
  const outline = nmingOutline(projectId, project.name, false);
  outlines.set(projectId, outline);
  putAssets(nmingAssets(projectId));
  if (!workflows.has(projectId)) workflows.set(projectId, defaultWorkflow(projectId));
  return cloneOutline(outline);
}

function cloneOutline(outline: Outline): Outline {
  return {
    ...outline,
    setting: { ...outline.setting },
    summary: { ...outline.summary },
    extractedAssets: assetsForProject(outline.projectId).filter((a) => a.type !== 'material'),
  };
}

function cloneWorkflow(state: WorkflowState): WorkflowState {
  return { ...state };
}

function seedDemoContent(): void {
  const outline = nmingOutline(DEMO_PROJECT_ID, '逆命木叶', false);
  outlines.set(DEMO_PROJECT_ID, outline);
  putAssets(nmingAssets(DEMO_PROJECT_ID));
  workflows.set(DEMO_PROJECT_ID, { ...defaultWorkflow(DEMO_PROJECT_ID), unlockedStep: 3, outlineFinalized: true, assetsCompleted: true });
}

export function resetDb(): void {
  for (const t of taskTimers.values()) clearTimeout(t);
  taskTimers.clear();
  tasks.clear();
  projects = seedProjects();
  creditsBalance = 940;
  outlines = new Map();
  assets = new Map();
  workflows = new Map();
  notifications = seedNotifications();
  seedDemoContent();
}

seedDemoContent();

export function getCreditsBalance(): number {
  return creditsBalance;
}

export function getProject(id: string): Project | undefined {
  return projects.find((p) => p.id === id);
}

/** 旧 REST 任务流的内部轮询（尚未迁移到后端契约的 mock 流程测试用） */
export function getTaskRecord(id: string): TaskStatus | undefined {
  const t = tasks.get(id);
  return t ? { taskId: t.taskId, status: t.status, progress: t.progress, result: t.result, error: t.error } : undefined;
}

export function getOutlineRecord(projectId: string): Outline | undefined {
  const outline = outlines.get(projectId);
  return outline ? cloneOutline(outline) : undefined;
}

function getWorkflowRecord(projectId: string): WorkflowState | undefined {
  if (!getProject(projectId)) return undefined;
  const existing = workflows.get(projectId);
  if (existing) return cloneWorkflow(existing);
  const created = defaultWorkflow(projectId);
  workflows.set(projectId, created);
  return cloneWorkflow(created);
}

function setWorkflow(projectId: string, patch: Partial<WorkflowState>): WorkflowState {
  const current = getWorkflowRecord(projectId) ?? defaultWorkflow(projectId);
  const next: WorkflowState = {
    ...current,
    ...patch,
    projectId,
    unlockedStep: Math.max(current.unlockedStep, patch.unlockedStep ?? current.unlockedStep) as WorkflowStep,
  };
  workflows.set(projectId, next);
  return cloneWorkflow(next);
}

export function finalizeOutlineRecord(projectId: string): WorkflowState | undefined {
  const outline = outlines.get(projectId);
  if (!outline) return undefined;
  outline.finalized = true;
  return setWorkflow(projectId, { outlineFinalized: true, unlockedStep: 2 });
}

export function listTemplateRecords(): Template[] {
  return officialTemplates();
}

export function listNotificationRecords(): AppNotification[] {
  return notifications.map((n) => ({ ...n }));
}

function jitter(minMs: number, maxMs: number): number {
  if (import.meta.env.MODE === 'test') return 5;
  return minMs + Math.floor(Math.random() * (maxMs - minMs + 1));
}

function schedule(taskId: string, fn: () => void, ms: number): void {
  const prev = taskTimers.get(taskId);
  if (prev) clearTimeout(prev);
  taskTimers.set(taskId, setTimeout(fn, ms));
}

function finishTask(task: InternalTask): void {
  task.status = 'succeeded';
  task.progress = 100;
  if (task.kind === 'outline' && task.projectId) {
    ensureOutlineAndAssets(task.projectId);
    task.result = { projectId: task.projectId };
    return;
  }
  if (task.kind === 'novel' && task.projectId) {
    ensureOutlineAndAssets(task.projectId);
    task.result = { projectId: task.projectId };
    return;
  }
  if (task.kind === 'creative-image') {
    const mediaUrl = Math.random() < 0.5 ? `${DA}/linwan.png` : `${DA}/itachi.png`;
    task.result = { mediaUrl, kind: 'image' };
    return;
  }
  if (task.kind === 'creative-video') {
    task.result = { mediaUrl: `${DA}/clip1.mp4`, kind: 'video' };
    return;
  }
}

function advanceTask(taskId: string): void {
  const task = tasks.get(taskId);
  if (!task) return;
  if (task.status === 'pending') {
    task.status = 'running';
    task.progress = 8;
    schedule(taskId, () => advanceTask(taskId), jitter(700, 1600));
    return;
  }
  if (task.status === 'running') {
    const next = Math.min(100, task.progress + 12 + Math.floor(Math.random() * 18));
    task.progress = next;
    if (next >= 100) {
      finishTask(task);
      return;
    }
    schedule(taskId, () => advanceTask(taskId), jitter(700, 1600));
  }
}

function createTask(
  kind: TaskKind,
  extra: { projectId?: string; assetId?: string },
): TaskStatus {
  const taskId = `task-${randomId()}`;
  const task: InternalTask = {
    taskId,
    status: 'pending',
    progress: 0,
    kind,
    ...extra,
  };
  tasks.set(taskId, task);
  schedule(taskId, () => advanceTask(taskId), jitter(800, 1800));
  return { taskId, status: 'pending', progress: 0 };
}

export function createOutlineTask(projectId: string): TaskStatus {
  return createTask('outline', { projectId });
}

export function createNovelTask(projectId: string): TaskStatus {
  return createTask('novel', { projectId });
}

export function createCreativeTask(kind: 'creative-image' | 'creative-video'): TaskStatus {
  return createTask(kind, {});
}
