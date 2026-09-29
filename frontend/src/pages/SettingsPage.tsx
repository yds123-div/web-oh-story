import { useCallback, useEffect, useState, type ComponentType } from 'react';
import { App, Alert, Button, Flex, Input, Spin, Typography } from 'antd';
import { LockOutlined, UnlockOutlined } from '@ant-design/icons';
import { fetchDbInfo } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { isSettingsLockedError, setSettingsKey } from '../lib/http';
import {
  DatabasePanel,
  DevPanel,
  InterfacePanel,
  LoginPanel,
  PromptPanel,
} from '../components/settingsPanels';
import { AgentPanel, VendorPanel } from '../components/settingsModelPanels';
import {
  MemoryPanel,
  ModelMapPanel,
  SkillPanel,
} from '../components/settingsContentPanels';

type SectionKey =
  | 'vendorConfig'
  | 'modelMap'
  | 'agentConfig'
  | 'promptManage'
  | 'skillManagement'
  | 'memoryConfig'
  | 'ui'
  | 'dbConfig'
  | 'devConfig'
  | 'loginConfig';

type Section = { key: SectionKey; label: string };

/** 设置中心分组（Q22 定的三段式），顺序照 Toonflow 的菜单。10 项均已接入后端。 */
const GROUPS: { title: string; items: Section[] }[] = [
  {
    title: '模型与供应商',
    items: [
      { key: 'vendorConfig', label: '模型服务' },
      { key: 'modelMap', label: '模型映射' },
    ],
  },
  {
    title: 'Agent 与提示词',
    items: [
      { key: 'agentConfig', label: 'Agent配置' },
      { key: 'promptManage', label: '提示词管理' },
      { key: 'skillManagement', label: 'Skills技能管理' },
      { key: 'memoryConfig', label: 'Agent记忆配置' },
    ],
  },
  {
    title: '系统与外观',
    items: [
      { key: 'ui', label: '界面设置' },
      { key: 'dbConfig', label: '数据库操作' },
      { key: 'devConfig', label: '开发者选项' },
      { key: 'loginConfig', label: '登录配置' },
    ],
  },
];

const PANELS: Partial<Record<SectionKey, ComponentType>> = {
  ui: InterfacePanel,
  vendorConfig: VendorPanel,
  modelMap: ModelMapPanel,
  agentConfig: AgentPanel,
  promptManage: PromptPanel,
  skillManagement: SkillPanel,
  memoryConfig: MemoryPanel,
  dbConfig: DatabasePanel,
  devConfig: DevPanel,
  loginConfig: LoginPanel,
};

export default function SettingsPage() {
  const { message } = App.useApp();
  const [section, setSection] = useState<SectionKey>('ui');
  const [checking, setChecking] = useState(true);
  const [locked, setLocked] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');
  const [unlocking, setUnlocking] = useState(false);

  /**
   * 用一次真实的受保护读请求来判断后端有没有上锁。
   * 后端未配置 SETTINGS_ACCESS_KEY 时这道门整体关闭，任何口令都能通过——所以不能靠"有没有口令"
   * 来判断，只能实际打一次。
   */
  const probe = useCallback(async () => {
    setChecking(true);
    try {
      await fetchDbInfo();
      setLocked(false);
    } catch (err) {
      if (isSettingsLockedError(err)) setLocked(true);
      else message.error(errorMessage(err, '无法连接设置接口'));
    } finally {
      setChecking(false);
    }
  }, [message]);

  useEffect(() => {
    void probe();
  }, [probe]);

  const onUnlock = async () => {
    setUnlocking(true);
    setSettingsKey(keyDraft);
    try {
      await fetchDbInfo();
      setLocked(false);
      setKeyDraft('');
      message.success('已解锁设置中心');
    } catch (err) {
      // 口令错误时后端回同一个 403，这里明确区分口令不对与其它失败
      if (isSettingsLockedError(err)) message.error('口令不正确');
      else message.error(errorMessage(err, '解锁失败'));
    } finally {
      setUnlocking(false);
    }
  };

  const onLock = () => {
    setSettingsKey('');
    setLocked(true);
    message.info('已清除本标签页保存的口令');
  };

  const Panel = PANELS[section];

  return (
    <div style={{ padding: '30px 32px 70px', maxWidth: 1200, width: '100%', margin: '0 auto' }}>
      <div className="ds-pageHead">
        <div>
          <h1 className="ds-pageTitle">设置</h1>
          <Typography.Text className="ds-pageSub">
            模型与供应商 · Agent 与提示词 · 系统与外观
          </Typography.Text>
        </div>
        {locked ? null : (
          <Button className="ds-pill ds-ghost" size="small" icon={<LockOutlined />} onClick={onLock}>
            锁定
          </Button>
        )}
      </div>

      {checking ? (
        <Flex justify="center" style={{ padding: 80 }}>
          <Spin />
        </Flex>
      ) : locked ? (
        <div style={{ maxWidth: 460, marginTop: 40 }}>
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="设置中心已上锁"
            description="后端配置了 SETTINGS_ACCESS_KEY，访问设置接口需要对应的口令。口令只保存在本标签页（sessionStorage），关掉标签页即失效。"
          />
          <Flex gap={8}>
            <Input.Password
              placeholder="设置中心口令"
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              onPressEnter={() => void onUnlock()}
              prefix={<UnlockOutlined />}
            />
            <Button
              type="primary"
              className="ds-grad ds-pill"
              loading={unlocking}
              disabled={!keyDraft}
              onClick={() => void onUnlock()}
            >
              解锁
            </Button>
          </Flex>
        </div>
      ) : (
        <div className="ds-setWrap">
          <nav className="ds-setNav">
            {GROUPS.map((group) => (
              <div key={group.title} className="ds-setGroup">
                <div className="ds-setGroupTitle">{group.title}</div>
                {group.items.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`ds-setItem${section === item.key ? ' on' : ''}`}
                    onClick={() => setSection(item.key)}
                  >
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>
          <section className="ds-setBody">
            {Panel ? <Panel /> : null}
          </section>
        </div>
      )}
    </div>
  );
}