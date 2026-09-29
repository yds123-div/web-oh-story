import { hasSession, login, logout } from './auth';
import { getAuthToken } from './http';

function envelopeResponse(data: unknown, code = 200, message = '成功'): Response {
  return new Response(JSON.stringify({ code, data, message }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('登录 / 登出', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('用提交的账号密码登录，并剥掉 token 的 Bearer 前缀', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(envelopeResponse({ token: 'Bearer eyJabc.def', name: 'admin', id: 1 }, 200, '登录成功'));
    vi.stubGlobal('fetch', fetchMock);

    const data = await login('someone', 'p@ssw0rd');

    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe('/api/login/login');
    expect(init.method).toBe('POST');
    // 凭据来自调用方，不再有硬编码的默认账号
    expect(JSON.parse(init.body)).toEqual({ username: 'someone', password: 'p@ssw0rd' });
    expect(localStorage.getItem('deepsfv-token')).toBe('eyJabc.def');
    expect(getAuthToken()).toBe('eyJabc.def');
    expect(data.name).toBe('admin');
    expect(hasSession()).toBe(true);
  });

  it('业务失败时抛出后端文案，且不留下 token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 400, data: null, message: '用户名或密码错误' }), { status: 400 })),
    );

    await expect(login('admin', 'wrong')).rejects.toMatchObject({ message: '用户名或密码错误' });
    expect(getAuthToken()).toBe('');
    expect(hasSession()).toBe(false);
  });

  it('后端不可达时抛 NetworkError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(login('admin', 'admin123')).rejects.toMatchObject({ name: 'NetworkError' });
  });

  it('登出清掉 token 与设置中心口令', () => {
    localStorage.setItem('deepsfv-token', 'tok');
    sessionStorage.setItem('deepsfv-settings-key', 's3cret');
    expect(hasSession()).toBe(true);

    logout();

    expect(getAuthToken()).toBe('');
    expect(hasSession()).toBe(false);
    expect(sessionStorage.getItem('deepsfv-settings-key')).toBeNull();
  });
});