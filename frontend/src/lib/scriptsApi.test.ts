import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  addScript,
  deleteScript,
  extractScriptAssets,
  listScripts,
  pollScriptAssets,
  projectHasAssets,
  updateScript,
} from './api';
import type { ScriptRow } from './api';

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function ok(data: unknown) {
  return HttpResponse.json({ code: 200, data, message: '成功' });
}

describe('Scripts API（后端真实契约翻译）', () => {
  const projectId = '12345';

  describe('listScripts', () => {
    it('按后端契约 POST {projectId} 并翻译行为前端 Script', async () => {
      const rows: ScriptRow[] = [
        {
          id: 1,
          projectId: 12345,
          name: '第1集·异世囚笼',
          content: '剧本内容',
          extractState: null,
          errorReason: null,
          createTime: 1727100000000,
        },
      ];

      server.use(
        http.post('/api/script/getScrptApi', async ({ request }) => {
          expect(await request.json()).toEqual({ projectId: 12345 });
          return ok(rows);
        }),
      );

      const result = await listScripts(projectId);
      expect(result.scripts).toHaveLength(1);
      expect(result.scripts[0]).toMatchObject({
        id: '1',
        projectId: '12345',
        name: '第1集·异世囚笼',
        content: '剧本内容',
        extractStatus: 'none',
        errorReason: null,
      });
      // 时间戳翻译为 ISO 字符串
      expect(result.scripts[0].createTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('把后端 extractState 整数翻译为五态命名状态', async () => {
      const rows: ScriptRow[] = [
        { id: 2, projectId: 12345, name: 'a', content: '', extractState: 1, errorReason: null, createTime: 1 },
        { id: 3, projectId: 12345, name: 'b', content: '', extractState: 2, errorReason: null, createTime: 1 },
        { id: 4, projectId: 12345, name: 'c', content: '', extractState: 0, errorReason: null, createTime: 1 },
        { id: 5, projectId: 12345, name: 'd', content: '', extractState: -1, errorReason: 'AI 未返回任何资产', createTime: 1 },
      ];

      server.use(http.post('/api/script/getScrptApi', async () => ok(rows)));

      const { scripts } = await listScripts(projectId);
      expect(scripts.map((s) => s.extractStatus)).toEqual(['done', 'waiting', 'extracting', 'failed']);
      expect(scripts.find((s) => s.id === '5')?.errorReason).toBe('AI 未返回任何资产');
    });

    it('空列表返回空数组', async () => {
      server.use(http.post('/api/script/getScrptApi', async () => ok([])));
      const result = await listScripts(projectId);
      expect(result.scripts).toEqual([]);
    });
  });

  describe('addScript', () => {
    it('body 含后端 zod 必填的 assets: []', async () => {
      let captured: unknown;

      server.use(
        http.post('/api/script/addScript', async ({ request }) => {
          captured = await request.json();
          return ok({ message: '添加剧本成功' });
        }),
      );

      await addScript({ projectId, name: '新剧本', content: '新内容' });

      expect(captured).toEqual({
        projectId: 12345,
        name: '新剧本',
        content: '新内容',
        assets: [],
      });
    });

    it('信封 code!==200 时抛出携带 message 的 ApiError', async () => {
      server.use(
        http.post('/api/script/addScript', async () =>
          HttpResponse.json({ code: 400, data: null, message: '参数错误' }),
        ),
      );

      await expect(addScript({ projectId, name: 'x', content: 'y' })).rejects.toMatchObject({
        name: 'ApiError',
        message: '参数错误',
      });
    });
  });

  describe('updateScript', () => {
    it('全量发送 id/name/content/assets（后端四字段必填）', async () => {
      let captured: unknown;

      server.use(
        http.post('/api/script/updateScript', async ({ request }) => {
          captured = await request.json();
          return ok({ message: '编辑剧本成功' });
        }),
      );

      await updateScript({ id: '123', name: '更新名称', content: '更新内容' });

      expect(captured).toEqual({
        id: 123,
        name: '更新名称',
        content: '更新内容',
        assets: [],
      });
    });
  });

  describe('deleteScript', () => {
    it('按后端批量语义 POST {ids: [id]}', async () => {
      let captured: unknown;

      server.use(
        http.post('/api/script/delScript', async ({ request }) => {
          captured = await request.json();
          return ok({ message: '删除剧本成功' });
        }),
      );

      await deleteScript('123');

      expect(captured).toEqual({ ids: [123] });
    });
  });

  describe('extractScriptAssets', () => {
    it('按后端契约 POST {projectId, scriptIds: number[]}', async () => {
      let captured: unknown;

      server.use(
        http.post('/api/script/extractAssets', async ({ request }) => {
          captured = await request.json();
          return ok({ message: '开始提取资产' });
        }),
      );

      await extractScriptAssets(projectId, ['11', '12']);

      expect(captured).toEqual({ projectId: 12345, scriptIds: [11, 12] });
    });
  });

  describe('pollScriptAssets', () => {
    it('POST {ids: number[]} 并把整数 extractState 翻译为命名状态', async () => {
      server.use(
        http.post('/api/script/pollScriptAssets', async ({ request }) => {
          expect(await request.json()).toEqual({ ids: [11, 12] });
          return ok([
            { id: 11, extractState: 1, errorReason: null },
            { id: 12, extractState: -1, errorReason: 'AI 未返回任何资产' },
          ]);
        }),
      );

      const states = await pollScriptAssets(['11', '12']);

      expect(states).toEqual([
        { id: '11', extractStatus: 'done', errorReason: null },
        { id: '12', extractStatus: 'failed', errorReason: 'AI 未返回任何资产' },
      ]);
    });
  });

  describe('projectHasAssets', () => {
    it('getAllAssets 有资产 → true', async () => {
      server.use(
        http.post('/api/cornerScape/getAllAssets', async ({ request }) => {
          expect(await request.json()).toEqual({ projectId: 12345 });
          return ok([{ id: 1, name: '林晚', type: 'role' }]);
        }),
      );

      await expect(projectHasAssets(projectId)).resolves.toBe(true);
    });

    it('getAllAssets 空 → false', async () => {
      server.use(http.post('/api/cornerScape/getAllAssets', async () => ok([])));
      await expect(projectHasAssets(projectId)).resolves.toBe(false);
    });
  });
});
