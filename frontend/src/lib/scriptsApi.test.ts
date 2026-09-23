import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { addScript, deleteScript, listScripts, updateScript } from './api';
import type { ScriptRow } from './api';

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Scripts API', () => {
  const projectId = '12345';

  describe('listScripts', () => {
    it('should POST to /api/script/getScrptApi with projectId', async () => {
      const mockScripts: ScriptRow[] = [
        {
          id: 1,
          projectId: 12345,
          name: '第1集·异世囚笼',
          content: '剧本内容',
          extractState: 0,
          errorReason: null,
          createTime: Date.now(),
        },
      ];

      server.use(
        http.post('/api/script/getScrptApi', async ({ request }) => {
          const body = await request.json();
          expect(body).toEqual({ projectId: 12345 });
          return HttpResponse.json({ code: 200, data: mockScripts, message: '成功' });
        }),
      );

      const result = await listScripts(projectId);
      expect(result.scripts).toHaveLength(1);
      expect(result.scripts[0].id).toBe('1');
      expect(result.scripts[0].name).toBe('第1集·异世囚笼');
    });

    it('should translate backend row to frontend Script type', async () => {
      const mockRow: ScriptRow = {
        id: 999,
        projectId: 12345,
        name: '测试剧本',
        content: '测试内容',
        extractState: 2,
        errorReason: null,
        createTime: 1727100000000,
      };

      server.use(
        http.post('/api/script/getScrptApi', async () => {
          return HttpResponse.json({ code: 200, data: [mockRow], message: '成功' });
        }),
      );

      const result = await listScripts(projectId);
      expect(result.scripts[0].id).toBe('999');
      expect(result.scripts[0].projectId).toBe('12345');
      expect(result.scripts[0].extractState).toBe(2);
      // 时间戳转 ISO 字符串，具体值取决于时区，只验证格式
      expect(result.scripts[0].createTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should handle empty array response', async () => {
      server.use(
        http.post('/api/script/getScrptApi', async () => {
          return HttpResponse.json({ code: 200, data: [], message: '成功' });
        }),
      );

      const result = await listScripts(projectId);
      expect(result.scripts).toEqual([]);
    });
  });

  describe('addScript', () => {
    it('should POST to /api/script/addScript with correct body', async () => {
      let capturedBody: unknown;

      server.use(
        http.post('/api/script/addScript', async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({ code: 200, data: { message: '新增剧本成功' }, message: '新增剧本成功' });
        }),
        http.post('/api/script/getScrptApi', async () => {
          return HttpResponse.json({
            code: 200,
            data: [
              {
                id: Date.now(),
                projectId: 12345,
                name: '新剧本',
                content: '新内容',
                extractState: 0,
                errorReason: null,
                createTime: Date.now(),
              },
            ],
            message: '成功',
          });
        }),
      );

      await addScript({
        projectId,
        name: '新剧本',
        content: '新内容',
      });

      expect(capturedBody).toEqual({
        projectId: 12345,
        name: '新剧本',
        content: '新内容',
      });
    });

    it('should fetch list after add and return newest script', async () => {
      const newId = Date.now();

      server.use(
        http.post('/api/script/addScript', async () => {
          return HttpResponse.json({ code: 200, data: { message: '新增剧本成功' }, message: '新增剧本成功' });
        }),
        http.post('/api/script/getScrptApi', async () => {
          return HttpResponse.json({
            code: 200,
            data: [
              { id: newId - 1000, projectId: 12345, name: '旧剧本', content: '', extractState: 0, errorReason: null, createTime: Date.now() },
              { id: newId, projectId: 12345, name: '新剧本', content: '新内容', extractState: 0, errorReason: null, createTime: Date.now() },
            ],
            message: '成功',
          });
        }),
      );

      const result = await addScript({ projectId, name: '新剧本', content: '新内容' });
      expect(result.id).toBe(String(newId));
      expect(result.name).toBe('新剧本');
    });
  });

  describe('updateScript', () => {
    it('should POST to /api/script/updateScript with id and optional fields', async () => {
      let capturedBody: unknown;

      server.use(
        http.post('/api/script/updateScript', async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({ code: 200, data: { message: '更新剧本成功' }, message: '更新剧本成功' });
        }),
      );

      await updateScript({ id: '123', name: '更新名称', content: '更新内容' });

      expect(capturedBody).toEqual({
        id: 123,
        name: '更新名称',
        content: '更新内容',
      });
    });

    it('should only send provided fields', async () => {
      let capturedBody: unknown;

      server.use(
        http.post('/api/script/updateScript', async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({ code: 200, data: { message: '更新剧本成功' }, message: '更新剧本成功' });
        }),
      );

      await updateScript({ id: '123', name: '仅更新名称' });

      expect(capturedBody).toEqual({
        id: 123,
        name: '仅更新名称',
      });
      expect(capturedBody).not.toHaveProperty('content');
    });
  });

  describe('deleteScript', () => {
    it('should POST to /api/script/delScript with id', async () => {
      let capturedBody: unknown;

      server.use(
        http.post('/api/script/delScript', async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({ code: 200, data: { message: '删除剧本成功' }, message: '删除剧本成功' });
        }),
      );

      await deleteScript('123');

      expect(capturedBody).toEqual({ id: 123 });
    });
  });
});
