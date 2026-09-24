import { useEffect, useRef, useState } from 'react';
import { App, Button, InputNumber, Modal, Tag, Typography } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { useWorkflowStep } from '../hooks/useWorkflowStep';
import { VideoPromptModal } from '../components/VideoPromptModal';
import { VideoPromptTag, VideoVersionTag } from '../components/VideoTrackTags';
import { DEFAULT_VIDEO_DURATION_SEC, VIDEO_RESOLUTION } from '../config/project';
import {
  batchGenerateTrackVideoPrompts,
  batchGenerateTrackVideos,
  deleteTrackVideo,
  deleteVideoTrack,
  fetchProject,
  fetchWorkbench,
  generateTrackVideo,
  pollVideoPromptsUntilSettled,
  pollVideosUntilSettled,
  selectTrackVideo,
  updateTrackVideoDuration,
  updateTrackVideoPrompt,
  VideoPollTimeoutError,
  VideoPromptPollTimeoutError,
} from '../lib/api';
import { errorMessage } from '../lib/errors';
import type { Project, TrackVideo, Workbench, WorkbenchTrack } from '../types/api';

/** 提示词生成轮询上限（文本模型一轨十秒级，批量时按并发拉长） */
const PROMPT_POLL_TIMEOUT_MS = 10 * 60_000;
/** 视频生成轮询上限（真实视频模型按分钟计） */
const VIDEO_POLL_TIMEOUT_MS = 15 * 60_000;
/** 进行中的静默重查间隔 */
const REFRESH_INTERVAL_MS = 3000;

/** 工作台把「从未生成」也显式标出来（分镜卡上没生成就不占位，工作台是总览） */
function trackTags(track: WorkbenchTrack) {
  return (
    <>
      {track.promptStatus === 'none' ? <Tag>提示词未生成</Tag> : <VideoPromptTag status={track.promptStatus} />}
      {track.videos.length === 0 ? <Tag>视频未生成</Tag> : <VideoVersionTag videos={track.videos} />}
    </>
  );
}

/**
 * 工作台：视频轨道总览。轨道与分镜一一对应（后端 addStoryboard 一镜一轨），
 * 页面按「轨道」组织批量生成提示词 / 批量生成视频，以及成片版本的选择与切换。
 */
export default function WorkbenchPage() {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const { id = '', episodeId = '' } = useParams();
  const { scripts } = useWorkflowStep();

  const [workbench, setWorkbench] = useState<Workbench | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [batchBusy, setBatchBusy] = useState<'prompt' | 'video' | null>(null);
  const [rowBusy, setRowBusy] = useState<Set<string>>(new Set());
  const [promptEditing, setPromptEditing] = useState<{ trackId: string; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [versionsOf, setVersionsOf] = useState<string | null>(null);

  const pollControllerRef = useRef<AbortController | null>(null);

  const load = async (signal?: AbortSignal): Promise<void> => {
    setWorkbench(await fetchWorkbench(id, episodeId, signal));
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadFailed(false);
    void Promise.all([
      load(controller.signal),
      fetchProject(id, controller.signal).then(setProject).catch(() => setProject(null)),
    ])
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setLoadFailed(true);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, episodeId]);

  useEffect(() => {
    return () => pollControllerRef.current?.abort();
  }, [id, episodeId]);

  /** 生成中：定时静默重查，状态以后端为准 */
  const busy = batchBusy != null || rowBusy.size > 0;
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => void load().catch(() => undefined), REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, id, episodeId]);

  const tracks = workbench?.tracks ?? [];
  const promptDone = tracks.filter((t) => t.promptStatus === 'done').length;
  const videoDone = tracks.filter((t) => t.videos.some((v) => v.status === 'done')).length;
  const versionsTrack = tracks.find((t) => t.id === versionsOf) ?? null;

  const withRowBusy = (trackId: string, fn: () => Promise<void>): Promise<void> => {
    setRowBusy((prev) => new Set(prev).add(trackId));
    return fn().finally(() =>
      setRowBusy((prev) => {
        const next = new Set(prev);
        next.delete(trackId);
        return next;
      }),
    );
  };

  // ===== 批量生成提示词 =====

  const onBatchPrompt = async () => {
    if (!project) {
      message.warning('项目配置尚未加载完成，请稍后再试');
      return;
    }
    // 只对还没有提示词的轨道批量生成，已有的是用户资产，不该被覆盖
    const targets = tracks.filter((t) => t.promptStatus !== 'done' && t.storyboardId);
    if (targets.length === 0) {
      message.info('所有轨道都已有提示词');
      return;
    }
    setBatchBusy('prompt');
    const controller = new AbortController();
    pollControllerRef.current = controller;
    try {
      await batchGenerateTrackVideoPrompts({
        projectId: id,
        tracks: targets.map((t) => ({ trackId: t.id, storyboardId: t.storyboardId as string })),
        model: project.videoModel,
        mode: project.mode,
      });
      message.success(`已提交 ${targets.length} 条轨道的提示词生成`);
      await pollVideoPromptsUntilSettled(
        { projectId: id, scriptId: episodeId, trackIds: targets.map((t) => t.id) },
        {
          onTick: () => void load().catch(() => undefined),
          timeoutMs: PROMPT_POLL_TIMEOUT_MS,
        },
        controller.signal,
      );
      await load();
      message.success('提示词生成完成');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (err instanceof VideoPromptPollTimeoutError) {
        message.warning('提示词仍在生成中，可稍后刷新查看（超时不代表失败）');
        await load().catch(() => undefined);
        return;
      }
      message.error(errorMessage(err, '批量生成提示词失败'));
      await load().catch(() => undefined);
    } finally {
      pollControllerRef.current = null;
      setBatchBusy(null);
    }
  };

  // ===== 批量生成视频 =====

  const onBatchVideo = async () => {
    if (!project) {
      message.warning('项目配置尚未加载完成，请稍后再试');
      return;
    }
    const targets = tracks.filter((t) => t.videoPrompt.trim() && t.storyboardId);
    if (targets.length === 0) {
      message.warning('没有可生成的轨道：先为轨道生成视频提示词');
      return;
    }
    setBatchBusy('video');
    const controller = new AbortController();
    pollControllerRef.current = controller;
    try {
      const created = await batchGenerateTrackVideos({
        projectId: id,
        scriptId: episodeId,
        tracks: targets.map((t) => ({
          trackId: t.id,
          storyboardId: t.storyboardId as string,
          prompt: t.videoPrompt,
          durationSec: t.durationSec ?? DEFAULT_VIDEO_DURATION_SEC,
        })),
        model: project.videoModel,
        mode: project.mode,
        resolution: VIDEO_RESOLUTION,
      });
      message.success(`已提交 ${created.length} 条轨道的视频生成`);
      await pollVideosUntilSettled(
        { projectId: id, scriptId: episodeId, videoIds: created.map((c) => c.videoId) },
        { onTick: () => void load().catch(() => undefined), timeoutMs: VIDEO_POLL_TIMEOUT_MS },
        controller.signal,
      );
      await load();
      const failed = (await fetchWorkbench(id, episodeId).catch(() => null))?.tracks.filter((t) =>
        t.videos.some((v) => v.status === 'failed'),
      );
      if (failed?.length) {
        message.warning(`${failed.length} 条轨道生成失败，原因见轨道行`);
      } else {
        message.success('视频生成完成');
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (err instanceof VideoPollTimeoutError) {
        message.warning('视频仍在生成中，可稍后刷新查看（超时不代表失败）');
        await load().catch(() => undefined);
        return;
      }
      message.error(errorMessage(err, '批量生成视频失败'));
      await load().catch(() => undefined);
    } finally {
      pollControllerRef.current = null;
      setBatchBusy(null);
    }
  };

  // ===== 单轨道操作 =====

  const onGenerateVideo = (track: WorkbenchTrack) =>
    withRowBusy(track.id, async () => {
      if (!project) {
        message.warning('项目配置尚未加载完成，请稍后再试');
        return;
      }
      if (!track.storyboardId) {
        message.warning('该轨道没有对应分镜，无法生成视频');
        return;
      }
      const controller = new AbortController();
      pollControllerRef.current = controller;
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
        await load().catch(() => undefined);
        await pollVideosUntilSettled(
          { projectId: id, scriptId: episodeId, videoIds: [videoId] },
          { onTick: () => void load().catch(() => undefined), timeoutMs: VIDEO_POLL_TIMEOUT_MS },
          controller.signal,
        );
        await load();
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (err instanceof VideoPollTimeoutError) {
          message.warning('视频仍在生成中，可稍后刷新查看');
          return;
        }
        message.error(errorMessage(err, '提交视频生成失败'));
      } finally {
        pollControllerRef.current = null;
      }
    });

  const onSavePrompt = async () => {
    if (!promptEditing) return;
    setSaving(true);
    try {
      await updateTrackVideoPrompt(promptEditing.trackId, promptEditing.text);
      await load();
      setPromptEditing(null);
      message.success('视频提示词已保存');
    } catch (err) {
      message.error(errorMessage(err, '保存视频提示词失败'));
    } finally {
      setSaving(false);
    }
  };

  const onSaveDuration = async (track: WorkbenchTrack, value: number | null) => {
    const duration = value ?? DEFAULT_VIDEO_DURATION_SEC;
    if (duration === track.durationSec) return;
    try {
      await updateTrackVideoDuration(track.id, duration);
      await load();
    } catch (err) {
      message.error(errorMessage(err, '保存时长失败'));
    }
  };

  const onSelectVideo = async (track: WorkbenchTrack, video: TrackVideo) => {
    try {
      await selectTrackVideo(track.id, video.id);
      await load();
      message.success('已切换到该版本');
    } catch (err) {
      message.error(errorMessage(err, '选择视频版本失败'));
    }
  };

  /**
   * 清理孤立轨道。后端 removeFrame 不删轨道（见 backendDb 的说明），
   * 删掉分镜后轨道会留下来且没有对应分镜——不清理就会无限堆积。
   * 只对孤立轨道开放这个按钮，不是通用的「新建/删除轨道」入口。
   */
  const onDeleteOrphanTrack = (track: WorkbenchTrack) => {
    modal.confirm({
      title: '删除这条孤立轨道',
      content: '它的分镜已经被删掉了，轨道本身无法再生成视频。确定删除吗？',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteVideoTrack(track.id);
          await load();
          message.success('轨道已删除');
        } catch (err) {
          message.error(errorMessage(err, '删除轨道失败'));
        }
      },
    });
  };

  const onDeleteVideo = (video: TrackVideo) => {
    modal.confirm({
      title: '删除这一版视频',
      content: '删除后无法恢复，确定删除吗？',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteTrackVideo(video.id);
          await load();
          message.success('视频版本已删除');
        } catch (err) {
          message.error(errorMessage(err, '删除视频版本失败'));
        }
      },
    });
  };

  return (
    <div className="ds-flowPage">
      <div className="ds-flowHead">
        <button
          type="button"
          className="ds-back"
          onClick={() => navigate(`/project/${id}/episode/${episodeId}`)}
        >
          ‹
        </button>
        <span className="ds-flowTitle">
          工作台 <span className="tag">{scripts?.find((s) => s.id === episodeId)?.name ?? '当前剧本'}</span>
        </span>
        <div className="right">
          <Button
            className="ds-ghost ds-pill"
            size="small"
            loading={batchBusy === 'prompt'}
            disabled={tracks.length === 0}
            onClick={() => void onBatchPrompt()}
          >
            ✨ 批量生成提示词
          </Button>
          <Button
            type="primary"
            className="ds-grad ds-pill"
            size="small"
            loading={batchBusy === 'video'}
            disabled={tracks.length === 0}
            onClick={() => void onBatchVideo()}
          >
            🎬 批量生成视频
          </Button>
        </div>
      </div>

      <div className="ds-viewInner">
        <div className="ds-wbStats">
          <div className="ds-statCard">
            <div className="nm">视频轨道</div>
            <div className="ct">{tracks.length}</div>
          </div>
          <div className="ds-statCard">
            <div className="nm">提示词已生成</div>
            <div className="ct">
              {promptDone}
              <small> / {tracks.length}</small>
            </div>
          </div>
          <div className="ds-statCard">
            <div className="nm">已有成片</div>
            <div className="ct">
              {videoDone}
              <small> / {tracks.length}</small>
            </div>
          </div>
        </div>

        <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
          当前视频模型（{project?.videoModel || '—'}）未配置 key 时生成会失败，失败原因直接展示在轨道行上，可随时重试。
        </Typography.Text>

        <div style={{ marginTop: 16 }}>
          {loading ? (
            <div className="ds-emptyBox">加载工作台…</div>
          ) : loadFailed ? (
            <div className="ds-emptyBox">
              <div style={{ fontSize: 28, marginBottom: 10 }}>⚠️</div>
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                加载工作台失败，请确认后端服务是否可用
              </Typography.Text>
              <div style={{ marginTop: 14 }}>
                <Button
                  className="ds-ghost ds-pill"
                  size="small"
                  onClick={() => {
                    setLoading(true);
                    setLoadFailed(false);
                    void load()
                      .catch(() => setLoadFailed(true))
                      .finally(() => setLoading(false));
                  }}
                >
                  重试
                </Button>
              </div>
            </div>
          ) : tracks.length === 0 ? (
            <div className="ds-emptyBox">
              <div style={{ fontSize: 28, marginBottom: 10 }}>🎞</div>
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                还没有视频轨道。回分镜工作区新建分镜，后端会为每个分镜建一条轨道。
              </Typography.Text>
              <div style={{ marginTop: 14 }}>
                <Button
                  type="primary"
                  className="ds-grad ds-pill"
                  onClick={() => navigate(`/project/${id}/episode/${episodeId}`)}
                >
                  去分镜工作区
                </Button>
              </div>
            </div>
          ) : (
            tracks.map((track) => {
              const working = rowBusy.has(track.id);
              // 已经有能用的成片时，历史失败版本只在 chip 上标「（失败）」，不再挂红框——
              // 否则挑到满意的版本后，那一行还一直红着，像还没成功一样
              const hasDone = track.videos.some((v) => v.status === 'done');
              const failedVideo = hasDone ? undefined : track.videos.find((v) => v.status === 'failed');
              const doneCount = track.videos.filter((v) => v.status === 'done').length;
              return (
                <div key={track.id} className="ds-wbRow" style={{ marginBottom: 12 }}>
                  <div className="ds-sbNo">{track.number ?? '—'}</div>
                  <div className="info">
                    <div className="desc">{track.description || '（该轨道没有对应分镜）'}</div>
                    <div className="ds-sbMeta">
                      {trackTags(track)}
                      <span className="ds-sbTag">
                        时长
                        <InputNumber
                          size="small"
                          min={1}
                          max={60}
                          value={track.durationSec ?? DEFAULT_VIDEO_DURATION_SEC}
                          onChange={(value) => void onSaveDuration(track, value)}
                          style={{ width: 62, marginLeft: 6 }}
                        />
                        s
                      </span>
                    </div>
                    {track.promptStatus === 'failed' && track.promptErrorReason ? (
                      <div className="ds-sbFail">提示词生成失败：{track.promptErrorReason}</div>
                    ) : null}
                    {failedVideo ? (
                      <div className="ds-sbFail">视频生成失败：{failedVideo.errorReason || '未知原因'}</div>
                    ) : null}
                    <div className={`ds-promptText${track.videoPrompt ? '' : ' empty'}`} style={{ marginTop: 8 }}>
                      {track.videoPrompt || '视频提示词未生成'}
                    </div>
                    {track.videos.length > 0 ? (
                      <div className="ds-wbVideos">
                        {track.videos.map((video, i) => (
                          <span
                            key={video.id}
                            className={`ds-wbVideo${track.selectedVideoId === video.id ? ' on' : ''}`}
                          >
                            第 {i + 1} 版
                            {video.status === 'running'
                              ? '（生成中）'
                              : video.status === 'failed'
                                ? '（失败）'
                                : track.selectedVideoId === video.id
                                  ? '（使用中）'
                                  : ''}
                            {doneCount > 1 && video.status === 'done' ? (
                              <Button
                                size="small"
                                type="link"
                                style={{ padding: 0, height: 'auto', fontSize: 11.5 }}
                                onClick={() => void onSelectVideo(track, video)}
                              >
                                使用
                              </Button>
                            ) : null}
                          </span>
                        ))}
                        <Button size="small" type="link" onClick={() => setVersionsOf(track.id)}>
                          管理版本
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  <div className="ops">
                    <Button
                      size="small"
                      disabled={!track.storyboardId}
                      onClick={() => setPromptEditing({ trackId: track.id, text: track.videoPrompt })}
                    >
                      改提示词
                    </Button>
                    <Button
                      size="small"
                      type="primary"
                      loading={working}
                      disabled={!track.videoPrompt.trim() || !track.storyboardId}
                      onClick={() => void onGenerateVideo(track)}
                    >
                      🎬 生成视频
                    </Button>
                    {track.storyboardId == null ? (
                      <Button size="small" danger onClick={() => onDeleteOrphanTrack(track)}>
                        删除孤立轨道
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <VideoPromptModal
        value={promptEditing?.text ?? null}
        saving={saving}
        onChange={(text) => setPromptEditing((prev) => (prev ? { ...prev, text } : prev))}
        onSave={() => void onSavePrompt()}
        onCancel={() => setPromptEditing(null)}
      />

      <Modal
        open={versionsTrack != null}
        className="ds-modal"
        title="成片版本"
        footer={null}
        onCancel={() => setVersionsOf(null)}
      >
        {versionsTrack ? (
          <>
            <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
              {versionsTrack.description || '（该轨道没有对应分镜）'}
            </Typography.Text>
            <div style={{ marginTop: 12 }}>
              {versionsTrack.videos.length === 0 ? (
                <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
                  还没有生成过视频。
                </Typography.Text>
              ) : (
                versionsTrack.videos.map((video, i) => (
                  <div key={video.id} style={{ marginBottom: 12 }}>
                    {/* 成片直接放出来播——挑版本得先看得见 */}
                    {video.url ? (
                      <video
                        src={video.url}
                        controls
                        preload="metadata"
                        aria-label={`第 ${i + 1} 版成片`}
                        style={{ width: '100%', borderRadius: 10, background: '#000' }}
                      />
                    ) : null}
                    <div
                      className={`ds-wbVideo${versionsTrack.selectedVideoId === video.id ? ' on' : ''}`}
                      style={{ width: '100%', justifyContent: 'space-between', marginTop: video.url ? 8 : 0 }}
                    >
                      <span>
                        第 {i + 1} 版 ·{' '}
                        {video.status === 'running' ? '生成中' : video.status === 'failed' ? '生成失败' : '已完成'}
                        {versionsTrack.selectedVideoId === video.id ? ' · 使用中' : ''}
                      </span>
                      <span style={{ display: 'flex', gap: 8 }}>
                        <Button
                          size="small"
                          disabled={video.status !== 'done' || versionsTrack.selectedVideoId === video.id}
                          onClick={() => void onSelectVideo(versionsTrack, video)}
                        >
                          使用这版
                        </Button>
                        <Button size="small" danger onClick={() => onDeleteVideo(video)}>
                          删除
                        </Button>
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : null}
      </Modal>
    </div>
  );
}
