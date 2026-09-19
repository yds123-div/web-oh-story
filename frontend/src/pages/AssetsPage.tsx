import { useEffect, useMemo, useState } from 'react';
import { App, Button, Progress, Switch } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { WorkflowHeader } from '../components/WorkflowHeader';
import { useTask } from '../hooks/useTask';
import { completeAssets, getOutline, getWorkflow, listAssets, patchAsset, submitAssetImageTask } from '../lib/api';
import { countAssetsByType, filterAssetsByType } from '../lib/assets';
import { useWorkflowStore } from '../stores/workflowStore';
import type { Asset, AssetType } from '../types/api';

function roleTagClass(role: string): string {
  if (role === '反派') return 'red';
  if (role === '男二' || role === '场景') return 'gray';
  return '';
}

function AssetCard({
  asset,
  onUpdated,
}: {
  asset: Asset;
  onUpdated: (next: Asset) => void;
}) {
  const { message } = App.useApp();
  const [taskId, setTaskId] = useState<string | null>(null);
  const [locking, setLocking] = useState(false);

  const { task } = useTask(taskId, {
    intervalMs: 2500,
    onSucceeded: async () => {
      const { assets } = await listAssets(asset.projectId);
      const next = assets.find((item) => item.id === asset.id);
      if (next) onUpdated(next);
      setTaskId(null);
    },
    onFailed: (t) => message.error(t.error ?? '生图失败'),
  });

  const generating = task != null && task.status !== 'failed' && task.status !== 'succeeded';

  const onGenerate = async () => {
    try {
      const { taskId: id } = await submitAssetImageTask(asset.id);
      setTaskId(id);
    } catch {
      message.error('提交生图任务失败');
    }
  };

  const onLock = async (checked: boolean) => {
    setLocking(true);
    try {
      const next = await patchAsset(asset.id, { consistencyLocked: checked });
      onUpdated(next);
    } catch {
      message.error('更新锁定状态失败');
    } finally {
      setLocking(false);
    }
  };

  return (
    <div className={`ds-charCard${asset.type === 'scene' ? ' wide' : ''}`}>
      <div className="img">
        {asset.imageUrl ? (
          <img src={asset.imageUrl} alt={asset.name} />
        ) : generating ? (
          <div className="ds-loadingPh">
            <div className="sp" />
            <div className="t">形象生成中 {task?.progress ?? 0}%</div>
            <Progress percent={task?.progress ?? 0} showInfo={false} size={['70%', 6]} strokeColor="#8b5cf6" />
          </div>
        ) : (
          <div className="ds-phEmoji">{asset.emoji ?? '⬚'}</div>
        )}
      </div>
      <div className="info">
        <div className="nm">
          {asset.name} <span className={`ds-miniTag ${roleTagClass(asset.role)}`}>{asset.role}</span>
        </div>
        <div className="ds">{asset.description}</div>
        <div className="ft">
          <span>{asset.status === 'ready' ? '✓ 可用' : '待生成'}</span>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            🔒
            <Switch size="small" checked={asset.consistencyLocked} loading={locking} onChange={(v) => void onLock(v)} />
          </label>
        </div>
        {asset.status !== 'ready' ? (
          <Button
            type="primary"
            className="ds-grad ds-pill"
            size="small"
            style={{ marginTop: 10 }}
            loading={generating}
            onClick={() => void onGenerate()}
          >
            生成形象
          </Button>
        ) : null}
      </div>
    </div>
  );
}

const FILTERS: { key: AssetType; label: string; icon: string }[] = [
  { key: 'character', label: '全部角色', icon: '👥' },
  { key: 'scene', label: '全部场景', icon: '🏛' },
  { key: 'prop', label: '全部道具', icon: '🗝' },
  { key: 'material', label: '全部素材', icon: '🖼' },
];

export default function AssetsPage() {
  const { message } = App.useApp();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const setUnlocked = useWorkflowStore((s) => s.setUnlocked);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [filter, setFilter] = useState<AssetType>('character');
  const [completing, setCompleting] = useState(false);
  const [projectName, setProjectName] = useState('');

  const load = async () => {
    const [{ assets: list }, wf, outline] = await Promise.all([listAssets(id), getWorkflow(id), getOutline(id)]);
    setAssets(list);
    setUnlocked(id, wf.unlockedStep);
    setProjectName(outline.projectName);
  };

  useEffect(() => {
    void load().catch(() => message.error('加载资产失败'));
  }, [id, message]);

  const counts = useMemo(() => countAssetsByType(assets), [assets]);
  const readyCounts = useMemo(
    () => ({
      character: assets.filter((a) => a.type === 'character' && a.status === 'ready').length,
      scene: assets.filter((a) => a.type === 'scene' && a.status === 'ready').length,
      prop: assets.filter((a) => a.type === 'prop' && a.status === 'ready').length,
      material: assets.filter((a) => a.type === 'material' && a.status === 'ready').length,
    }),
    [assets],
  );
  const visible = filterAssetsByType(assets, filter);

  const onNext = async () => {
    setCompleting(true);
    try {
      const wf = await completeAssets(id);
      setUnlocked(id, wf.unlockedStep);
      navigate(`/project/${id}/episodes`);
    } catch {
      message.error('请先完成剧本定稿');
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div className="ds-flowPage">
      <WorkflowHeader projectName={projectName || '项目'} tag="资产库" current="assets" />
      <div className="ds-viewInner">
        <div className="ds-statRow">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`ds-statCard${filter === item.key ? ' on' : ''}`}
              onClick={() => setFilter(item.key)}
            >
              <div className="nm">
                {item.icon} {item.label}
              </div>
              <div className="ct">
                {readyCounts[item.key]}
                <small> / {counts[item.key]}</small>
              </div>
            </button>
          ))}
        </div>
        <div className="ds-assetGrid">
          {visible.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              onUpdated={(next) => setAssets((list) => list.map((item) => (item.id === next.id ? next : item)))}
            />
          ))}
          {visible.length === 0 ? (
            <div className="ds-emptyHint">暂无{FILTERS.find((f) => f.key === filter)?.label.replace('全部', '')} — 本集无关键物件流转</div>
          ) : null}
        </div>
        <div className="ds-noteBar">
          <span className="ic">⚡</span>
          <span>
            点「生成形象」提交生图任务；林晚 / 鼬完成后将出现 linwan.png / itachi.png。一致性锁定经 PATCH 持久化。
          </span>
        </div>
      </div>
      <div className="ds-flowBar">
        <span className="msg">角色形象生成完成后可进入分集拆分</span>
        <Button className="ds-ghost ds-pill" size="small" onClick={() => navigate(`/project/${id}/outline`)}>
          上一步
        </Button>
        <Button type="primary" className="ds-grad ds-pill" size="small" loading={completing} onClick={() => void onNext()}>
          下一步：分集拆分 ◆28
        </Button>
      </div>
    </div>
  );
}
