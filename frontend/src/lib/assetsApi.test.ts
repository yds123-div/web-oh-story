import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  countAssets,
  createAsset,
  deleteAsset,
  listAssets,
  updateAsset,
  uploadAssetImage,
  type AssetRow,
} from './api';

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function ok(data: unknown) {
  return HttpResponse.json({ code: 200, data, message: '成功' });
}

describe('Assets API（后端真实契约翻译）', () => {
  const projectId = '12345';

  describe('listAssets', () => {
    it('按后端契约 POST {projectId, type 映射, page, limit} 并翻译行', async () => {
      const rows: AssetRow[] = [
        {
          id: 101,
          projectId: 12345,
          name: '林晚',
          type: 'role',
          describe: '现代穿越者',
          prompt: null,
          remark: null,
          imageId: 9,
          src: 'http://localhost:10588/oss/12345/role/linwan.png?size=20',
          sonAssets: [],
        },
        {
          id: 102,
          projectId: 12345,
          name: '木叶长廊',
          type: 'scene',
          describe: '日式木质长廊',
          prompt: '月光冷调的长廊',
          remark: null,
          imageId: null,
          src: null,
          sonAssets: [],
        },
      ];

      server.use(
        http.post('/api/assets/getAssetsApi', async ({ request }) => {
          expect(await request.json()).toEqual({
            projectId: 12345,
            type: 'role',
            page: 1,
            limit: 12,
          });
          return ok({ data: rows, total: 2 });
        }),
      );

      const result = await listAssets(projectId, { type: 'character', page: 1, limit: 12 });
      expect(result.total).toBe(2);
      expect(result.assets).toEqual([
        {
          id: '101',
          projectId: '12345',
          type: 'character',
          name: '林晚',
          description: '现代穿越者',
          imageUrl: 'http://localhost:10588/oss/12345/role/linwan.png?size=20',
          prompt: null,
          remark: null,
        },
        {
          id: '102',
          projectId: '12345',
          type: 'scene',
          name: '木叶长廊',
          description: '日式木质长廊',
          imageUrl: null,
          prompt: '月光冷调的长廊',
          remark: null,
        },
      ]);
    });

    it('道具映射为 tool，name 可选参数透传', async () => {
      let captured: unknown;
      server.use(
        http.post('/api/assets/getAssetsApi', async ({ request }) => {
          captured = await request.json();
          return ok({ data: [], total: 0 });
        }),
      );

      const result = await listAssets(projectId, { type: 'prop', name: '苦无', page: 2, limit: 10 });
      expect(captured).toEqual({
        projectId: 12345,
        type: 'tool',
        name: '苦无',
        page: 2,
        limit: 10,
      });
      expect(result).toEqual({ assets: [], total: 0 });
    });

    it('不指定类型时按 role/scene/tool 并行取回合并', async () => {
      const seen: string[] = [];
      server.use(
        http.post('/api/assets/getAssetsApi', async ({ request }) => {
          const body = (await request.json()) as { type: string };
          seen.push(body.type);
          const byType: Record<string, { id: number; name: string; type: string }[]> = {
            role: [{ id: 1, name: '林晚', type: 'role' }],
            scene: [{ id: 2, name: '长廊', type: 'scene' }],
            tool: [{ id: 3, name: '苦无', type: 'tool' }],
          };
          return ok({ data: byType[body.type] ?? [], total: 1 });
        }),
      );

      const result = await listAssets(projectId);
      expect(seen.sort()).toEqual(['role', 'scene', 'tool']);
      expect(result.assets.map((a) => a.name).sort()).toEqual(['林晚', '苦无', '长廊']);
      expect(result.total).toBe(3);
    });

    it('信封 code!==200 时抛出携带 message 的 ApiError', async () => {
      server.use(
        http.post('/api/assets/getAssetsApi', async () =>
          HttpResponse.json({ code: 400, data: null, message: '参数错误' }),
        ),
      );
      await expect(listAssets(projectId, { type: 'character' })).rejects.toMatchObject({
        name: 'ApiError',
        message: '参数错误',
      });
    });
  });

  describe('countAssets', () => {
    it('limit 1 只取 total', async () => {
      server.use(
        http.post('/api/assets/getAssetsApi', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          expect(body).toMatchObject({ projectId: 12345, type: 'scene', page: 1, limit: 1 });
          return ok({ data: [], total: 7 });
        }),
      );
      await expect(countAssets(projectId, 'scene')).resolves.toBe(7);
    });
  });

  describe('createAsset', () => {
    it('字段名翻译为后端契约（description→describe、character→role）', async () => {
      let captured: unknown;
      server.use(
        http.post('/api/assets/addAssets', async ({ request }) => {
          captured = await request.json();
          return ok({ message: '新增资产成功' });
        }),
      );

      await createAsset({
        projectId,
        type: 'character',
        name: '宇智波止水',
        description: '温柔守护型忍者',
      });

      expect(captured).toEqual({
        name: '宇智波止水',
        describe: '温柔守护型忍者',
        type: 'role',
        projectId: 12345,
      });
    });

    it('prompt 可选字段透传', async () => {
      let captured: unknown;
      server.use(
        http.post('/api/assets/addAssets', async ({ request }) => {
          captured = await request.json();
          return ok({ message: '新增资产成功' });
        }),
      );

      await createAsset({
        projectId,
        type: 'scene',
        name: '训练场',
        description: '白天',
        prompt: '开阔的沙地训练场',
      });

      expect(captured).toEqual({
        name: '训练场',
        describe: '白天',
        type: 'scene',
        projectId: 12345,
        prompt: '开阔的沙地训练场',
      });
    });
  });

  describe('updateAsset', () => {
    it('POST {id, name, describe, remark, prompt}（id 转 number）', async () => {
      let captured: unknown;
      server.use(
        http.post('/api/assets/updateAssets', async ({ request }) => {
          captured = await request.json();
          return ok({ message: '更新资产成功' });
        }),
      );

      await updateAsset({
        id: '101',
        name: '林晚·改',
        description: '更新后的描述',
        prompt: '原提示词',
        remark: null,
      });

      expect(captured).toEqual({
        id: 101,
        name: '林晚·改',
        describe: '更新后的描述',
        remark: null,
        prompt: '原提示词',
      });
    });
  });

  describe('deleteAsset', () => {
    it('POST {id}（后端级联删图与子资产）', async () => {
      let captured: unknown;
      server.use(
        http.post('/api/assets/delAssets', async ({ request }) => {
          captured = await request.json();
          return ok({ message: '删除资产成功' });
        }),
      );

      await deleteAsset('101');
      expect(captured).toEqual({ id: 101 });
    });
  });

  describe('uploadAssetImage', () => {
    it('POST {id, projectId, base64, type 映射, prompt 原样回传}', async () => {
      let captured: unknown;
      server.use(
        http.post('/api/assets/saveAssets', async ({ request }) => {
          captured = await request.json();
          return ok({ message: '保存资产图片成功' });
        }),
      );

      await uploadAssetImage({
        assetId: '101',
        projectId,
        type: 'character',
        base64: 'data:image/png;base64,iVBORw0KGgo=',
        prompt: '原提示词',
      });

      expect(captured).toEqual({
        id: 101,
        projectId: 12345,
        base64: 'data:image/png;base64,iVBORw0KGgo=',
        type: 'role',
        prompt: '原提示词',
      });
    });

    it('prompt 未传时发空串（后端会覆写该列，避免 undefined）', async () => {
      let captured: unknown;
      server.use(
        http.post('/api/assets/saveAssets', async ({ request }) => {
          captured = await request.json();
          return ok({ message: '保存资产图片成功' });
        }),
      );

      await uploadAssetImage({
        assetId: '102',
        projectId,
        type: 'scene',
        base64: 'iVBORw0KGgo=',
      });

      expect(captured).toEqual({
        id: 102,
        projectId: 12345,
        base64: 'iVBORw0KGgo=',
        type: 'scene',
        prompt: '',
      });
    });
  });
});
