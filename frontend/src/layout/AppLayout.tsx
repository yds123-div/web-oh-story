import { Outlet } from 'react-router-dom';
import { SideNav } from './SideNav';
import { TopBar } from './TopBar';

/**
 * 外壳：左侧浮动图标栏 + 右侧一整块白色卡片（顶栏 + 可滚动内容区）。
 *
 * 版式借鉴 Toonflow 的首页；所有色值走 antd token（`var(--ant-color-*)`），
 * 亮/暗两套主题共用同一份规则，不再靠 `html[data-theme]` 逐个打补丁。
 */
export function AppLayout() {
  return (
    <div className="ds-app">
      <SideNav />
      <div className="ds-main">
        <header className="ds-topbar">
          <TopBar />
        </header>
        <main className="ds-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}