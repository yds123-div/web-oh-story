import { useEffect, useState } from 'react';
import { App, Button, InputNumber, Modal, Select, Typography } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { useWorkflowStep } from '../hooks/useWorkflowStep';
import {
  createStoryboard,
  deleteStoryboard,
  deleteStoryboards,
  listStoryboards,
  updateStoryboard,
} from '../lib/api';
import { errorMessage } from '../lib/errors';
import type { Storyboard } from '../types/api';

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

export default function StudioPage() {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const { id = '', episodeId = '' } = useParams();
  // 门控 Provider 已拉过剧本列表，直接消费，避免重复请求
  const { scripts } = useWorkflowStep();

  const [storyboards, setStoryboards] = useState<Storyboard[]>([]);
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

  const load = async (signal?: AbortSignal): Promise<void> => {
    const data = await listStoryboards(id, episodeId, signal);
    setStoryboards(data);
    setSelected((prev) => new Set([...prev].filter((sid) => data.some((s) => s.id === sid))));
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadFailed(false);
    void load(controller.signal)
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setLoadFailed(true);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
    // load 每次渲染都是新身份，仅依赖路由参数
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, episodeId]);

  const totalDur = storyboards.reduce((sum, s) => sum + (s.durationSec ?? 0), 0);

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
      // 重查拿后端落库的真实行（id / 缩略图 / 关联资产）
      await load();
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
      content: '删除后无法恢复（该分镜的视频轨道将一并清理），确定删除吗？',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteStoryboard(storyboard.id);
          await load();
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
          await load();
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
            onClick={() => (multiMode ? exitMultiMode() : setMultiMode(true))}
          >
            {multiMode ? `退出批量（已选 ${selected.size}）` : '批量操作'}
          </Button>
          {multiMode ? (
            <Button danger size="small" onClick={onBatchDelete}>
              删除选中
            </Button>
          ) : null}
          <Button type="primary" className="ds-grad ds-pill" size="small" onClick={openCreate}>
            ＋ 新建分镜
          </Button>
        </div>
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
                  void load()
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
          storyboards.map((storyboard, index) => (
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
              </div>
              <div className="ds-sbOps">
                <Button size="small" onClick={() => openEdit(storyboard)}>
                  ✏️ 编辑
                </Button>
                <Button size="small" danger onClick={() => onDelete(storyboard)}>
                  删除
                </Button>
              </div>
            </div>
          ))
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
    </div>
  );
}
