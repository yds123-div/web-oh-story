import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  createStoryboard,
  deleteStoryboard,
  deleteStoryboards,
  listEpisodes,
  listStoryboards,
  updateStoryboard,
  type StoryboardRow,
} from './api';

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function ok(data: unknown) {
  return HttpResponse.json({ code: 200, data, message: '成功' });
}

/** 后端失败信封：HTTP 400 + {code, data, message}（storyboard 接口的真实行为） */
function fail(message: string) {
  return HttpResponse.json({ code: 400, data: null, message }, { status: 400 });
}

const projectId = '1790179247218';
const scriptId = '10';

/** getStoryboardData 的真实响应行（后端会省掉 undefined 键，这里照抄） */
const ROWS: StoryboardRow[] = [
  {
    id: '3',
    scriptId: 10,
    prompt: '长廊夜景：林晚独自伫立',
    duration: 4,
    filePath: 'http://localhost:10588/oss/10/storyboard/3.png?size=20',
    characters: [
      { name: '林晚', type: 'role', avatar: 'http://localhost:10588/oss/10/role/8.png?size=20' },
      { name: '木叶深夜长廊', type: 'scene' },
    ],
    index: null,
  },
  {
    id: '4',
    scriptId: 10,
    prompt: '林晚回头，叫住鼬',
    // duration / filePath / createTime 后端无值时整个键不出现
    characters: [],
  },
];

describe('Storyboards API（后端真实契约翻译）', () => {
  describe('listStoryboards', () => {
    it('按后端契约 POST {scriptId, projectId} 并翻译行', async () => {
      server.use(
        http.post('/api/production/getStoryboardData', async ({ request }) => {
          expect(await request.json()).toEqual({ scriptId: 10, projectId: 1790179247218 });
          return ok(ROWS);
        }),
      );

      const storyboards = await listStoryboards(projectId, scriptId);

      expect(storyboards).toEqual([
        {
          id: '3',
          scriptId: '10',
          prompt: '长廊夜景：林晚独自伫立',
          durationSec: 4,
          imageUrl: 'http://localhost:10588/oss/10/storyboard/3.png?size=20',
          characters: [
            {
              name: '林晚',
              type: 'character',
              avatarUrl: 'http://localhost:10588/oss/10/role/8.png?size=20',
            },
            { name: '木叶深夜长廊', type: 'scene', avatarUrl: null },
          ],
        },
        {
          id: '4',
          scriptId: '10',
          prompt: '林晚回头，叫住鼬',
          durationSec: null,
          imageUrl: null,
          characters: [],
        },
      ]);
    });

    it('后端返回空数组时给空列表（新剧本还没建分镜）', async () => {
      server.use(http.post('/api/production/getStoryboardData', async () => ok([])));
      await expect(listStoryboards(projectId, scriptId)).resolves.toEqual([]);
    });

    it('资产 type 为 role/scene/tool 时翻译为前端枚举', async () => {
      server.use(
        http.post('/api/production/getStoryboardData', async () =>
          ok([
            {
              id: 9,
              scriptId: 10,
              prompt: 'x',
              characters: [
                { name: '苦无', type: 'tool' },
                { name: '未知类型', type: 'something' },
              ],
            },
          ]),
        ),
      );
      const [storyboard] = await listStoryboards(projectId, scriptId);
      expect(storyboard?.characters.map((c) => c.type)).toEqual(['prop', 'material']);
    });
  });

  describe('createStoryboard', () => {
    it('按 addStoryboard 的 zod 契约发全 8 个字段并返回新分镜 id', async () => {
      server.use(
        http.post('/api/production/storyboard/addStoryboard', async ({ request }) => {
          expect(await request.json()).toEqual({
            prompt: '远景，固定机位，林晚独自伫立',
            duration: 4,
            state: '未生成',
            // 后端无「景别/运镜」列：描述同时写入 videoDesc，09 的 AI 生成视频提示词以它为输入
            videoDesc: '远景，固定机位，林晚独自伫立',
            shouldGenerateImage: 0,
            src: null,
            scriptId: 10,
            projectId: 1790179247218,
          });
          return ok({ id: 7 });
        }),
      );

      const id = await createStoryboard({
        projectId,
        scriptId,
        prompt: '远景，固定机位，林晚独自伫立',
        durationSec: 4,
      });
      expect(id).toBe('7');
    });
  });

  describe('updateStoryboard', () => {
    it('按 editStoryboardInfo 契约同时回传 prompt 与 videoDesc（两列同值，不丢 09 的输入）', async () => {
      server.use(
        http.post('/api/production/storyboard/editStoryboardInfo', async ({ request }) => {
          expect(await request.json()).toEqual({
            id: 3,
            prompt: '改后的描述',
            videoDesc: '改后的描述',
          });
          return ok({ message: '更新提示词成功' });
        }),
      );

      await expect(updateStoryboard({ id: '3', prompt: '改后的描述' })).resolves.toBeUndefined();
    });
  });

  describe('deleteStoryboard', () => {
    it('单条删除走 removeFrame（后端会连带清掉该分镜独占的视频轨道）', async () => {
      server.use(
        http.post('/api/production/storyboard/removeFrame', async ({ request }) => {
          expect(await request.json()).toEqual({ id: 3 });
          return ok({ message: '视频删除成功' });
        }),
      );

      await expect(deleteStoryboard('3')).resolves.toBeUndefined();
    });

    it('后端业务失败（HTTP 400 信封）时抛出带原因的错误', async () => {
      server.use(
        http.post('/api/production/storyboard/removeFrame', async () => fail('未找到该分镜')),
      );

      await expect(deleteStoryboard('999')).rejects.toThrow('未找到该分镜');
    });
  });

  describe('deleteStoryboards', () => {
    it('批量删除走 batchDelete，携带 projectId（后端按项目过滤）', async () => {
      server.use(
        http.post('/api/production/storyboard/batchDelete', async ({ request }) => {
          expect(await request.json()).toEqual({ ids: [3, 4], projectId: 1790179247218 });
          return ok({ message: '视频删除成功' });
        }),
      );

      await expect(deleteStoryboards(projectId, ['3', '4'])).resolves.toBeUndefined();
    });

    it('选中的分镜不属于该项目时，后端原因原样透出', async () => {
      server.use(
        http.post('/api/production/storyboard/batchDelete', async () => fail('当前选择分镜不存在')),
      );

      await expect(deleteStoryboards(projectId, ['3'])).rejects.toThrow('当前选择分镜不存在');
    });
  });
});

describe('listEpisodes（剧本即分集）', () => {
  it('列后端剧本，按剧本 id 升序编集数，并聚合各剧本的分镜数与总时长', async () => {
    server.use(
      http.post('/api/script/getScrptApi', async ({ request }) => {
        expect(await request.json()).toEqual({ projectId: 1790179247218 });
        return ok([
          { id: 11, projectId: 1790179247218, name: '第2集·月下对峙', content: 'x', extractState: null, errorReason: null, createTime: 2 },
          { id: 10, projectId: 1790179247218, name: '逆命木叶', content: 'y', extractState: 1, errorReason: null, createTime: 1 },
        ]);
      }),
      http.post('/api/production/getStoryboardData', async ({ request }) => {
        const { scriptId } = (await request.json()) as { scriptId: number };
        return ok(scriptId === 10 ? ROWS : []);
      }),
    );

    const { episodes } = await listEpisodes(projectId);

    expect(episodes.map((e) => [e.number, e.id, e.title])).toEqual([
      [1, '10', '逆命木叶'],
      [2, '11', '第2集·月下对峙'],
    ]);
    expect(episodes[0]).toMatchObject({
      projectId,
      storyboardCount: 2,
      // 第二个分镜没有 duration，按 0 计入
      durationSec: 4,
      coverUrl: 'http://localhost:10588/oss/10/storyboard/3.png?size=20',
    });
    // 还没建分镜的剧本：计数为 0、无封面，仍要在列表里
    expect(episodes[1]).toMatchObject({ storyboardCount: 0, durationSec: 0, coverUrl: null });
  });

  it('没有剧本时返回空列表', async () => {
    server.use(http.post('/api/script/getScrptApi', async () => ok([])));
    await expect(listEpisodes(projectId)).resolves.toEqual({ episodes: [] });
  });
});
