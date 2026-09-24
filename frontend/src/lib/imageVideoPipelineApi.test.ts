import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  batchGenerateTrackVideoPrompts,
  batchGenerateTrackVideos,
  createVideoTrack,
  deleteTrackVideo,
  deleteVideoTrack,
  downloadStoryboardPreview,
  fetchWorkbench,
  generateStoryboardImages,
  generateTrackVideo,
  generateTrackVideoPrompt,
  listTrackVideos,
  pollStoryboardImagesUntilSettled,
  pollVideoPromptsUntilSettled,
  pollVideosUntilSettled,
  previewStoryboardImages,
  selectTrackVideo,
  StoryboardImagePollTimeoutError,
  updateTrackVideoDuration,
  updateTrackVideoPrompt,
  VideoPollTimeoutError,
  VideoPromptPollTimeoutError,
} from './api';

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function ok(data: unknown) {
  return HttpResponse.json({ code: 200, data, message: '成功' });
}

/** 后端业务失败信封：HTTP 400 + {code, data, message} */
function fail(message: string) {
  return HttpResponse.json({ code: 400, data: null, message }, { status: 400 });
}

const projectId = '1790179247218';
const scriptId = '11';

describe('分镜图片 API（后端 production/storyboard 契约翻译）', () => {
  describe('generateStoryboardImages', () => {
    it('发 compulsory:true 与收敛后的并发数（后端非 compulsory 会跳过全新分镜）', async () => {
      server.use(
        http.post('/api/production/storyboard/batchGenerateImage', async ({ request }) => {
          expect(await request.json()).toEqual({
            projectId: 1790179247218,
            scriptId: 11,
            storyboardIds: [3, 4],
            compulsory: true,
            concurrentCount: 2,
          });
          return ok([]);
        }),
      );

      await expect(
        generateStoryboardImages({ projectId, scriptId, storyboardIds: ['3', '4'] }),
      ).resolves.toBeUndefined();
    });

    it('后端业务失败（HTTP 500 信封）时抛出真实原因', async () => {
      server.use(
        http.post('/api/production/storyboard/batchGenerateImage', async () =>
          HttpResponse.json({ code: 400, data: null, message: '未查到分镜数据' }, { status: 500 }),
        ),
      );

      await expect(
        generateStoryboardImages({ projectId, scriptId, storyboardIds: ['3'] }),
      ).rejects.toThrow('未查到分镜数据');
    });
  });

  describe('previewStoryboardImages', () => {
    it('返回后端拼好的 data URL', async () => {
      server.use(
        http.post('/api/production/storyboard/previewImage', async ({ request }) => {
          expect(await request.json()).toEqual({ storyboardIds: [3, 4] });
          return ok('data:image/jpeg;base64,/9j/4AAQ');
        }),
      );

      await expect(previewStoryboardImages(['3', '4'])).resolves.toBe('data:image/jpeg;base64,/9j/4AAQ');
    });

    it('一张有效图都没有时后端回 null，翻译为 null（不是空串）', async () => {
      server.use(http.post('/api/production/storyboard/previewImage', async () => ok(null)));
      await expect(previewStoryboardImages(['3'])).resolves.toBeNull();
    });
  });

  describe('downloadStoryboardPreview', () => {
    it('拿回 PNG 二进制', async () => {
      server.use(
        http.post('/api/production/storyboard/downPreviewImage', async ({ request }) => {
          expect(await request.json()).toEqual({ storyboardIds: [3, 4] });
          return new HttpResponse(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
            status: 200,
            headers: { 'Content-Type': 'image/png' },
          });
        }),
      );

      const blob = await downloadStoryboardPreview(['3', '4']);
      expect(blob?.type).toBe('image/png');
      expect(blob?.size).toBe(4);
    });

    it('无有效图时后端回 204，翻译为 null', async () => {
      server.use(
        http.post('/api/production/storyboard/downPreviewImage', () => new HttpResponse(null, { status: 204 })),
      );

      await expect(downloadStoryboardPreview(['3'])).resolves.toBeNull();
    });
  });
});

describe('分镜生图轮询（缺失即「仍在生成」）', () => {
  it('缺失的 id 视为生成中，继续轮询直到全部出现', async () => {
    let round = 0;
    server.use(
      http.post('/api/production/storyboard/pollingImage', async () => {
        round += 1;
        // 第 1 拍只回第 3 条（第 4 条还在生成），第 2 拍才回全
        if (round === 1) {
          return ok([{ id: 3, state: '已完成', reason: null, src: 'http://x/3.png?size=20' }]);
        }
        return ok([
          { id: 3, state: '已完成', reason: null, src: 'http://x/3.png?size=20' },
          { id: 4, state: '生成失败', reason: '图像供应商未配置 key', src: null },
        ]);
      }),
    );

    const ticks: string[][] = [];
    await pollStoryboardImagesUntilSettled(
      ['3', '4'],
      { onTick: (states) => ticks.push(states.map((s) => `${s.id}:${s.status}`)), intervalMs: 1 },
    );

    expect(round).toBe(2);
    expect(ticks).toEqual([['3:done'], ['3:done', '4:failed']]);
  });

  it('超过上限仍未全部到终态时抛 StoryboardImagePollTimeoutError', async () => {
    server.use(
      http.post('/api/production/storyboard/pollingImage', async () =>
        ok([{ id: 3, state: '已完成', reason: null, src: null }]),
      ),
    );

    await expect(
      pollStoryboardImagesUntilSettled(['3', '4'], { onTick: () => {}, intervalMs: 1, timeoutMs: 20 }),
    ).rejects.toBeInstanceOf(StoryboardImagePollTimeoutError);
  });

  it('取消时抛 AbortError（不按超时处理）', async () => {
    const controller = new AbortController();
    // 回空数组 = 该分镜仍在生成，轮询会继续进入下一次等待，取消才有机会生效
    server.use(http.post('/api/production/storyboard/pollingImage', async () => ok([])));

    const promise = pollStoryboardImagesUntilSettled(
      ['3'],
      { onTick: () => controller.abort(), intervalMs: 1 },
      controller.signal,
    );
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('工作台读模型 fetchWorkbench', () => {
  /** getGenerateData 的真实响应（轨道 duration 为 0、selectVideoId 为 0 都是后端的真实形态） */
  const generateData = {
    storyboardList: [
      { id: 3, scriptId: 11, prompt: '长廊夜景', duration: 4, state: '已完成', reason: null, trackId: 700, src: 'http://x/3.png?size=20' },
      { id: 4, scriptId: 11, prompt: '林晚回头', duration: 3, state: '生成失败', reason: '图像供应商未配置 key', trackId: 701, src: '' },
    ],
    trackList: [
      { id: 700, duration: 0, prompt: '镜头 700 的提示词', state: '已完成', reason: '', selectVideoId: 0, medias: [], videoList: [] },
      { id: 701, duration: 6, prompt: '', state: '生成失败', reason: '模型超时', selectVideoId: 88, medias: [], videoList: [] },
    ],
  };

  function useWorkbench(videos: unknown[] = []) {
    server.use(
      http.post('/api/production/workbench/getGenerateData', async ({ request }) => {
        expect(await request.json()).toEqual({ projectId: 1790179247218, scriptId: 11 });
        return ok(generateData);
      }),
      http.post('/api/production/workbench/getVideoList', async ({ request }) => {
        expect(await request.json()).toEqual({ projectId: 1790179247218, scriptId: 11 });
        return ok(videos);
      }),
    );
  }

  it('合并 getGenerateData 的轨道与 getVideoList 的视频版本，并翻译各列状态', async () => {
    useWorkbench([
      { id: 88, videoTrackId: 701, state: '生成成功', errorReason: null, filePath: '/p/v/88.mp4', src: 'http://x/88.mp4?size=20' },
      { id: 89, videoTrackId: 701, state: '生成失败', errorReason: '缺少API Key', filePath: '/p/v/89.mp4', src: 'http://x/89.mp4?size=20' },
      { id: 90, videoTrackId: 701, state: '生成中', errorReason: null, filePath: '/p/v/90.mp4', src: '' },
    ]);

    const workbench = await fetchWorkbench(projectId, scriptId);

    expect(workbench.storyboards).toEqual([
      { id: '3', status: 'done', errorReason: null, imageUrl: 'http://x/3.png?size=20', trackId: '700' },
      { id: '4', status: 'failed', errorReason: '图像供应商未配置 key', imageUrl: null, trackId: '701' },
    ]);

    expect(workbench.tracks).toHaveLength(2);
    expect(workbench.tracks[0]).toMatchObject({
      id: '700',
      storyboardId: '3',
      number: 1,
      description: '长廊夜景',
      imageUrl: 'http://x/3.png?size=20',
      // 轨道自己 duration=0（后端 addStoryboard 不写），回退到分镜时长
      durationSec: 4,
      videoPrompt: '镜头 700 的提示词',
      promptStatus: 'done',
      promptErrorReason: null,
      // 后端 Number(null) = 0，不是合法 id，翻译成 null
      selectedVideoId: null,
      videos: [],
    });
    expect(workbench.tracks[1]).toMatchObject({
      id: '701',
      storyboardId: '4',
      number: 2,
      // 轨道自己有 duration=6 时优先用轨道的
      durationSec: 6,
      promptStatus: 'failed',
      promptErrorReason: '模型超时',
      selectedVideoId: '88',
    });
    expect(workbench.tracks[1]?.videos).toEqual([
      { id: '88', trackId: '701', status: 'done', url: 'http://x/88.mp4?size=20', errorReason: null },
      // 失败/生成中的版本即使后端给了 src 也不对外给 url（那个地址下面没有文件）
      { id: '89', trackId: '701', status: 'failed', url: null, errorReason: '缺少API Key' },
      { id: '90', trackId: '701', status: 'running', url: null, errorReason: null },
    ]);
  });

  it('轨道没有对应分镜时仍列出，分镜相关字段为空', async () => {
    server.use(
      http.post('/api/production/workbench/getGenerateData', async () =>
        ok({ storyboardList: [], trackList: [{ id: 900, duration: 5, prompt: '', state: '未生成', reason: '', selectVideoId: 0 }] }),
      ),
      http.post('/api/production/workbench/getVideoList', async () => ok([])),
    );

    const { tracks } = await fetchWorkbench(projectId, scriptId);
    expect(tracks[0]).toMatchObject({
      id: '900',
      storyboardId: null,
      number: null,
      description: '',
      durationSec: 5,
      promptStatus: 'none',
      selectedVideoId: null,
    });
  });

  it('项目未配置视频模型时把后端那句「成功」翻成可读原因', async () => {
    server.use(
      http.post('/api/production/workbench/getGenerateData', async () =>
        // 后端原样：HTTP 400 却套了成功信封，message 恒为默认的「成功」
        HttpResponse.json({ code: 200, data: '项目未配置视频模型', message: '成功' }, { status: 400 }),
      ),
      http.post('/api/production/workbench/getVideoList', async () => ok([])),
    );

    await expect(fetchWorkbench(projectId, scriptId)).rejects.toThrow('项目未配置视频模型，无法加载工作台');
  });
});

describe('工作台轨道增删与版本管理', () => {
  it('createVideoTrack 发 addTrack 并翻译 trackId 为字符串', async () => {
    server.use(
      http.post('/api/production/workbench/addTrack', async ({ request }) => {
        expect(await request.json()).toEqual({ projectId: 1790179247218, scriptId: 11, duration: 5 });
        return ok(1790215147273);
      }),
    );

    await expect(createVideoTrack(projectId, scriptId, 5)).resolves.toBe('1790215147273');
  });

  it('createVideoTrack 不带时长时整个 duration 键不发', async () => {
    server.use(
      http.post('/api/production/workbench/addTrack', async ({ request }) => {
        expect(await request.json()).toEqual({ projectId: 1790179247218, scriptId: 11 });
        return ok(1);
      }),
    );

    await expect(createVideoTrack(projectId, scriptId)).resolves.toBe('1');
  });

  it('deleteVideoTrack / selectTrackVideo / deleteTrackVideo 的请求形状', async () => {
    server.use(
      http.post('/api/production/workbench/deleteTrack', async ({ request }) => {
        expect(await request.json()).toEqual({ id: 700 });
        return ok({ message: '视频段删除成功' });
      }),
      http.post('/api/production/workbench/selectVideo', async ({ request }) => {
        expect(await request.json()).toEqual({ trackId: 700, videoId: 88 });
        return ok({ message: '视频选择成功' });
      }),
      http.post('/api/production/workbench/delVideo', async ({ request }) => {
        expect(await request.json()).toEqual({ id: 88 });
        return ok({ message: '视频删除成功' });
      }),
    );

    await expect(deleteVideoTrack('700')).resolves.toBeUndefined();
    await expect(selectTrackVideo('700', '88')).resolves.toBeUndefined();
    await expect(deleteTrackVideo('88')).resolves.toBeUndefined();
  });

  it('listTrackVideos 翻译原始 state（含生成中与失败原因）', async () => {
    server.use(
      http.post('/api/production/workbench/getVideoList', async () =>
        ok([
          { id: 88, videoTrackId: 700, state: '生成成功', errorReason: null, src: 'http://x/88.mp4' },
          { id: 89, videoTrackId: 700, state: '生成失败', errorReason: '缺少API Key', src: 'http://x/89.mp4' },
        ]),
      ),
    );

    await expect(listTrackVideos(projectId, scriptId)).resolves.toEqual([
      { id: '88', trackId: '700', status: 'done', url: 'http://x/88.mp4', errorReason: null },
      { id: '89', trackId: '700', status: 'failed', url: null, errorReason: '缺少API Key' },
    ]);
  });
});

describe('视频生成轮询（后端只回终态）', () => {
  it('轮询直到每个视频都出现，并翻译状态与原因', async () => {
    let round = 0;
    server.use(
      http.post('/api/production/workbench/checkVideoStateList', async ({ request }) => {
        expect(await request.json()).toEqual({ projectId: 1790179247218, scriptId: 11, videoIds: [88] });
        round += 1;
        if (round === 1) return ok([]);
        return ok([{ id: 88, state: '生成失败', errorReason: '缺少API Key', src: '' }]);
      }),
    );

    const ticks: unknown[] = [];
    await expect(
      pollVideosUntilSettled(
        { projectId, scriptId, videoIds: ['88'] },
        { onTick: (states) => ticks.push(states), intervalMs: 1 },
      ),
    ).resolves.toBeUndefined();

    expect(round).toBe(2);
    expect(ticks[1]).toEqual([{ id: '88', status: 'failed', url: null, errorReason: '缺少API Key' }]);
  });

  it('超时抛 VideoPollTimeoutError', async () => {
    server.use(http.post('/api/production/workbench/checkVideoStateList', async () => ok([])));

    await expect(
      pollVideosUntilSettled(
        { projectId, scriptId, videoIds: ['88'] },
        { onTick: () => {}, intervalMs: 1, timeoutMs: 20 },
      ),
    ).rejects.toBeInstanceOf(VideoPollTimeoutError);
  });
});

describe('视频提示词生成', () => {
  it('generateTrackVideoPrompt 按后端 zod 契约发 trackId/projectId/info/model/mode，返回提示词', async () => {
    server.use(
      http.post('/api/production/workbench/generateVideoPrompt', async ({ request }) => {
        expect(await request.json()).toEqual({
          trackId: 700,
          projectId: 1790179247218,
          // sources 恒为 storyboard：一镜一轨，参考图就是该分镜自己的画面
          info: [{ id: 3, sources: 'storyboard' }],
          model: 'volcengine:doubao-seedance-2-0-260128',
          mode: 'text',
        });
        return ok('镜头1：电影感中景，缓慢推进');
      }),
    );

    await expect(
      generateTrackVideoPrompt({
        trackId: '700',
        storyboardId: '3',
        projectId,
        model: 'volcengine:doubao-seedance-2-0-260128',
        mode: 'text',
      }),
    ).resolves.toBe('镜头1：电影感中景，缓慢推进');
  });

  it('文本模型失败时把后端原因原样抛出（HTTP 400 错误信封）', async () => {
    server.use(
      http.post('/api/production/workbench/generateVideoPrompt', async () => fail('视觉手册未定义')),
    );

    await expect(
      generateTrackVideoPrompt({ trackId: '700', storyboardId: '3', projectId, model: 'm', mode: 'text' }),
    ).rejects.toThrow('视觉手册未定义');
  });

  it('batchGenerateTrackVideoPrompts 发 trackData 数组与并发数', async () => {
    server.use(
      http.post('/api/production/workbench/batchGeneratePrompt', async ({ request }) => {
        expect(await request.json()).toEqual({
          projectId: 1790179247218,
          trackData: [
            { trackId: 700, info: [{ id: 3, sources: 'storyboard' }] },
            { trackId: 701, info: [{ id: 4, sources: 'storyboard' }] },
          ],
          model: 'volcengine:doubao-seedance-2-0-260128',
          mode: 'text',
          concurrentCount: 3,
        });
        return ok('开始生成提示词');
      }),
    );

    await expect(
      batchGenerateTrackVideoPrompts({
        projectId,
        tracks: [
          { trackId: '700', storyboardId: '3' },
          { trackId: '701', storyboardId: '4' },
        ],
        model: 'volcengine:doubao-seedance-2-0-260128',
        mode: 'text',
        concurrentCount: 3,
      }),
    ).resolves.toBeUndefined();
  });

  it('轮询直到每个轨道都到终态，超时抛 VideoPromptPollTimeoutError', async () => {
    let round = 0;
    server.use(
      http.post('/api/production/workbench/checkVideoPrompt', async ({ request }) => {
        expect(await request.json()).toEqual({ projectId: 1790179247218, scriptId: 11, trackIds: [700] });
        round += 1;
        return round === 1 ? ok([]) : ok([{ id: 700, state: '已完成', reason: null, prompt: '镜头1…' }]);
      }),
    );

    const ticks: unknown[] = [];
    await pollVideoPromptsUntilSettled(
      { projectId, scriptId, trackIds: ['700'] },
      { onTick: (states) => ticks.push(states), intervalMs: 1 },
    );
    expect(round).toBe(2);
    expect(ticks[1]).toEqual([{ id: '700', status: 'done', prompt: '镜头1…', errorReason: null }]);

    server.use(http.post('/api/production/workbench/checkVideoPrompt', async () => ok([])));
    await expect(
      pollVideoPromptsUntilSettled(
        { projectId, scriptId, trackIds: ['700'] },
        { onTick: () => {}, intervalMs: 1, timeoutMs: 20 },
      ),
    ).rejects.toBeInstanceOf(VideoPromptPollTimeoutError);
  });

  it('updateTrackVideoPrompt / updateTrackVideoDuration 的请求形状', async () => {
    server.use(
      http.post('/api/production/workbench/updateVideoPrompt', async ({ request }) => {
        expect(await request.json()).toEqual({ id: 700, prompt: '改后的提示词' });
        return ok('更新成功');
      }),
      http.post('/api/production/workbench/updateVideoDuration', async ({ request }) => {
        expect(await request.json()).toEqual({ id: 700, duration: 6 });
        return ok('更新成功');
      }),
    );

    await expect(updateTrackVideoPrompt('700', '改后的提示词')).resolves.toBeUndefined();
    await expect(updateTrackVideoDuration('700', 6)).resolves.toBeUndefined();
  });
});

describe('视频生成', () => {
  it('generateTrackVideo 按后端 zod 契约发全字段并返回 videoId', async () => {
    server.use(
      http.post('/api/production/workbench/generateVideo', async ({ request }) => {
        expect(await request.json()).toEqual({
          projectId: 1790179247218,
          scriptId: 11,
          trackId: 700,
          uploadData: [{ id: 3, sources: 'storyboard' }],
          prompt: '镜头1…',
          model: 'volcengine:doubao-seedance-2-0-260128',
          mode: 'text',
          resolution: '720p',
          duration: 4,
        });
        return ok(88);
      }),
    );

    await expect(
      generateTrackVideo({
        projectId,
        scriptId,
        trackId: '700',
        storyboardId: '3',
        prompt: '镜头1…',
        model: 'volcengine:doubao-seedance-2-0-260128',
        mode: 'text',
        resolution: '720p',
        durationSec: 4,
      }),
    ).resolves.toBe('88');
  });

  it('batchGenerateTrackVideos 发 trackData 并翻译返回的 videoId/trackId 为字符串', async () => {
    server.use(
      http.post('/api/production/workbench/batchGenerateVideo', async ({ request }) => {
        expect(await request.json()).toEqual({
          projectId: 1790179247218,
          scriptId: 11,
          trackData: [{ trackId: 700, uploadData: [{ id: 3, sources: 'storyboard' }], prompt: '镜头1…', duration: 4 }],
          model: 'm',
          mode: 'text',
          resolution: '720p',
        });
        return ok([{ videoId: 88, trackId: 700 }]);
      }),
    );

    await expect(
      batchGenerateTrackVideos({
        projectId,
        scriptId,
        tracks: [{ trackId: '700', storyboardId: '3', prompt: '镜头1…', durationSec: 4 }],
        model: 'm',
        mode: 'text',
        resolution: '720p',
      }),
    ).resolves.toEqual([{ videoId: '88', trackId: '700' }]);
  });
});
