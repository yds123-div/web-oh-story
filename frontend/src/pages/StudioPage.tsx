import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { App, Button, Modal, Progress, Select } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { useTask } from '../hooks/useTask';
import {
  getEpisode,
  listAssets,
  listModels,
  listSegments,
  patchSegment,
  submitEpisodeExportTask,
  submitSegmentVideoTask,
} from '../lib/api';
import { assetPreviewUrl } from '../lib/assets';
import { generationCost } from '../lib/generationCost';
import { insertAssetMention, parsePromptParts } from '../lib/promptMentions';
import type { Asset, Episode, Model, ModelId, Segment, Shot } from '../types/api';

function formatClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function chipClass(asset: Asset | undefined): string {
  if (asset?.type === 'scene') return 'scene';
  return 'role';
}

function MentionChip({ asset, assetId }: { asset: Asset | undefined; assetId: string }) {
  const thumb = asset ? assetPreviewUrl(asset) : null;
  return (
    <span className={`ds-refChip ${chipClass(asset)}`}>
      <span className="th">
        {thumb ? <img src={thumb} alt="" /> : (asset?.emoji ?? assetId.slice(-1))}
      </span>
      {asset?.name ?? assetId}
    </span>
  );
}

function PromptView({ prompt, assets }: { prompt: string; assets: Asset[] }) {
  const byId = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  return (
    <div className="ds-promptText">
      {parsePromptParts(prompt).map((part, i) =>
        part.kind === 'mention' ? (
          <MentionChip key={`${part.assetId}-${i}`} asset={byId.get(part.assetId)} assetId={part.assetId} />
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </div>
  );
}

export default function StudioPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id = '', episodeId = '' } = useParams();
  const videoRef = useRef<HTMLVideoElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  const [episode, setEpisode] = useState<Episode | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [cur, setCur] = useState(0);
  const [model, setModel] = useState<ModelId>('seedance-2.5');
  const [editing, setEditing] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState('');
  const [openShot, setOpenShot] = useState<string | null>(null);
  const [draftShots, setDraftShots] = useState<Shot[]>([]);
  const [saving, setSaving] = useState(false);
  const [genTaskId, setGenTaskId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportTaskId, setExportTaskId] = useState<string | null>(null);
  const [download, setDownload] = useState<{ url: string; name: string } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [cursor, setCursor] = useState(0);

  const segment = segments[cur];
  const totalDur = segments.reduce((a, s) => a + s.durationSec, 0);
  const cost = generationCost(segment?.generated ?? false);

  const { task: genTask } = useTask(genTaskId, {
    intervalMs: 2500,
    onSucceeded: async () => {
      const data = await listSegments(episodeId);
      setSegments(data.segments);
      setGenTaskId(null);
      message.success('片段视频已生成');
    },
    onFailed: (t) => message.error(t.error ?? '生成失败'),
  });

  const { task: exportTask } = useTask(exportTaskId, {
    intervalMs: 2500,
    onSucceeded: (t) => {
      const result = t.result as { downloadUrl?: string; fileName?: string } | undefined;
      if (result?.downloadUrl && result.fileName) {
        setDownload({ url: result.downloadUrl, name: result.fileName });
      }
      setExportTaskId(null);
    },
    onFailed: (t) => message.error(t.error ?? '合成失败'),
  });

  const generating = genTask != null && genTask.status !== 'failed' && genTask.status !== 'succeeded';
  const exporting = exportTask != null && exportTask.status !== 'failed' && exportTask.status !== 'succeeded';

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      const [ep, segs, assetData, modelData] = await Promise.all([
        getEpisode(episodeId),
        listSegments(episodeId),
        listAssets(id),
        listModels(),
      ]);
      if (cancelled) return;
      setEpisode(ep);
      setSegments(segs.segments);
      setAssets(assetData.assets);
      setModels(modelData.models);
      if (modelData.models[0]) setModel(modelData.models[0].id);
    };
    void boot().catch(() => {
      if (!cancelled) message.error('加载片段编辑器失败');
    });
    return () => {
      cancelled = true;
    };
  }, [episodeId, id, message]);

  useEffect(() => {
    if (!segment) return;
    setDraftPrompt(segment.prompt);
    setDraftShots(segment.shots.map((s) => ({ ...s })));
    setEditing(false);
    setOpenShot(null);
    setPlaying(false);
    setCurrentTime(0);
    const vid = videoRef.current;
    if (vid) {
      vid.pause();
      vid.currentTime = 0;
    }
  }, [segment?.id]);

  const mentionOpen = editing && draftPrompt.slice(0, cursor).endsWith('@');

  const grouped = useMemo(
    () => ({
      character: assets.filter((a) => a.type === 'character'),
      scene: assets.filter((a) => a.type === 'scene'),
      prop: assets.filter((a) => a.type === 'prop'),
      material: assets.filter((a) => a.type === 'material'),
    }),
    [assets],
  );

  const insertAsset = (asset: Asset) => {
    const at = promptRef.current?.selectionStart ?? cursor;
    const next = insertAssetMention(editing ? draftPrompt : (segment?.prompt ?? ''), at, asset.id);
    setDraftPrompt(next.prompt);
    setCursor(next.cursor);
    setEditing(true);
    requestAnimationFrame(() => {
      const el = promptRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(next.cursor, next.cursor);
    });
    message.success(`已引用：${asset.name}`);
  };

  const saveSegment = async () => {
    if (!segment) return;
    setSaving(true);
    try {
      const updated = await patchSegment(segment.id, { prompt: draftPrompt, shots: draftShots });
      setSegments((list) => list.map((s) => (s.id === updated.id ? updated : s)));
      setEditing(false);
      message.success('分镜已保存');
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const onGenerate = async () => {
    if (!segment) return;
    if (editing) await saveSegment();
    try {
      const { taskId } = await submitSegmentVideoTask(segment.id, { model });
      setGenTaskId(taskId);
    } catch {
      message.error('提交生成任务失败');
    }
  };

  const onExport = async () => {
    setDownload(null);
    try {
      const { taskId } = await submitEpisodeExportTask(episodeId, { resolution: '720P', format: 'MP4' });
      setExportTaskId(taskId);
    } catch {
      message.error('提交合成任务失败');
    }
  };

  const togglePlay = () => {
    const vid = videoRef.current;
    if (!segment?.generated || !vid) {
      message.info('当前片段尚未生成，请先点击「生成」');
      return;
    }
    if (playing) {
      vid.pause();
      setPlaying(false);
    } else {
      void vid.play();
      setPlaying(true);
    }
  };

  const seek = (event: MouseEvent<HTMLDivElement>) => {
    const vid = videoRef.current;
    if (!segment?.generated || !vid) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    vid.currentTime = p * (vid.duration || segment.durationSec);
    setCurrentTime(vid.currentTime);
  };

  if (!episode || !segment) {
    return <div style={{ padding: 32, color: 'var(--ant-color-text-tertiary)' }}>加载片段…</div>;
  }

  if (episode.status !== 'split') {
    return (
      <div style={{ padding: 32 }}>
        <p>第{episode.number}集为草稿，待导演智能体拆分后进入编辑。</p>
        <Button className="ds-ghost ds-pill" onClick={() => navigate(`/project/${id}/episodes`)}>
          返回分集
        </Button>
      </div>
    );
  }

  const elapsed = segments.slice(0, cur).reduce((a, s) => a + s.durationSec, 0) + Math.min(currentTime, segment.durationSec);

  return (
    <div className="ds-studioPage">
      <div className="ds-studioHead">
        <button type="button" className="ds-back" onClick={() => navigate(`/project/${id}/episodes`)}>
          ‹
        </button>
        <div className="ds-selBox">
          集：<b>第{episode.number}集 · {episode.title}</b>
        </div>
        <span className="st">
          总片段数：<b>{segments.length}</b> ｜ 总时长：<b>{formatClock(totalDur)}</b>
        </span>
        <div className="right">
          <Select
            size="small"
            value={model}
            onChange={setModel}
            options={models.map((m) => ({ value: m.id, label: m.name }))}
            style={{ minWidth: 160 }}
          />
          <Button className="ds-ghost ds-pill" size="small" onClick={() => setExportOpen(true)}>
            ⬇ 合成
          </Button>
        </div>
      </div>

      <div className="ds-studioBody">
        <aside className="ds-libCol">
          <div className="h">资产库</div>
          {(['character', 'scene', 'prop', 'material'] as const).map((type) => (
            <div key={type}>
              <div className="ds-libSec">
                {type === 'character' ? '角色' : type === 'scene' ? '场景' : type === 'prop' ? '道具' : '素材'}
                <span>{grouped[type].length}</span>
              </div>
              {grouped[type].length === 0 ? (
                <div className="ds-libEmpty">暂无{type === 'prop' ? '道具' : '素材'}</div>
              ) : (
                grouped[type].map((asset) => {
                  const thumb = assetPreviewUrl(asset);
                  return (
                  <button key={asset.id} type="button" className="ds-libCard" onClick={() => insertAsset(asset)}>
                    <div className={`im${asset.type === 'scene' ? ' wide' : ''}`}>
                      {thumb ? <img src={thumb} alt={asset.name} /> : <span className="em">{asset.emoji ?? '⬚'}</span>}
                    </div>
                    <div className="nm">{asset.name}</div>
                  </button>
                  );
                })
              )}
            </div>
          ))}
        </aside>

        <div className="ds-editCol">
          <div className="ds-segTabs">
            {segments.map((s, i) => (
              <button key={s.id} type="button" className={`ds-segTab${i === cur ? ' on' : ''}`} onClick={() => setCur(i)}>
                片段 {s.no} · {s.durationSec}s
              </button>
            ))}
          </div>
          <div className="ds-editTip">
            片段时长请限制在 <b>4-15s</b>，输入 <b>@</b> 可引用角色、场景、素材
          </div>
          <div className="ds-promptBox">
            <div className="pbh">
              <h4>
                片段 {segment.no} · {segment.title}
              </h4>
              <span className={`ds-status ${segment.generated ? 'ok' : 'no'}`}>
                <i className="ds-dot" />
                {segment.generated ? '已生成' : '未生成'}
              </span>
              <span className="cnt">
                {editing ? draftPrompt.length : segment.charCount} / 9000
              </span>
              <Button size="small" className="ds-ghost ds-pill" onClick={() => (editing ? void saveSegment() : setEditing(true))} loading={saving}>
                {editing ? '保存分镜' : '编辑提示词'}
              </Button>
              <button type="button" className="ds-genBtn" disabled={generating} onClick={() => void onGenerate()}>
                {segment.generated ? '再次生成' : '生成'} <span className="fee">◆{cost}</span>
              </button>
            </div>
            {editing ? (
              <div className="ds-promptEditWrap">
                <textarea
                  ref={promptRef}
                  className="ds-promptEdit"
                  value={draftPrompt}
                  onChange={(e) => {
                    setDraftPrompt(e.target.value);
                    setCursor(e.target.selectionStart);
                  }}
                  onSelect={(e) => setCursor(e.currentTarget.selectionStart)}
                  spellCheck={false}
                />
                {mentionOpen ? (
                  <div className="ds-mentionMenu">
                    {assets.map((asset) => (
                      <button key={asset.id} type="button" onClick={() => insertAsset(asset)}>
                        <MentionChip asset={asset} assetId={asset.id} />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <PromptView prompt={segment.prompt} assets={assets} />
            )}
            {generating ? (
              <div className="ds-progWrap">
                <Progress percent={genTask?.progress ?? 0} strokeColor={{ from: '#8b5cf6', to: '#6366f1' }} />
                <div className="progTxt">
                  {genTask?.status === 'pending' ? '排队中…' : `生成中… 模型 ${models.find((m) => m.id === model)?.name ?? model}`}
                </div>
              </div>
            ) : null}
            <div className="ds-shotList">
              <div className="ds-editTip" style={{ margin: '0 0 8px' }}>
                分镜详情（时长 / 景别 / 运镜 / 表演 / 台词 / 语音标注）
              </div>
              {draftShots.map((shot, idx) => {
                const open = openShot === shot.id;
                return (
                  <div key={shot.id} className={`ds-shotItem${open ? ' open' : ''}`}>
                    <button type="button" className="shotTop" onClick={() => setOpenShot(open ? null : shot.id)}>
                      <span className="shotId">{shot.id}</span>
                      <span className="shotDur">{shot.durationSec.toFixed(1)}s</span>
                      <span className="shotKind">{shot.camera ? `${shot.shotType} · ${shot.camera}` : shot.shotType}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--ant-color-text-tertiary)' }}>
                        {open ? '收起' : '点击展开'}
                      </span>
                    </button>
                    {open ? (
                      <div className="shotBody">
                        <label>
                          时长（秒）
                          <input
                            type="number"
                            min={1}
                            max={15}
                            step={0.5}
                            value={shot.durationSec}
                            onChange={(e) => {
                              const next = [...draftShots];
                              next[idx] = { ...shot, durationSec: Number(e.target.value) };
                              setDraftShots(next);
                            }}
                          />
                        </label>
                        <label>
                          景别
                          <input
                            value={shot.shotType}
                            onChange={(e) => {
                              const next = [...draftShots];
                              next[idx] = { ...shot, shotType: e.target.value };
                              setDraftShots(next);
                            }}
                          />
                        </label>
                        <label>
                          运镜
                          <input
                            value={shot.camera}
                            onChange={(e) => {
                              const next = [...draftShots];
                              next[idx] = { ...shot, camera: e.target.value };
                              setDraftShots(next);
                            }}
                          />
                        </label>
                        <label>
                          表演
                          <textarea
                            value={shot.action}
                            onChange={(e) => {
                              const next = [...draftShots];
                              next[idx] = { ...shot, action: e.target.value };
                              setDraftShots(next);
                            }}
                          />
                        </label>
                        <label>
                          台词
                          <textarea
                            value={shot.line}
                            onChange={(e) => {
                              const next = [...draftShots];
                              next[idx] = { ...shot, line: e.target.value };
                              setDraftShots(next);
                            }}
                          />
                        </label>
                        <label>
                          语音标注
                          <input
                            value={shot.voice}
                            onChange={(e) => {
                              const next = [...draftShots];
                              next[idx] = { ...shot, voice: e.target.value };
                              setDraftShots(next);
                            }}
                          />
                        </label>
                        {shot.speaker ? <div className="shotLine"><span className="who">{shot.speaker}：</span>{shot.line}</div> : null}
                      </div>
                    ) : (
                      <div className="shotActPreview">{shot.action}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <aside className="ds-prevCol">
          <div className="ds-prevPanel">
            <div className="ds-prevBox">
              {segment.generated && segment.videoUrl ? (
                <video
                  ref={videoRef}
                  src={segment.videoUrl}
                  poster="/demo-assets/corridor.jpg"
                  playsInline
                  onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                  onEnded={() => setPlaying(false)}
                />
              ) : (
                <div className="empty">
                  <div className="hex">▶</div>
                  当前片段视频尚未生成
                  <br />
                  <span style={{ fontSize: 10.5, opacity: 0.7 }}>点击左上「生成」开始创建</span>
                </div>
              )}
            </div>
            <div className="ds-prevBar">
              <button type="button" className="playBtn" onClick={togglePlay}>
                {playing ? '⏸' : '▶'}
              </button>
              <div className="pBar" onClick={seek}>
                <i style={{ width: `${Math.min(100, (currentTime / (segment.durationSec || 1)) * 100)}%` }} />
              </div>
              <span>
                {formatClock(currentTime)} / {formatClock(segment.durationSec)}
              </span>
            </div>
            <div className="ds-prevMeta">
              <span>9:16 · 720P</span>
              <span>
                片段 {segment.no} · {segment.generated ? '真实生成结果' : '尚未生成'}
              </span>
            </div>
          </div>
        </aside>
      </div>

      <div className="ds-tlBar">
        <button type="button" className="tlPlay" onClick={togglePlay}>
          {playing ? '⏸' : '▶'}
        </button>
        <span className="tlTime">
          {formatClock(elapsed)} / {formatClock(totalDur)}
        </span>
        <div className="tlClips">
          {segments.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={`tlClip${i === cur ? ' sel' : ''}${s.generated ? '' : ' emptyC'}`}
              onClick={() => setCur(i)}
            >
              <div className="im">
                {s.generated && s.videoUrl ? (
                  <>
                    <video src={`${s.videoUrl}#t=1`} muted playsInline preload="metadata" />
                    <span className="resTag">480P</span>
                  </>
                ) : (
                  <span className="no">{s.no}</span>
                )}
              </div>
              <div className="ft">
                <span className="st">
                  <i />
                  {s.generated ? '已生成' : '未生成'}
                </span>
                <span className="du">{formatClock(s.durationSec)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <Modal
        open={exportOpen}
        className="ds-modal"
        title="⬇ 合成 / 导出"
        onCancel={() => {
          if (!exporting) setExportOpen(false);
        }}
        footer={
          download
            ? [
                <Button key="close" className="ds-ghost ds-pill" onClick={() => setExportOpen(false)}>
                  关闭
                </Button>,
                <Button
                  key="dl"
                  type="primary"
                  className="ds-grad ds-pill"
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = download.url;
                    a.download = download.name;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                  }}
                >
                  下载成片
                </Button>,
              ]
            : [
                <Button key="cancel" className="ds-ghost ds-pill" disabled={exporting} onClick={() => setExportOpen(false)}>
                  取消
                </Button>,
                <Button key="go" type="primary" className="ds-grad ds-pill" loading={exporting} onClick={() => void onExport()}>
                  开始合成
                </Button>,
              ]
        }
      >
        <div className="ds-fRow">
          <label>导出范围</label>
          <div>整集（片段 1-{segments.length} · {formatClock(totalDur)}）</div>
        </div>
        <div className="ds-fRow">
          <label>分辨率 / 格式</label>
          <div>720P · MP4</div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--ant-color-text-tertiary)', marginBottom: 12 }}>
          合成消耗按片段时长计费；未生成片段将自动跳过
        </div>
        {exporting || exportTask ? (
          <div>
            <Progress percent={exportTask?.progress ?? 0} strokeColor={{ from: '#8b5cf6', to: '#6366f1' }} />
            <div style={{ fontSize: 12, color: 'var(--ant-color-text-tertiary)', textAlign: 'center' }}>
              {exportTask?.status === 'pending' && '已加入合成队列…'}
              {exportTask?.status === 'running' && '正在拼接成片…'}
              {exportTask?.status === 'succeeded' && '✓ 合成完成'}
            </div>
          </div>
        ) : null}
        {download ? (
          <div style={{ fontSize: 12, color: '#4ecf8d', marginTop: 8 }}>✓ 成片已就绪：{download.name}</div>
        ) : null}
      </Modal>
    </div>
  );
}
