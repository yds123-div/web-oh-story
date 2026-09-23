import { apiFetch, getAuthToken, setNetworkErrorHandler, setUnauthorizedHandler } from '../lib/http';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('apiFetch', () => {
  it('sends Authorization Bearer on every request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/projects');

    const headers = new Headers(fetchMock.mock.calls[0][1].headers);
    expect(headers.get('Authorization')).toBe(`Bearer ${getAuthToken()}`);
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
