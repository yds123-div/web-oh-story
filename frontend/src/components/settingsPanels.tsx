import { useCallback, useEffect, useState } from 'react';
import { Alert, App, Button, Descriptions, Flex, Input, Space, Switch, Table, Tag, Typography } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  fetchAiDevToolSwitch,
  fetchDbExport,
  fetchDbInfo,
  fetchLoginUser,
  fetchPrompts,
  updateAiDevToolSwitch,
  updateLoginUser,
  updatePromptData,
  type DbTableInfo,
  type LoginUser,
} from '../lib/api';
import { errorMessage } from '../lib/errors';
import { useThemeStore } from '../stores/themeStore';

/** 面板通用的加载骨架：统一处理 loading / 首次失败 / 重试 */
function usePanelLoad<T>(loader: () => Promise<T>, fallbackError: string) {
  const { message } = App.useApp();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loader());
    } catch (err) {
      message.error(errorMessage(err, fallbackError));
    } finally {
      setLoading(false);
    }
  }, [loader, message, fallbackError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, reload };
}

const Hint = ({ children }: { children: React.ReactNode }) => (
  <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
    {children}
  </Typography.Text>
);

// ===== 界面设置（纯前端，无后端接口）=====

export function InterfacePanel() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  return (
    <Flex vertical gap={16}>
      <div>
        <div className="ds-fieldLabel">主题</div>
        <Space>
          <Button
            className={mode === 'light' ? 'ds-pill ds-grad' : 'ds-pill ds-ghost'}
            type={mode === 'light' ? 'primary' : 'default'}
            size="small"
            onClick={() => setMode('light')}
          >
            明亮
          </Button>
          <Button
            className={mode === 'dark' ? 'ds-pill ds-grad' : 'ds-pill ds-ghost'}
            type={mode === 'dark' ? 'primary' : 'default'}
            size="small"
            onClick={() => setMode('dark')}
          >
            暗色
          </Button>
        </Space>
        <Hint>与顶栏的月亮/太阳按钮是同一份状态（localStorage `deepsfv-theme`），改一处两处都变。</Hint>
      </div>
      <Alert
        type="info"
        showIcon
        message="这里只放了真实生效的选项"
        description="暂不提供「页面密度」「动效开关」之类的开关：后端没有对应配置，做出来只会是假的。"
      />
    </Flex>
  );
}

// ===== 提示词管理 =====

export function PromptPanel() {
  const { message } = App.useApp();
  const { data, loading, reload } = usePanelLoad(fetchPrompts, '加载提示词失败');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const prompts = data ?? [];
  const selected = prompts.find((p) => p.id === selectedId) ?? null;

  // 选中项变化时把草稿同步为「自定义覆盖」或「内置原文」
  useEffect(() => {
    if (!selected) return;
    setDraft(selected.useData ?? selected.data);
  }, [selected]);

  const onSave = async (value: string) => {
    if (!selected) return;
    setSaving(true);
    try {
      await updatePromptData(selected.id, value);
      message.success(value ? '已保存自定义提示词' : '已恢复内置提示词');
      await reload();
    } catch (err) {
      message.error(errorMessage(err, '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  if (!selected) {
    return (
      <Flex vertical gap={12}>
        <Hint>共 {prompts.length} 条。选择一条开始编辑。</Hint>
        {prompts.map((p) => (
          <button
            key={p.id}
            type="button"
            className="ds-listRow"
            onClick={() => setSelectedId(p.id)}
          >
            <span>{p.name ?? `#${p.id}`}</span>
            <Space>
              {p.type ? <Tag>{p.type}</Tag> : null}
              {p.useData ? <Tag color="purple">已自定义</Tag> : <Tag>内置</Tag>}
            </Space>
          </button>
        ))}
        {loading ? <Hint>加载中…</Hint> : null}
      </Flex>
    );
  }

  return (
    <Flex vertical gap={12}>
      <Space>
        <Button size="small" onClick={() => setSelectedId(null)}>
          返回列表
        </Button>
        <b>{selected.name ?? `#${selected.id}`}</b>
        {selected.useData ? <Tag color="purple">已自定义</Tag> : <Tag>内置</Tag>}
        <Button size="small" icon={<ReloadOutlined />} onClick={() => void reload()}>
          重载
        </Button>
      </Space>
      <Alert
        type="warning"
        showIcon
        message="编辑是整体替换，不是增量补丁"
        description="保存后整段提示词被你的内容取代（写入 o_prompt.useData）；点「恢复内置」清空覆盖即回到出厂原文。建议先看完内置原文再改。"
      />
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
          loading={saving}
          onClick={() => void onSave(draft)}
        >
          保存
        </Button>
        <Button size="small" disabled={saving} onClick={() => void onSave('')}>
          恢复内置
        </Button>
        <Hint>共 {draft.length} 字</Hint>
      </Space>
    </Flex>
  );
}

// ===== 数据库操作（只读 + 导出）=====

export function DatabasePanel() {
  const { message } = App.useApp();
  const { data, loading, reload } = usePanelLoad(fetchDbInfo, '读取数据库信息失败');
  const [exporting, setExporting] = useState(false);

  const onExport = async () => {
    setExporting(true);
    try {
      const blob = await fetchDbExport();
      if (!blob) {
        message.warning('后端没有返回导出内容');
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `deepsfv-backup-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);
      message.success('已开始下载');
    } catch (err) {
      message.error(errorMessage(err, '导出失败'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Flex vertical gap={12}>
      <Alert
        type="warning"
        showIcon
        message="导出文件里含敏感信息"
        description="整库导出会包含 o_user 的密码明文与 o_vendorConfig 里的供应商 key，请勿放进公开仓库或随手转发（本仓库是 public）。"
      />
      <Alert
        type="info"
        showIcon
        message="清库类操作没有开放"
        description="clearData / clearTable / importData 是清库级写操作，而这套后端跑在共享服务器上，因此本批次不接。需要时单独评估并加二次确认。"
      />
      <Space>
        <Button size="small" icon={<ReloadOutlined />} onClick={() => void reload()}>
          刷新
        </Button>
        <Button
          size="small"
          type="primary"
          className="ds-grad ds-pill"
          icon={<DownloadOutlined />}
          loading={exporting}
          onClick={() => void onExport()}
        >
          导出整库 JSON
        </Button>
      </Space>
      <Table<DbTableInfo>
        size="small"
        rowKey="name"
        loading={loading}
        dataSource={data ?? []}
        pagination={false}
        columns={[
          { title: '表名', dataIndex: 'name' },
          { title: '行数', dataIndex: 'rowCount', width: 120, align: 'right' },
        ]}
      />
    </Flex>
  );
}

// ===== 开发者选项 =====

export function DevPanel() {
  const { message } = App.useApp();
  const { data, loading, reload } = usePanelLoad(fetchAiDevToolSwitch, '读取开发者选项失败');
  const [saving, setSaving] = useState(false);

  const onToggle = async (next: boolean) => {
    setSaving(true);
    try {
      await updateAiDevToolSwitch(next);
      message.success(next ? '已开启 AI 调试工具' : '已关闭 AI 调试工具');
      await reload();
    } catch (err) {
      message.error(errorMessage(err, '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Flex vertical gap={12}>
      <Flex align="center" gap={12}>
        <Switch checked={data === true} loading={loading || saving} onChange={(v) => void onToggle(v)} />
        <span>AI 调试工具</span>
      </Flex>
      <Hint>读写 o_setting 的 `switchAiDevTool`；这是本面板唯一一项。</Hint>
    </Flex>
  );
}

// ===== 登录配置（本批次只读）=====

export function LoginPanel() {
  const { message } = App.useApp();
  const { data, loading } = usePanelLoad(fetchLoginUser, '读取登录账号失败');
  const user: LoginUser | null = data;

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) setName(user.name);
  }, [user]);

  const onSave = async () => {
    if (!user) return;
    if (!name.trim()) {
      message.warning('账号名不能为空');
      return;
    }
    if (password && password !== confirm) {
      message.warning('两次输入的密码不一致');
      return;
    }
    setSaving(true);
    try {
      // 密码留空 = 只改账号名；后端也按「空串则不动密码」处理
      await updateLoginUser({ id: user.id, name: name.trim(), password });
      message.success(password ? '账号名与密码已更新' : '账号名已更新');
      setPassword('');
      setConfirm('');
    } catch (err) {
      message.error(errorMessage(err, '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Flex vertical gap={12}>
      <Alert
        type="info"
        showIcon
        message="这里的改动会影响下次登录"
        description="改完不会踢掉当前会话（JWT 独立于口令），但下次登录必须用新账号名与密码。忘记密码只能直接改数据库，请先记牢。"
      />
      <Alert
        type="warning"
        showIcon
        message="密码存储强度有限"
        description="密码现在会先做 sha256 再落库（不再是明文），但**单轮、未加盐**，不足以抵抗离线爆破。真要上强度需要换 bcrypt/argon2 并做一次全量迁移。"
      />
      <Descriptions size="small" column={1} bordered>
        <Descriptions.Item label="账号 id">{loading ? '…' : (user?.id ?? '未读取到')}</Descriptions.Item>
        <Descriptions.Item label="密码">
          不回显（后端只存哈希，接口也不再返回该字段）
        </Descriptions.Item>
      </Descriptions>
      <Flex vertical gap={12} style={{ maxWidth: 380 }}>
        <div>
          <label className="ds-fieldLabel" htmlFor="lu-name">
            账号名
          </label>
          <Input id="lu-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="ds-fieldLabel" htmlFor="lu-pwd">
            新密码（留空 = 不改）
          </label>
          <Input.Password
            id="lu-pwd"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="留空则保持当前密码"
          />
        </div>
        <div>
          <label className="ds-fieldLabel" htmlFor="lu-pwd2">
            确认新密码
          </label>
          <Input.Password
            id="lu-pwd2"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={!password}
          />
        </div>
        <Button
          type="primary"
          className="ds-grad ds-pill"
          size="small"
          loading={saving}
          disabled={!user || loading}
          onClick={() => void onSave()}
        >
          保存
        </Button>
      </Flex>
    </Flex>
  );
}