import { useEffect, useState } from 'react';
import { App, Button, Input, Modal, Tag, Typography } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { WorkflowHeader } from '../components/WorkflowHeader';
import { deleteScript, fetchProject, listScripts, updateScript } from '../lib/api';
import { useWorkflowStore } from '../stores/workflowStore';
import type { Script } from '../types/api';

export default function ScriptsPage() {
  const { message } = App.useApp();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const setUnlocked = useWorkflowStore((s) => s.setUnlocked);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [projectName, setProjectName] = useState('');
  const [editingScript, setEditingScript] = useState<Script | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingContent, setEditingContent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        const [project, data] = await Promise.all([fetchProject(id), listScripts(id)]);
        if (cancelled) return;
        setProjectName(project.name);
        setScripts(data.scripts);
        // 剧本存在即可进入资产步骤
        if (data.scripts.length > 0) {
          setUnlocked(id, 2);
        }
      } catch (err) {
        if (!cancelled) message.error('加载剧本失败');
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, [id, message, setUnlocked]);

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
    } catch {
      message.error('更新失败');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (scriptId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除这个剧本吗？',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteScript(scriptId);
          setScripts(scripts.filter((s) => s.id !== scriptId));
          message.success('剧本已删除');
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  const extractStateTag = (state: number) => {
    if (state === 0) return <Tag color="default">未提取</Tag>;
    if (state === 1) return <Tag color="processing">提取中</Tag>;
    if (state === 2) return <Tag color="success">已提取</Tag>;
    return <Tag color="default">未知</Tag>;
  };

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
          {scripts.length === 0 ? (
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
            scripts.map((script) => (
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
                  >
                    {Number(script.id)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <h4 style={{ margin: 0, fontSize: 15 }}>{script.name}</h4>
                      {extractStateTag(script.extractState)}
                      <Tag color="default">{script.content.length} 字</Tag>
                    </div>
                    <Typography.Text
                      type="secondary"
                      style={{ fontSize: 12.5, lineHeight: 1.6, display: 'block', marginBottom: 12 }}
                    >
                      {script.content.slice(0, 120)}{script.content.length > 120 ? '……' : ''}
                    </Typography.Text>
                    {script.errorReason ? (
                      <Typography.Text type="danger" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                        提取失败：{script.errorReason}
                      </Typography.Text>
                    ) : null}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button
                        size="small"
                        onClick={() => onEdit(script)}
                      >
                        ✏️ 编辑
                      </Button>
                      <Button
                        size="small"
                        danger
                        onClick={() => onDelete(script.id)}
                      >
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
          上一步
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
