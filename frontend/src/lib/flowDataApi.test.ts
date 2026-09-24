import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { composeFlowStoryboards, fetchStudioFlowData, saveStudioFlowData } from './api';
import type { FlowDataStoryboard, Storyboard, StudioFlowData, Workbench } from '../types/api';

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function ok(data: unknown) {
  return HttpResponse.json({ code: 200, data, message: '成功' });
}

/** 后端失败信封：HTTP 400 + {code, data, message} */
function fail(message: string) {
  return HttpResponse.json({ code: 400, data: null, message }, { status: 400 });
}

const projectId = '1790179247218';
const episodesId = '10';

/**
 * 后端默认 FlowData（无存档分支）的真实形状：scriptPlan/storyboardTable 空串、
 * storyboard 恒空数组、workbench 只有空 videoList。
 */
const DEFAULT_ROW = {
  script: '【木叶长廊 内 夜】\n△ 林晚扶着廊柱，指尖颤抖。',
  scriptPlan: '',
  assets: [],
  storyboardTable: '',
  storyboard: [],
  workbench: { videoList: [] },
};

/** 后端有存档分支：script/assets/storyboard 被真实表数据覆盖，scriptPlan/storyboardTable 来自存档 JSON */
const ARCHIVED_ROW = {
  script: '【木叶长廊 内 夜】',
  scriptPlan: '第1集拍摄计划：长廊夜景起手，用冷调压低情绪。',
  storyboardTable: '| 序号 | 描述 | 时长 |\n| 1 | 长廊夜景 | 4s |',
  assets: [
    {
      id: 101,
      name: '林晚',
      type: 'role',
      prompt: '赛博朋克电影质感',
      desc: '现代穿越者',
      // 后端拼好的静态托管小图路径，前端原样使用
      src: 'http://localhost:10588/oss/1790179247218/role/101.png?size=20',
      flowId: 7,
      derive: [
        {
          id: 108,
          assetsId: 101,
          name: '林晚·战斗形态',
          type: 'role',
          prompt: '战斗服',
          desc: '第二形态',
          src: null,
          // 后端无图时给「未生成」字面量
          state: '未生成',
          errorReason: '',
          flowId: 8,
        },
        {
          id: 109,
          assetsId: 101,
          name: '林晚·夜行装',
          type: 'role',
          prompt: '夜行装',
          desc: '第三形态',
          src: 'http://localhost:10588/oss/1790179247218/role/109.png',
          state: '生成失败',
          errorReason: '缺少API Key',
          flowId: 9,
        },
      ],
    },
    { id: 103, name: '木叶长廊', type: 'scene', prompt: '', desc: '冷调长廊', src: null },
  ],
  storyboard: [
    {
      id: 3,
      index: 0,
      duration: 4,
      prompt: '长廊夜景：林晚独自伫立',
      videoDesc: '长廊夜景：林晚独自伫立',
      associateAssetsIds: [101, 103],
      src: 'http://localhost:10588/oss/10/storyboard/3.png?size=20',
      state: '已完成',
      reason: '',
      shouldGenerateImage: 1,
      flowId: 12,
    },
    {
      id: 4,
      index: 1,
      duration: 0,
      prompt: '林晚回头，叫住鼬',
      videoDesc: '林晚回头，叫住鼬',
      associateAssetsIds: [],
      src: null,
      state: '生成失败',
      reason: '图像供应商未配置 key',
      shouldGenerateImage: 0,
    },
  ],
};

describe('FlowData API（后端 production/getFlowData + saveFlowData 契约翻译）', () => {
  describe('fetchStudioFlowData', () => {
    it('按后端契约 POST {projectId, episodesId} 数字', async () => {
      server.use(
        http.post('/api/production/getFlowData', async ({ request }) => {
          expect(await request.json()).toEqual({ projectId: 1790179247218, episodesId: 10 });
          return ok(DEFAULT_ROW);
        }),
      );

      await fetchStudioFlowData(projectId, episodesId);
    });

    it('无存档时把后端默认 FlowData 翻译成形状完整的空态（页面据此正常渲染）', async () => {
      server.use(http.post('/api/production/getFlowData', () => ok(DEFAULT_ROW)));

      const data = await fetchStudioFlowData(projectId, episodesId);

      expect(data).toEqual({
        script: '【木叶长廊 内 夜】\n△ 林晚扶着廊柱，指尖颤抖。',
        scriptPlan: '',
        storyboardTable: '',
        assets: [],
        storyboard: [],
        workbench: { videoList: [] },
      });
    });

    it('后端整个键缺失（老存档）时也给出完整文档，不抛错', async () => {
      server.use(http.post('/api/production/getFlowData', () => ok({ script: '正文' })));

      const data = await fetchStudioFlowData(projectId, episodesId);

      expect(data.scriptPlan).toBe('');
      expect(data.storyboardTable).toBe('');
      expect(data.storyboard).toEqual([]);
      expect(data.workbench.videoList).toEqual([]);
    });

    it('有存档时翻译编辑状态、资产与分镜，图片路径直接用后端静态托管地址', async () => {
      server.use(http.post('/api/production/getFlowData', () => ok(ARCHIVED_ROW)));

      const data = await fetchStudioFlowData(projectId, episodesId);

      // 能真正往返的编辑状态
      expect(data.scriptPlan).toBe('第1集拍摄计划：长廊夜景起手，用冷调压低情绪。');
      expect(data.storyboardTable).toContain('| 1 | 长廊夜景 | 4s |');

      // 资产：类型枚举翻译、id 数字→字符串、静态托管路径原样保留
      expect(data.assets.map((a) => a.id)).toEqual(['101', '103']);
      expect(data.assets[0]?.type).toBe('character');
      expect(data.assets[1]?.type).toBe('scene');
      expect(data.assets[0]?.imageUrl).toBe(
        'http://localhost:10588/oss/1790179247218/role/101.png?size=20',
      );
      expect(data.assets[1]?.imageUrl).toBeNull();
      expect(data.assets[0]?.flowId).toBe('7');

      // 衍生资产：生图状态与失败原因
      const derive = data.assets[0]!.derive;
      expect(derive.map((d) => d.name)).toEqual(['林晚·战斗形态', '林晚·夜行装']);
      expect(derive[0]?.assetsId).toBe('101');
      expect(derive[0]?.imageState).toBe('none');
      expect(derive[0]?.imageUrl).toBeNull();
      expect(derive[1]?.imageState).toBe('failed');
      expect(derive[1]?.errorReason).toBe('缺少API Key');

      // 分镜：数组顺序 = 编辑后的顺序，state 翻译为命名状态
      expect(data.storyboard.map((s) => s.id)).toEqual(['3', '4']);
      expect(data.storyboard[0]?.index).toBe(0);
      expect(data.storyboard[0]?.durationSec).toBe(4);
      expect(data.storyboard[0]?.status).toBe('done');
      expect(data.storyboard[0]?.associateAssetsIds).toEqual(['101', '103']);
      expect(data.storyboard[1]?.status).toBe('failed');
      expect(data.storyboard[1]?.errorReason).toBe('图像供应商未配置 key');
    });

    it('后端业务失败时抛出真实原因', async () => {
      server.use(http.post('/api/production/getFlowData', () => fail('参数错误')));

      await expect(fetchStudioFlowData(projectId, episodesId)).rejects.toThrow('参数错误');
    });
  });

  describe('saveStudioFlowData', () => {
    const data: StudioFlowData = {
      script: '【木叶长廊 内 夜】',
      scriptPlan: '第1集拍摄计划',
      storyboardTable: '| 1 | 长廊夜景 | 4s |',
      assets: [
        {
          id: '101',
          name: '林晚',
          type: 'character',
          prompt: '赛博朋克电影质感',
          description: '现代穿越者',
          imageUrl: 'http://localhost:10588/oss/1790179247218/role/101.png?size=20',
          flowId: '7',
          derive: [
            {
              id: '108',
              assetsId: '101',
              name: '林晚·战斗形态',
              type: 'character',
              prompt: '战斗服',
              description: '第二形态',
              imageUrl: null,
              imageState: 'none',
              errorReason: null,
              flowId: '8',
            },
          ],
        },
      ],
      // 顺序是编辑态：4 在前、3 在后
      storyboard: [
        {
          id: '4',
          index: 0,
          durationSec: 3,
          prompt: '林晚回头，叫住鼬',
          videoDesc: '林晚回头，叫住鼬',
          associateAssetsIds: ['101'],
          imageUrl: null,
          status: 'none',
          errorReason: null,
          shouldGenerateImage: 0,
          flowId: null,
        },
        {
          id: '3',
          index: 1,
          durationSec: 4,
          prompt: '长廊夜景',
          videoDesc: '长廊夜景',
          associateAssetsIds: [],
          imageUrl: 'http://localhost:10588/oss/10/storyboard/3.png?size=20',
          status: 'failed',
          errorReason: '图像供应商未配置 key',
          shouldGenerateImage: 1,
          flowId: '12',
        },
      ],
      workbench: { videoList: [], note: '未定义结构的键要原样带回去' },
    };

    it('整体提交文档：id 转数字、state 回写后端文案、分镜数组顺序保真', async () => {
      server.use(
        http.post('/api/production/saveFlowData', async ({ request }) => {
          expect(await request.json()).toEqual({
            projectId: 1790179247218,
            episodesId: 10,
            data: {
              script: '【木叶长廊 内 夜】',
              scriptPlan: '第1集拍摄计划',
              storyboardTable: '| 1 | 长廊夜景 | 4s |',
              assets: [
                {
                  id: 101,
                  name: '林晚',
                  type: 'role',
                  prompt: '赛博朋克电影质感',
                  desc: '现代穿越者',
                  src: 'http://localhost:10588/oss/1790179247218/role/101.png?size=20',
                  flowId: 7,
                  derive: [
                    {
                      id: 108,
                      assetsId: 101,
                      name: '林晚·战斗形态',
                      type: 'role',
                      prompt: '战斗服',
                      desc: '第二形态',
                      src: null,
                      state: '未生成',
                      errorReason: null,
                      flowId: 8,
                    },
                  ],
                },
              ],
              // 数组顺序就是 o_storyboard.index 的持久化形式，必须原样发出去
              storyboard: [
                {
                  id: 4,
                  index: 0,
                  duration: 3,
                  prompt: '林晚回头，叫住鼬',
                  videoDesc: '林晚回头，叫住鼬',
                  associateAssetsIds: [101],
                  src: null,
                  state: '未生成',
                  reason: null,
                  shouldGenerateImage: 0,
                  flowId: null,
                },
                {
                  id: 3,
                  index: 1,
                  duration: 4,
                  prompt: '长廊夜景',
                  videoDesc: '长廊夜景',
                  associateAssetsIds: [],
                  src: 'http://localhost:10588/oss/10/storyboard/3.png?size=20',
                  state: '生成失败',
                  reason: '图像供应商未配置 key',
                  shouldGenerateImage: 1,
                  flowId: 12,
                },
              ],
              workbench: { videoList: [], note: '未定义结构的键要原样带回去' },
            },
          });
          return ok(null);
        }),
      );

      await expect(saveStudioFlowData(projectId, episodesId, data)).resolves.toBeUndefined();
    });

    it('后端业务失败时抛出真实原因', async () => {
      server.use(http.post('/api/production/saveFlowData', () => fail('保存存档失败')));

      await expect(saveStudioFlowData(projectId, episodesId, data)).rejects.toThrow(
        '保存存档失败',
      );
    });
  });

  describe('composeFlowStoryboards（面板分镜 + 存档分镜 → 写回存档的行）', () => {
    const panel: Storyboard[] = [
      { id: '3', scriptId: '10', prompt: '长廊夜景', durationSec: 4, imageUrl: null, characters: [] },
      { id: '7', scriptId: '10', prompt: '新建的分镜', durationSec: null, imageUrl: null, characters: [] },
    ];

    const archivedRow: FlowDataStoryboard = {
      id: '3',
      index: 5,
      durationSec: 4,
      // 与面板上的描述一致（存档与真实表来自同一行），故 videoDesc 应当被保留
      prompt: '长廊夜景',
      videoDesc: '旧视频描述',
      associateAssetsIds: ['101', '103'],
      imageUrl: 'http://localhost:10588/oss/10/storyboard/3.png',
      status: 'none',
      errorReason: null,
      shouldGenerateImage: 1,
      flowId: '12',
    };

    it('顺序 = 传入的分镜顺序，index 按位置重排（后端据此回写 o_storyboard.index）', () => {
      const reversed = composeFlowStoryboards([panel[1]!, panel[0]!], [archivedRow]);

      expect(reversed.map((row) => row.id)).toEqual(['7', '3']);
      expect(reversed.map((row) => row.index)).toEqual([0, 1]);
    });

    it('存档里没有的新分镜按 addStoryboard 的约定补默认值（videoDesc 与描述同值）', () => {
      const [rows] = [composeFlowStoryboards([panel[1]!], [])];

      expect(rows[0]).toEqual({
        id: '7',
        index: 0,
        durationSec: 0,
        prompt: '新建的分镜',
        videoDesc: '新建的分镜',
        associateAssetsIds: [],
        imageUrl: null,
        status: 'none',
        errorReason: null,
        shouldGenerateImage: 0,
        flowId: null,
      });
    });

    it('存档里已有的分镜保留只有存档才有的字段（视频描述 / 关联资产 / flowId）', () => {
      const [row] = composeFlowStoryboards([panel[0]!], [archivedRow]);

      expect(row?.videoDesc).toBe('旧视频描述');
      expect(row?.associateAssetsIds).toEqual(['101', '103']);
      expect(row?.shouldGenerateImage).toBe(1);
      expect(row?.flowId).toBe('12');
      // 描述与图片路径以面板（= 真实表）为准
      expect(row?.prompt).toBe('长廊夜景');
      expect(row?.imageUrl).toBe('http://localhost:10588/oss/10/storyboard/3.png');
    });

    it('存档里没有的分镜：shouldGenerateImage 按有没有图给（后端 addStoryboard 就是 src ? 1 : 0）', () => {
      const withImage: Storyboard = {
        ...panel[1]!,
        imageUrl: 'http://localhost:10588/oss/10/storyboard/7.png?size=20',
      };

      expect(composeFlowStoryboards([withImage], [])[0]?.shouldGenerateImage).toBe(1);
      expect(composeFlowStoryboards([panel[1]!], [])[0]?.shouldGenerateImage).toBe(0);
    });

    it('描述改过之后 videoDesc 跟着描述走（08 约定：两列不同步会清空 09 的输入）', () => {
      const edited: Storyboard = { ...panel[0]!, prompt: '改过的描述' };

      const [row] = composeFlowStoryboards([edited], [archivedRow]);

      expect(row?.videoDesc).toBe('改过的描述');
    });

    it('生图状态以工作台读模型为准，比存档里的旧快照新', () => {
      const imageStates: Workbench['storyboards'] = [
        { id: '3', status: 'failed', errorReason: '图像供应商未配置 key', imageUrl: null, trackId: '9' },
      ];

      const [row] = composeFlowStoryboards([panel[0]!], [archivedRow], imageStates);

      expect(row?.status).toBe('failed');
      expect(row?.errorReason).toBe('图像供应商未配置 key');
    });
  });
});