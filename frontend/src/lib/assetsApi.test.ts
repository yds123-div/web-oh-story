import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  batchPolishAssetPrompts,
  cancelAssetImageGeneration,
  countAssets,
  createAsset,
  deleteAsset,
  generateAssetImage,
  listAssets,
  polishAssetPrompt,
  pollAssetPromptsUntilSettled,
  PromptPollTimeoutError,
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
          promptState: 'none',
          promptErrorReason: null,
          imageId: '9',
          imageState: 'none',
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
          promptState: 'none',
          promptErrorReason: null,
          imageId: null,
          imageState: 'none',
        },
      ]);
    });

    it('翻译润色/生图状态列（含后端两种失败文案）', async () => {
      server.use(
        http.post('/api/assets/getAssetsApi', async () =>
          ok({
            data: [
              {
                id: 1,
                projectId: 12345,
                name: '润色中资产',
                type: 'role',
                describe: '',
                prompt: null,
                remark: null,
                imageId: 11,
                promptState: '生成中',
                promptErrorReason: null,
                state: '生成中',
                src: null,
              },
              {
                id: 2,
                projectId: 12345,
                name: '润色失败（单个接口文案）',
                type: 'role',
                describe: '',
                prompt: null,
                remark: null,
                imageId: null,
                promptState: '失败',
                promptErrorReason: '文本模型未配置',
                state: null,
                src: null,
              },
              {
                id: 3,
                projectId: 12345,
                name: '润色失败（批量接口文案）',
                type: 'role',
                describe: '',
                prompt: null,
                remark: null,
                imageId: 12,
                promptState: '生成失败',
                promptErrorReason: null,
                state: '生成失败',
                src: null,
              },
            ],
            total: 3,
          }),
        ),
      );

      const { assets } = await listAssets(projectId, { type: 'character' });
      expect(assets.map((a) => [a.promptState, a.imageState])).toEqual([
        ['running', 'running'],
        ['failed', 'none'],
        ['failed', 'failed'],
      ]);
      expect(assets[1]!.promptErrorReason).toBe('文本模型未配置');
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

  describe('资产 AI（后端 assetsGenerate 契约）', () => {
    const character = { assetId: '101', type: 'character' as const, name: '林晚', description: '现代穿越者' };

    describe('polishAssetPrompt（单个润色，同步）', () => {
      it('POST {assetsId, projectId, type 映射, name, describe} 并返回新提示词', async () => {
        let captured: unknown;
        server.use(
          http.post('/api/assetsGenerate/polishAssetsPrompt', async ({ request }) => {
            captured = await request.json();
            return ok({ prompt: '赛博朋克风格的角色标准四视图……', assetsId: 101 });
          }),
        );

        await expect(
          polishAssetPrompt({ ...character, projectId }),
        ).resolves.toBe('赛博朋克风格的角色标准四视图……');

        expect(captured).toEqual({
          assetsId: 101,
          projectId: 12345,
          type: 'role',
          name: '林晚',
          describe: '现代穿越者',
        });
      });

      it('后端失败时抛出携带原因的错误（o_assets 同时落失败态）', async () => {
        server.use(
          http.post('/api/assetsGenerate/polishAssetsPrompt', async () =>
            HttpResponse.json(
              { code: 500, data: null, message: '文本模型供应商未配置 key' },
              { status: 500 },
            ),
          ),
        );

        await expect(polishAssetPrompt({ ...character, projectId })).rejects.toMatchObject({
          message: '文本模型供应商未配置 key',
        });
      });

      it('润色结果为空时抛错（防御后端 _output 为空的分支）', async () => {
        server.use(
          http.post('/api/assetsGenerate/polishAssetsPrompt', async () =>
            ok({ prompt: null, assetsId: 101 }),
          ),
        );

        await expect(polishAssetPrompt({ ...character, projectId })).rejects.toThrow('润色结果为空');
      });
    });

    describe('batchPolishAssetPrompts（批量润色，异步受理）', () => {
      it('POST {projectId, items[{assetsId,type,name,describe}], concurrentCount, otherTextPrompt} 返回 total', async () => {
        let captured: unknown;
        server.use(
          http.post('/api/assetsGenerate/batchPolishAssetsPrompt', async ({ request }) => {
            captured = await request.json();
            return ok({ total: 2 });
          }),
        );

        await expect(
          batchPolishAssetPrompts(projectId, [
            character,
            { assetId: '103', type: 'scene', name: '木叶长廊', description: '日式长廊' },
          ]),
        ).resolves.toBe(2);

        expect(captured).toEqual({
          projectId: 12345,
          items: [
            { assetsId: 101, type: 'role', name: '林晚', describe: '现代穿越者' },
            { assetsId: 103, type: 'scene', name: '木叶长廊', describe: '日式长廊' },
          ],
          concurrentCount: 1,
          otherTextPrompt: '',
        });
      });

      it('otherTextPrompt / concurrentCount 可透传', async () => {
        let captured: unknown;
        server.use(
          http.post('/api/assetsGenerate/batchPolishAssetsPrompt', async ({ request }) => {
            captured = await request.json();
            return ok({ total: 1 });
          }),
        );

        await batchPolishAssetPrompts(projectId, [character], {
          concurrentCount: 3,
          otherTextPrompt: '突出月光冷调',
        });

        expect(captured).toMatchObject({ concurrentCount: 3, otherTextPrompt: '突出月光冷调' });
      });
    });

    describe('pollAssetPromptsUntilSettled（批量润色轮询，读模型=资产列表）', () => {
      function assetRow(id: number, promptState: string | null): Record<string, unknown> {
        return {
          id,
          projectId: 12345,
          name: `资产${id}`,
          type: 'role',
          describe: '',
          prompt: promptState === '已完成' ? `润色结果${id}` : null,
          remark: null,
          imageId: null,
          promptState,
          promptErrorReason: null,
          state: null,
          src: null,
        };
      }

      it('按 intervalMs 轮询 getAssetsApi 直到全部到达终态，每拍回调最新状态', async () => {
        let rounds = 0;
        server.use(
          http.post('/api/assets/getAssetsApi', async ({ request }) => {
            const body = (await request.json()) as { type: string };
            if (body.type !== 'role') return ok({ data: [], total: 0 });
            // 一轮 = role/scene/tool 三次并发请求；三拍：生成中 → 生成中/已完成 → 全部已完成
            rounds += 1;
            const states = [
              ['生成中', '生成中'],
              ['生成中', '已完成'],
              ['已完成', '已完成'],
            ][Math.min(rounds, 3) - 1];
            return ok({
              data: [assetRow(101, states[0]), assetRow(102, states[1])],
              total: 2,
            });
          }),
        );

        const ticks: { id: string; promptState: string }[][] = [];
        await pollAssetPromptsUntilSettled(
          projectId,
          ['101', '102'],
          {
            onTick: (states) => ticks.push(states.map((s) => ({ id: s.id, promptState: s.promptState }))),
            intervalMs: 10,
          },
        );

        expect(rounds).toBe(3);
        expect(ticks).toEqual([
          [
            { id: '101', promptState: 'running' },
            { id: '102', promptState: 'running' },
          ],
          [
            { id: '101', promptState: 'running' },
            { id: '102', promptState: 'done' },
          ],
          [
            { id: '101', promptState: 'done' },
            { id: '102', promptState: 'done' },
          ],
        ]);
      });

      it('全部终态时一拍即止（并发请求各类型共 3 次）', async () => {
        const seenTypes: string[] = [];
        server.use(
          http.post('/api/assets/getAssetsApi', async ({ request }) => {
            const body = (await request.json()) as { type: string };
            seenTypes.push(body.type);
            return ok({ data: [assetRow(101, '已完成')], total: 1 });
          }),
        );

        await pollAssetPromptsUntilSettled(projectId, ['101'], { onTick: () => {}, intervalMs: 10 });

        expect(seenTypes.sort()).toEqual(['role', 'scene', 'tool']);
      });

      it('轮询超时抛 PromptPollTimeoutError', async () => {
        server.use(
          http.post('/api/assets/getAssetsApi', async () =>
            ok({ data: [assetRow(101, '生成中')], total: 1 }),
          ),
        );

        await expect(
          pollAssetPromptsUntilSettled(
            projectId,
            ['101'],
            { onTick: () => {}, intervalMs: 5, timeoutMs: 20 },
          ),
        ).rejects.toBeInstanceOf(PromptPollTimeoutError);
      });

      it('abort 后停止轮询（抛 AbortError）', async () => {
        const controller = new AbortController();
        let rounds = 0;
        server.use(
          http.post('/api/assets/getAssetsApi', async ({ request }) => {
            const body = (await request.json()) as { type: string };
            if (body.type !== 'role') return ok({ data: [], total: 0 });
            rounds += 1;
            controller.abort();
            return ok({ data: [assetRow(101, '生成中')], total: 1 });
          }),
        );

        await expect(
          pollAssetPromptsUntilSettled(
            projectId,
            ['101'],
            { onTick: () => {}, intervalMs: 5 },
            controller.signal,
          ),
        ).rejects.toMatchObject({ name: 'AbortError' });
        expect(rounds).toBe(1);
      });
    });

    describe('generateAssetImage（AI 生图，同步）', () => {
      it('POST {projectId, model, resolution, id, type 映射, name, prompt, base64?} 并翻译 path', async () => {
        let captured: unknown;
        server.use(
          http.post('/api/assetsGenerate/generateAssets', async ({ request }) => {
            captured = await request.json();
            return ok({ path: 'http://localhost:10588/oss/12345/role/small.jpg', assetsId: 101 });
          }),
        );

        await expect(
          generateAssetImage({
            ...character,
            projectId,
            model: '1:Seedream-4.0',
            resolution: '2K',
            prompt: '赛博朋克少女四视图',
            base64: 'data:image/png;base64,iVBORw0KGgo=',
          }),
        ).resolves.toEqual({
          imageUrl: 'http://localhost:10588/oss/12345/role/small.jpg',
          assetId: '101',
        });

        expect(captured).toEqual({
          projectId: 12345,
          model: '1:Seedream-4.0',
          resolution: '2K',
          id: 101,
          type: 'role',
          name: '林晚',
          prompt: '赛博朋克少女四视图',
          base64: 'data:image/png;base64,iVBORw0KGgo=',
        });
      });

      it('base64 未传时请求体不带该键（无参考图生成）', async () => {
        let captured: unknown;
        server.use(
          http.post('/api/assetsGenerate/generateAssets', async ({ request }) => {
            captured = await request.json();
            return ok({ path: '/oss/x.jpg', assetsId: 101 });
          }),
        );

        await generateAssetImage({
          ...character,
          projectId,
          model: '1:Seedream-4.0',
          resolution: '2K',
          prompt: '提示词',
        });

        expect('base64' in (captured as object)).toBe(false);
      });

      it('图像 key 未到位：后端失败原因原样透出（可重试，不阻塞）', async () => {
        server.use(
          http.post('/api/assetsGenerate/generateAssets', async () =>
            HttpResponse.json(
              { code: 400, data: null, message: '未找到供应商配置 id=Seedream-4.0' },
              { status: 400 },
            ),
          ),
        );

        await expect(
          generateAssetImage({
            ...character,
            projectId,
            model: 'Seedream-4.0',
            resolution: '2K',
            prompt: '提示词',
          }),
        ).rejects.toMatchObject({
          name: 'HttpError',
          message: '未找到供应商配置 id=Seedream-4.0',
        });
      });
    });

    describe('cancelAssetImageGeneration', () => {
      it('POST {id}（o_image 行 id）', async () => {
        let captured: unknown;
        server.use(
          http.post('/api/assetsGenerate/cancelGenerate', async ({ request }) => {
            captured = await request.json();
            return ok({ message: '取消成功' });
          }),
        );

        await cancelAssetImageGeneration('33');
        expect(captured).toEqual({ id: 33 });
      });
    });
  });
});
