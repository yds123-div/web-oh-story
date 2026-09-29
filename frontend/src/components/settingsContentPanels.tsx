import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Flex,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { DeleteOutlined, PlusOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import {
  bindPromptToModel,
  clearAllAgentMemory,
  createModelPromptFile,
  deleteModelPromptFile,
  fetchMemoryConfig,
  fetchModelMap,
  fetchModelPromptFiles,
  fetchSkillContent,
  fetchSkillList,
  saveMemoryConfig,
  saveSkillContent,
  updateModelPromptFile,
  type MemoryConfig,
  type ModelMapVendor,
  type ModelPromptFile,
} from '../lib/api';
import { errorMessage } from '../lib/errors';

const Hint = ({ children }: { children: React.ReactNode }) => (
  <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
    {children}
  </Typography.Text>
);

// ===== 模型映射 =====

export function ModelMapPanel() {
  return (
    <Flex vertical gap={22}>
      <ModelBindingPanel />
      <div>
        <div className="ds-formGroupTitle">提示词模板文件</div>
        <ModelPromptFilesPanel />
      </div>
    </Flex>
  );
}

/** 模型 ← 模板 的绑定表 */
function ModelBindingPanel() {
  const { message } = App.useApp();
  const [vendors, setVendors] = useState<ModelMapVendor[]>([]);
  const [files, setFiles] = useState<ModelPromptFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [binding, setBinding] = useState<string | null>(null);

  /** 已选中的模板（key 是 `vendorId:model`），未选时用后端已绑定的值 */
  const [picked, setPicked] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [map, promptFiles] = await Promise.all([fetchModelMap(), fetchModelPromptFiles()]);
      setVendors(map);
      setFiles(promptFiles);
    } catch (err) {
      message.error(errorMessage(err, '加载模型映射失败'));
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const fileOptions = files.map((f) => ({ value: f.path, label: `${f.name}（${f.type}）` }));

  const onBind = async (vendorId: string, model: string) => {
    const key = `${vendorId}:${model}`;
    const path = picked[key];
    if (!path) {
      message.warning('请先选择一个提示词模板');
      return;
    }
    const file = files.find((f) => f.path === path);
    if (!file) return;
    setBinding(key);
    try {
      await bindPromptToModel({ vendorId, model, path, fileName: file.name });
      message.success(`已把「${file.name}」绑到 ${model}`);
      await reload();
    } catch (err) {
      message.error(errorMessage(err, '绑定失败'));
    } finally {
      setBinding(null);
    }
  };

  // 后端 getImageAndVideoModel 号称 image+video，实际按 type === 'video' 过滤，界面上如实说明
  const rows = vendors.flatMap((v) =>
    (v.promptList ?? []).map((m) => ({ vendorId: v.id, vendorName: v.name, ...m })),
  );

  return (
    <Flex vertical gap={12}>
      <Alert
        type="info"
        showIcon
        message="这里管的是「模型 ← 提示词模板」的绑定"
        description="模板文件在 data/modelPrompt/<type>/ 下。后端按 vendorId + model 记一条 o_modelPrompt，命中后生成请求会用该模板。另注：接口名叫 getImageAndVideoModel，但后端实际只筛 type === 'video'，所以下表只有视频模型。"
      />
      <Space>
        <Button size="small" icon={<ReloadOutlined />} onClick={() => void reload()}>
          刷新
        </Button>
        <Hint>共 {rows.length} 个可绑定模型，{files.length} 个模板文件</Hint>
      </Space>
      <Table
        size="small"
        rowKey={(r) => `${r.vendorId}:${r.model}`}
        loading={loading}
        pagination={false}
        dataSource={rows}
        columns={[
          { title: '供应商', dataIndex: 'vendorName', width: 160 },
          {
            title: '模型',
            dataIndex: 'name',
            width: 240,
            render: (name: string, row) => (
              <Space size={6}>
                <span>{name}</span>
                {/* 后端同时给了友好名 name 与真实 modelName，两个都显示，别让人只看到裸 modelName */}
                <span style={{ opacity: 0.6, fontSize: 11.5 }}>{row.model}</span>
              </Space>
            ),
          },
          {
            title: '当前模板',
            dataIndex: 'fileName',
            width: 200,
            render: (fileName: string | undefined, row) =>
              fileName ? (
                <Tag>{fileName}</Tag>
              ) : row.path ? (
                <Tag>{String(row.path).split('/').pop()}</Tag>
              ) : (
                <Tag color="default">未绑定</Tag>
              ),
          },
          {
            title: '改绑',
            render: (_: unknown, row) => {
              const key = `${row.vendorId}:${row.model}`;
              return (
                <Space size={6}>
                  <Select
                    size="small"
                    style={{ minWidth: 220 }}
                    placeholder="选择提示词模板"
                    value={picked[key]}
                    onChange={(v) => setPicked((p) => ({ ...p, [key]: v }))}
                    options={fileOptions}
                  />
                  <Button
                    size="small"
                    loading={binding === key}
                    onClick={() => void onBind(row.vendorId, row.model)}
                  >
                    绑定
                  </Button>
                </Space>
              );
            },
          },
        ]}
      />
    </Flex>
  );
}

/** 模板文件的新建 / 编辑 / 删除 */
export function ModelPromptFilesPanel() {
  const { message } = App.useApp();
  const [files, setFiles] = useState<ModelPromptFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ModelPromptFile | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'image' | 'video'>('video');

  const reload = useCallback(
    async (keepSelection = false) => {
      setLoading(true);
      try {
        const list = await fetchModelPromptFiles();
        setFiles(list);
        if (!keepSelection) setSelected(null);
        else if (selected) {
          const again = list.find((f) => f.path === selected.path);
          if (again) {
            setSelected(again);
            setDraft(again.data);
          }
        }
      } catch (err) {
        message.error(errorMessage(err, '加载模板文件失败'));
      } finally {
        setLoading(false);
      }
    },
    [message, selected],
  );

  useEffect(() => {
    void reload();
    // 只在挂载时拉一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await updateModelPromptFile({ name: selected.name, data: draft, type: selected.type as 'image' | 'video' });
      message.success('已保存');
      await reload(true);
    } catch (err) {
      message.error(errorMessage(err, '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  const onCreate = async () => {
    const name = newName.trim();
    if (!name) {
      message.warning('请输入文件名');
      return;
    }
    setSaving(true);
    try {
      await createModelPromptFile({ name, data: draft, type: newType });
      message.success('已新建模板文件');
      setCreating(false);
      setNewName('');
      setDraft('');
      await reload();
    } catch (err) {
      message.error(errorMessage(err, '新建失败'));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (file: ModelPromptFile) => {
    try {
      await deleteModelPromptFile(file.path);
      message.success('已删除');
      if (selected?.path === file.path) setSelected(null);
      await reload();
    } catch (err) {
      message.error(errorMessage(err, '删除失败'));
    }
  };

  if (selected || creating) {
    return (
      <Flex vertical gap={12}>
        <Space>
          <Button size="small" onClick={() => { setSelected(null); setCreating(false); }}>
            返回列表
          </Button>
          {creating ? (
            <>
              <span>新建模板：</span>
              <Input
                size="small"
                style={{ width: 220 }}
                placeholder="文件名（不含 .md）"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <Select
                size="small"
                style={{ width: 110 }}
                value={newType}
                onChange={setNewType}
                options={[
                  { value: 'video', label: 'video' },
                  { value: 'image', label: 'image' },
                ]}
              />
            </>
          ) : (
            <Space size={6}>
              <b>{selected?.path}</b>
            </Space>
          )}
        </Space>
        <Input.TextArea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoSize={{ minRows: 12, maxRows: 26 }}
          style={{ fontFamily: 'Consolas, Monaco, monospace', fontSize: 12.5 }}
        />
        <Space>
          <Button
            type="primary"
            className="ds-grad ds-pill"
            size="small"
            icon={<SaveOutlined />}
            loading={saving}
            disabled={creating && !newName.trim()}
            onClick={() => void (creating ? onCreate() : onSave())}
          >
            {creating ? '新建' : '保存'}
          </Button>
          <Hint>共 {draft.length} 字</Hint>
        </Space>
      </Flex>
    );
  }

  return (
    <Flex vertical gap={12}>
      <Alert
        type="warning"
        showIcon
        message="新建同名文件会直接覆盖"
        description="后端 savePrompt 不校验文件是否已存在，同名即覆盖；改写走 updatePrompt（文件不存在会报 404）。"
      />
      <Space>
        <Button size="small" icon={<ReloadOutlined />} onClick={() => void reload()}>
          刷新
        </Button>
        <Button
          size="small"
          type="primary"
          className="ds-grad ds-pill"
          icon={<PlusOutlined />}
          onClick={() => {
            setCreating(true);
            setDraft('');
          }}
        >
          新建模板
        </Button>
        <Hint>共 {files.length} 个文件</Hint>
      </Space>
      {loading ? <Hint>加载中…</Hint> : null}
      {files.map((f) => (
        <button
          key={f.path}
          type="button"
          className="ds-listRow"
          onClick={() => {
            setSelected(f);
            setDraft(f.data);
          }}
        >
          <span>
            {f.path} <span style={{ opacity: 0.6, fontSize: 11.5 }}>· {f.data.length} 字</span>
          </span>
          <Space onClick={(e) => e.stopPropagation()}>
            <Popconfirm
              title={`删除 ${f.path}？`}
              description="文件会从磁盘上移除，已引用它的模型将失去模板。"
              okText="删除"
              okButtonProps={{ danger: true }}
              cancelText="取消"
              onConfirm={() => void onDelete(f)}
            >
              <Button size="small" danger type="text" icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        </button>
      ))}
    </Flex>
  );
}

// ===== Skills 技能管理 =====

export function SkillPanel() {
  const { message } = App.useApp();
  const [paths, setPaths] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setPaths(await fetchSkillList());
    } catch (err) {
      message.error(errorMessage(err, '加载技能列表失败'));
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onOpen = async (path: string) => {
    try {
      const content = await fetchSkillContent(path);
      setSelected(path);
      setDraft(content);
    } catch (err) {
      message.error(errorMessage(err, '读取技能内容失败'));
    }
  };

  const onSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await saveSkillContent(selected, draft);
      message.success('已保存');
    } catch (err) {
      message.error(errorMessage(err, '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  if (selected) {
    return (
      <Flex vertical gap={12}>
        <Space>
          <Button size="small" onClick={() => setSelected(null)}>
            返回列表
          </Button>
          <b>{selected}</b>
        </Space>
        <Alert
          type="info"
          showIcon
          message="这些文件就是 Agent 的提示词本体"
          description="ScriptAgent 与 ProductionAgent 的提示词外化为 data/skills 下的 markdown，改完立即生效、不需要重启。"
        />
        <Input.TextArea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoSize={{ minRows: 16, maxRows: 30 }}
          style={{ fontFamily: 'Consolas, Monaco, monospace', fontSize: 12.5 }}
        />
        <Space>
          <Button
            type="primary"
            className="ds-grad ds-pill"
            size="small"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={() => void onSave()}
          >
            保存
          </Button>
          <Hint>共 {draft.length} 字</Hint>
        </Space>
      </Flex>
    );
  }

  // 按顶层目录分组，读起来比一长串平铺路径清楚
  const groups = paths.reduce<Record<string, string[]>>((acc, p) => {
    const dir = p.includes('/') ? p.split('/')[0] : '（根目录）';
    (acc[dir] ??= []).push(p);
    return acc;
  }, {});

  return (
    <Flex vertical gap={12}>
      <Alert
        type="info"
        showIcon
        message="只允许改已存在的文件"
        description="后端 saveSkillContent 会先检查文件存在，不存在直接回「文件不存在」——所以这里没有新建能力，加技能文件要放上磁盘后刷新。"
      />
      <Space>
        <Button size="small" icon={<ReloadOutlined />} onClick={() => void reload()}>
          刷新
        </Button>
        <Hint>共 {paths.length} 个文件</Hint>
      </Space>
      {loading ? <Hint>加载中…</Hint> : null}
      {Object.entries(groups).map(([dir, items]) => (
        <div key={dir}>
          <div className="ds-formGroupTitle">
            {dir} · {items.length}
          </div>
          <Flex vertical gap={6}>
            {items.map((p) => (
              <button key={p} type="button" className="ds-listRow" onClick={() => void onOpen(p)}>
                <span>{p}</span>
                <span style={{ opacity: 0.5, fontSize: 11 }}>编辑</span>
              </button>
            ))}
          </Flex>
        </div>
      ))}
    </Flex>
  );
}

// ===== Agent 记忆配置 =====

/** 记忆配置里的纯数字字段（用字面量联合，才能直接当 React key 用） */
type MemoryNumberKey =
  | 'messagesPerSummary'
  | 'shortTermLimit'
  | 'summaryMaxLength'
  | 'summaryLimit'
  | 'ragLimit'
  | 'deepRetrieveSummaryLimit';

/** 数字字段的可读标注——含义取自 `utils/agent/memory.ts` 的注释与默认值 */
const MEMORY_NUMBER_FIELDS: Array<{
  key: MemoryNumberKey;
  label: string;
  hint: string;
}> = [
  { key: 'messagesPerSummary', label: 'messagesPerSummary', hint: '每累积多少条 message 触发一次 summary 生成（默认 3）' },
  { key: 'shortTermLimit', label: 'shortTermLimit', hint: 'get() 返回的近期未总结 message 条数（默认 5）' },
  { key: 'summaryMaxLength', label: 'summaryMaxLength', hint: 'summary 最大字符长度（默认 500）' },
  { key: 'summaryLimit', label: 'summaryLimit', hint: 'get() 返回的 summary 条数（默认 10）' },
  { key: 'ragLimit', label: 'ragLimit', hint: 'get() 向量相似搜索返回的 message 条数（默认 3）' },
  { key: 'deepRetrieveSummaryLimit', label: 'deepRetrieveSummaryLimit', hint: 'deepRetrieve() 向量召回 summary 的条数（默认 5）' },
];

export function MemoryPanel() {
  const { message, modal } = App.useApp();
  const [config, setConfig] = useState<MemoryConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setConfig(await fetchMemoryConfig());
    } catch (err) {
      message.error(errorMessage(err, '加载记忆配置失败'));
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const set = <K extends keyof MemoryConfig>(key: K, value: MemoryConfig[K]) =>
    setConfig((c: MemoryConfig | null) => (c ? { ...c, [key]: value } : c));

  const onSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await saveMemoryConfig(config);
      message.success('已保存');
      await reload();
    } catch (err) {
      message.error(errorMessage(err, '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  const onClear = () => {
    modal.confirm({
      title: '清空全部 Agent 记忆？',
      content:
        '会清空 memories 表（向量检索用的历史消息与摘要），不可恢复。已生成的项目数据不受影响。',
      okText: '清空',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        setClearing(true);
        try {
          await clearAllAgentMemory();
          message.success('已清空记忆');
        } catch (err) {
          message.error(errorMessage(err, '清空失败'));
        } finally {
          setClearing(false);
        }
      },
    });
  };

  if (loading || !config) return <Hint>加载中…</Hint>;

  return (
    <Flex vertical gap={14}>
      <Alert
        type="info"
        showIcon
        message="检索窗口参数"
        description="这些值决定 Agent 每轮能看到多少历史：太多会撑爆上下文并变慢，太少会丢上下文。下面的默认值来自后端 memory.ts 的 DEFAULTS。"
      />
      {MEMORY_NUMBER_FIELDS.map((f) => (
        <div key={f.key}>
          <label className="ds-fieldLabel">{f.label}</label>
          <InputNumber
            style={{ width: 220 }}
            min={1}
            value={config[f.key]}
            onChange={(v) => set(f.key, v ?? 1)}
          />
          <Hint>{f.hint}</Hint>
        </div>
      ))}

      <div>
        <label className="ds-fieldLabel">modelOnnxFile（本地 embedding 模型路径片段）</label>
        <Input
          value={config.modelOnnxFile.join('/')}
          onChange={(e) =>
            set(
              'modelOnnxFile',
              e.target.value.split('/').filter((s) => s.trim().length > 0),
            )
          }
        />
        <Hint>
          用 / 分隔，写成数组存进 o_setting（默认 all-MiniLM-L6-v2/onnx/model_fp16.onnx）
        </Hint>
      </div>

      <div>
        <label className="ds-fieldLabel">modelDtype（ONNX 量化类型）</label>
        <Select
          style={{ width: 220 }}
          value={config.modelDtype}
          onChange={(v) => set('modelDtype', v)}
          options={[
            { value: 'fp32', label: 'fp32（更准、更慢）' },
            { value: 'fp16', label: 'fp16（更快）' },
          ]}
        />
      </div>

      <Space>
        <Button
          type="primary"
          className="ds-grad ds-pill"
          size="small"
          loading={saving}
          onClick={() => void onSave()}
        >
          保存
        </Button>
        <Button
          size="small"
          danger
          icon={<DeleteOutlined />}
          loading={clearing}
          onClick={onClear}
        >
          清空全部记忆
        </Button>
      </Space>
    </Flex>
  );
}