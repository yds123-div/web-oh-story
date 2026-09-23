import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { getTask, listTaskCategories, listTaskProjects, listTasks } from './api';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function envelope(data: unknown, message = '成功') {
  return HttpResponse.json({ code: 200, data, message });
}

/** o_tasks 表一行（后端 select * 的形状） */
const TASK_ROW = {
  id: 9001,
  projectId: 1758000000000,
  taskClass: '剧本资产提取',
  relatedObjects: '{"scriptId":12}',
  model: 'deepseek-chat',
  describe: '提取《逆命木叶》第 1 集资产',
  state: '生成失败',
  startTime: 1758000100000,
  reason: '供应商未配置 key',
};

/**
 * 后端 getTaskApi 对 o_project 做了 `select("o_tasks.*", "o_project.*")` 的 leftJoin，
 * 重名列 `id` 会被项目 id 覆盖（join 不上时为 null）——列表行的 id 不可当作任务 id。
 */
function joinedRow(overrides: Record<string, unknown> = {}) {
  return {
    ...TASK_ROW,
    id: 1758000000000, // 被项目表覆盖
    name: '逆命木叶',
    projectType: 'script',
    ...overrides,
  };
}

describe('listTasks（POST /api/task/getTaskApi）', () => {
  it('sends page/limit and backend-native filter values, translates rows', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post('/api/task/getTaskApi', async ({ request }) => {
        bodies.push(await request.json());
        return envelope({ data: [joinedRow()], total: 1 });
      }),
    );

    const data = await listTasks({ state: 'failed', taskClass: '剧本资产提取', projectId: '1758000000000', page: 2, limit: 10 });

    // 前端 state 枚举翻译回后端中文文案；id 字符串转数字
    expect(bodies).toEqual([
      { state: '生成失败', taskClass: '剧本资产提取', projectId: 1758000000000, page: 2, limit: 10 },
    ]);
    expect(data).toEqual({
      tasks: [
        {
          projectId: '1758000000000',
          projectName: '逆命木叶',
          taskClass: '剧本资产提取',
          relatedObjects: '{"scriptId":12}',
          model: 'deepseek-chat',
          describe: '提取《逆命木叶》第 1 集资产',
          state: 'failed',
          stateText: '生成失败',
          startTime: new Date(1758000100000).toISOString(),
          reason: '供应商未配置 key',
        },
      ],
      total: 1,
    });
  });

  it('maps 进行中/已完成 to running/succeeded and survives join misses', async () => {
    server.use(
      http.post('/api/task/getTaskApi', async ({ request }) => {
        const body = (await request.json()) as { state?: string };
        const state = body.state;
        return HttpResponse.json({
          code: 200,
          data: { data: [joinedRow({ state, id: null, name: null, projectId: 999, reason: null })], total: 1 },
          message: '成功',
        });
      }),
    );

    const running = await listTasks({ state: 'running', page: 1, limit: 10 });
    expect(running.tasks[0]).toMatchObject({ state: 'running', stateText: '进行中', projectId: '999', projectName: null, reason: null });

    const succeeded = await listTasks({ state: 'succeeded', page: 1, limit: 10 });
    expect(succeeded.tasks[0]).toMatchObject({ state: 'succeeded', stateText: '已完成' });
  });

  it('omits empty filters from the request body', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post('/api/task/getTaskApi', async ({ request }) => {
        bodies.push(await request.json());
        return envelope({ data: [], total: 0 });
      }),
    );

    await listTasks({ page: 1, limit: 10 });
    expect(bodies).toEqual([{ page: 1, limit: 10 }]);
  });
});

describe('getTask（POST /api/task/taskDetails）', () => {
  it('sends numeric taskId and translates backend state to TaskStatus', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post('/api/task/taskDetails', async ({ request }) => {
        bodies.push(await request.json());
        return envelope({ ...TASK_ROW, state: '已完成', reason: null });
      }),
    );

    const status = await getTask('9001');

    expect(bodies).toEqual([{ taskId: 9001 }]);
    expect(status).toMatchObject({ taskId: '9001', status: 'succeeded', progress: 100 });
  });

  it('exposes reason as error for failed tasks', async () => {
    server.use(http.post('/api/task/taskDetails', () => envelope(TASK_ROW)));

    const status = await getTask('9001');

    expect(status).toMatchObject({ status: 'failed', error: '供应商未配置 key' });
  });

  it('treats a missing task as an error instead of a fake success', async () => {
    server.use(http.post('/api/task/taskDetails', () => envelope(null)));

    await expect(getTask('424242')).rejects.toThrow('任务不存在');
  });
});

describe('listTaskCategories（POST /api/task/getTaskCategories）', () => {
  it('flattens {taskClass} rows into strings', async () => {
    server.use(
      http.post('/api/task/getTaskCategories', () => envelope([{ taskClass: '剧本资产提取' }, { taskClass: '视频生成' }])),
    );

    await expect(listTaskCategories()).resolves.toEqual(['剧本资产提取', '视频生成']);
  });
});

describe('listTaskProjects（POST /api/task/getProject）', () => {
  it('translates numeric ids to strings', async () => {
    server.use(
      http.post('/api/task/getProject', () => envelope([{ id: 1758000000000, name: '逆命木叶' }])),
    );

    await expect(listTaskProjects()).resolves.toEqual([{ id: '1758000000000', name: '逆命木叶' }]);
  });
});
