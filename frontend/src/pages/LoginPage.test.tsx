import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { App as AntApp, ConfigProvider } from 'antd';
import { setupServer } from 'msw/node';
import LoginPage from './LoginPage';
import { handlers } from '../mocks/handlers';
import { RequireAuth } from '../components/RequireAuth';
import { getAuthToken } from '../lib/http';

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => server.close());

/**
 * 路由结构必须和 `App.tsx` 一致：**登录页在守卫外面**。
 * 曾把 `/login` 也套进 RequireAuth，结果守卫跳 /login、/login 的守卫又跳 /login，
 * 无限重定向直接把测试 worker 撑爆。
 */
function renderApp(startAt: string) {
  return render(
    <ConfigProvider>
      <AntApp>
        <MemoryRouter initialEntries={[startAt]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <div>home-marker</div>
                </RequireAuth>
              }
            />
          </Routes>
        </MemoryRouter>
      </AntApp>
    </ConfigProvider>,
  );
}

describe('登录页', () => {
  it('未登录访问受保护路由会被送到登录页', async () => {
    renderApp('/');

    expect(await screen.findByRole('button', { name: /登\s*录/ })).toBeInTheDocument();
    expect(screen.queryByText('home-marker')).not.toBeInTheDocument();
  });

  it('凭据正确时存入 token 并跳到原地址', async () => {
    renderApp('/login');

    fireEvent.change(await screen.findByLabelText('账号'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'admin123' } });
    fireEvent.click(screen.getByRole('button', { name: /登\s*录/ }));

    expect(await screen.findByText('home-marker')).toBeInTheDocument();
    // 后端回了 `Bearer mock-token-for-admin`，前端入库前剥掉前缀
    expect(getAuthToken()).toBe('mock-token-for-admin');
  });

  it('凭据错误时展示后端文案且不写 token', async () => {
    renderApp('/login');

    fireEvent.change(await screen.findByLabelText('账号'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'wrong-password' } });
    fireEvent.click(screen.getByRole('button', { name: /登\s*录/ }));

    expect(await screen.findByText('用户名或密码错误')).toBeInTheDocument();
    expect(getAuthToken()).toBe('');
    expect(screen.queryByText('home-marker')).not.toBeInTheDocument();
  });

  it('已登录时访问登录页直接回首页', async () => {
    localStorage.setItem('deepsfv-token', 'already-have-token');
    renderApp('/login');

    expect(await screen.findByText('home-marker')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /登\s*录/ })).not.toBeInTheDocument();
  });

  it('登录凭据不再以字面量硬编码在源码里（回归护栏）', () => {
    // 曾经的 silentLogin 把默认管理员的账号口令打进包里，等于随前端公开发布管理员凭据。
    // 断言的是"字面量"这个不变量，而不是某个具体口令串或函数名——注释里提到它们都会误报
    // （第一版就踩了：注释里写 `silentLogin()` 把护栏自己绊倒）。
    // 用 cwd 解析而不是 import.meta.url：vitest 的 jsdom 环境下后者不是 file: 协议。
    const src = readFileSync(resolve(process.cwd(), 'src/lib/auth.ts'), 'utf8');
    expect(src).not.toMatch(/username:\s*['"]/);
    expect(src).not.toMatch(/password:\s*['"]/);
    // 实参必须来自调用方，不能是写死的值
    expect(src).toMatch(/JSON\.stringify\(\{ username, password \}\)/);
  });
});