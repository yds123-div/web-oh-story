import { useCallback, useEffect, useState } from 'react';
import { App, Button, Card, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
  createProject,
  deleteProject,
  fetchAllProjectStatistics,
  fetchArtStyleDirs,
  fetchImageModels,
  fetchVideoModels,
  listProjects,
  patchProject,
} from '../lib/api';
import type { ImageModelOption, Project, ProjectStatistics } from '../types/api';
import { errorMessage } from '../lib/errors';
import { formatDateTime } from '../lib/format';
import {
  EMPTY_PROJECT_FORM,
  ProjectFormModal,
  type ModelsStatus,
  type ProjectFormValues,
} from '../components/ProjectFormModal';
import {
  GettingStartedModal,
  hasSeenOnboarding,
  markOnboardingDone,
} from '../components/GettingStartedModal';

/** 项目现状 → 表单值（编辑弹窗的初始值） */
function toFormValues(p: Project): ProjectFormValues {
  return {
    name: p.name,
    intro: p.intro,
    type: p.type,
    artStyle: p.artStyle,
    videoRatio: p.videoRatio,
    imageQuality: p.imageQuality,
    imageModel: p.imageModel,
    videoModel: p.videoModel,
    storyboardImageModel: p.storyboardImageModel,
    deriveAssetsModel: p.deriveAssetsModel,
  };
}

export default function HomePage() {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<Record<string, ProjectStatistics>>({});
  const [loaded, setLoaded] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editing, setEditing] = useState<Project | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /** 视频风格目录名（artStyle 的合法取值） */
  const [artStyles, setArtStyles] = useState<string[]>([]);
  const [imageModels, setImageModels] = useState<ImageModelOption[]>([]);
  const [videoModels, setVideoModels] = useState<ImageModelOption[]>([]);
  const [modelsStatus, setModelsStatus] = useState<ModelsStatus>('loading');

  // 模型与风格清单是次要数据：拉不到就退回内置兜底表，页面照常可用。
  // 但「拉成功但清单为空」要和「拉失败」分开——前者是后端真的没启用供应商，建项目必然失败。
  useEffect(() => {
    void Promise.all([fetchImageModels(), fetchVideoModels()])
      .then(([img, video]) => {
        setImageModels(img);
        setVideoModels(video);
        setModelsStatus('ok');
      })
      .catch(() => setModelsStatus('error'));
    void fetchArtStyleDirs()
      .then(setArtStyles)
      .catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    const data = await listProjects();
    // 后端列表无排序保证，按创建时间（id 为 Date.now 时间戳）倒序展示，全部呈现不截断
    const sorted = [...data.projects].sort((a, b) => Number(b.id) - Number(a.id));
    setProjects(sorted);
    setLoaded(true);
    // 计数走聚合接口一次拿全（原来是对每个项目各发一次，项目一多就是 N+1）
    setStats(await fetchAllProjectStatistics().catch(() => ({})));
  }, []);

  useEffect(() => {
    void load().catch(() => message.error('加载项目列表失败'));
  }, [load, message]);

  /**
   * 首次运行引导：只在「读过标记不存在」且「确实缺东西」时弹一次。
   * 两个触发条件——还没有项目，或后端一个模型供应商都没启用（后者意味着建了项目也生成不出内容）。
   * modelsStatus 为 error 时按「不知道」处理，不弹，避免把网络故障误报成配置缺失。
   */
  const [onboarding, setOnboarding] = useState(false);
  useEffect(() => {
    if (!loaded || hasSeenOnboarding()) return;
    const noProjects = projects.length === 0;
    const noVendors = modelsStatus === 'ok' && imageModels.length === 0 && videoModels.length === 0;
    if (noProjects || noVendors) setOnboarding(true);
  }, [loaded, projects.length, modelsStatus, imageModels.length, videoModels.length]);

  const closeOnboarding = (goSettings: boolean) => {
    markOnboardingDone();
    setOnboarding(false);
    if (goSettings) navigate('/settings');
  };

  const openCreate = () => {
    setFormMode('create');
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (project: Project) => {
    setFormMode('edit');
    setEditing(project);
    setFormOpen(true);
  };

  const onSubmit = async (values: ProjectFormValues) => {
    setSubmitting(true);
    try {
      if (formMode === 'create') {
        await createProject({ ...values });
        message.success(`项目「${values.name}」已创建并保存到后端`);
      } else if (editing) {
        await patchProject(editing.id, { ...values });
        message.success('已保存到后端');
      }
      setFormOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      message.error(errorMessage(err, formMode === 'create' ? '新建项目失败' : '保存失败'));
    } finally {
      setSubmitting(false);
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
      <div className="ds-pageHead">
        <div>
          <h1 className="ds-pageTitle">我的项目</h1>
          <Typography.Text className="ds-pageSub">
            管理你的全部短剧项目 · 新建 / 编辑 / 删除 · 数据来自后端，刷新不丢失
          </Typography.Text>
        </div>
        <Button type="primary" className="ds-grad ds-pill" icon={<PlusOutlined />} onClick={openCreate}>
          新建项目
        </Button>
      </div>

      {loaded && projects.length === 0 ? (
        <Card className="ds-card" style={{ marginTop: 26 }}>
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 34, marginBottom: 12 }}>🎬</div>
            <div style={{ fontSize: 14.5, marginBottom: 6 }}>还没有项目</div>
            <Typography.Text type="secondary" style={{ fontSize: 12.5, display: 'block', marginBottom: 18 }}>
              从一个故事开始：新建项目后，提交剧本即可进入创作工作流
            </Typography.Text>
            <Button type="primary" className="ds-grad ds-pill" icon={<PlusOutlined />} onClick={openCreate}>
              新建第一个项目
            </Button>
          </div>
        </Card>
      ) : (
        <div className="ds-pgrid" style={{ marginTop: 26 }}>
          {projects.map((p) => {
            const s = stats[p.id];
            return (
              <article
                key={p.id}
                className="ds-pcard"
                onClick={() => navigate(`/project/${p.id}/scripts`)}
              >
                <div className="ds-pcardTop">
                  <b title={p.name}>{p.name}</b>
                  <span className="ds-tag">{p.type}</span>
                </div>
                <div className="ds-pcardTags">
                  <span className="ds-tagMono">{p.artStyle || '未设置风格'}</span>
                  <span className="ds-tagMono">{p.videoRatio}</span>
                  <span className="ds-tagMono">{p.imageQuality}</span>
                </div>
                <p className="ds-pcardIntro">{p.intro || '（未填写项目简介）'}</p>
                <div className="ds-pcardStats">
                  角色 {s?.roleCount ?? 0} · 剧本 {s?.scriptCount ?? 0} · 视频 {s?.videoCount ?? 0} · 分镜{' '}
                  {s?.storyboardCount ?? 0}
                </div>
                <div className="ds-pcardFoot">
                  <span>创建于 {formatDateTime(p.createTime)}</span>
                  <div className="ds-pcardOps">
                    <button
                      type="button"
                      title="项目设置"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(p);
                      }}
                    >
                      <EditOutlined />
                      项目设置
                    </button>
                    <button
                      type="button"
                      className="danger"
                      title="删除项目"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(p);
                      }}
                    >
                      <DeleteOutlined />
                      删除
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
          <button type="button" className="ds-newCard" onClick={openCreate}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>
                <PlusOutlined />
              </div>
              <div style={{ fontSize: 12 }}>新建项目</div>
            </div>
          </button>
        </div>
      )}

      <ProjectFormModal
        open={formOpen}
        mode={formMode}
        initial={editing ? toFormValues(editing) : EMPTY_PROJECT_FORM}
        artStyles={artStyles}
        imageModels={imageModels}
        videoModels={videoModels}
        modelsStatus={modelsStatus}
        submitting={submitting}
        onCancel={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={(values) => void onSubmit(values)}
        onDelete={
          formMode === 'edit' && editing
            ? () => {
                const target = editing;
                setFormOpen(false);
                setEditing(null);
                onDelete(target);
              }
            : undefined
        }
      />

      <GettingStartedModal
        open={onboarding}
        onStart={() => closeOnboarding(true)}
        onSkip={() => closeOnboarding(false)}
      />
    </div>
  );
}