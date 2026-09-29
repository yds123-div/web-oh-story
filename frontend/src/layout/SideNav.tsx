import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
import {
  AppstoreOutlined,
  BulbOutlined,
  ClusterOutlined,
  HomeOutlined,
  PartitionOutlined,
  ProfileOutlined,
  SettingOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { getRecentProjectId } from '../lib/recentProject';

/**
 * 全局导航。保留「图标 + 文字」双行结构：我们的标签语义相近（创意/创作/画布/空间），
 * 去掉文字会难以分辨；这里只是把原来的 emoji 换成了 `@ant-design/icons` 线性图标。
 *
 * 「团队」已移除——它原本没有路由，点了只弹「即将上线」，是个死入口。
 */
const items: {
  to: () => string;
  icon: ReactNode;
  label: string;
  end: boolean;
}[] = [
  { to: () => '/', icon: <HomeOutlined />, label: '首页', end: true },
  { to: () => '/idea', icon: <BulbOutlined />, label: '创意', end: false },
  // 有最近访问的项目则直达其剧本列表，否则去空白创作页
  {
    to: () => {
      const recent = getRecentProjectId();
      return recent ? `/project/${recent}/scripts` : '/create';
    },
    icon: <VideoCameraOutlined />,
    label: '创作',
    end: false,
  },
  { to: () => '/tasks', icon: <ProfileOutlined />, label: '任务', end: false },
  { to: () => '/canvas', icon: <PartitionOutlined />, label: '画布', end: false },
  { to: () => '/plaza', icon: <AppstoreOutlined />, label: '资产', end: false },
  { to: () => '/space', icon: <ClusterOutlined />, label: '空间', end: false },
];

export function SideNav() {
  return (
    <nav className="ds-side">
      <div className="ds-logo">D</div>
      {items.map((item) => (
        <NavLink
          key={item.label}
          to={item.to()}
          end={item.end}
          className={({ isActive }) => `ds-navItem${isActive ? ' on' : ''}`}
        >
          <span className="ico">{item.icon}</span>
          {item.label}
        </NavLink>
      ))}
      {/* 底部独立一组：设置中心（照 Toonflow 的侧栏布局） */}
      <div style={{ flex: 1 }} />
      <NavLink
        to="/settings"
        className={({ isActive }) => `ds-navItem${isActive ? ' on' : ''}`}
      >
        <span className="ico">
          <SettingOutlined />
        </span>
        设置
      </NavLink>
    </nav>
  );
}