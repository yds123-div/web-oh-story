export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/** 信封业务失败：HTTP 200 但 `{code, data, message}` 中 code !== 200 */
export class ApiError extends Error {
  constructor(
    public code: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** 网络错误 / 后端不可达（fetch 本身失败，区别于业务失败） */
export const NETWORK_UNREACHABLE_MESSAGE = '无法连接后端服务，请确认后端已启动（默认端口 10588）';

export class NetworkError extends Error {
  constructor(message = NETWORK_UNREACHABLE_MESSAGE) {
    super(message);
    this.name = 'NetworkError';
  }
}

const TOKEN_KEY = 'deepsfv-token';
const PLACEHOLDER_TOKEN = 'dev-placeholder-token';

export function getAuthToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? PLACEHOLDER_TOKEN;
  } catch {
    return PLACEHOLDER_TOKEN;
  }
}

export function setAuthToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // localStorage 不可用时静默降级为占位 token
  }
}

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

type NetworkErrorHandler = () => void;

let networkErrorHandler: NetworkErrorHandler | null = null;

export function setNetworkErrorHandler(handler: NetworkErrorHandler | null): void {
  networkErrorHandler = handler;
}

// 网络错误可能连续触发（页面并行请求），全局提示做节流
const NETWORK_ERROR_NOTIFY_INTERVAL_MS = 60_000;
let lastNetworkErrorNotifyAt = 0;

function notifyNetworkError(): void {
  const now = Date.now();
  if (now - lastNetworkErrorNotifyAt < NETWORK_ERROR_NOTIFY_INTERVAL_MS) return;
  lastNetworkErrorNotifyAt = now;
  networkErrorHandler?.();
}

type Envelope = { code: number; data?: unknown; message?: string };

function isEnvelope(body: unknown): body is Envelope {
  return typeof body === 'object' && body !== null && typeof (body as Envelope).code === 'number';
}

/** 非 2xx 响应没有统一信封，尽量从 JSON body 里提取 message / errors */
async function httpErrorMessage(response: Response): Promise<string> {
  const detail = await response.text();
  if (!detail) return response.statusText || `HTTP ${response.status}`;
  try {
    const parsed = JSON.parse(detail) as { message?: unknown; errors?: unknown };
    const parts = [
      typeof parsed.message === 'string' && parsed.message ? parsed.message : undefined,
      Array.isArray(parsed.errors) && parsed.errors.length > 0 ? parsed.errors.join('；') : undefined,
    ].filter((part): part is string => Boolean(part));
    if (parts.length > 0) return parts.join('：');
  } catch {
    // 非 JSON body，原样返回
  }
  return detail;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${getAuthToken()}`);
  if (init.body !== undefined && !headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(path, { ...init, headers });
  } catch {
    notifyNetworkError();
    throw new NetworkError();
  }

  if (response.status === 401) {
    unauthorizedHandler?.();
    throw new HttpError(401, 'Unauthorized');
  }

  if (!response.ok) {
    throw new HttpError(response.status, await httpErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const body: unknown = await response.json();

  // 后端信封：HTTP 恒 200，成败看 {code, data, message}；非信封 body（旧 mock 契约）原样透传
  if (isEnvelope(body)) {
    if (body.code === 200) {
      return body.data as T;
    }
    throw new ApiError(body.code, body.message?.trim() || `请求失败（code ${body.code}）`);
  }

  return body as T;
}
