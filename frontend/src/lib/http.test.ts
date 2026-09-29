import {
  apiFetch,
  getAuthToken,
  setNetworkErrorHandler,
  setSettingsKey,
  setUnauthorizedHandler,
} from '../lib/http';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('apiFetch', () => {
  it('未登录时不发占位 token，已登录时带真实 token', async () => {
    localStorage.clear();
    // 每次调用都要新的 Response：Response 的 body 只能读一次，复用同一个实例会报
    // "Body is unusable: Body has already been read"
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ ok: true })));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/projects');

    // Headers 会裁掉尾随空格，所以空 token 读出来是 'Bearer'
    // —— 以前这里会发 'Bearer dev-placeholder-token'，把"未登录"伪装成"已登录"
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get('Authorization')).toBe('Bearer');
    expect(getAuthToken()).toBe('');

    localStorage.setItem('deepsfv-token', 'real-token');
    await apiFetch('/api/projects');
    expect(new Headers(fetchMock.mock.calls[1][1].headers).get('Authorization')).toBe(
      'Bearer real-token',
    );
  });

  it('只在受保护的设置路径上带 x-settings-key', async () => {
    setSettingsKey('s3cret');
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ ok: true })));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/setting/dbConfig/dbInfo');
    expect(
      new Headers(fetchMock.mock.calls[0][1].headers).get('x-settings-key'),
    ).toBe('s3cret');

    // 无关接口不该带上这个口令，避免把它散到别处的日志里
    await apiFetch('/api/project/getProject');
    expect(new Headers(fetchMock.mock.calls[1][1].headers).get('x-settings-key')).toBeNull();
  });

  it('invokes the shared 401 handler and throws', async () => {
    const on401 = vi.fn();
    setUnauthorizedHandler(on401);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })));

    await expect(apiFetch('/api/credits')).rejects.toMatchObject({ status: 401 });
    expect(on401).toHaveBeenCalledTimes(1);

    setUnauthorizedHandler(null);
  });

  it('unwraps the envelope and returns data when code is 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ code: 200, data: { token: 't', name: 'admin' }, message: '成功' })),
    );

    await expect(apiFetch('/api/login/login')).resolves.toEqual({ token: 't', name: 'admin' });
  });

  it('throws an ApiError carrying the envelope message when code is not 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ code: 400, data: null, message: '用户名或密码错误' })),
    );

    await expect(apiFetch('/api/project/getProject')).rejects.toMatchObject({
      name: 'ApiError',
      code: 400,
      message: '用户名或密码错误',
    });
  });

  it('extracts the message from a non-envelope HTTP 400 validation error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ message: '参数错误', errors: ['字段 username 必填'] }, 400),
      ),
    );

    await expect(apiFetch('/api/project/addProject')).rejects.toMatchObject({
      name: 'HttpError',
      status: 400,
      message: '参数错误：字段 username 必填',
    });
  });

  it('keeps a non-envelope HTTP 404 body as the error detail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ message: '接口不存在' }, 404)),
    );

    await expect(apiFetch('/api/unknown')).rejects.toMatchObject({
      status: 404,
      message: '接口不存在',
    });
  });

  it('throws a NetworkError and fires the network handler when fetch rejects', async () => {
    const onNetworkError = vi.fn();
    setNetworkErrorHandler(onNetworkError);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(apiFetch('/api/projects')).rejects.toMatchObject({
      name: 'NetworkError',
    });
    expect(onNetworkError).toHaveBeenCalledTimes(1);

    setNetworkErrorHandler(null);
  });

  it('passes non-envelope JSON bodies through unchanged', async () => {
    const body = { projects: [{ id: 'p1' }], storage: { usedBytes: 1 } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(body)));

    await expect(apiFetch('/api/projects')).resolves.toEqual(body);
  });
});
