import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Flex, Input, Modal, Select, Typography } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import {
  ART_STYLE_OPTIONS,
  DEFAULT_PROJECT_FORM,
  IMAGE_MODEL_OPTIONS,
  IMAGE_QUALITY_OPTIONS,
  PROJECT_TYPE_OPTIONS,
  VIDEO_MODEL_OPTIONS,
  VIDEO_RATIO_OPTIONS,
} from '../config/project';
import type { ImageModelOption } from '../types/api';

/** 项目表单的全部字段——新建与编辑是同一套（后端 editProject 也收全字段） */
export type ProjectFormValues = {
  name: string;
  intro: string;
  type: string;
  artStyle: string;
  videoRatio: string;
  imageQuality: string;
  imageModel: string;
  videoModel: string;
  storyboardImageModel: string;
  deriveAssetsModel: string;
};

export const EMPTY_PROJECT_FORM: ProjectFormValues = { name: '', intro: '', ...DEFAULT_PROJECT_FORM };

/** 模型清单的加载状态：区分「拉取失败」（可用兜底表）与「后端确实没有可用供应商」（该拦住） */
export type ModelsStatus = 'loading' | 'ok' | 'error';

type Props = {
  open: boolean;
  mode: 'create' | 'edit';
  /** 编辑模式的初始值 */
  initial?: ProjectFormValues | null;
  /** 后端真实的风格目录名；为空时回退内置清单 */
  artStyles: string[];
  imageModels: ImageModelOption[];
  videoModels: ImageModelOption[];
  modelsStatus: ModelsStatus;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (values: ProjectFormValues) => void;
  /** 编辑模式下的危险区操作；新建时不传 */
  onDelete?: () => void;
};

/** 图像模型标签带上能力注解——能力不同决定它能不能吃参考图，会直接影响生成是否成功 */
type ModelCapability = Pick<
  ImageModelOption,
  'label' | 'textToImage' | 'supportsReference' | 'requiresReference'
>;

export function imageModelLabel(m: ModelCapability): string {
  const capability = m.requiresReference
    ? '仅图生图·约2-5分钟/张'
    : m.textToImage && m.supportsReference
      ? '文生图/图生图'
      : '仅文生图';
  return `${m.label}（${capability}）`;
}

/** 模型值 `<供应商id>:<模型名>` → 只显示模型名（跟随项的回显用） */
function shortModelName(value: string): string {
  const name = (value || '').split(':').pop() ?? '';
  return name || '未配置';
}

export function ProjectFormModal({
  open,
  mode,
  initial,
  artStyles,
  imageModels,
  videoModels,
  modelsStatus,
  submitting,
  onCancel,
  onSubmit,
  onDelete,
}: Props) {
  const [form, setForm] = useState<ProjectFormValues>(EMPTY_PROJECT_FORM);
  const set = <K extends keyof ProjectFormValues>(key: K, value: ProjectFormValues[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // 只在「打开」或模式变化时同步一次初始值：编辑取项目现状，新建回到默认值。
  // initial 走 ref 读取（不进依赖），否则父组件每次重渲染都生成新对象会把正在输入的内容冲掉。
  const initialRef = useRef(initial);
  initialRef.current = initial;
  useEffect(() => {
    if (!open) return;
    const source = mode === 'edit' && initialRef.current ? initialRef.current : EMPTY_PROJECT_FORM;
    setForm({ ...source });
  }, [open, mode]);

  /** 后端没有可用供应商——建项目必然失败，直接拦住 */
  const noProviders = modelsStatus === 'ok' && imageModels.length === 0 && videoModels.length === 0;

  const artStyleOptions = useMemo(() => {
    if (!artStyles.length) return ART_STYLE_OPTIONS.map((s) => ({ value: s.value, label: s.label }));
    const known = new Map(ART_STYLE_OPTIONS.map((s) => [s.value, s.label]));
    return artStyles.map((value) => ({ value, label: known.get(value) ?? value }));
  }, [artStyles]);

  const imageModelOptions = useMemo(() => {
    const list = imageModels.length
      ? imageModels.map((m) => ({ value: m.value, label: imageModelLabel(m) }))
      : IMAGE_MODEL_OPTIONS.map((m) => ({ value: m.value, label: imageModelLabel(m) }));
    return list;
  }, [imageModels]);

  const videoModelOptions = useMemo(() => {
    const list = videoModels.length
      ? videoModels.map((m) => ({ value: m.value, label: `${m.label} · ${m.vendorName}` }))
      : VIDEO_MODEL_OPTIONS.map((m) => ({ value: m.value, label: m.label }));
    return list;
  }, [videoModels]);

  /** 空串 = 跟随图像模型（后端按 `字段 || imageModel` 取值） */
  const followOptions = (current: string) => [
    { value: '', label: `跟随图像模型（${shortModelName(current)}）` },
    ...imageModelOptions.filter((o) => o.value !== current),
  ];

  const canSubmit = form.name.trim().length > 0 && !noProviders;

  return (
    <Modal
      open={open}
      className="ds-modal"
      width={560}
      title={mode === 'edit' ? '项目设置' : '新建项目'}
      onCancel={onCancel}
      // 遮罩交给 CSS（.ds-mask）：原来写死 rgba(5,5,10,.62)，在亮色主题下压得太黑
      classNames={{ mask: 'ds-mask' }}
      footer={[
        <Button key="cancel" className="ds-ghost ds-pill" size="small" onClick={onCancel}>
          取消
        </Button>,
        <Button
          key="ok"
          type="primary"
          className="ds-grad ds-pill"
          size="small"
          loading={submitting}
          disabled={!canSubmit}
          onClick={() => onSubmit({ ...form, name: form.name.trim() })}
        >
          {mode === 'edit' ? '保存' : '创 建'}
        </Button>,
      ]}
    >
      {noProviders ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="没有可用的模型供应商"
          description="后端未启用任何图像或视频模型供应商，此时创建项目后无法生成内容。请先在服务端 o_vendorConfig 中配置并启用供应商。"
        />
      ) : modelsStatus === 'error' ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="模型清单拉取失败"
          description="下方模型下拉展示的是内置兜底清单，可能与服务端实际可用的模型不一致。"
        />
      ) : null}

      {/* 基础信息 */}
      <div className="ds-formGroup">
        <div className="ds-formGroupTitle">基础信息</div>
        <Flex vertical gap={13}>
          <div>
            <label className="ds-fieldLabel" htmlFor="pf-name">
              项目名称
            </label>
            <Input
              id="pf-name"
              placeholder="输入项目名称"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
            <div>
              <label className="ds-fieldLabel" htmlFor="pf-type">
                故事类型
              </label>
              <Select
                id="pf-type"
                style={{ width: '100%' }}
                value={form.type}
                onChange={(v) => set('type', v)}
                options={PROJECT_TYPE_OPTIONS}
              />
            </div>
            <div>
              <label className="ds-fieldLabel" htmlFor="pf-style">
                视频风格
              </label>
              <Select
                id="pf-style"
                style={{ width: '100%' }}
                value={form.artStyle}
                onChange={(v) => set('artStyle', v)}
                options={artStyleOptions}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
            <div>
              <label className="ds-fieldLabel" htmlFor="pf-ratio">
                画面比例
              </label>
              <Select
                id="pf-ratio"
                style={{ width: '100%' }}
                value={form.videoRatio}
                onChange={(v) => set('videoRatio', v)}
                options={VIDEO_RATIO_OPTIONS}
              />
            </div>
            <div>
              <label className="ds-fieldLabel" htmlFor="pf-quality">
                生图质量
              </label>
              <Select
                id="pf-quality"
                style={{ width: '100%' }}
                value={form.imageQuality}
                onChange={(v) => set('imageQuality', v)}
                options={IMAGE_QUALITY_OPTIONS}
              />
            </div>
          </div>
          <div>
            <label className="ds-fieldLabel" htmlFor="pf-intro">
              项目简介（可选）
            </label>
            <Input.TextArea
              id="pf-intro"
              rows={2}
              placeholder="一句话介绍这个故事"
              value={form.intro}
              onChange={(e) => set('intro', e.target.value)}
            />
          </div>
        </Flex>
      </div>

      {/* 模型选择 */}
      <div className="ds-formGroup">
        <div className="ds-formGroupTitle">模型选择</div>
        <Flex vertical gap={13}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
            <div>
              <label className="ds-fieldLabel" htmlFor="pf-image-model">
                图像模型
              </label>
              <Select
                id="pf-image-model"
                style={{ width: '100%' }}
                value={form.imageModel}
                onChange={(v) => set('imageModel', v)}
                options={imageModelOptions}
                showSearch
                optionFilterProp="label"
              />
            </div>
            <div>
              <label className="ds-fieldLabel" htmlFor="pf-video-model">
                视频模型
              </label>
              <Select
                id="pf-video-model"
                style={{ width: '100%' }}
                value={form.videoModel}
                onChange={(v) => set('videoModel', v)}
                options={videoModelOptions}
                showSearch
                optionFilterProp="label"
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
            <div>
              <label className="ds-fieldLabel" htmlFor="pf-sb-model">
                分镜图模型
              </label>
              <Select
                id="pf-sb-model"
                style={{ width: '100%' }}
                value={form.storyboardImageModel}
                onChange={(v) => set('storyboardImageModel', v)}
                options={followOptions(form.imageModel)}
              />
            </div>
            <div>
              <label className="ds-fieldLabel" htmlFor="pf-derive-model">
                衍生资产模型
              </label>
              <Select
                id="pf-derive-model"
                style={{ width: '100%' }}
                value={form.deriveAssetsModel}
                onChange={(v) => set('deriveAssetsModel', v)}
                options={followOptions(form.imageModel)}
              />
            </div>
          </div>
        </Flex>
      </div>

      {mode === 'edit' && onDelete ? (
        <div className="ds-dangerZone">
          <Typography.Text style={{ fontSize: 12, display: 'block', marginBottom: 10 }}>
            修改模型 / 质量 / 风格只影响之后的生成，不会重做已生成的资产与分镜。
          </Typography.Text>
          <Button danger size="small" icon={<DeleteOutlined />} onClick={onDelete}>
            删除项目
          </Button>
        </div>
      ) : null}
    </Modal>
  );
}