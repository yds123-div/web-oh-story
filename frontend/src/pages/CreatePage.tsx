import { useEffect, useMemo, useState } from 'react';
import { App, Button, Flex, Input, Progress, Select, Typography } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTask } from '../hooks/useTask';
import { createProject, listTemplates, submitOutlineTask } from '../lib/api';
import { validateScriptFileContent, validateScriptText } from '../lib/scriptValidation';
import type { Template } from '../types/api';

const SAMPLE = `【木叶长廊 内 夜】
木叶，夜晚长廊，月光冷白。
△ 林晚扶着廊柱，指尖颤抖，眼神茫然又痛苦，身着木叶制式素色和服。
林晚（低声独白）：明明只是在家看火影……一睁眼，就来到了这里。
△ 鼬缓步从阴影走出，红瞳微光，神色淡漠。
鼬：深夜在此，有何目的。长老安排你，来监视我？`;

type ReadySource =
  | { kind: 'paste'; text: string }
  | { kind: 'file'; file: File; charCount?: number };

export default function CreatePage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const projectIdFromUrl = params.get('projectId');
  const templateIdFromUrl = params.get('templateId');

  const [mode, setMode] = useState<'script' | 'novel'>('script');
  const [panel, setPanel] = useState<'empty' | 'paste' | 'ready'>('empty');
  const [paste, setPaste] = useState(SAMPLE);
  const [source, setSource] = useState<ReadySource | null>(null);
  const [fileName, setFileName] = useState('逆命木叶');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState(templateIdFromUrl ?? '');

  const { task } = useTask(taskId, {
    intervalMs: 2500,
    onSucceeded: (t) => {
      const result = t.result as { projectId?: string } | undefined;
      const nextId = result?.projectId ?? projectIdFromUrl;
      if (nextId) navigate(`/project/${nextId}/outline`);
    },
    onFailed: (t) => message.error(t.error ?? '创作任务失败'),
  });

  useEffect(() => {
    void listTemplates()
      .then((data) => {
        setTemplates(data.templates);
        const tpl = data.templates.find((item) => item.id === templateIdFromUrl);
        if (!tpl) return;
        setTemplateId(tpl.id);
        setFileName(tpl.name);
        setPaste(tpl.scriptText);
        setSource({ kind: 'paste', text: tpl.scriptText });
        setPanel('ready');
      })
      .catch(() => undefined);
  }, [templateIdFromUrl]);

  const readyHint = useMemo(() => {
    if (!source) return '';
    if (source.kind === 'paste') return `粘贴文本 · ${source.text.length} 字 · 删除后可重新粘贴`;
    const extra = source.charCount != null ? ` · ${source.charCount} 字` : '';
    return `《${source.file.name}》${extra} · 删除当前文件后可重新上传`;
  }, [source]);

  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    const result = await validateScriptFileContent(file);
    if (!result.ok) {
      message.error(result.message);
      return;
    }
    setSource({ kind: 'file', file, charCount: result.charCount });
    setPanel('ready');
    setFileName(file.name.replace(/\.[^.]+$/, '') || fileName);
    message.success('剧本上传成功 · 格式校验通过');
  };

  const onUsePaste = () => {
    const result = validateScriptText(paste);
    if (!result.ok) {
      message.error(result.message);
      return;
    }
    setSource({ kind: 'paste', text: paste.trim() });
    setPanel('ready');
    message.success(`文本已载入（${paste.trim().length} 字）`);
  };

  const startCreate = async () => {
    if (mode === 'novel') {
      message.info('小说模式将在后续阶段开放');
      return;
    }
    if (!source) {
      message.warning('请先上传剧本，或粘贴文本');
      return;
    }
    setSubmitting(true);
    try {
      let projectId = projectIdFromUrl;
      if (!projectId) {
        const created = await createProject({
          name: fileName.trim() || '未命名项目',
          templateId: templateId || undefined,
        });
        projectId = created.id;
      }
      const body =
        source.kind === 'paste'
          ? { sourceType: 'paste' as const, text: source.text }
          : { sourceType: 'file' as const, fileName: source.file.name };
      const { taskId: id } = await submitOutlineTask(projectId, body);
      setTaskId(id);
    } catch {
      message.error('提交创作任务失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '30px 32px 70px', maxWidth: 1200, margin: '0 auto' }}>
      <h2 className="ds-h2">剧集创作</h2>
      <Typography.Text type="secondary" style={{ fontSize: 13, display: 'block', marginTop: 6 }}>
        短剧 AGENT，一键直出整部剧
      </Typography.Text>

      <Flex gap={8} wrap style={{ margin: '16px 0 0' }} align="center">
        <button type="button" className={`ds-modeChip${mode === 'script' ? ' on' : ''}`} onClick={() => setMode('script')}>
          📄 剧本模式（≤30万字）
        </button>
        <button type="button" className={`ds-modeChip${mode === 'novel' ? ' on' : ''}`} onClick={() => setMode('novel')}>
          📖 小说模式（≤10万字 · 一键转视频）
        </button>
        <span style={{ fontSize: 11, color: 'var(--ant-color-text-tertiary)', marginLeft: 10 }}>
          {mode === 'script' ? '上传成品剧本，AI 精编后进入三步工作流' : '小说模式：先解析章节，再由编剧智能体改编'}
        </span>
      </Flex>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 16, marginTop: 14 }}>
        <div className="ds-upload">
          {panel === 'empty' ? (
            <Flex vertical align="center" gap={12} style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 28 }}>📄</div>
              <h4 style={{ margin: 0 }}>拖拽剧本到这里，或选择上传方式</h4>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                支持 txt / pdf / doc / docx / md 格式 · 单文件 ≤ 10MB · 剧本字数不超过 30 万字
              </Typography.Text>
              <Flex gap={8}>
                <Button
                  className="ds-ghost ds-pill"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.txt,.pdf,.doc,.docx,.md';
                    input.onchange = () => void onPickFile(input.files?.[0]);
                    input.click();
                  }}
                >
                  ⬆ 上传剧本
                </Button>
                <Button className="ds-ghost ds-pill" onClick={() => setPanel('paste')}>
                  📋 粘贴文本
                </Button>
              </Flex>
            </Flex>
          ) : null}

          {panel === 'paste' ? (
            <div>
              <Input.TextArea
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                style={{ minHeight: 170, fontSize: 12, lineHeight: 1.9 }}
                placeholder="粘贴剧本文本…"
              />
              <Flex justify="space-between" align="center" style={{ marginTop: 10 }}>
                <span style={{ fontSize: 11, color: 'var(--ant-color-text-tertiary)' }}>
                  {paste.length} 字（≤300,000）
                </span>
                <Flex gap={8}>
                  <Button className="ds-ghost ds-pill" size="small" onClick={() => setPanel('empty')}>
                    返回上传
                  </Button>
                  <Button type="primary" className="ds-grad ds-pill" size="small" onClick={onUsePaste}>
                    使用此文本
                  </Button>
                </Flex>
              </Flex>
            </div>
          ) : null}

          {panel === 'ready' && source ? (
            <Flex vertical align="center" gap={8} style={{ textAlign: 'center', padding: '28px 0' }}>
              <div style={{ fontSize: 28 }}>✓</div>
              <div>上传成功</div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {readyHint}
              </Typography.Text>
              <Button
                className="ds-ghost ds-pill"
                size="small"
                onClick={() => {
                  setSource(null);
                  setPanel('empty');
                  setTaskId(null);
                }}
              >
                删除并重选
              </Button>
            </Flex>
          ) : null}
        </div>

        <div className="ds-upload">
          <h4 style={{ margin: '0 0 14px' }}>创作参数</h4>
          <Typography.Text type="secondary" style={{ fontSize: 11.5, display: 'block', marginBottom: 6 }}>
            文件名称
          </Typography.Text>
          <Input value={fileName} onChange={(e) => setFileName(e.target.value)} style={{ marginBottom: 12 }} />
          <Typography.Text type="secondary" style={{ fontSize: 11.5, display: 'block', marginBottom: 6 }}>
            从官方示例开始（可选）
          </Typography.Text>
          <Select
            style={{ width: '100%', marginBottom: 12 }}
            value={templateId}
            onChange={(value) => {
              setTemplateId(value);
              const tpl = templates.find((item) => item.id === value);
              if (!tpl) return;
              setFileName(tpl.name);
              setPaste(tpl.scriptText);
              setSource({ kind: 'paste', text: tpl.scriptText });
              setPanel('ready');
            }}
            options={[
              { value: '', label: '— 不使用示例 —' },
              ...templates.map((tpl) => ({ value: tpl.id, label: tpl.name })),
            ]}
          />
          {task ? (
            <div style={{ margin: '16px 0' }}>
              <Progress percent={task.progress} strokeColor={{ from: '#8b5cf6', to: '#6366f1' }} />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {task.status === 'pending' && '排队中…'}
                {task.status === 'running' && '编剧智能体解读中…'}
                {task.status === 'succeeded' && '✓ 大纲任务完成'}
                {task.status === 'failed' && (task.error ?? '失败')}
              </Typography.Text>
            </div>
          ) : null}
          <Flex justify="flex-end" style={{ marginTop: 18 }}>
            <Button
              type="primary"
              className="ds-grad ds-pill"
              loading={submitting || (task != null && task.status !== 'failed')}
              onClick={() => void startCreate()}
            >
              ✦ 立即创作 ◆32
            </Button>
          </Flex>
        </div>
      </div>
    </div>
  );
}
