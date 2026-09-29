import { Flex, Popconfirm, Typography } from 'antd';
import { LogoutOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useThemeStore } from '../stores/themeStore';
import { useAuthStore } from '../stores/authStore';

/**
 * 顶栏。刻意保持安静：品牌 + 主题开关 + 账号 / 退出登录。
 *
 * 原来的「领取创作者权益 / 商务合作 / 开通会员」三个按钮已删除——它们没有任何 onClick，
 * 是纯装饰，在亮色大留白的版式里既抢眼又容易被当成 bug 报。
 */
export function TopBar() {
  const mode = useThemeStore((s) => s.mode);
  const toggle = useThemeStore((s) => s.toggle);
  const username = useAuthStore((s) => s.username);
  const signOut = useAuthStore((s) => s.signOut);
  const navigate = useNavigate();

  const onLogout = () => {
    signOut(); // 清 token，RequireAuth 会把用户送回登录页
    navigate('/login', { replace: true });
  };

  return (
    <Flex align="center" gap={10} style={{ width: '100%', height: '100%' }}>
      <div className="ds-brand">
        <div className="ds-mark">D</div>
        <div className="bt">
          <b>DeepSFV</b>
          <span>AI 短剧工坊</span>
        </div>
      </div>
      <div style={{ flex: 1 }} />
      <button type="button" className="ds-themeBtn" title="切换 明亮 / 暗色主题" onClick={toggle}>
        {mode === 'light' ? <MoonOutlined /> : <SunOutlined />}
      </button>
      <div className="ds-avatar" title={username ? `当前账号：${username}` : '未登录'}>
        {(username ?? '?').slice(0, 1).toUpperCase()}
      </div>
      <Popconfirm
        title="退出登录？"
        description="会清除本机保存的登录态，需要重新输入账号密码。"
        okText="退出"
        okButtonProps={{ danger: true }}
        cancelText="取消"
        onConfirm={onLogout}
      >
        <button type="button" className="ds-themeBtn" title="退出登录">
          <LogoutOutlined />
        </button>
      </Popconfirm>
      {username ? (
        <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
          {username}
        </Typography.Text>
      ) : null}
    </Flex>
  );
}