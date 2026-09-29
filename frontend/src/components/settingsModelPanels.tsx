import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  Descriptions,
  Flex,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd';
import { ApiOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  fetchAgentDeploy,
  fetchAgentUseMode,
  fetchTextModels,
  fetchVendors,
  saveVendorInputs,
  setVendorEnabled,
  testVendorModel,
  updateAgentModel,
  updateAgentUseMode,
  type AgentDeployRow,
  type VendorRow,
} from '../lib/api';
import type { ImageModelOption } from '../types/api';
import { errorMessage } from '../lib/errors';

const Hint = ({ children }: { children: React.ReactNode }) => (
  <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
    {children}
  </Typography.Text>
);

/** 把 `<供应商id>:<模型名>` 拆成三段（o_agentDeploy 的 model/vendorId/modelName 要一起给） */
function splitModelValue(value: string): { vendorId: string; modelName: string } {
  const idx = value.indexOf(':');
  if (idx < 0) return { vendorId: '', modelName: value };
  return { vendorId: value.slice(0, idx), modelName: value.slice(idx + 1) };
}

// ===== 模型服务 =====

/** 单个供应商：输入项表单 + 模型清单 + 连通测试 */
function VendorCard({
  vendor,
  onChanged,
}: {
  vendor: VendorRow;
  onChanged: () => Promise<void>;
}) {
  const { message } = App.useApp();
  const [values, setValues] = useState<Record<string, string>>(vendor.inputValues ?? {});
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);

  // 父级重载后同步一次（例如批量操作后）
  useEffect(() => {
    setValues(vendor.inputValues ?? {});
  }, [vendor.inputValues]);

  const [testKey, setTestKey] = useState<string | undefined>(undefined);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; value: string } | null>(null);

  const onSaveInputs = async () => {
    setSaving(true);
    try {
      // 后端是整份覆盖，未改的字段也必须带上——因此直接把当前全部值回传
      await saveVendorInputs(vendor.id, values);
      message.success(`已保存 ${vendor.name} 的输入项`);
      await onChanged();
    } catch (err) {
      message.error(errorMessage(err, '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  const onToggle = async (next: boolean) => {
    setToggling(true);
    try {
      await setVendorEnabled(vendor.id, next);
      message.success(next ? `已启用 ${vendor.name}` : `已停用 ${vendor.name}`);
      await onChanged();
    } catch (err) {
      message.error(errorMessage(err, '切换失败'));
    } finally {
      setToggling(false);
    }
  };

  const onTest = async () => {
    const target = vendor.models.find((m) => m.modelName === testKey);
    if (!target) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testVendorModel({
        id: vendor.id,
        modelName: target.modelName,
        type: target.type as 'text' | 'image' | 'video',
      });
      // 不额外弹 toast：下面的 Alert 已经同时承担状态与结果，再弹一遍就是重复提示
      setTestResult({ ok: true, value: String(result ?? '') });
    } catch (err) {
      setTestResult({ ok: false, value: errorMessage(err, '测试失败') });
    } finally {
      setTesting(false);
    }
  };

  const testedModel = vendor.models.find((m) => m.modelName === testKey);
  const isMedia = testedModel?.type === 'image' || testedModel?.type === 'video';

  return (
    <Card
      size="small"
      style={{ marginBottom: 14 }}
      title={
        <Space size={8}>
          <b>{vendor.name}</b>
          <Tag>{vendor.id}</Tag>
          {vendor.author ? <Tag>作者 {vendor.author}</Tag> : null}
          {vendor.version ? <Tag>v{vendor.version}</Tag> : null}
        </Space>
      }
      extra={
        <Space size={8}>
          <span style={{ fontSize: 12, color: 'var(--ant-color-text-tertiary)' }}>
            {vendor.enable === 1 ? '已启用' : '已停用'}
          </span>
          <Switch
            size="small"
            checked={vendor.enable === 1}
            loading={toggling}
            onChange={(v) => void onToggle(v)}
          />
        </Space>
      }
    >
      {vendor.description ? <Hint>{vendor.description}</Hint> : null}

      {/* 输入项：key / baseUrl 等，按供应商自己的声明渲染 */}
      {vendor.inputs?.length ? (
        <Flex vertical gap={10} style={{ marginTop: 12 }}>
          {vendor.inputs.map((spec) => (
            <div key={spec.key}>
              <label className="ds-fieldLabel" htmlFor={`vi-${vendor.id}-${spec.key}`}>
                {spec.label}
                {spec.required ? ' *' : ''}
                <span style={{ marginLeft: 6, opacity: 0.7 }}>{spec.key}</span>
              </label>
              {spec.type === 'password' ? (
                <Input.Password
                  id={`vi-${vendor.id}-${spec.key}`}
                  placeholder={spec.placeholder}
                  value={values[spec.key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [spec.key]: e.target.value }))}
                />
              ) : (
                <Input
                  id={`vi-${vendor.id}-${spec.key}`}
                  placeholder={spec.placeholder}
                  value={values[spec.key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [spec.key]: e.target.value }))}
                />
              )}
            </div>
          ))}
          <Space>
            <Button
              size="small"
              type="primary"
              className="ds-grad ds-pill"
              loading={saving}
              onClick={() => void onSaveInputs()}
            >
              保存输入项
            </Button>
            <Hint>整份覆盖写回 o_vendorConfig.inputValues</Hint>
          </Space>
        </Flex>
      ) : (
        <Hint>该供应商没有声明输入项。</Hint>
      )}

      {/* 模型清单（本批次只读：新增/编辑/删除模型的表单要按 text/image/video 三种 discriminated union 分别做） */}
      <div style={{ marginTop: 14 }}>
        <div className="ds-formGroupTitle" style={{ marginBottom: 8 }}>
          模型（{vendor.models?.length ?? 0}）
        </div>
        <Flex wrap gap={6}>
          {(vendor.models ?? []).map((m) => (
            <Tag key={m.modelName} style={{ marginInlineEnd: 0 }}>
              {m.name} · {m.type}
              <span style={{ opacity: 0.65 }}> · {m.modelName}</span>
            </Tag>
          ))}
        </Flex>
      </div>

      {/* 连通测试 */}
      {vendor.models?.length ? (
        <div style={{ marginTop: 14 }}>
          <div className="ds-formGroupTitle" style={{ marginBottom: 8 }}>
            连通测试
          </div>
          <Space wrap>
            <Select
              style={{ minWidth: 280 }}
              placeholder="选择要测试的模型"
              value={testKey}
              onChange={setTestKey}
              options={(vendor.models ?? []).map((m) => ({
                value: m.modelName,
                label: `${m.name}（${m.type}）`,
              }))}
            />
            <Button
              size="small"
              icon={<ApiOutlined />}
              loading={testing}
              disabled={!testKey}
              onClick={() => void onTest()}
            >
              测试
            </Button>
          </Space>
          {testResult ? (
            <Alert
              style={{ marginTop: 10 }}
              type={testResult.ok ? 'success' : 'error'}
              showIcon
              message={testResult.ok ? '测试通过' : '测试失败'}
              description={
                testResult.ok && isMedia ? (
                  testedModel?.type === 'image' ? (
                    <img
                      src={testResult.value}
                      alt="连通测试结果"
                      style={{ maxWidth: 240, borderRadius: 8, display: 'block', marginTop: 4 }}
                    />
                  ) : (
                    <a href={testResult.value} target="_blank" rel="noreferrer">
                      {testResult.value}
                    </a>
                  )
                ) : (
                  <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {testResult.value}
                  </span>
                )
              }
            />
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

export function VendorPanel() {
  const { message } = App.useApp();
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setVendors(await fetchVendors());
    } catch (err) {
      message.error(errorMessage(err, '加载供应商列表失败'));
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <Flex vertical gap={12}>
      <Alert
        type="warning"
        showIcon
        message="连通测试会真的发起一次生成请求"
        description="不是轻量探活：文本模型跑一次带工具调用的对话，图像模型真的生成一张 2×2 宫格图，视频模型真的出片——都会消耗额度，图像/视频还需要等待。测试结果会写进 OSS 目录（testImage.jpg / test.mp4）。"
      />
      <Alert
        type="info"
        showIcon
        message="本批次开放了什么、没开放什么"
        description="开放：填 / 改输入项（API key、baseUrl）、启用停用、连通测试。未开放：供应商适配器代码编辑（改代码等于让服务端执行任意 TypeScript）、新增 / 删除供应商、以及模型的增删改（text/image/video 三种模型的字段差异很大，要分别做表单）。"
      />
      <Alert
        type="warning"
        showIcon
        message="API key 会明文回填到浏览器"
        description="getVendorList 会把 inputValues（含 key）原样返回，界面才能显示与保存。这也是整组设置接口都放在 SETTINGS_ACCESS_KEY 口令门后的原因——本仓库是 public，勿把导出的配置或截图外发。"
      />
      <Space>
        <Button size="small" icon={<ReloadOutlined />} onClick={() => void reload()}>
          刷新
        </Button>
        <Hint>
          共 {vendors.length} 个供应商，其中启用 {vendors.filter((v) => v.enable === 1).length} 个
        </Hint>
      </Space>
      {loading ? <Hint>加载中…</Hint> : null}
      {vendors.map((v) => (
        <VendorCard key={v.id} vendor={v} onChanged={reload} />
      ))}
    </Flex>
  );
}

// ===== Agent配置 =====

/** 单行 agent 的模型绑定编辑 */
function AgentEditModal({
  row,
  models,
  onClose,
  onSaved,
}: {
  row: AgentDeployRow | null;
  models: ImageModelOption[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { message } = App.useApp();
  const [value, setValue] = useState<string>('');
  const [desc, setDesc] = useState('');
  const [temperature, setTemperature] = useState<number | null>(null);
  const [maxTokens, setMaxTokens] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!row) return;
    setValue(row.vendorId && row.modelName ? `${row.vendorId}:${row.modelName}` : '');
    setDesc(row.desc ?? '');
    setTemperature(row.temperature ?? null);
    setMaxTokens(row.maxOutputTokens ?? null);
  }, [row]);

  const onSave = async () => {
    if (!row) return;
    const { vendorId, modelName } = splitModelValue(value);
    if (!vendorId || !modelName) {
      message.warning('请选择一个具体的模型');
      return;
    }
    setSaving(true);
    try {
      await updateAgentModel({
        id: row.id,
        name: row.name ?? row.key,
        model: models.find((m) => m.value === value)?.label ?? modelName,
        modelName,
        vendorId,
        desc,
        ...(temperature != null ? { temperature } : {}),
        ...(maxTokens != null ? { maxOutputTokens: maxTokens } : {}),
      });
      message.success('已保存');
      await onSaved();
      onClose();
    } catch (err) {
      message.error(errorMessage(err, '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={row !== null}
      title={`配置 ${row?.key ?? ''}`}
      width={520}
      className="ds-modal"
      onCancel={onClose}
      classNames={{ mask: 'ds-mask' }}
      footer={[
        <Button key="c" className="ds-ghost ds-pill" size="small" onClick={onClose}>
          取消
        </Button>,
        <Button
          key="s"
          type="primary"
          className="ds-grad ds-pill"
          size="small"
          loading={saving}
          onClick={() => void onSave()}
        >
          保存
        </Button>,
      ]}
    >
      <Flex vertical gap={12}>
        <div>
          <label className="ds-fieldLabel">模型</label>
          <Select
            style={{ width: '100%' }}
            value={value || undefined}
            onChange={setValue}
            showSearch
            optionFilterProp="label"
            placeholder="选择文本模型"
            options={models.map((m) => ({ value: m.value, label: `${m.label} · ${m.vendorName}` }))}
          />
          <Hint>写入 o_agentDeploy 的 vendorId + modelName（model 字段记展示名）</Hint>
        </div>
        {row?.temperature != null ? (
          <div>
            <label className="ds-fieldLabel">temperature</label>
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              max={2}
              step={0.1}
              value={temperature}
              onChange={setTemperature}
            />
          </div>
        ) : null}
        {row?.maxOutputTokens != null ? (
          <div>
            <label className="ds-fieldLabel">maxOutputTokens</label>
            <InputNumber
              style={{ width: '100%' }}
              min={1}
              value={maxTokens}
              onChange={setMaxTokens}
            />
          </div>
        ) : null}
        <div>
          <label className="ds-fieldLabel">说明</label>
          <Input value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
      </Flex>
    </Modal>
  );
}

export function AgentPanel() {
  const { message } = App.useApp();
  const [data, setData] = useState<{ ordinary: AgentDeployRow[]; advanced: AgentDeployRow[] }>({
    ordinary: [],
    advanced: [],
  });
  const [mode, setMode] = useState<'0' | '1'>('0');
  const [models, setModels] = useState<ImageModelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingMode, setSavingMode] = useState(false);
  const [editing, setEditing] = useState<AgentDeployRow | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [deploy, useMode] = await Promise.all([fetchAgentDeploy(), fetchAgentUseMode()]);
      setMode(useMode);
      // 后端把 universalAi 同时放进两个列表（qrdinaryData 用 key 无冒号筛、advancedData 又显式带上它），
      // 这里去重，只在小巧的"简易"表里出现一次，避免同一行渲染两遍
      setData({
        ordinary: deploy.qrdinaryData,
        advanced: deploy.advancedData.filter((r) => r.key !== 'universalAi'),
      });
    } catch (err) {
      message.error(errorMessage(err, '加载 Agent 配置失败'));
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    void fetchTextModels()
      .then(setModels)
      .catch(() => undefined);
  }, []);

  const onModeChange = async (next: '0' | '1') => {
    setSavingMode(true);
    try {
      await updateAgentUseMode(next);
      message.success(next === '1' ? '已切到高级配置' : '已切到简易配置');
      await reload();
    } catch (err) {
      message.error(errorMessage(err, '切换失败'));
    } finally {
      setSavingMode(false);
    }
  };

  const columns = [
    { title: 'key', dataIndex: 'key', width: 260 },
    {
      title: '当前模型',
      dataIndex: 'modelName',
      render: (_: unknown, row: AgentDeployRow) =>
        row.modelName ? (
          <Space size={6}>
            {row.vendorId ? <Tag>{row.vendorId}</Tag> : null}
            {/* 后端把这个字段存成 `<供应商id>:<模型名>`，前面已经用标签显示了供应商，这里去掉重复前缀 */}
            <span>{row.modelName.replace(`${row.vendorId}:`, '')}</span>
          </Space>
        ) : (
          <Tag color="red">未配置</Tag>
        ),
    },
    { title: '说明', dataIndex: 'desc' },
    {
      title: '操作',
      width: 80,
      render: (_: unknown, row: AgentDeployRow) => (
        <Button size="small" onClick={() => setEditing(row)}>
          配置
        </Button>
      ),
    },
  ];

  /** 简易模式下，所有子 agent 都解析到顶层这四行，任一行缺 modelName 都会在用到时报错 */
  const missingInSimple = data.ordinary.filter((r) => !r.modelName);
  /** 高级模式下每个子 agent 都必须有 modelName，否则后端直接抛错 */
  const missingInAdvanced = [...data.ordinary, ...data.advanced].filter((r) => !r.modelName);

  return (
    <Flex vertical gap={12}>
      <Alert
        type="info"
        showIcon
        message="这个开关真的在生效"
        description="utils/ai.ts 读取 o_setting.agentUseMode 决定子 agent 的模型怎么解析：简易配置下所有子 agent 回退到父级（scriptAgent / productionAgent）；高级配置下每个子 agent 用自己那一行，缺 modelName 时后端直接抛错。"
      />
      <Space>
        <span style={{ fontSize: 12.5 }}>解析模式</span>
        <Select
          size="small"
          style={{ width: 200 }}
          value={mode}
          loading={savingMode}
          onChange={(v) => void onModeChange(v as '0' | '1')}
          options={[
            { value: '0', label: '简易配置（回退父级）' },
            { value: '1', label: '高级配置（逐个子 agent）' },
          ]}
        />
        <Button size="small" icon={<ReloadOutlined />} onClick={() => void reload()}>
          刷新
        </Button>
      </Space>

      {mode === '0' && missingInSimple.length > 0 ? (
        <Alert
          type="error"
          showIcon
          message="简易配置下有顶层行没配模型"
          description={`这些行缺 modelName，用到时会报错：${missingInSimple.map((r) => r.key).join('、')}`}
        />
      ) : null}
      {mode === '1' && missingInAdvanced.length > 0 ? (
        <Alert
          type="error"
          showIcon
          message="高级配置下有子 agent 没配模型"
          description={`高级配置要求每个子 agent 都有自己的 modelName，否则后端抛「高级配置模式下，未找到对应的模型配置」。当前缺 ${missingInAdvanced.length} 行：${missingInAdvanced
            .slice(0, 6)
            .map((r) => r.key)
            .join('、')}${missingInAdvanced.length > 6 ? ' 等' : ''}`}
        />
      ) : null}

      <div>
        <div className="ds-formGroupTitle">顶层（简易配置生效）</div>
        <Table<AgentDeployRow>
          size="small"
          rowKey="key"
          loading={loading}
          pagination={false}
          dataSource={data.ordinary}
          columns={columns}
        />
      </div>
      <div>
        <div className="ds-formGroupTitle">
          子 agent（高级配置生效）· {data.advanced.length} 行
        </div>
        <Table<AgentDeployRow>
          size="small"
          rowKey="key"
          loading={loading}
          pagination={false}
          dataSource={data.advanced}
          columns={columns}
        />
      </div>
      <Descriptions size="small" column={1}>
        <Descriptions.Item label="后端行为">
          `getAgentDeploy` 用「key 里有没有冒号」拆两张表，但 `universalAi` 被同时放进了两张——
          这是后端的怪癖，界面已去重（只在小巧的顶层表里显示一次）。
        </Descriptions.Item>
      </Descriptions>

      <AgentEditModal
        row={editing}
        models={models}
        onClose={() => setEditing(null)}
        onSaved={reload}
      />
    </Flex>
  );
}