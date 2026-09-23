import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import {
  createProject,
  deleteProject,
  getProjectStatistics,
  listProjects,
  patchProject,
} from './api';
import type { Project } from '../types/api';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** 后端信封：HTTP 恒 200，成败看 code */
function envelope(data: unknown, message = '成功') {
  return HttpResponse.json({ code: 200, data, message });
}

function failure(message: string, code = 400) {
  return HttpResponse.json({ code, data: null, message });
}

/** o_project 表一行（后端 select * 的形状） */
const ROW = {
  id: 1758000000000,
  name: '逆命木叶',
  intro: '穿越木叶的救赎故事',
  projectType: 'script',
  type: '女频-轻小说',
  artStyle: '赛博朋克电影',
  directorManual: '',
  videoRatio: '9:16',
  imageModel: 'Seedream-4.0',
  videoModel: 'Seedance 2.0',
  imageQuality: '2K',
  mode: 'text',
  createTime: 1758000000000,
  userId: 1,
};

const TRANSLATED: Project = {
  id: '1758000000000',
  name: '逆命木叶',
  intro: '穿越木叶的救赎故事',
  projectType: 'script',
  type: '女频-轻小说',
  artStyle: '赛博朋克电影',
  directorManual: '',
  videoRatio: '9:16',
  imageModel: 'Seedream-4.0',
  videoModel: 'Seedance 2.0',
  imageQuality: '2K',
  mode: 'text',
  createTime: new Date(1758000000000).toISOString(),
};

describe('listProjects（POST /api/project/getProject）', () => {
  it('sends a POST and translates rows into frontend types', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post('/api/project/getProject', async ({ request }) => {
        bodies.push(await request.json());
        return envelope([ROW]);
      }),
    );

    const data = await listProjects();

    expect(bodies).toEqual([{}]);
    expect(data).toEqual({ projects: [TRANSLATED] });
    // 数字 id（Date.now()）收敛为字符串
    expect(data.projects[0]?.id).toBeTypeOf('string');
    expect(data.projects[0]?.createTime).toBeTypeOf('string');
  });
});

describe('createProject（POST /api/project/addProject）', () => {
  const BODY = {
    name: '新项目',
    type: '女频-轻小说',
    artStyle: '赛博朋克电影',
    videoRatio: '9:16',
    imageModel: 'Seedream-4.0',
    videoModel: 'Seedance 2.0',
    imageQuality: '2K',
    intro: '',
  };

  it('sends all 12 required fields with backend names and returns the created project', async () => {
    const added: unknown[] = [];
    server.use(
      http.post('/api/project/addProject', async ({ request }) => {
        added.push(await request.json());
        return envelope({ message: '新增项目成功' }, '新增项目成功');
      }),
      http.post('/api/project/getProject', () => envelope([ROW, { ...ROW, id: 1758000000999, name: '新项目' }])),

    );

    const created = await createProject(BODY);

    // 12 个必填字段一一对应，全部为字符串
    expect(added[0]).toEqual({
      projectType: 'script',
      name: '新项目',
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
    // 后端只回 message，新增项目通过重新拉取列表里最大 id（Date.now 时间戳）识别
    expect(created.id).toBe('1758000000999');
    expect(created.name).toBe('新项目');
  });

  it('surfaces the envelope message as ApiError when code !== 200', async () => {
    server.use(
      http.post('/api/project/addProject', () => failure('项目数量已达上限')),
    );

    await expect(createProject(BODY)).rejects.toMatchObject({
      name: 'ApiError',
      code: 400,
      message: '项目数量已达上限',
    });
  });
});

describe('patchProject（改名 → POST /api/project/editProject）', () => {
  it('fetches the current project, then sends the full 12-field edit body', async () => {
    const editBodies: unknown[] = [];
    server.use(
      http.post('/api/general/getSingleProject', async ({ request }) => {
        expect(await request.json()).toEqual({ id: 1758000000000 });
        return envelope([ROW]);
      }),
      http.post('/api/project/editProject', async ({ request }) => {
        editBodies.push(await request.json());
        return envelope({ message: '编辑项目成功' }, '编辑项目成功');
      }),
    );

    const updated = await patchProject('1758000000000', { name: '逆命木叶·改' });

    expect(editBodies).toEqual([
      {
        id: 1758000000000,
        name: '逆命木叶·改',
        intro: ROW.intro,
        type: ROW.type,
        artStyle: ROW.artStyle,
        directorManual: ROW.directorManual,
        videoRatio: ROW.videoRatio,
        imageModel: ROW.imageModel,
        videoModel: ROW.videoModel,
        imageQuality: ROW.imageQuality,
        projectType: ROW.projectType,
        mode: ROW.mode,
      },
    ]);
    // 返回值为合并后的翻译结果，页面无需再拉一次列表
    expect(updated.name).toBe('逆命木叶·改');
    expect(updated.id).toBe('1758000000000');
  });
});

describe('deleteProject（POST /api/project/delProject）', () => {
  it('sends the numeric id', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post('/api/project/delProject', async ({ request }) => {
        bodies.push(await request.json());
        return envelope({ message: '删除项目成功' }, '删除项目成功');
      }),
    );

    await deleteProject('1758000000000');

    expect(bodies).toEqual([{ id: 1758000000000 }]);
  });
});

describe('getProjectStatistics（POST /api/general/generalStatistics）', () => {
  it('sends the numeric projectId and returns the counters', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post('/api/general/generalStatistics', async ({ request }) => {
        bodies.push(await request.json());
        return envelope({ roleCount: 2, scriptCount: 1, videoCount: 0, storyboardCount: 3 });
      }),
    );

    const stats = await getProjectStatistics('1758000000000');

    expect(bodies).toEqual([{ projectId: 1758000000000 }]);
    expect(stats).toEqual({ roleCount: 2, scriptCount: 1, videoCount: 0, storyboardCount: 3 });
  });
});
