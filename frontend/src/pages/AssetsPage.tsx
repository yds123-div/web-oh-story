import { useEffect, useRef, useState } from 'react';
import { App, Button, Input, Modal, Pagination, Tag, Typography } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { WorkflowHeader } from '../components/WorkflowHeader';
import {
  countAssets,
  createAsset,
  deleteAsset,
  fetchProject,
  listAssets,
  updateAsset,
  uploadAssetImage,
} from '../lib/api';
import { errorMessage } from '../lib/errors';
import type { Asset, AssetType } from '../types/api';

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

const PAGE_SIZE = 12;

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

function AssetCard({
  asset,
  onUpdated,
  onDeleted,
  onUpload,
}: {
  asset: Asset;
  /** 编辑保存后：用重查结果替换本卡 */
  onUpdated: (next: Asset) => void;
  /** 删除后：父组件决定本地移除或页码回退 */
  onDeleted: () => void;
  /** 上传入口（父组件持有文件读取逻辑，成功后重查列表） */
  onUpload: (asset: Asset) => void;
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

  return (
    <div className={`ds-charCard${asset.type === 'scene' ? ' wide' : ''}`}>
      <div className="img">
        {asset.imageUrl ? (
          <img src={asset.imageUrl} alt={asset.name} />
        ) : (
          <div className="ds-phEmoji">{typeMeta.placeholder}</div>
        )}
      </div>
      <div className="info">
        <div className="nm">
          {asset.name} <span className="ds-miniTag">{typeMeta.tag}</span>
        </div>
        <div className="ds">{asset.description || '暂无描述'}</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          <Button size="small" onClick={() => onUpload(asset)}>
            🖼 {asset.imageUrl ? '更换图片' : '上传图片'}
          </Button>
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
  const [assets, setAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<PageAssetType>('character');
  const [counts, setCounts] = useState<Record<PageAssetType, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<Asset | null>(null);
  const [addName, setAddName] = useState('');
  const [addDescription, setAddDescription] = useState('');
  const [addPrompt, setAddPrompt] = useState('');

  // 项目名（页头展示）
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const project = await fetchProject(id, controller.signal);
        setProjectName(project.name);
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

  const loadList = async (targetPage = page) => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const result = await listAssets(id, { type: filter, page: targetPage, limit: PAGE_SIZE });
      setAssets(result.assets);
      setTotal(result.total);
    } catch (err) {
      setLoadFailed(true);
      message.error(errorMessage(err, '加载资产失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadList(page);
    void loadCounts();
    // filter/page 驱动重查；loadList/loadCounts 读取最新 state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, filter, page]);

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
              还没有{TYPE_META[filter].tag}。可在剧本页对剧本执行 AI 提取，或手工新增。
            </div>
            <div style={{ marginTop: 16, display: 'flex', gap: 10, justifyContent: 'center' }}>
              <Button
                type="primary"
                className="ds-grad ds-pill"
                size="small"
                onClick={() => navigate(`/project/${id}/scripts`)}
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
            资产来自剧本 AI 提取或手工创建，增删改与图片上传均实时保存到后端。
          </span>
        </div>
      </div>

      <div className="ds-flowBar">
        <span className="msg">{uploadingId ? '图片上传中…' : '角色、场景和道具就绪后可进入下一步'}</span>
        <Button className="ds-ghost ds-pill" size="small" onClick={() => navigate(`/project/${id}/scripts`)}>
          上一步
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
