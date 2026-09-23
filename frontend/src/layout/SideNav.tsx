import { NavLink } from 'react-router-dom';
import { message } from 'antd';
import { getRecentProjectId } from '../lib/recentProject';

const items: {
  to: () => string;
  icon: string;
  label: string;
  end: boolean;
  isTeam?: boolean;
}[] = [
  { to: () => '/', icon: '🏠', label: '首页', end: true },
  { to: () => '/idea', icon: '💡', label: '创意', end: false },
  // 有最近访问的项目则直达其剧本列表，否则去空白创作页
  {
    to: () => {
      const recent = getRecentProjectId();
      return recent ? `/project/${recent}/scripts` : '/create';
    },
    icon: '🎬',
    label: '创作',
    end: false,
  },
  { to: () => '/tasks', icon: '🧾', label: '任务', end: false },
  { to: () => '/canvas', icon: '🎨', label: '画布', end: false },
  { to: () => '/plaza', icon: '📦', label: '资产', end: false },
  { to: () => '/space', icon: '🧊', label: '空间', end: false },
  { to: () => '/team', icon: '👥', label: '团队', end: false, isTeam: true },
];

export function SideNav() {
  const handleTeamClick = (e: React.MouseEvent) => {
    e.preventDefault();
    message.info('团队功能即将上线');
  };

  return (
    <div className="ds-side">
      <div className="ds-logo">D</div>
      {items.map((item) => {
        const to = item.to();
        return (
          <NavLink
            key={to}
            to={to}
            end={item.end}
            onClick={item.isTeam ? handleTeamClick : undefined}
            className={({ isActive }) => `ds-navItem${isActive ? ' on' : ''}`}
          >
            <span className="ico">{item.icon}</span>
            {item.label}
          </NavLink>
        );
      })}
    </div>
  );
}
