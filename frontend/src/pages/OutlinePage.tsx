import { useEffect, useState } from 'react';
import { App, Button, Modal, Typography } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { WorkflowHeader } from '../components/WorkflowHeader';
import { finalizeOutline, getOutline, getWorkflow } from '../lib/api';
import { useWorkflowStore } from '../stores/workflowStore';
import type { Asset, Outline } from '../types/api';

const AGENTS = [
  {
    name: '编剧老赵',
    role: '剧本精编 · 节奏',
    ab: '编',
    cls: 'a1',
    msgs: [
      '原著我先通读了一遍。我先把水分压掉、剧本精编、节奏收紧。',
      'SYS:开始剧本解读、故事分析',
      '这个本子的核心张力其实在于全知者面对宿命论时的无力感，女主虽然知道所有剧情，却无法轻易打破原有的世界壁垒。',
      '前期的互动要重点刻画这种想要靠近却被推开的撕裂感，男主的防备心是最大的阻碍，但也是最好看的反差虐点。',
      '美术方面需要强调场景里的冷色调，利用大面积的阴影和清冷的月光来烘托那种绝望又压抑的氛围。',
    ],
  },
  {
    name: '美术小陈',
    role: '角色 · 场景 · 道具',
    ab: '美',
    cls: 'a2',
    msgs: [
      'SYS:开始角色提取、场景识别、道具提取',
      '在角色设计上，我着重放大了人物视觉上的撕裂感。林晚身穿素色和服，展现出无依无靠的柔弱感；而鼬则以深色忍服和象征宿命悲剧的红瞳微光示人。',
      '第一集的场景承担着情绪铺垫的重任，我将木叶长廊的夜景抽离了暖色，大量使用冷蓝和冷灰。',
      '目前第一集的情节核心在于人物的心理试探与宿命对峙，并没有涉及关键物件的流转，因此没有提取核心道具。',
    ],
  },
  {
    name: '导演James',
    role: '分集拆分 · 镜头',
    ab: '导',
    cls: 'a3',
    msgs: [
      'SYS:开始分集拆分',
      '原剧本已经明确标注了第1集，总字数虽然只有两百多字，低于单集300字的常规下限，但叙事闭环完整。所以我决定严格保持原始的1集结构。',
      '这个长廊对峙场景的张力非常足，女主想靠近而男主极力推开，情绪高点很明确。',
      '最后落在了黑屏字幕上，这种直接宣告无力改变命运的设计作为虐心型钩子非常绝。',
    ],
  },
];

function roleTagClass(role: string): string {
  if (role === '反派') return 'red';
  if (role === '男二' || role === '场景') return 'gray';
  return '';
}

function AssetThumb({ asset }: { asset: Asset }) {
  if (asset.imageUrl) return <img src={asset.imageUrl} alt={asset.name} />;
  if (asset.emoji) return <span>{asset.emoji}</span>;
  return <span>{asset.name.slice(0, 1)}</span>;
}

export default function OutlinePage() {
  const { message } = App.useApp();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const setUnlocked = useWorkflowStore((s) => s.setUnlocked);
  const [outline, setOutline] = useState<Outline | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getOutline(id), getWorkflow(id)])
      .then(([data, wf]) => {
        if (cancelled) return;
        setOutline(data);
        setUnlocked(id, wf.unlockedStep);
      })
      .catch(() => {
        if (!cancelled) message.error('加载大纲失败');
      });
    return () => {
      cancelled = true;
    };
  }, [id, message, setUnlocked]);

  const onFinalize = async () => {
    if (!outline) return;
    if (outline.finalized) {
      navigate(`/project/${id}/assets`);
      return;
    }
    setFinalizing(true);
    try {
      const wf = await finalizeOutline(id);
      setUnlocked(id, wf.unlockedStep);
      setOutline({ ...outline, finalized: true });
      message.success('剧本已定稿，STEP2 已解锁');
      navigate(`/project/${id}/assets`);
    } catch {
      message.error('定稿失败');
    } finally {
      setFinalizing(false);
    }
  };

  if (!outline) return null;

  return (
    <div className="ds-flowPage">
      <WorkflowHeader
        projectName={outline.projectName}
        tag={outline.screenplayTitle}
        current="outline"
        extra={
          <Button className="ds-ghost ds-pill" size="small" onClick={() => setSettingsOpen(true)}>
            ⚙ 全局设定
          </Button>
        }
      />

      <div className="ds-outlineGrid">
        <div className="ds-chatPanel">
          <div className="ph">
            🎙 智能体剧组 · 创作会议 <span className="live">解读完成</span>
          </div>
          {AGENTS.map((agent) => (
            <div key={agent.name}>
              <div className="ds-agentName">
                <span className={`ds-av ${agent.cls}`}>{agent.ab}</span>
                {agent.name} <span className="role">{agent.role}</span>
              </div>
              {agent.msgs.map((msg) =>
                msg.startsWith('SYS:') ? (
                  <div key={msg} className="ds-msg sys">
                    — {msg.slice(4)} —
                  </div>
                ) : (
                  <div key={msg} className="ds-msg">
                    {msg}
                  </div>
                ),
              )}
            </div>
          ))}
        </div>

        <div>
          <div className="ds-docPanel">
            <h4>🎛 整体设定</h4>
            <div className="ds-kvRow">
              <div className="k">视频风格</div>
              <div className="v">{outline.setting.videoStyle}</div>
              <div className="k">画面比例</div>
              <div className="v">{outline.setting.aspectRatio} 竖屏</div>
              <div className="k">清晰度</div>
              <div className="v">{outline.setting.resolution}</div>
              <div className="k">生成模型</div>
              <div className="v">{outline.setting.model}</div>
            </div>
          </div>

          <div className="ds-docPanel">
            <h4>📋 剧本摘要</h4>
            <div className="ds-kvRow">
              <div className="k">主角</div>
              <div className="v">{outline.summary.protagonists}</div>
              <div className="k">故事类型</div>
              <div className="v">{outline.summary.genre}</div>
              <div className="k">故事梗概</div>
              <div className="v">{outline.summary.synopsis}</div>
              <div className="k">故事背景</div>
              <div className="v">{outline.summary.background}</div>
              <div className="k">故事设定</div>
              <div className="v">{outline.summary.setting}</div>
            </div>
          </div>

          <div className="ds-docPanel">
            <h4>🎭 角色 / 场景 / 道具</h4>
            <div className="ds-castGrid">
              {outline.extractedAssets.map((asset) => (
                <div key={asset.id} className="ds-castItem">
                  <div className="ci">
                    <AssetThumb asset={asset} />
                  </div>
                  <div>
                    <div className="nm">
                      {asset.name} <span className={`ds-miniTag ${roleTagClass(asset.role)}`}>{asset.role}</span>
                      {asset.consistencyLocked ? (
                        <span className="ds-miniTag lock">🔒 一致性锁定</span>
                      ) : null}
                    </div>
                    <div className="ds">{asset.description}</div>
                  </div>
                </div>
              ))}
              {outline.extractedAssets.every((a) => a.type !== 'prop') ? (
                <div className="ds-castItem empty">道具 0 ｜ 本集无关键物件流转</div>
              ) : null}
            </div>
          </div>

          <div className="ds-docPanel">
            <h4>📜 剧本内容</h4>
            <div className="ds-screenplay">{outline.screenplay}</div>
          </div>
        </div>
      </div>

      <div className="ds-flowBar">
        <span className="msg">
          {outline.finalized ? (
            <span style={{ color: 'var(--ant-color-success)' }}>✓ 剧本已定稿，可进入资产步骤</span>
          ) : (
            '智能体剧组已完成解读：大纲 / 摘要 / 角色·场景·道具 / 剧本内容 已生成'
          )}
        </span>
        <Button className="ds-ghost ds-pill" size="small" onClick={() => navigate(`/create?projectId=${id}`)}>
          上一步
        </Button>
        <Button type="primary" className="ds-grad ds-pill" size="small" loading={finalizing} onClick={() => void onFinalize()}>
          {outline.finalized ? '下一步：生成资产' : '定稿并进入资产 ◆28'}
        </Button>
      </div>

      <Modal
        open={settingsOpen}
        className="ds-modal"
        title="⚙ 全局设定（负面约束）"
        onCancel={() => setSettingsOpen(false)}
        footer={[
          <Button key="close" className="ds-ghost ds-pill" size="small" onClick={() => setSettingsOpen(false)}>
            关闭
          </Button>,
        ]}
      >
        <Typography.Paragraph type="secondary" style={{ fontSize: 12.5, lineHeight: 1.8 }}>
          画面风格：赛博朋克电影。全程人物边界独立，自然表演，人物无穿插、无穿透；全程禁止出现字幕（黑屏字幕分镜除外）、禁止角色变脸、变装、形象突变。此设定将注入后续生成。
        </Typography.Paragraph>
      </Modal>
    </div>
  );
}
