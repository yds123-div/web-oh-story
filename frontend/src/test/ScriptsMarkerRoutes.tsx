import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

/**
 * 页面测试共享：在 initialPath 渲染被测页面，并挂一个
 * `/project/:id/scripts` 标记路由（显示 scripts-page-marker），
 * 用于断言"点击后直达剧本列表"。
 */
export function ScriptsMarkerRoutes({
  children,
  initialPath,
}: {
  children: ReactNode;
  initialPath: string;
}) {
  const pathOnly = initialPath.split('?')[0];
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path={pathOnly} element={children} />
        <Route path="/project/:id/scripts" element={<div>scripts-page-marker</div>} />
      </Routes>
    </MemoryRouter>
  );
}
