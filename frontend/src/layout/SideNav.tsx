import { NavLink } from 'react-router-dom';

const items = [
  { to: '/', icon: '🏠', label: '首页', end: true },
  { to: '/idea', icon: '💡', label: '创意', end: false },
  { to: '/create', icon: '🎬', label: '创作', end: false },
];

export function SideNav() {
  return (
    <div className="ds-side">
      <div className="ds-logo">D</div>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => `ds-navItem${isActive ? ' on' : ''}`}
        >
          <span className="ico">{item.icon}</span>
          {item.label}
        </NavLink>
      ))}
    </div>
  );
}
