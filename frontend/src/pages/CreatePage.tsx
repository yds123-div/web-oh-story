import { useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Flex, Input, Select, Typography, Tag } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { addScript, createProject, fetchProject, listProjects } from '../lib/api';
import { ART_STYLE_OPTIONS, DEFAULT_PROJECT_FORM } from '../config/project';
import { errorMessage } from '../lib/errors';
import { validateScriptFileContent, validateScriptText } from '../lib/scriptValidation';
import type { Project } from '../types/api';

const SAMPLE = `【木叶长廊 内 夜】
木叶，夜晚长廊，月光冷白。
△ 林晚扶着廊柱，指尖颤抖，眼神茫然又痛苦，身着木叶制式素色和服。
林晚（低声独白）：明明只是在家看火影……一睁眼，就来到了这里。
△ 鼬缓步从阴影走出，红瞳微光，神色淡漠。
鼬：深夜在此，有何目的。长老安排你，来监视我？`;

type ReadySource =
  | { kind: 'paste'; text: string }
  | { kind: 'file'; file: File; charCount?: number; text: string };

export default function CreatePage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const projectIdFromUrl = params.get('projectId');

  // 打开已有项目时，拉取并还原其创建时保存的配置
  const [savedProject, setSavedProject] = useState<Project | null>(null);
  useEffect(() => {
    if (!projectIdFromUrl) {
      setSavedProject(null);
      return;
    }
    void fetchProject(projectIdFromUrl)
      .then(setSavedProject)
      .catch((err) => message.error(errorMessage(err, '加载项目配置失败')));
  }, [projectIdFromUrl, message]);

  const [panel, setPanel] = useState<'empty' | 'paste' | 'ready'>('empty');
  const [paste, setPaste] = useState(SAMPLE);
  const [source, setSource] = useState<ReadySource | null>(null);
  const [fileName, setFileName] = useState('逆命木叶');
  const [submitting, setSubmitting] = useState(false);
  const [category, setCategory] = useState('女频-轻小说');
  const [style, setStyle] = useState(DEFAULT_PROJECT_FORM.artStyle);
  const [videoRatio, setVideoRatio] = useState('9:16');
  const [sceneRatio, setSceneRatio] = useState('16:9');
  const [imageQuality, setImageQuality] = useState('2K');

  // 无 URL 项目上下文时，可把剧本提交进已有项目（后端真实列表）或新建项目
  const [projectOptions, setProjectOptions] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('new');
  useEffect(() => {
    if (projectIdFromUrl) return;
    void listProjects()
      .then(({ projects }) => setProjectOptions(projects))
      .catch((err) => message.error(errorMessage(err, '加载项目列表失败')));
  }, [projectIdFromUrl, message]);

  // 免提交逃生口：URL 指定项目、或下拉选中已有项目时，可不提交直接回剧本列表
  const viewScriptProjectId =
    projectIdFromUrl ?? (selectedProjectId !== 'new' ? selectedProjectId : null);
  const viewScriptsLink = viewScriptProjectId ? (
    <Button
      size="small"
      type="link"
      style={{ padding: 0 }}
      onClick={() => navigate(`/project/${viewScriptProjectId}/scripts`)}
    >
      查看该项目剧本列表 →
    </Button>
  ) : null;

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
    // 读取文件内容
    const text = await file.text();
    setSource({ kind: 'file', file, charCount: result.charCount, text });
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
    if (!source) {
      message.warning('请先上传剧本，或粘贴文本');
      return;
    }
    setSubmitting(true);
    try {
      let projectId = projectIdFromUrl;
      if (!projectId) {
        if (selectedProjectId !== 'new') {
          // 提交进已有项目
          projectId = selectedProjectId;
        } else {
          const created = await createProject({
            name: fileName.trim() || '未命名项目',
            type: category,
            artStyle: style,
            videoRatio,
            imageQuality,
            // 创作页暂不选模型，沿用项目表单默认值（模型选项见 config/project.ts）
            imageModel: DEFAULT_PROJECT_FORM.imageModel,
            videoModel: DEFAULT_PROJECT_FORM.videoModel,
          });
          projectId = created.id;
        }
      }
      const scriptName = fileName.trim() || '未命名剧本';
      const content = source.kind === 'paste' ? source.text : (source.text || '');
      await addScript({
        projectId,
        name: scriptName,
        content,
      });
      message.success('剧本已保存到后端');
      navigate(`/project/${projectId}/scripts`);
    } catch (err) {
      message.error(errorMessage(err, '提交剧本失败'));
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
        <button type="button" className="ds-modeChip on">📄 剧本模式（≤3万字）</button>
        <span style={{ fontSize: 11, color: 'var(--ant-color-text-tertiary)', marginLeft: 10 }}>
          上传成品剧本，AI 精编后进入三步工作流
        </span>
      </Flex>

      {savedProject ? (
        <Card className="ds-card" size="small" style={{ marginTop: 14 }} styles={{ body: { padding: '12px 16px' } }}>
          <Flex justify="space-between" align="center" style={{ marginBottom: 8 }}>
            <b style={{ fontSize: 13 }}>📌 项目配置（已保存）</b>
            <Flex align="center" gap={6}>
              {viewScriptsLink}
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                {savedProject.projectType === 'script' ? '剧本项目' : savedProject.projectType}
              </Typography.Text>
            </Flex>
          </Flex>
          <Flex gap={8} wrap style={{ fontSize: 12 }}>
            {[
              savedProject.type,
              savedProject.artStyle,
              savedProject.videoRatio,
              savedProject.imageQuality,
              `图像模型 ${savedProject.imageModel || '未选择'}`,
              `视频模型 ${savedProject.videoModel || '未选择'}`,
            ].map((item) => (
              <Tag key={item}>{item}</Tag>
            ))}
          </Flex>
          {savedProject.intro ? (
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
              {savedProject.intro}
            </Typography.Text>
          ) : null}
        </Card>
      ) : null}

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
              <Flex gap={6} wrap justify="center" style={{ marginTop: 12 }}>
                {source.kind === 'file' ? (
                  <>
                    <Tag color="success" style={{ fontSize: 10, padding: '2px 8px' }}>
                      格式 ✓ {source.file.name.split('.').pop()?.toUpperCase()}
                    </Tag>
                    <Tag color="success" style={{ fontSize: 10, padding: '2px 8px' }}>
                      大小 ✓ {(source.file.size / 1024).toFixed(0)} KB
                    </Tag>
                  </>
                ) : (
                  <Tag color="success" style={{ fontSize: 10, padding: '2px 8px' }}>
                    来源 ✓ 粘贴板
                  </Tag>
                )}
                <Tag color="success" style={{ fontSize: 10, padding: '2px 8px' }}>
                  字数 ✓ {(source.kind === 'paste' ? source.text.length : source.charCount)?.toLocaleString()}
                </Tag>
                <Tag color="success" style={{ fontSize: 10, padding: '2px 8px' }}>
                  校验通过
                </Tag>
              </Flex>
              <Button
                className="ds-ghost ds-pill"
                size="small"
                onClick={() => {
                  setSource(null);
                  setPanel('empty');
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
            选择项目
          </Typography.Text>
          {projectIdFromUrl ? (
            <Select
              style={{ width: '100%', marginBottom: 12 }}
              value={savedProject?.name || '当前项目'}
              disabled
              options={[{ value: savedProject?.name || '当前项目' }]}
            />
          ) : (
            <Select
              style={{ width: '100%', marginBottom: 12 }}
              value={selectedProjectId}
              onChange={setSelectedProjectId}
              options={[
                { value: 'new', label: '＋ 新建项目（用左侧参数创建）' },
                ...projectOptions.map((p) => ({ value: p.id, label: p.name || '未命名项目' })),
              ]}
            />
          )}
          {!projectIdFromUrl && viewScriptsLink ? (
            <div style={{ margin: '-4px 0 12px' }}>{viewScriptsLink}</div>
          ) : null}
          <Flex gap={8} style={{ marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <Typography.Text type="secondary" style={{ fontSize: 11.5, display: 'block', marginBottom: 6 }}>
                分类
              </Typography.Text>
              <Select
                style={{ width: '100%' }}
                value={category}
                onChange={setCategory}
                options={[
                  { value: '女频-轻小说', label: '女频-轻小说' },
                  { value: '穿越宿命', label: '穿越宿命' },
                  { value: '热血战斗', label: '热血战斗' },
                ]}
              />
            </div>
            <div style={{ flex: 1 }}>
              <Typography.Text type="secondary" style={{ fontSize: 11.5, display: 'block', marginBottom: 6 }}>
                风格库
              </Typography.Text>
              <Select
                style={{ width: '100%' }}
                value={style}
                onChange={setStyle}
                options={ART_STYLE_OPTIONS}
              />
            </div>
          </Flex>
          <Flex gap={8} style={{ marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <Typography.Text type="secondary" style={{ fontSize: 11.5, display: 'block', marginBottom: 6 }}>
                视频比例
              </Typography.Text>
              <Select
                style={{ width: '100%' }}
                value={videoRatio}
                onChange={setVideoRatio}
                options={[
                  { value: '9:16', label: '📱 9:16' },
                  { value: '16:9', label: '16:9' },
                ]}
              />
            </div>
            <div style={{ flex: 1 }}>
              <Typography.Text type="secondary" style={{ fontSize: 11.5, display: 'block', marginBottom: 6 }}>
                场景比例
              </Typography.Text>
              <Select
                style={{ width: '100%' }}
                value={sceneRatio}
                onChange={setSceneRatio}
                options={[
                  { value: '16:9', label: '🖥 16:9' },
                  { value: '9:16', label: '9:16' },
                ]}
              />
            </div>
            <div style={{ flex: 1 }}>
              <Typography.Text type="secondary" style={{ fontSize: 11.5, display: 'block', marginBottom: 6 }}>
                生图质量
              </Typography.Text>
              <Select
                style={{ width: '100%' }}
                value={imageQuality}
                onChange={setImageQuality}
                options={[
                  { value: '4K', label: '4K' },
                  { value: '2K', label: '2K' },
                  { value: '1080P', label: '1080P' },
                ]}
              />
            </div>
          </Flex>
          <Flex justify="flex-end" style={{ marginTop: 18 }}>
            <Button
              type="primary"
              className="ds-grad ds-pill"
              loading={submitting}
              onClick={() => void startCreate()}
            >
              ✦ 立即创作
            </Button>
          </Flex>
        </div>
      </div>
    </div>
  );
}
