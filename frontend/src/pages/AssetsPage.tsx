import { useEffect, useRef, useState } from 'react';
import { App, Button, Input, Modal, Pagination, Spin, Tag, Typography } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { WorkflowHeader } from '../components/WorkflowHeader';
import { useWorkflowStep } from '../hooks/useWorkflowStep';
import {
  batchPolishAssetPrompts,
  cancelAssetImageGeneration,
  countAssets,
  createAsset,
  deleteAsset,
  extractScriptAssets,
  fetchProject,
  generateAssetImage,
  listAssets,
  polishAssetPrompt,
  pollAssetPromptsUntilSettled,
  pollExtractionUntilDone,
  ExtractionTimeoutError,
  PromptPollTimeoutError,
  updateAsset,
  uploadAssetImage,
  type AssetAiItem,
} from '../lib/api';
import { canExtract, isExtractionActive } from '../lib/extractState';
import { isImageActive } from '../lib/assetGenState';
import { errorMessage } from '../lib/errors';
import type {
  Asset,
  AssetType,
  Project,
  Script,
  ScriptExtractState,
  ScriptExtractStatus,
} from '../types/api';

/** 页面上可见的资产类型（素材无后端对应，按规格隐藏） */
type PageAssetType = Exclude<AssetType, 'material'>;

const TYPE_META: Record<
  PageAssetType,
  { label: string; icon: string; tag: string; placeholder: string }
> = {
  character: { label: '全部角色', icon: '👥', tag: '角色', placeholder: '👤' },
  scene: { label: '全部场景', icon: '🏛', tag: '场景', placeholder: '🏛' },
  prop: { label: '全部道具', icon: '🗝', tag: '道具', placeholder: '🗝' },
};

/** 提示词在卡片上的摘要长度 */
const PROMPT_SNIPPET_LENGTH = 60;

const PAGE_SIZE = 12;

/** 生图进行中静默重查列表的间隔（及时拿到后端落的 o_image 占位，取消才可达） */
const GENERATE_POLL_INTERVAL_MS = 2000;

/** base64 上传的体积上限（data URL 约为原文件的 4/3，8MB 原图约 10MB 报文） */
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** 表单字段标签（新增/编辑弹窗共用同一份字段块） */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
        {label}
      </Typography.Text>
      {children}
    </div>
  );
}

/** 资产表单三字段（名称/描述/生图提示词），新增与编辑弹窗共用 */
function AssetFields({
  name,
  description,
  prompt,
  onName,
  onDescription,
  onPrompt,
}: {
  name: string;
  description: string;
  prompt: string;
  onName: (value: string) => void;
  onDescription: (value: string) => void;
  onPrompt: (value: string) => void;
}) {
  return (
    <>
      <Field label="名称">
        <Input value={name} onChange={(e) => onName(e.target.value)} placeholder="资产名称" maxLength={50} />
      </Field>
      <Field label="描述">
        <Input.TextArea
          value={description}
          onChange={(e) => onDescription(e.target.value)}
          rows={4}
          placeholder="资产描述（用于生图的视觉设定）"
        />
      </Field>
      <Field label="生图提示词（可选，AI 生图时使用）">
        <Input.TextArea
          value={prompt}
          onChange={(e) => onPrompt(e.target.value)}
          rows={3}
          placeholder="留空则由 AI 根据描述生成"
        />
      </Field>
    </>
  );
}

/** 润色状态徽标（状态翻译在 API 层完成，此处只配 UI） */
function promptStateTag(state: Asset['promptState']) {
  switch (state) {
    case 'running':
      return <Tag color="processing">润色中</Tag>;
    case 'done':
      return <Tag color="success">提示词已润色</Tag>;
    case 'failed':
      return <Tag color="error">润色失败</Tag>;
    default:
      return null;
  }
}

/** 生图状态徽标：未生成且无图 → 待生成；进行中/失败如实展示 */
function imageStateTag(asset: Asset) {
  if (isImageActive(asset.imageState)) return <Tag color="processing">图片生成中</Tag>;
  if (asset.imageState === 'failed') return <Tag color="error">生成失败</Tag>;
  if (asset.imageState === 'none' && !asset.imageUrl) return <Tag color="warning">形象待生成</Tag>;
  return null;
}

function AssetCard({
  asset,
  onUpdated,
  onDeleted,
  onUpload,
  onPolish,
  onGenerate,
  onCancelGenerate,
  polishing,
  generating,
  batchRunning,
  generateError,
}: {
  asset: Asset;
  /** 编辑保存后：用重查结果替换本卡 */
  onUpdated: (next: Asset) => void;
  /** 删除后：父组件决定本地移除或页码回退 */
  onDeleted: () => void;
  /** 上传入口（父组件持有文件读取逻辑，成功后重查列表） */
  onUpload: (asset: Asset) => void;
  /** AI 润色提示词（父组件持有请求与状态更新） */
  onPolish: (asset: Asset) => void;
  /** AI 生成形象（父组件持有项目配置与失败态） */
  onGenerate: (asset: Asset) => void;
  /** 取消进行中的生图（o_image 行已存在时可见） */
  onCancelGenerate: (asset: Asset) => void;
  /** 本卡润色请求进行中 */
  polishing: boolean;
  /** 本卡生图请求进行中 */
  generating: boolean;
  /** 批量润色进行中（禁用单卡润色避免重复消耗） */
  batchRunning: boolean;
  /** 生图失败原因（本次会话内触发过时展示；后端父资产行不回传历史原因） */
  generateError?: string | null;
}) {
  const { message, modal } = App.useApp();
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPrompt, setEditPrompt] = useState('');

  const typeMeta = TYPE_META[asset.type as PageAssetType] ?? TYPE_META.character;

  const onSaveEdit = async () => {
    const name = editName.trim();
    if (!name) {
      message.warning('请填写资产名称');
      return;
    }
    const nextPrompt = editPrompt.trim() ? editPrompt : null;
    setSaving(true);
    try {
      await updateAsset({
        id: asset.id,
        name,
        description: editDescription.trim(),
        prompt: nextPrompt,
        remark: asset.remark,
      });
      onUpdated({ ...asset, name, description: editDescription.trim(), prompt: nextPrompt });
      setEditing(false);
      message.success('资产已更新');
    } catch (err) {
      message.error(errorMessage(err, '更新资产失败'));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    modal.confirm({
      title: '确认删除',
      content: `删除「${asset.name}」后无法恢复，确定删除吗？`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteAsset(asset.id);
          onDeleted();
          message.success('资产已删除');
        } catch (err) {
          message.error(errorMessage(err, '删除资产失败'));
        }
      },
    });
  };

  const promptSnippet =
    asset.prompt && asset.prompt.length > PROMPT_SNIPPET_LENGTH
      ? `${asset.prompt.slice(0, PROMPT_SNIPPET_LENGTH)}……`
      : (asset.prompt ?? '');

  return (
    <div className={`ds-charCard${asset.type === 'scene' ? ' wide' : ''}`}>
      <div className="img">
        {asset.imageUrl ? (
          <img src={asset.imageUrl} alt={asset.name} />
        ) : (
          <div className="ds-phEmoji">{typeMeta.placeholder}</div>
        )}
        {generating ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'var(--ant-color-bg-mask)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              color: 'var(--ant-color-warning)',
              fontSize: 12.5,
            }}
          >
            <Spin size="small" />
            <span>AI 生图中…（图像 key 到位后可用）</span>
          </div>
        ) : null}
      </div>
      <div className="info">
        <div className="nm">
          {asset.name} <span className="ds-miniTag">{typeMeta.tag}</span>
        </div>
        <div className="ds">{asset.description || '暂无描述'}</div>
        {promptSnippet ? (
          <Typography.Text
            type="secondary"
            style={{ fontSize: 12, display: 'block', marginTop: 4 }}
            title={asset.prompt ?? undefined}
          >
            提示词：{promptSnippet}
          </Typography.Text>
        ) : null}
        <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
          {promptStateTag(asset.promptState)}
          {imageStateTag(asset)}
        </div>
        {asset.promptState === 'failed' && asset.promptErrorReason ? (
          <Typography.Text type="danger" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
            润色失败：{asset.promptErrorReason}
          </Typography.Text>
        ) : null}
        {generateError ? (
          <Typography.Text type="danger" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
            生成失败：{generateError}
          </Typography.Text>
        ) : null}
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          <Button size="small" onClick={() => onUpload(asset)}>
            🖼 {asset.imageUrl ? '更换图片' : '上传图片'}
          </Button>
          <Button
            size="small"
            loading={polishing}
            disabled={batchRunning || asset.promptState === 'running'}
            onClick={() => onPolish(asset)}
          >
            ✨ 润色提示词
          </Button>
          {isImageActive(asset.imageState) && asset.imageId ? (
            <Button size="small" danger onClick={() => onCancelGenerate(asset)}>
              取消生成
            </Button>
          ) : (
            <Button
              size="small"
              loading={generating}
              onClick={() => onGenerate(asset)}
              disabled={isImageActive(asset.imageState)}
            >
              🎨 {asset.imageUrl ? '重新生成形象' : '生成形象'}
            </Button>
          )}
          <Button
            size="small"
            onClick={() => {
              setEditName(asset.name);
              setEditDescription(asset.description);
              setEditPrompt(asset.prompt ?? '');
              setEditing(true);
            }}
          >
            ✏️ 编辑
          </Button>
          <Button size="small" danger onClick={onDelete}>
            删除
          </Button>
        </div>
      </div>

      <Modal
        open={editing}
        title={`编辑资产 · ${asset.name}`}
        okText="保存"
        cancelText="取消"
        onOk={onSaveEdit}
        onCancel={() => setEditing(false)}
        confirmLoading={saving}
        width={520}
      >
        <AssetFields
          name={editName}
          description={editDescription}
          prompt={editPrompt}
          onName={setEditName}
          onDescription={setEditDescription}
          onPrompt={setEditPrompt}
        />
      </Modal>
    </div>
  );
}

export default function AssetsPage() {
  const { message } = App.useApp();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { scripts, retry } = useWorkflowStep();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<PageAssetType>('character');
  const [counts, setCounts] = useState<Record<PageAssetType, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<Asset | null>(null);
  const [addName, setAddName] = useState('');
  const [addDescription, setAddDescription] = useState('');
  const [addPrompt, setAddPrompt] = useState('');
  /** 单卡润色进行中的资产 id */
  const [polishingIds, setPolishingIds] = useState<Set<string>>(new Set());
  /** 单卡生图进行中的资产 id */
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  /** 本地记录的生图失败原因（后端父资产行不回传 o_image.errorReason，刷新后丢失属预期） */
  const [generateErrors, setGenerateErrors] = useState<Record<string, string>>({});
  /** 批量润色进行中 */
  const [batchPolishing, setBatchPolishing] = useState(false);
  /** 就地发起提取时对 Provider 剧本状态的本地覆盖（id → 最新提取状态） */
  const [extractOverrides, setExtractOverrides] = useState<Record<string, ScriptExtractState>>({});
  /** 已发起提取请求、等待后端响应的剧本（按钮 loading） */
  const [pendingKickoff, setPendingKickoff] = useState(false);

  // 项目配置（页头展示 + 生图用的 imageModel/imageQuality）
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        setProject(await fetchProject(id, controller.signal));
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        message.error(errorMessage(err, '加载项目失败'));
      }
    })();
    return () => controller.abort();
  }, [id, message]);

  const loadCounts = async () => {
    try {
      const [character, scene, prop] = await Promise.all([
        countAssets(id, 'character'),
        countAssets(id, 'scene'),
        countAssets(id, 'prop'),
      ]);
      setCounts({ character, scene, prop });
    } catch {
      // 计数失败不打断列表；下一次重查会再补
    }
  };

  /** silent：不切换整页 loading（生图占位刷新等场景，避免列表闪空） */
  const loadList = async (targetPage = page, options: { silent?: boolean } = {}) => {
    if (!options.silent) setLoading(true);
    setLoadFailed(false);
    try {
      const result = await listAssets(id, { type: filter, page: targetPage, limit: PAGE_SIZE });
      setAssets(result.assets);
      setTotal(result.total);
    } catch (err) {
      setLoadFailed(true);
      message.error(errorMessage(err, '加载资产失败'));
    } finally {
      if (!options.silent) setLoading(false);
    }
  };

  useEffect(() => {
    void loadList(page);
    void loadCounts();
    // filter/page 驱动重查；loadList/loadCounts 读取最新 state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, filter, page]);

  /** 列表行的本地补丁（不改 id/type 等主键字段） */
  const patchAsset = (assetId: string, patch: Partial<Asset>) => {
    setAssets((list) => list.map((item) => (item.id === assetId ? { ...item, ...patch } : item)));
  };

  const onFilterChange = (type: PageAssetType) => {
    setFilter(type);
    setPage(1);
  };

  const onAdd = async () => {
    const name = addName.trim();
    if (!name) {
      message.warning('请填写资产名称');
      return;
    }
    setSaving(true);
    try {
      await createAsset({
        projectId: id,
        type: filter,
        name,
        description: addDescription.trim(),
        prompt: addPrompt.trim() || undefined,
      });
      setAdding(false);
      setAddName('');
      setAddDescription('');
      setAddPrompt('');
      message.success('资产已创建');
      // 后端不返回 id：重查列表与计数
      void loadList();
      void loadCounts();
    } catch (err) {
      message.error(errorMessage(err, '新增资产失败'));
    } finally {
      setSaving(false);
    }
  };

  // ===== AI 提取（本页可就地发起；进行中显示横幅并轮询）=====

  const scriptStatus = (script: Script): ScriptExtractStatus =>
    extractOverrides[script.id]?.extractStatus ?? script.extractStatus;

  /** 处于提取中的剧本（本地覆盖优先），驱动轮询 */
  const activeExtractIds = (scripts ?? [])
    .filter((s) => isExtractionActive(scriptStatus(s)))
    .map((s) => s.id);
  const activeExtractKey = activeExtractIds.join('|');

  const extractableScripts = (scripts ?? []).filter((s) => canExtract(scriptStatus(s)));

  const onExtractHere = async () => {
    // 资产页就地发起：对可提取的剧本（未提取/上次失败）触发后端异步提取
    if (extractableScripts.length === 0) {
      navigate(`/project/${id}/scripts`);
      return;
    }
    const ids = extractableScripts.map((s) => s.id);
    setPendingKickoff(true);
    try {
      await extractScriptAssets(id, ids);
      setExtractOverrides((prev) => {
        const next = { ...prev };
        for (const scriptId of ids) {
          next[scriptId] = { id: scriptId, extractStatus: 'waiting', errorReason: null };
        }
        return next;
      });
    } catch (err) {
      message.error(errorMessage(err, '触发提取失败'));
    } finally {
      setPendingKickoff(false);
    }
  };

  const overridesRef = useRef(extractOverrides);
  useEffect(() => {
    overridesRef.current = extractOverrides;
  });
  // 轮询回调闭包里取最新页码，避免换页后重查旧页
  const pageRef = useRef(page);
  useEffect(() => {
    pageRef.current = page;
  });

  useEffect(() => {
    if (activeExtractIds.length === 0) return;
    const controller = new AbortController();

    const tick = (states: ScriptExtractState[]) => {
      setExtractOverrides((prev) => {
        const next = { ...prev };
        for (const state of states) next[state.id] = state;
        return next;
      });
      for (const state of states) {
        const before = overridesRef.current[state.id];
        if (before && before.extractStatus === state.extractStatus) continue;
        if (state.extractStatus === 'done') {
          message.success('资产提取完成：角色与场景已入库');
          // 资产已入库：重查列表/计数，并刷新门控（三步条与后续页面解锁）
          void loadList(pageRef.current, { silent: true });
          void loadCounts();
          retry();
        }
        if (state.extractStatus === 'failed') {
          message.error(`提取失败：${state.errorReason ?? '原因未知'}`);
        }
      }
    };

    // 轮询编排（循环/间隔/超时/终态）收敛在 API client
    void pollExtractionUntilDone(activeExtractIds, { onTick: tick }, controller.signal).catch(
      (err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (err instanceof ExtractionTimeoutError) {
          setExtractOverrides((prev) => {
            const next = { ...prev };
            for (const scriptId of activeExtractIds) {
              if (isExtractionActive(next[scriptId]?.extractStatus ?? 'none')) {
                next[scriptId] = { id: scriptId, extractStatus: 'failed', errorReason: '提取超时，请重新发起' };
              }
            }
            return next;
          });
          message.warning('资产提取超时，请重新发起');
        }
      },
    );

    return () => controller.abort();
    // activeExtractKey 变化（发起/完成）时重建；message/retry 身份稳定
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeExtractKey, message, retry]);

  // ===== AI 润色（单个同步 / 批量异步轮询）=====

  const onPolish = async (asset: Asset) => {
    setPolishingIds((prev) => new Set(prev).add(asset.id));
    try {
      const prompt = await polishAssetPrompt({
        assetId: asset.id,
        projectId: asset.projectId || id,
        type: asset.type as PageAssetType,
        name: asset.name,
        description: asset.description,
      });
      patchAsset(asset.id, { prompt, promptState: 'done', promptErrorReason: null });
      message.success('提示词已润色并保存');
    } catch (err) {
      // 后端失败时资产行也落「失败」态；本地镜像同一状态便于展示原因
      const reason = errorMessage(err, '润色失败');
      patchAsset(asset.id, { promptState: 'failed', promptErrorReason: reason });
      message.error(`润色失败：${reason}`);
    } finally {
      setPolishingIds((prev) => {
        const next = new Set(prev);
        next.delete(asset.id);
        return next;
      });
    }
  };

  const onBatchPolish = async () => {
    const items: AssetAiItem[] = assets
      .filter((a) => a.type !== 'material')
      .map((a) => ({
        assetId: a.id,
        type: a.type as PageAssetType,
        name: a.name,
        description: a.description,
      }));
    if (items.length === 0) return;
    const ids = items.map((item) => item.assetId);

    setBatchPolishing(true);
    for (const assetId of ids) {
      patchAsset(assetId, { promptState: 'running', promptErrorReason: null });
    }
    const controller = new AbortController();
    batchPollControllerRef.current = controller;
    try {
      await batchPolishAssetPrompts(id, items);
      message.success(`已提交 ${items.length} 个资产的提示词润色`);
      // 后台并发生成，轮询资产列表直到全部终态（收敛在 API client）
      await pollAssetPromptsUntilSettled(
        id,
        ids,
        {
          onTick: (states) => {
            for (const state of states) {
              patchAsset(state.id, { promptState: state.promptState, promptErrorReason: state.promptErrorReason });
            }
          },
          intervalMs: 2000,
        },
        controller.signal,
      );
      // 终态后重查拿最终提示词文本（轮询只回状态）
      await loadList(page, { silent: true });
      message.success('批量润色完成，提示词已保存');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (err instanceof PromptPollTimeoutError) {
        message.warning('批量润色超时，可稍后刷新查看结果');
        await loadList(page, { silent: true });
        return;
      }
      message.error(errorMessage(err, '批量润色失败'));
      await loadList(page, { silent: true });
    } finally {
      batchPollControllerRef.current = null;
      setBatchPolishing(false);
    }
  };

  /** 批量润色轮询的取消控制器（离开页面/换项目时终止轮询） */
  const batchPollControllerRef = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = batchPollControllerRef.current;
    return () => controller?.abort();
  }, [id]);

  // ===== AI 生图（图像 key 未到位时失败：原因展示、可重试、可取消）=====

  const onGenerate = async (asset: Asset) => {
    if (!project) {
      message.warning('项目配置尚未加载完成，请稍后再试');
      return;
    }
    if (asset.type === 'material') return;
    setGeneratingIds((prev) => new Set(prev).add(asset.id));
    setGenerateErrors((prev) => {
      const { [asset.id]: _omit, ...rest } = prev;
      return rest;
    });
    // 后端受理即落 o_image 占位并挂到资产：静默重查拿 imageId，期间可取消
    void loadList(page, { silent: true });
    try {
      const result = await generateAssetImage({
        assetId: asset.id,
        projectId: asset.projectId || id,
        type: asset.type as PageAssetType,
        name: asset.name,
        description: asset.description,
        // 按后端自身约定：项目配置的图像模型与画质（o_project.imageModel / imageQuality）
        model: project.imageModel,
        resolution: project.imageQuality,
        prompt: asset.prompt || asset.description || asset.name,
        // 参考图仅限本地上传的 data URL；后端生成图的 oss 路径不是 base64
        base64: asset.imageUrl?.startsWith('data:') ? asset.imageUrl : null,
      });
      patchAsset(asset.id, { imageUrl: result.imageUrl, imageState: 'done' });
      message.success('形象已生成');
    } catch (err) {
      const reason = errorMessage(err, '生成失败');
      // 后端失败时 o_image 置「生成失败」并挂到资产行，本地镜像同一状态
      patchAsset(asset.id, { imageState: 'failed' });
      setGenerateErrors((prev) => ({ ...prev, [asset.id]: reason }));
      message.error(`生成失败：${reason}`);
    } finally {
      setGeneratingIds((prev) => {
        const next = new Set(prev);
        next.delete(asset.id);
        return next;
      });
    }
  };

  const onCancelGenerate = async (asset: Asset) => {
    if (!asset.imageId) return;
    try {
      await cancelAssetImageGeneration(asset.imageId);
      message.success('已取消生成');
    } catch (err) {
      message.error(errorMessage(err, '取消失败'));
    } finally {
      // 取消只是把 o_image 置失败，行状态以后端为准重查
      await loadList(page, { silent: true });
    }
  };

  /**
   * 生图进行中：定时静默重查列表。后端受理即落 o_image 占位并挂到资产行，
   * 重查拿到 imageId 后「取消生成」才可达；卡片状态也以后端为准。
   */
  useEffect(() => {
    if (generatingIds.size === 0) return;
    const timer = setInterval(() => {
      void loadList(pageRef.current, { silent: true });
    }, GENERATE_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatingIds.size]);

  const onUploadClick = (asset: Asset) => {
    uploadTargetRef.current = asset;
    fileInputRef.current?.click();
  };

  const onFileSelected = async (files: FileList | null) => {
    const asset = uploadTargetRef.current;
    const file = files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!asset || !file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      message.warning('图片不能超过 8MB，请压缩后重试');
      return;
    }
    // 仅后端三类资产可传图（material 无后端类型）
    if (asset.type === 'material') return;
    const type = asset.type;
    setUploadingId(asset.id);
    try {
      const base64 = await readAsDataUrl(file);
      await uploadAssetImage({
        assetId: asset.id,
        projectId: asset.projectId || id,
        type,
        base64,
        // 原样回传，避免后端保存图片时清空提示词
        prompt: asset.prompt,
      });
      await loadList();
      message.success('图片已上传');
    } catch (err) {
      message.error(errorMessage(err, '上传图片失败'));
    } finally {
      setUploadingId(null);
    }
  };

  const projectName = project?.name ?? '';

  return (
    <div className="ds-flowPage">
      <WorkflowHeader projectName={projectName || '项目'} tag="资产库" current="assets" />
      <div className="ds-viewInner">
        <div className="ds-statRow">
          {(Object.keys(TYPE_META) as PageAssetType[]).map((type) => (
            <button
              key={type}
              type="button"
              className={`ds-statCard${filter === type ? ' on' : ''}`}
              onClick={() => onFilterChange(type)}
            >
              <div className="nm">
                {TYPE_META[type].icon} {TYPE_META[type].label}
              </div>
              <div className="ct">{counts ? counts[type] : '…'}</div>
            </button>
          ))}
        </div>

        {activeExtractIds.length > 0 ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '22px 24px',
              marginBottom: 20,
              background: 'var(--ant-color-bg-container)',
              border: '1px solid var(--ant-color-border)',
              borderRadius: 12,
            }}
          >
            <Spin />
            <div>
              <b style={{ fontSize: 14.5 }}>AI 正在通读剧本，提取角色与场景…</b>
              <div style={{ color: 'var(--ant-color-text-tertiary)', fontSize: 12.5, marginTop: 4 }}>
                异步任务进行中，完成后资产将自动出现在下方
              </div>
            </div>
          </div>
        ) : null}

        {loadFailed ? (
          <div className="ds-emptyHint">
            加载资产失败
            <Button
              className="ds-ghost ds-pill"
              size="small"
              style={{ marginLeft: 12 }}
              onClick={() => void loadList()}
            >
              重试
            </Button>
          </div>
        ) : loading ? null : assets.length === 0 ? (
          <div className="ds-emptyHint">
            <div style={{ fontSize: 32, marginBottom: 10 }}>{TYPE_META[filter].icon}</div>
            <div>
              还没有{TYPE_META[filter].tag}。可在本页对剧本执行 AI 提取，或手工新增。
            </div>
            <div style={{ marginTop: 16, display: 'flex', gap: 10, justifyContent: 'center' }}>
              <Button
                type="primary"
                className="ds-grad ds-pill"
                size="small"
                loading={pendingKickoff}
                disabled={activeExtractIds.length > 0}
                onClick={() => void onExtractHere()}
              >
                🤖 AI 提取资产
              </Button>
              <Button className="ds-ghost ds-pill" size="small" onClick={() => setAdding(true)}>
                ＋ 手工新增
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="ds-assetGrid">
              {assets.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  onUpdated={(next) =>
                    setAssets((list) => list.map((item) => (item.id === next.id ? next : item)))
                  }
                  onDeleted={() => {
                    // 删掉本页最后一条且不在第一页：回退到上一页（否则误显空状态）
                    if (assets.length === 1 && page > 1) {
                      setTotal((t) => Math.max(0, t - 1));
                      setPage(page - 1);
                      return;
                    }
                    setAssets((list) => list.filter((item) => item.id !== asset.id));
                    setTotal((t) => Math.max(0, t - 1));
                    void loadCounts();
                  }}
                  onUpload={onUploadClick}
                  onPolish={(a) => void onPolish(a)}
                  onGenerate={(a) => void onGenerate(a)}
                  onCancelGenerate={(a) => void onCancelGenerate(a)}
                  polishing={polishingIds.has(asset.id)}
                  generating={generatingIds.has(asset.id)}
                  batchRunning={batchPolishing}
                  generateError={generateErrors[asset.id] ?? null}
                />
              ))}
            </div>
            {total > PAGE_SIZE ? (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
                <Pagination
                  current={page}
                  pageSize={PAGE_SIZE}
                  total={total}
                  showSizeChanger={false}
                  onChange={(next) => setPage(next)}
                />
              </div>
            ) : null}
          </>
        )}

        <div className="ds-noteBar">
          <span className="ic">⚡</span>
          <span>
            资产来自剧本 AI 提取或手工创建，增删改、图片上传与 AI 润色均实时保存到后端。
          </span>
        </div>
      </div>

      <div className="ds-flowBar">
        <span className="msg">
          {uploadingId
            ? '图片上传中…'
            : batchPolishing
              ? '批量润色进行中，完成后提示词自动更新…'
              : generatingIds.size > 0
                ? 'AI 生图进行中，可继续操作其他资产…'
                : '角色、场景和道具就绪后可进入下一步'}
        </span>
        <Button className="ds-ghost ds-pill" size="small" onClick={() => navigate(`/project/${id}/scripts`)}>
          上一步
        </Button>
        <Button
          className="ds-ghost ds-pill"
          size="small"
          disabled={assets.length === 0 || batchPolishing}
          onClick={() => void onBatchPolish()}
        >
          ✨ 批量润色提示词
        </Button>
        <Button className="ds-ghost ds-pill" size="small" onClick={() => setAdding(true)}>
          ＋ 新增资产
        </Button>
        <Button
          type="primary"
          className="ds-grad ds-pill"
          size="small"
          disabled={total === 0}
          onClick={() => navigate(`/project/${id}/episodes`)}
        >
          下一步：分集视频
        </Button>
      </div>

      {/* 上传图片：隐藏 input，选中即读为 data URL 上传（base64 保存到后端静态托管） */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => void onFileSelected(e.target.files)}
      />

      <Modal
        open={adding}
        title={`新增${TYPE_META[filter].tag}`}
        okText="创建"
        cancelText="取消"
        onOk={onAdd}
        onCancel={() => setAdding(false)}
        confirmLoading={saving}
        width={520}
      >
        <div style={{ marginBottom: 12 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            类型：<Tag>{TYPE_META[filter].tag}</Tag>（按当前筛选创建）
          </Typography.Text>
        </div>
        <AssetFields
          name={addName}
          description={addDescription}
          prompt={addPrompt}
          onName={setAddName}
          onDescription={setAddDescription}
          onPrompt={setAddPrompt}
        />
      </Modal>
    </div>
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
}
