import { useCallback, useEffect, useState } from 'react';
import { App, Button, Card, Flex, Input, Modal, Select, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { createProject, deleteProject, fetchImageModels, getProjectStatistics, listProjects, patchProject } from '../lib/api';
import type { ImageModelOption, Project, ProjectStatistics } from '../types/api';
import { errorMessage } from '../lib/errors';
import { formatDateTime } from '../lib/format';
import {
  ART_STYLE_OPTIONS,
  DEFAULT_PROJECT_FORM,
  IMAGE_MODEL_OPTIONS,
  IMAGE_QUALITY_OPTIONS,
  PROJECT_TYPE_OPTIONS,
  VIDEO_MODEL_OPTIONS,
  VIDEO_RATIO_OPTIONS,
  setImageModelCapabilities,
} from '../config/project';

export default function HomePage() {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<Record<string, ProjectStatistics>>({});
  const [loaded, setLoaded] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIntro, setNewIntro] = useState('');
  const [form, setForm] = useState({ ...DEFAULT_PROJECT_FORM });
  const [creating, setCreating] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);
  /** 编辑项目弹窗里的模型字段（初始值取自项目卡片上的数据） */
  const [renameModels, setRenameModels] = useState({ imageModel: '', storyboardImageModel: '', deriveAssetsModel: '' });
  /** 图像模型清单（含后端透出的能力）：新建与编辑项目共用 */
  const [imageModelOptions, setImageModelOptions] = useState<ImageModelOption[]>([]);

  /** 模型选项标签，带能力标注 */
  const imageModelOptionLabel = (m: ImageModelOption): string =>
    `${m.label}（${m.requiresReference ? '仅图生图·约2-5分钟/张' : m.textToImage && m.supportsReference ? '文生图/图生图' : '仅文生图'}）`;
  /** 下拉里的"跟随图像模型"项（空串） */
  const followOption = (current: string) => ({
    value: '',
    label: `跟随图像模型（${(current || '未配置').split(':').pop()}）`,
  });
  /** 某个"跟随基准"下的模型选项（排除与基准相同的那个，避免重复项） */
  const modelOptionsFor = (current: string) => [
    followOption(current),
    ...(imageModelOptions.length
      ? imageModelOptions.filter((m) => m.value !== current).map((m) => ({ value: m.value, label: imageModelOptionLabel(m) }))
      : IMAGE_MODEL_OPTIONS.filter((m) => m.value !== current).map((m) => ({ value: m.value, label: m.label }))),
  ];

  // 模型清单是次要数据：拉不到就退回静态兜底表，页面照常可用
  useEffect(() => {
    void fetchImageModels()
      .then((list) => {
        setImageModelCapabilities(list);
        setImageModelOptions(list);
      })
      .catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    const data = await listProjects();
    // 后端列表无排序保证，按创建时间（id 为 Date.now 时间戳）倒序展示，全部呈现不截断
    const sorted = [...data.projects].sort((a, b) => Number(b.id) - Number(a.id));
    setProjects(sorted);
    setLoaded(true);
    // 计数走后端统计接口，逐项目拉取，不阻塞列表渲染
    const entries = await Promise.all(
      sorted.map(async (p) => [p.id, await getProjectStatistics(p.id)] as const),
    );
    setStats(Object.fromEntries(entries));
  }, []);

  useEffect(() => {
    void load().catch(() => message.error('加载项目列表失败'));
  }, [load, message]);

  const onCreate = async () => {
    const name = newName.trim();
    if (!name) {
      message.warning('请输入项目名称');
      return;
    }
    setCreating(true);
    try {
      await createProject({ name, intro: newIntro.trim(), ...form });
      setCreateOpen(false);
      setNewName('');
      setNewIntro('');
      setForm({ ...DEFAULT_PROJECT_FORM });
      await load();
      message.success(`项目「${name}」已创建并保存到后端`);
    } catch (err) {
      message.error(errorMessage(err, '新建项目失败'));
    } finally {
      setCreating(false);
    }
  };

  const onRename = async () => {
    if (!renameId) return;
    const name = renameValue.trim();
    if (!name) {
      message.warning('请输入项目名称');
      return;
    }
    setRenaming(true);
    try {
      await patchProject(renameId, { name, ...renameModels });
      setRenameId(null);
      await load();
      message.success('已保存到后端');
    } catch (err) {
      message.error(errorMessage(err, '重命名失败'));
    } finally {
      setRenaming(false);
    }
  };

  const onDelete = (project: Project) => {
    modal.confirm({
      title: `删除项目「${project.name}」？`,
      content: '将级联删除该项目下的剧本、资产、分镜、视频轨道与任务记录，且不可恢复。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteProject(project.id);
          await load();
          message.success('项目已删除');
        } catch (err) {
          message.error(errorMessage(err, '删除项目失败'));
        }
      },
    });
  };

  return (
    <div style={{ padding: '30px 32px 70px', maxWidth: 1200, width: '100%', margin: '0 auto' }}>
      <h2 className="ds-h2">
        空间 <em>· 个人</em>
      </h2>
      <Typography.Text type="secondary" style={{ fontSize: 13, display: 'block', marginTop: 6 }}>
        个人项目卡 · 新建 / 重命名 / 删除 · 数据来自后端，刷新不丢失
      </Typography.Text>

      <Flex align="center" justify="space-between" style={{ margin: '26px 0 13px' }}>
        <h3 style={{ fontSize: 15, margin: 0 }}>📁 我的项目</h3>
        <Button type="primary" className="ds-grad ds-pill" size="small" onClick={() => setCreateOpen(true)}>
          ＋ 新建项目
        </Button>
      </Flex>

      {loaded && projects.length === 0 ? (
        <div className="ds-card" style={{ padding: '48px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 34, marginBottom: 12 }}>🎬</div>
          <div style={{ fontSize: 14.5, marginBottom: 6 }}>还没有项目</div>
          <Typography.Text type="secondary" style={{ fontSize: 12.5, display: 'block', marginBottom: 18 }}>
            从一个故事开始：新建项目后，提交剧本即可进入创作工作流
          </Typography.Text>
          <Button type="primary" className="ds-grad ds-pill" onClick={() => setCreateOpen(true)}>
            ＋ 新建第一个项目
          </Button>
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 15 }}>
        {projects.map((p) => {
          const s = stats[p.id];
          return (
            <Card
              key={p.id}
              className="ds-card"
              style={{ overflow: 'hidden', cursor: 'pointer' }}
              styles={{ body: { padding: '12px 14px' } }}
              onClick={() => navigate(`/project/${p.id}/scripts`)}
              cover={
                <div className="ds-cv">
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      color: 'rgba(255,255,255,.85)',
                    }}
                  >
                    {p.name}
                  </div>
                  <div className="ds-ops">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenameId(p.id);
                        setRenameValue(p.name);
                        setRenameModels({
                          imageModel: p.imageModel,
                          storyboardImageModel: p.storyboardImageModel,
                          deriveAssetsModel: p.deriveAssetsModel,
                        });
                      }}
                    >
                      ✎ 项目设置
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(p);
                      }}
                    >
                      🗑 删除
                    </button>
                  </div>
                </div>
              }
            >
              <b style={{ fontSize: 13.5 }}>{p.name}</b>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 7 }}>
                <Flex align="center" justify="space-between">
                  <span style={{ fontSize: 10.5, color: 'var(--ant-color-text-tertiary)' }}>
                    创建于 {formatDateTime(p.createTime)}
                  </span>
                  <span style={{ fontSize: 10.5, color: 'var(--ant-color-text-tertiary)' }}>
                    {p.videoRatio} · {p.artStyle}
                  </span>
                </Flex>
                <span style={{ fontSize: 10.5, color: 'var(--ant-color-text-tertiary)' }}>
                  角色 {s?.roleCount ?? 0} · 剧本 {s?.scriptCount ?? 0} · 视频 {s?.videoCount ?? 0} · 分镜{' '}
                  {s?.storyboardCount ?? 0}
                </span>
                <span style={{ fontSize: 10.5, color: 'var(--ant-color-text-tertiary)' }}>
                  {p.type} · {p.imageQuality}
                </span>
              </div>
            </Card>
          );
        })}
        {projects.length > 0 ? (
          <button type="button" className="ds-newCard" onClick={() => setCreateOpen(true)}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>＋</div>
              <div style={{ fontSize: 12 }}>新建项目</div>
            </div>
          </button>
        ) : null}
      </div>

      <Modal
        open={createOpen}
        className="ds-modal"
        title="✨ 新建项目"
        onCancel={() => setCreateOpen(false)}
        styles={{ mask: { backdropFilter: 'blur(4px)', background: 'rgba(5,5,10,.62)' } }}
        footer={[
          <Button key="cancel" className="ds-ghost ds-pill" size="small" onClick={() => setCreateOpen(false)}>
            取消
          </Button>,
          <Button key="ok" type="primary" className="ds-grad ds-pill" size="small" loading={creating} onClick={() => void onCreate()}>
            创 建
          </Button>,
        ]}
      >
        <Flex vertical gap={13}>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 11.5, display: 'block', marginBottom: 6 }}>
              项目名称
            </Typography.Text>
            <Input
              placeholder="输入项目名称"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onPressEnter={() => void onCreate()}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 11.5, display: 'block', marginBottom: 6 }}>
                故事类型
              </Typography.Text>
              <Select
                style={{ width: '100%' }}
                value={form.type}
                onChange={(type) => setForm((f) => ({ ...f, type }))}
                options={PROJECT_TYPE_OPTIONS}
              />
            </div>
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 11.5, display: 'block', marginBottom: 6 }}>
                视频风格
              </Typography.Text>
              <Select
                style={{ width: '100%' }}
                value={form.artStyle}
                onChange={(artStyle) => setForm((f) => ({ ...f, artStyle }))}
                options={ART_STYLE_OPTIONS}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 11.5, display: 'block', marginBottom: 6 }}>
                画面比例
              </Typography.Text>
              <Select
                style={{ width: '100%' }}
                value={form.videoRatio}
                onChange={(videoRatio) => setForm((f) => ({ ...f, videoRatio }))}
                options={VIDEO_RATIO_OPTIONS}
              />
            </div>
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 11.5, display: 'block', marginBottom: 6 }}>
                生图质量
              </Typography.Text>
              <Select
                style={{ width: '100%' }}
                value={form.imageQuality}
                onChange={(imageQuality) => setForm((f) => ({ ...f, imageQuality }))}
                options={IMAGE_QUALITY_OPTIONS}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 11.5, display: 'block', marginBottom: 6 }}>
                图像模型
              </Typography.Text>
              <Select
                style={{ width: '100%' }}
                value={form.imageModel}
                onChange={(imageModel) => setForm((f) => ({ ...f, imageModel }))}
                options={
                  imageModelOptions.length
                    ? imageModelOptions.map((m) => ({ value: m.value, label: imageModelOptionLabel(m) }))
                    : IMAGE_MODEL_OPTIONS.map((m) => ({ value: m.value, label: m.label }))
                }
              />
            </div>
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 11.5, display: 'block', marginBottom: 6 }}>
                视频模型
              </Typography.Text>
              <Select
                style={{ width: '100%' }}
                value={form.videoModel}
                onChange={(videoModel) => setForm((f) => ({ ...f, videoModel }))}
                options={VIDEO_MODEL_OPTIONS}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 11.5, display: 'block', marginBottom: 6 }}>
                分镜图模型（可选）
              </Typography.Text>
              <Select
                style={{ width: '100%' }}
                value={form.storyboardImageModel}
                onChange={(storyboardImageModel) => setForm((f) => ({ ...f, storyboardImageModel }))}
                options={modelOptionsFor(form.imageModel)}
              />
            </div>
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 11.5, display: 'block', marginBottom: 6 }}>
                衍生资产模型（可选）
              </Typography.Text>
              <Select
                style={{ width: '100%' }}
                value={form.deriveAssetsModel}
                onChange={(deriveAssetsModel) => setForm((f) => ({ ...f, deriveAssetsModel }))}
                options={modelOptionsFor(form.imageModel)}
              />
            </div>
          </div>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 11.5, display: 'block', marginBottom: 6 }}>
              项目简介（可选）
            </Typography.Text>
            <Input.TextArea
              rows={2}
              placeholder="一句话介绍这个故事"
              value={newIntro}
              onChange={(e) => setNewIntro(e.target.value)}
            />
          </div>
        </Flex>
      </Modal>

      <Modal
        open={renameId !== null}
        className="ds-modal"
        title="项目设置"
        onCancel={() => setRenameId(null)}
        styles={{ mask: { backdropFilter: 'blur(4px)', background: 'rgba(5,5,10,.62)' } }}
        footer={[
          <Button key="cancel" className="ds-ghost ds-pill" size="small" onClick={() => setRenameId(null)}>
            取消
          </Button>,
          <Button key="ok" type="primary" className="ds-grad ds-pill" size="small" loading={renaming} onClick={() => void onRename()}>
            保存
          </Button>,
        ]}
      >
        <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onPressEnter={() => void onRename()} />
        <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 11.5, display: 'block', marginBottom: 6 }}>
              图像模型
            </Typography.Text>
            <Select
              style={{ width: '100%' }}
              value={renameModels.imageModel}
              onChange={(imageModel) => setRenameModels((m) => ({ ...m, imageModel }))}
              options={
                imageModelOptions.length
                  ? imageModelOptions.map((m) => ({ value: m.value, label: imageModelOptionLabel(m) }))
                  : IMAGE_MODEL_OPTIONS.map((m) => ({ value: m.value, label: m.label }))
              }
            />
          </div>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 11.5, display: 'block', marginBottom: 6 }}>
              分镜图模型（分镜工作区「生成图片」用；留空=跟随图像模型）
            </Typography.Text>
            <Select
              style={{ width: '100%' }}
              value={renameModels.storyboardImageModel}
              onChange={(storyboardImageModel) => setRenameModels((m) => ({ ...m, storyboardImageModel }))}
              options={modelOptionsFor(renameModels.imageModel)}
            />
          </div>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 11.5, display: 'block', marginBottom: 6 }}>
              衍生资产模型（阶段3 衍生资产生成用；留空=跟随图像模型）
            </Typography.Text>
            <Select
              style={{ width: '100%' }}
              value={renameModels.deriveAssetsModel}
              onChange={(deriveAssetsModel) => setRenameModels((m) => ({ ...m, deriveAssetsModel }))}
              options={modelOptionsFor(renameModels.imageModel)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
