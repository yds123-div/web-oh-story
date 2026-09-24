import { useEffect, useRef, useState } from 'react';
import { App, Button, InputNumber, Modal, Select, Tag, Typography } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { useWorkflowStep } from '../hooks/useWorkflowStep';
import { VideoPromptModal } from '../components/VideoPromptModal';
import { VideoPromptTag, VideoVersionTag } from '../components/VideoTrackTags';
import { DEFAULT_VIDEO_DURATION_SEC, VIDEO_RESOLUTION } from '../config/project';
import {
  createStoryboard,
  deleteStoryboard,
  deleteStoryboards,
  downloadStoryboardPreview,
  fetchProject,
  fetchWorkbench,
  generateStoryboardImages,
  generateTrackVideo,
  generateTrackVideoPrompt,
  listStoryboards,
  pollStoryboardImagesUntilSettled,
  pollVideosUntilSettled,
  previewStoryboardImages,
  StoryboardImagePollTimeoutError,
  updateStoryboard,
  updateTrackVideoPrompt,
  VideoPollTimeoutError,
} from '../lib/api';
import { errorMessage } from '../lib/errors';
import type { Project, Storyboard, Workbench, WorkbenchTrack } from '../types/api';

function formatClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** 后端无「景别/运镜」列，两者由页面拼进描述文本（原型 genPromptText 的做法） */
const SHOT_TYPES = ['远景', '全景', '中景', '近景', '特写'];
const CAMERA_MOVES = ['固定机位', '缓慢推进', '轻微手持', '横向平移', '推拉'];

function composePrompt(shotType: string, camera: string, description: string): string {
  return [shotType, camera, description.trim()].filter(Boolean).join('，');
}

/**
 * 时长防呆范围（秒）。后端 addStoryboard 只校验 `z.number()`，没有区间约束，
 * 这里仅拦住 0/负数与明显手误，不代表后端契约。
 */
const MIN_DURATION = 1;
const MAX_DURATION = 60;

/** 单张分镜图的服务端耗时是分钟级（单卡串行），轮询上限给足，超时按软失败处理 */
const IMAGE_POLL_TIMEOUT_MS = 15 * 60_000;

/** 生图/视频进行中的静默重查间隔 */
const REFRESH_INTERVAL_MS = 3000;

/** 分镜图片状态徽标（状态翻译在 API 层完成，此处只配 UI） */
function imageStateTag(status: Workbench['storyboards'][number]['status'] | undefined) {
  switch (status) {
    case 'running':
      return <Tag color="processing">图片生成中</Tag>;
    case 'done':
      return <Tag color="success">图片已生成</Tag>;
    case 'failed':
      return <Tag color="error">图片生成失败</Tag>;
    default:
      return null;
  }
}

/** 分镜卡上的视频提示词 / 视频版本徽标（与工作台共用） */
function trackTags(track: WorkbenchTrack | undefined) {
  if (!track) return null;
  return (
    <>
      <VideoPromptTag status={track.promptStatus} />
      <VideoVersionTag videos={track.videos} />
    </>
  );
}

export default function StudioPage() {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const { id = '', episodeId = '' } = useParams();
  // 门控 Provider 已拉过剧本列表，直接消费，避免重复请求
  const { scripts } = useWorkflowStep();

  const [storyboards, setStoryboards] = useState<Storyboard[]>([]);
  const [workbench, setWorkbench] = useState<Workbench | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [multiMode, setMultiMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Storyboard | null>(null);
  const [saving, setSaving] = useState(false);

  // 弹窗表单（新增用全部字段，编辑只改描述 —— 后端 editStoryboardInfo 不接受 duration）
  const [shotType, setShotType] = useState(SHOT_TYPES[2]);
  const [camera, setCamera] = useState(CAMERA_MOVES[0]);
  const [description, setDescription] = useState('');
  const [durationSec, setDurationSec] = useState(4);

  // ===== 分镜图片 =====
  const [generatingImages, setGeneratingImages] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // ===== 视频提示词 =====
  const [promptBusy, setPromptBusy] = useState<Set<string>>(new Set());
  const [promptEditing, setPromptEditing] = useState<{ trackId: string; text: string } | null>(null);

  // ===== 视频 =====
  const [videoBusy, setVideoBusy] = useState<Set<string>>(new Set());

  const imagePollControllerRef = useRef<AbortController | null>(null);
  const videoPollControllerRef = useRef<AbortController | null>(null);

  const load = async (signal?: AbortSignal): Promise<void> => {
    const data = await listStoryboards(id, episodeId, signal);
    setStoryboards(data);
    setSelected((prev) => new Set([...prev].filter((sid) => data.some((s) => s.id === sid))));
  };

  /**
   * 工作台读模型是次要数据（轨道上的提示词与视频），拉不到不该让整个页面失败——
   * 例如项目没配视频模型时后端会拒绝 getGenerateData，此时分镜本身仍然可用。
   */
  const loadWorkbench = async (signal?: AbortSignal): Promise<Workbench> => {
    const data = await fetchWorkbench(id, episodeId, signal);
    setWorkbench(data);
    return data;
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadFailed(false);
    setWorkbench(null);
    void Promise.all([
      load(controller.signal),
      loadWorkbench(controller.signal).catch(() => setWorkbench(null)),
      fetchProject(id, controller.signal).then(setProject).catch(() => setProject(null)),
    ])
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setLoadFailed(true);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
    // load 每次渲染都是新身份，仅依赖路由参数
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, episodeId]);

  // 离开页面/换剧本时终止进行中的轮询
  useEffect(() => {
    return () => {
      imagePollControllerRef.current?.abort();
      videoPollControllerRef.current?.abort();
    };
  }, [id, episodeId]);

  /** 生图/视频进行中：定时静默重查，状态以后端为准（页面不自己猜进度） */
  const busy = generatingImages || promptBusy.size > 0 || videoBusy.size > 0;
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => {
      void load().catch(() => undefined);
      void loadWorkbench().catch(() => undefined);
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, id, episodeId]);

  const totalDur = storyboards.reduce((sum, s) => sum + (s.durationSec ?? 0), 0);

  /** 图片/视频提示词操作的作用对象：批量勾选时用选中项，否则用全部分镜 */
  const targetStoryboards = multiMode && selected.size > 0
    ? storyboards.filter((s) => selected.has(s.id))
    : storyboards;

  const storyboardStateById = new Map((workbench?.storyboards ?? []).map((s) => [s.id, s]));
  const trackByStoryboardId = new Map(
    (workbench?.tracks ?? []).flatMap((t) => (t.storyboardId ? [[t.storyboardId, t] as const] : [])),
  );

  // ===== 分镜 CRUD =====

  const openCreate = () => {
    setShotType(SHOT_TYPES[2]);
    setCamera(CAMERA_MOVES[0]);
    setDescription('');
    setDurationSec(4);
    setCreating(true);
  };

  const openEdit = (storyboard: Storyboard) => {
    setDescription(storyboard.prompt);
    setEditing(storyboard);
  };

  const onCreate = async () => {
    const prompt = composePrompt(shotType, camera, description);
    if (!prompt.trim()) {
      message.warning('请填写分镜描述');
      return;
    }
    setSaving(true);
    try {
      await createStoryboard({ projectId: id, scriptId: episodeId, prompt, durationSec });
      // 重查拿后端落库的真实行（id / 缩略图 / 关联资产 / 新建的轨道）
      await Promise.all([load(), loadWorkbench().catch(() => undefined)]);
      setCreating(false);
      message.success('分镜已创建');
    } catch (err) {
      message.error(errorMessage(err, '创建分镜失败'));
    } finally {
      setSaving(false);
    }
  };

  const onSaveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await updateStoryboard({ id: editing.id, prompt: description });
      await load();
      setEditing(null);
      message.success('分镜已保存');
    } catch (err) {
      message.error(errorMessage(err, '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (storyboard: Storyboard) => {
    modal.confirm({
      title: '删除分镜',
      // 实测后端 removeFrame 不会删掉轨道（见 mocks/backendDb.ts 的说明），
      // 所以这里不能承诺「轨道一并清理」——那条轨道会变成孤立轨道，去工作台清理。
      content: '删除后无法恢复。它的视频轨道会留在工作台变成孤立轨道，可到工作台清理。确定删除吗？',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteStoryboard(storyboard.id);
          await Promise.all([load(), loadWorkbench().catch(() => undefined)]);
          message.success('分镜已删除');
        } catch (err) {
          message.error(errorMessage(err, '删除失败'));
        }
      },
    });
  };

  const onBatchDelete = () => {
    const ids = [...selected];
    if (ids.length === 0) {
      message.warning('请先勾选要删除的分镜');
      return;
    }
    modal.confirm({
      title: `删除 ${ids.length} 个分镜`,
      content: '删除后无法恢复，确定删除吗？',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteStoryboards(id, ids);
          setMultiMode(false);
          await Promise.all([load(), loadWorkbench().catch(() => undefined)]);
          message.success(`已删除 ${ids.length} 个分镜`);
        } catch (err) {
          message.error(errorMessage(err, '批量删除失败'));
        }
      },
    });
  };

  const toggleSelect = (storyboardId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(storyboardId)) {
        next.delete(storyboardId);
      } else {
        next.add(storyboardId);
      }
      return next;
    });
  };

  const exitMultiMode = () => {
    setMultiMode(false);
    setSelected(new Set());
  };

  // ===== 分镜图片：批量生成 → 轮询 → 预览 / 下载 =====

  const runImageGeneration = async (targets: Storyboard[]) => {
    if (targets.length === 0) {
      message.warning('没有可生成的分镜');
      return;
    }
    const ids = targets.map((s) => s.id);
    setGeneratingImages(true);
    const controller = new AbortController();
    imagePollControllerRef.current = controller;
    try {
      await generateStoryboardImages({ projectId: id, scriptId: episodeId, storyboardIds: ids });
      message.success(`已提交 ${ids.length} 个分镜的图片生成`);
      // 后端受理后立即返回，进度靠轮询；生成中的分镜会整行从响应里消失
      await pollStoryboardImagesUntilSettled(
        ids,
        {
          onTick: () => {
            void loadWorkbench().catch(() => undefined);
          },
          timeoutMs: IMAGE_POLL_TIMEOUT_MS,
        },
        controller.signal,
      );
      const [, after] = await Promise.all([load(), loadWorkbench()]);
      const failedCount = after.storyboards.filter(
        (s) => ids.includes(s.id) && s.status === 'failed',
      ).length;
      if (failedCount > 0) {
        // 失败原因逐条挂在卡片上（下面渲染），这里只提示总数，不弹一长串
        message.warning(`${failedCount} 个分镜生成失败，原因见卡片`);
      } else {
        message.success('分镜图片已生成');
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (err instanceof StoryboardImagePollTimeoutError) {
        message.warning('图片仍在生成中，可稍后刷新查看（超时不代表失败）');
        await Promise.all([load(), loadWorkbench().catch(() => undefined)]);
        return;
      }
      message.error(errorMessage(err, '生成图片失败'));
    } finally {
      imagePollControllerRef.current = null;
      setGeneratingImages(false);
    }
  };

  const onPreviewImages = async (targets: Storyboard[]) => {
    if (targets.length === 0) {
      message.warning('没有可分镜可预览');
      return;
    }
    setPreviewLoading(true);
    try {
      const url = await previewStoryboardImages(targets.map((s) => s.id));
      if (!url) {
        message.warning('选中的分镜还没有已生成的图片');
        return;
      }
      setPreviewUrl(url);
    } catch (err) {
      message.error(errorMessage(err, '预览失败'));
    } finally {
      setPreviewLoading(false);
    }
  };

  const onDownloadImages = async (targets: Storyboard[]) => {
    if (targets.length === 0) {
      message.warning('没有可分镜可下载');
      return;
    }
    try {
      const blob = await downloadStoryboardPreview(targets.map((s) => s.id));
      if (!blob) {
        message.warning('选中的分镜还没有已生成的图片');
        return;
      }
      // 后端回的是 PNG 附件，这里在浏览器侧触发下载
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'storyboard-preview.png';
      link.click();
      URL.revokeObjectURL(url);
      message.success('已开始下载分镜拼图');
    } catch (err) {
      message.error(errorMessage(err, '下载失败'));
    }
  };

  // ===== 视频提示词 =====

  const onGeneratePrompt = async (track: WorkbenchTrack) => {
    if (!project) {
      message.warning('项目配置尚未加载完成，请稍后再试');
      return;
    }
    setPromptBusy((prev) => new Set(prev).add(track.id));
    try {
      await generateTrackVideoPrompt({
        trackId: track.id,
        storyboardId: track.storyboardId ?? '',
        projectId: id,
        model: project.videoModel,
        mode: project.mode,
      });
      await loadWorkbench().catch(() => undefined);
      message.success('视频提示词已生成并保存');
    } catch (err) {
      await loadWorkbench().catch(() => undefined);
      message.error(errorMessage(err, '生成视频提示词失败'));
    } finally {
      setPromptBusy((prev) => {
        const next = new Set(prev);
        next.delete(track.id);
        return next;
      });
    }
  };

  const onSavePrompt = async () => {
    if (!promptEditing) return;
    setSaving(true);
    try {
      await updateTrackVideoPrompt(promptEditing.trackId, promptEditing.text);
      await loadWorkbench().catch(() => undefined);
      setPromptEditing(null);
      message.success('视频提示词已保存');
    } catch (err) {
      message.error(errorMessage(err, '保存视频提示词失败'));
    } finally {
      setSaving(false);
    }
  };

  // ===== 视频生成 =====

  const onGenerateVideo = async (track: WorkbenchTrack) => {
    if (!project) {
      message.warning('项目配置尚未加载完成，请稍后再试');
      return;
    }
    if (!track.videoPrompt.trim()) {
      message.warning('请先生成视频提示词');
      return;
    }
    if (!track.storyboardId) {
      message.warning('该轨道没有对应分镜，无法生成视频');
      return;
    }
    setVideoBusy((prev) => new Set(prev).add(track.id));
    const controller = new AbortController();
    videoPollControllerRef.current = controller;
    try {
      const videoId = await generateTrackVideo({
        projectId: id,
        scriptId: episodeId,
        trackId: track.id,
        storyboardId: track.storyboardId,
        prompt: track.videoPrompt,
        model: project.videoModel,
        mode: project.mode,
        resolution: VIDEO_RESOLUTION,
        durationSec: track.durationSec ?? DEFAULT_VIDEO_DURATION_SEC,
      });
      await loadWorkbench().catch(() => undefined);
      // 视频生成是异步的：轮询到终态才知道成功还是失败（无视频 key 时必失败）
      await pollVideosUntilSettled(
        { projectId: id, scriptId: episodeId, videoIds: [videoId] },
        { onTick: () => void loadWorkbench().catch(() => undefined) },
        controller.signal,
      );
      await loadWorkbench().catch(() => undefined);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (err instanceof VideoPollTimeoutError) {
        message.warning('视频仍在生成中，可稍后刷新查看（超时不代表失败）');
        return;
      }
      message.error(errorMessage(err, '提交视频生成失败'));
    } finally {
      videoPollControllerRef.current = null;
      setVideoBusy((prev) => {
        const next = new Set(prev);
        next.delete(track.id);
        return next;
      });
    }
  };

  return (
    <div className="ds-studioPage">
      <div className="ds-studioHead">
        <button type="button" className="ds-back" onClick={() => navigate(`/project/${id}/episodes`)}>
          ‹
        </button>
        <div className="ds-selBox">
          <Select
            size="small"
            value={episodeId}
            onChange={(value) => navigate(`/project/${id}/episode/${value}`)}
            options={(scripts ?? []).map((script) => ({ value: script.id, label: script.name }))}
            style={{ minWidth: 200 }}
          />
        </div>
        <span className="st">
          总分镜数：<b>{storyboards.length}</b> ｜ 总时长：<b>{formatClock(totalDur)}</b>
        </span>
        <div className="right">
          <Button
            className="ds-ghost ds-pill"
            size="small"
            loading={previewLoading}
            onClick={() => void onPreviewImages(targetStoryboards)}
          >
            🔍 预览拼图（{targetStoryboards.length}）
          </Button>
          <Button
            className="ds-ghost ds-pill"
            size="small"
            onClick={() => void onDownloadImages(targetStoryboards)}
          >
            ⬇ 下载拼图
          </Button>
          <Button
            type="primary"
            className="ds-grad ds-pill"
            size="small"
            loading={generatingImages}
            disabled={storyboards.length === 0}
            onClick={() => void runImageGeneration(targetStoryboards)}
          >
            🖼 生成图片（{targetStoryboards.length}）
          </Button>
          <Button
            className="ds-ghost ds-pill"
            size="small"
            disabled={storyboards.length === 0}
            onClick={() =>
              void runImageGeneration(
                targetStoryboards.filter((s) => storyboardStateById.get(s.id)?.status !== 'done'),
              )
            }
          >
            只补未出图的
          </Button>
          <Button
            className="ds-ghost ds-pill"
            size="small"
            onClick={() => (multiMode ? exitMultiMode() : setMultiMode(true))}
          >
            {multiMode ? `退出批量（已选 ${selected.size}）` : '批量操作'}
          </Button>
          {multiMode ? (
            <Button danger size="small" onClick={onBatchDelete}>
              删除选中
            </Button>
          ) : null}
          <Button
            className="ds-ghost ds-pill"
            size="small"
            onClick={() => navigate(`/project/${id}/episode/${episodeId}/bench`)}
          >
            进入工作台 →
          </Button>
          <Button type="primary" className="ds-grad ds-pill" size="small" onClick={openCreate}>
            ＋ 新建分镜
          </Button>
        </div>
      </div>

      <div className="ds-sbNotice">
        <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
          当前图像模型（{project?.imageModel || '—'}）不支持参考图，分镜画面按描述文生图，不会沿用资产形象。
        </Typography.Text>
      </div>

      <div className="ds-sbList">
        {loading ? (
          <div className="ds-emptyBox">加载分镜…</div>
        ) : loadFailed ? (
          <div className="ds-emptyBox">
            <div style={{ fontSize: 28, marginBottom: 10 }}>⚠️</div>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              加载分镜失败，请确认后端服务是否可用
            </Typography.Text>
            <div style={{ marginTop: 14 }}>
              <Button
                className="ds-ghost ds-pill"
                size="small"
                onClick={() => {
                  setLoading(true);
                  setLoadFailed(false);
                  void Promise.all([load(), loadWorkbench().catch(() => undefined)])
                    .catch(() => setLoadFailed(true))
                    .finally(() => setLoading(false));
                }}
              >
                重试
              </Button>
            </div>
          </div>
        ) : storyboards.length === 0 ? (
          <div className="ds-emptyBox">
            <div style={{ fontSize: 28, marginBottom: 10 }}>🎬</div>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              这个剧本还没有分镜。新建一个分镜开始编排。
            </Typography.Text>
            <div style={{ marginTop: 14 }}>
              <Button type="primary" className="ds-grad ds-pill" onClick={openCreate}>
                ＋ 新建分镜
              </Button>
            </div>
          </div>
        ) : (
          storyboards.map((storyboard, index) => {
            const imageState = storyboardStateById.get(storyboard.id);
            const track = trackByStoryboardId.get(storyboard.id);
            const promptWorking = track != null && promptBusy.has(track.id);
            const videoWorking = track != null && videoBusy.has(track.id);
            return (
              <div key={storyboard.id} className="ds-sbCard">
                {multiMode ? (
                  <input
                    type="checkbox"
                    className="ds-sbChk"
                    aria-label={`选择分镜 ${index + 1}`}
                    checked={selected.has(storyboard.id)}
                    onChange={() => toggleSelect(storyboard.id)}
                  />
                ) : null}
                <div className="ds-sbNo">{index + 1}</div>
                <div className="ds-sbThumb">
                  {storyboard.imageUrl ? (
                    <img src={storyboard.imageUrl} alt={`分镜 ${index + 1}`} />
                  ) : (
                    <span className="em">⬚</span>
                  )}
                </div>
                <div className="ds-sbBody">
                  <div className="ds-sbPrompt">{storyboard.prompt || '（无描述）'}</div>
                  <div className="ds-sbMeta">
                    <span className="ds-sbTag">⏱ {storyboard.durationSec ?? '—'}s</span>
                    {imageStateTag(imageState?.status)}
                    {trackTags(track)}
                    {storyboard.characters.map((character) => (
                      <span
                        key={character.name}
                        className={`ds-refChip ${character.type === 'scene' ? 'scene' : 'role'}`}
                      >
                        <span className="th">
                          {character.avatarUrl ? (
                            <img src={character.avatarUrl} alt="" />
                          ) : (
                            character.name.slice(0, 1)
                          )}
                        </span>
                        {character.name}
                      </span>
                    ))}
                    {storyboard.characters.length === 0 ? (
                      <span className="ds-sbTag muted">未关联资产</span>
                    ) : null}
                  </div>
                  {/* 失败原因逐条展示 + 可重试（工单：原因清晰、可重试、不阻塞页面） */}
                  {imageState?.status === 'failed' && imageState.errorReason ? (
                    <div className="ds-sbFail">生图失败：{imageState.errorReason}</div>
                  ) : null}
                  {track?.promptStatus === 'failed' && track.promptErrorReason ? (
                    <div className="ds-sbFail">提示词生成失败：{track.promptErrorReason}</div>
                  ) : null}
                  {track && track.videos.some((v) => v.status === 'failed') ? (
                    <div className="ds-sbFail">
                      视频生成失败：
                      {track.videos.find((v) => v.status === 'failed')?.errorReason || '未知原因'}
                    </div>
                  ) : null}
                  {track ? (
                    <div className="ds-promptBox">
                      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                        视频提示词
                      </Typography.Text>
                      <div className={`ds-promptText${track.videoPrompt ? '' : ' empty'}`}>
                        {track.videoPrompt || '未生成（由文本 AI 根据分镜描述撰写）'}
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="ds-sbOps">
                  {track ? (
                    <>
                      <Button
                        size="small"
                        loading={promptWorking}
                        onClick={() => void onGeneratePrompt(track)}
                      >
                        {track.promptStatus === 'none' ? '✨ 生成提示词' : '重新生成提示词'}
                      </Button>
                      <Button
                        size="small"
                        disabled={!track.videoPrompt}
                        onClick={() => setPromptEditing({ trackId: track.id, text: track.videoPrompt })}
                      >
                        改提示词
                      </Button>
                      <Button
                        size="small"
                        loading={videoWorking}
                        disabled={!track.videoPrompt}
                        onClick={() => void onGenerateVideo(track)}
                      >
                        🎬 生成视频
                      </Button>
                    </>
                  ) : null}
                  {imageState?.status === 'failed' ? (
                    <Button size="small" onClick={() => void runImageGeneration([storyboard])}>
                      重试生图
                    </Button>
                  ) : null}
                  <Button size="small" onClick={() => openEdit(storyboard)}>
                    ✏️ 编辑
                  </Button>
                  <Button size="small" danger onClick={() => onDelete(storyboard)}>
                    删除
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Modal
        open={creating}
        className="ds-modal"
        title="＋ 新建分镜"
        okText="创建"
        cancelText="取消"
        confirmLoading={saving}
        onOk={() => void onCreate()}
        onCancel={() => setCreating(false)}
      >
        <div className="ds-fRow ds-f2">
          <div>
            <label>景别</label>
            <Select
              size="small"
              value={shotType}
              onChange={setShotType}
              options={SHOT_TYPES.map((v) => ({ value: v, label: v }))}
              style={{ minWidth: 110 }}
            />
          </div>
          <div>
            <label>运镜</label>
            <Select
              size="small"
              value={camera}
              onChange={setCamera}
              options={CAMERA_MOVES.map((v) => ({ value: v, label: v }))}
              style={{ minWidth: 110 }}
            />
          </div>
        </div>
        <div className="ds-fRow">
          <label>描述</label>
          <textarea
            className="ds-gpText"
            rows={3}
            value={description}
            placeholder="画面内容，如：林晚独自伫立，月光透过木窗洒下"
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="ds-fRow">
          <label>时长（秒）</label>
          <InputNumber
            size="small"
            min={MIN_DURATION}
            max={MAX_DURATION}
            step={1}
            value={durationSec}
            onChange={(value) => setDurationSec(value ?? MIN_DURATION)}
          />
        </div>
        <div className="ds-sbPreview">
          <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
            将保存的描述（景别 / 运镜拼入文本，后端无独立字段）：
          </Typography.Text>
          <div className="ds-promptText">{composePrompt(shotType, camera, description) || '—'}</div>
        </div>
      </Modal>

      <Modal
        open={editing != null}
        className="ds-modal"
        title="✏️ 编辑分镜"
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
        onOk={() => void onSaveEdit()}
        onCancel={() => setEditing(null)}
      >
        <div className="ds-fRow">
          <label>描述</label>
          <textarea
            className="ds-gpText"
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
          后端只开放描述与视频描述的修改，时长在创建时确定。
        </Typography.Text>
      </Modal>

      <VideoPromptModal
        value={promptEditing?.text ?? null}
        saving={saving}
        onChange={(text) => setPromptEditing((prev) => (prev ? { ...prev, text } : prev))}
        onSave={() => void onSavePrompt()}
        onCancel={() => setPromptEditing(null)}
      />

      <Modal
        open={previewUrl != null}
        className="ds-modal"
        title="分镜拼图预览"
        footer={null}
        width={720}
        onCancel={() => setPreviewUrl(null)}
      >
        {previewUrl ? (
          <img src={previewUrl} alt="分镜拼图预览" style={{ width: '100%', borderRadius: 10 }} />
        ) : null}
      </Modal>
    </div>
  );
}
