import { useEffect, useRef, useState } from 'react';
import { App, Button, Input, Modal, Tag, Typography } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { WorkflowHeader } from '../components/WorkflowHeader';
import { useWorkflowStep } from '../hooks/useWorkflowStep';
import {
  deleteScript,
  ExtractionTimeoutError,
  extractScriptAssets,
  fetchProject,
  pollExtractionUntilDone,
  updateScript,
} from '../lib/api';
import { canExtract, isExtractionActive } from '../lib/extractState';
import { errorMessage } from '../lib/errors';
import type { Script, ScriptExtractState, ScriptExtractStatus } from '../types/api';

/** 命名提取状态 → 展示标签（状态翻译已在 API 层完成，此处只配 UI） */
function extractStatusTag(status: ScriptExtractStatus) {
  switch (status) {
    case 'done':
      return <Tag color="success">已提取</Tag>;
    case 'waiting':
    case 'extracting':
      return <Tag color="warning">{status === 'extracting' ? '提取中' : '等待提取'}</Tag>;
    case 'failed':
      return <Tag color="error">提取失败</Tag>;
    case 'none':
      return <Tag>未提取</Tag>;
  }
}

export default function ScriptsPage() {
  const { message, modal } = App.useApp();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { scripts: fetchedScripts, retry } = useWorkflowStep();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingScript, setEditingScript] = useState<Script | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingContent, setEditingContent] = useState('');
  const [saving, setSaving] = useState(false);
  /** 已发起提取请求、等待后端响应的剧本（按钮 loading） */
  const [pendingKickoff, setPendingKickoff] = useState<Set<string>>(new Set());

  // 项目名是页面自身所需（门控查询不含），单独取
  useEffect(() => {
    const controller = new AbortController();
    const boot = async () => {
      try {
        const project = await fetchProject(id, controller.signal);
        setProjectName(project.name);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        message.error(errorMessage(err, '加载项目失败'));
      }
    };
    void boot();
    return () => controller.abort();
  }, [id, message]);

  // 剧本列表消费 Provider 的门控查询结果：按自增 id 排序（同毫秒也稳定），列表位置即集数
  useEffect(() => {
    if (fetchedScripts == null) return;
    setScripts([...fetchedScripts].sort((a, b) => Number(a.id) - Number(b.id)));
    setLoading(false);
  }, [fetchedScripts]);

  const onEdit = (script: Script) => {
    setEditingScript(script);
    setEditingName(script.name);
    setEditingContent(script.content);
  };

  const onSaveEdit = async () => {
    if (!editingScript) return;
    setSaving(true);
    try {
      await updateScript({
        id: editingScript.id,
        name: editingName,
        content: editingContent,
      });
      setScripts(
        scripts.map((s) =>
          s.id === editingScript.id
            ? { ...s, name: editingName, content: editingContent }
            : s,
        ),
      );
      setEditingScript(null);
      message.success('剧本已更新');
    } catch (err) {
      message.error(errorMessage(err, '更新失败'));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (scriptId: string) => {
    modal.confirm({
      title: '确认删除',
      content: '删除后无法恢复（关联分镜、视频将一并删除），确定要删除这个剧本吗？',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteScript(scriptId);
          setScripts(scripts.filter((s) => s.id !== scriptId));
          message.success('剧本已删除');
        } catch (err) {
          message.error(errorMessage(err, '删除失败'));
        }
      },
    });
  };

  const onExtract = async (script: Script) => {
    setPendingKickoff((prev) => new Set(prev).add(script.id));
    try {
      // 真实后端：置等待后立即返回，AI 在后台提取
      await extractScriptAssets(id, [script.id]);
      // 乐观置等待，轮询 effect 随即启动
      setScripts(
        scriptsRef.current.map((s) =>
          s.id === script.id ? { ...s, extractStatus: 'waiting' } : s,
        ),
      );
    } catch (err) {
      message.error(errorMessage(err, '触发提取失败'));
    } finally {
      setPendingKickoff((prev) => {
        const next = new Set(prev);
        next.delete(script.id);
        return next;
      });
    }
  };

  // scriptsRef：onTick 里取最新列表做状态对比，不把整个列表放进轮询依赖
  const scriptsRef = useRef(scripts);
  useEffect(() => {
    scriptsRef.current = scripts;
  });

  /** 处于提取中的剧本（等待/提取中），驱动轮询 */
  const activeIds = scripts
    .filter((s) => isExtractionActive(s.extractStatus))
    .map((s) => s.id);
  const activeKey = activeIds.join('|');

  useEffect(() => {
    if (activeIds.length === 0) return;
    const controller = new AbortController();

    // 每拍结果映射到 UI；进入终态时提示并重查门控
    const tick = (states: ScriptExtractState[]) => {
      const prev = scriptsRef.current;
      setScripts(
        prev.map((s) => {
          const next = states.find((x) => x.id === s.id);
          return next
            ? { ...s, extractStatus: next.extractStatus, errorReason: next.errorReason }
            : s;
        }),
      );

      for (const next of states) {
        const before = prev.find((s) => s.id === next.id);
        if (!before || before.extractStatus === next.extractStatus) continue;
        if (next.extractStatus === 'done') {
          message.success(`《${before.name}》资产提取完成`);
          // 资产已入库：重查门控状态，三步条与后续页面解锁
          retry();
        }
        if (next.extractStatus === 'failed') {
          message.error(`《${before.name}》提取失败`);
        }
      }
    };

    // 轮询编排（循环/间隔/超时/终态）收敛在 API client
    void pollExtractionUntilDone(activeIds, { onTick: tick }, controller.signal).catch(
      (err: unknown) => {
        // 取消：静默
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (err instanceof ExtractionTimeoutError) {
          // 超时兜底：仍在进行中的本地置失败、可重新发起（后端恢复后重提即可）
          setScripts((prev) =>
            prev.map((s) =>
              activeIds.includes(s.id) && isExtractionActive(s.extractStatus)
                ? { ...s, extractStatus: 'failed', errorReason: '提取超时，请重新发起' }
                : s,
            ),
          );
          message.warning('资产提取超时，请重新发起');
        }
      },
    );

    return () => controller.abort();
    // activeKey 变化（发起/完成）时重建；message、retry 身份稳定
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, message, retry]);

  return (
    <div className="ds-flowPage">
      <WorkflowHeader projectName={projectName || '项目'} tag="剧本列表" current="scripts" />
      <div className="ds-viewInner">
        <div className="ds-h2" style={{ fontSize: 20 }}>
          剧本列表
        </div>
        <div style={{ fontSize: 13, color: 'var(--ant-color-text-tertiary)', marginTop: 6 }}>
          每个剧本就是一集 · 共 {scripts.length} 个剧本
        </div>

        <div style={{ marginTop: 22 }}>
          {loading ? null : scripts.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '60px 20px',
                background: 'var(--ant-color-bg-container)',
                borderRadius: 12,
                border: '1px dashed var(--ant-color-border)',
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 12 }}>📄</div>
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                还没有剧本。前往创作页提交剧本。
              </Typography.Text>
              <div style={{ marginTop: 16 }}>
                <Button
                  type="primary"
                  className="ds-grad ds-pill"
                  onClick={() => navigate(`/create?projectId=${id}`)}
                >
                  去创作
                </Button>
              </div>
            </div>
          ) : (
            scripts.map((script, idx) => (
              <div
                key={script.id}
                style={{
                  background: 'var(--ant-color-bg-container)',
                  border: '1px solid var(--ant-color-border)',
                  borderRadius: 12,
                  padding: '16px 18px',
                  marginBottom: 14,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: 'var(--ant-color-primary-bg)',
                      color: 'var(--ant-color-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 15,
                      flexShrink: 0,
                    }}
                    title={`第 ${idx + 1} 集`}
                  >
                    {idx + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <h4 style={{ margin: 0, fontSize: 15 }}>{script.name}</h4>
                      {extractStatusTag(script.extractStatus)}
                      <Tag color="default">{script.content.length} 字</Tag>
                    </div>
                    <Typography.Text
                      type="secondary"
                      style={{ fontSize: 12.5, lineHeight: 1.6, display: 'block', marginBottom: 12 }}
                    >
                      {script.content.slice(0, 120)}{script.content.length > 120 ? '……' : ''}
                    </Typography.Text>
                    {script.extractStatus === 'failed' && script.errorReason ? (
                      <Typography.Text type="danger" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                        提取失败：{script.errorReason}
                      </Typography.Text>
                    ) : null}
                    {isExtractionActive(script.extractStatus) ? (
                      <Typography.Text
                        type="secondary"
                        style={{ fontSize: 12, display: 'block', marginBottom: 8 }}
                      >
                        ⏳ AI 正在通读剧本，提取角色与场景…
                      </Typography.Text>
                    ) : null}
                    <div style={{ display: 'flex', gap: 8 }}>
                      {canExtract(script.extractStatus) ? (
                        <Button
                          size="small"
                          type="primary"
                          className="ds-grad ds-pill"
                          loading={pendingKickoff.has(script.id)}
                          onClick={() => void onExtract(script)}
                        >
                          🤖 AI 提取资产
                        </Button>
                      ) : null}
                      <Button size="small" onClick={() => onEdit(script)}>
                        ✏️ 编辑
                      </Button>
                      <Button size="small" danger onClick={() => onDelete(script.id)}>
                        删除
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="ds-flowBar">
        <span className="msg">
          {scripts.length === 0
            ? '还没有剧本，先去创作页提交'
            : '剧本已就绪，可进入资产步骤提取角色与场景'}
        </span>
        <Button
          className="ds-ghost ds-pill"
          size="small"
          onClick={() => navigate(`/create?projectId=${id}`)}
        >
          ＋ 添加剧本
        </Button>
        <Button
          type="primary"
          className="ds-grad ds-pill"
          size="small"
          disabled={scripts.length === 0}
          onClick={() => navigate(`/project/${id}/assets`)}
        >
          下一步：资产工坊
        </Button>
      </div>

      <Modal
        open={editingScript != null}
        title="编辑剧本"
        okText="保存"
        cancelText="取消"
        onOk={onSaveEdit}
        onCancel={() => setEditingScript(null)}
        confirmLoading={saving}
        width={600}
      >
        <div style={{ marginBottom: 12 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
            剧本名称
          </Typography.Text>
          <Input
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            placeholder="剧本名称"
          />
        </div>
        <div>
          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
            剧本内容
          </Typography.Text>
          <Input.TextArea
            value={editingContent}
            onChange={(e) => setEditingContent(e.target.value)}
            rows={12}
            placeholder="剧本内容"
          />
        </div>
      </Modal>
    </div>
  );
}
