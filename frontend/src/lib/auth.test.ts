import { silentLogin } from './auth';
import { getAuthToken } from './http';

function envelopeResponse(data: unknown, code = 200, message = '成功'): Response {
  return new Response(JSON.stringify({ code, data, message }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('silentLogin', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('logs in with the default account and stores the token without the Bearer prefix', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(envelopeResponse({ token: 'Bearer eyJabc.def', name: 'admin', id: 1 }, 200, '登录成功'));
    vi.stubGlobal('fetch', fetchMock);

    await silentLogin();

    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe('/api/login/login');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ username: 'admin', password: 'admin123' });
    expect(localStorage.getItem('deepsfv-token')).toBe('eyJabc.def');
    expect(getAuthToken()).toBe('eyJabc.def');
  });

  it('rejects on a business failure envelope and keeps the previous token', async () => {
    localStorage.setItem('deepsfv-token', 'old-token');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 400, data: null, message: '用户名或密码错误' }), { status: 400 })),
    );

    await expect(silentLogin()).rejects.toMatchObject({ message: '用户名或密码错误' });
    expect(getAuthToken()).toBe('old-token');
  });

  it('rejects with a NetworkError when the backend is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(silentLogin()).rejects.toMatchObject({ name: 'NetworkError' });
  });
});
