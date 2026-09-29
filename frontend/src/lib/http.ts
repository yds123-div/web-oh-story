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

/**
 * 当前 token；未登录时是空串。
 *
 * 以前这里会回一个 `dev-placeholder-token` 占位串——那会让「未登录」和「登录了」在请求层
 * 看起来一样，鉴权失败被掩盖成 401。现在如实回空串，由路由守卫拦在页面层。
 */
export function getAuthToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setAuthToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // localStorage 不可用时无法持久化登录态，下次打开需重新登录
  }
}

export function clearAuthToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // 忽略
  }
}

/**
 * 设置中心口令（后端 `SETTINGS_ACCESS_KEY` 对应的请求头 `x-settings-key`）。
 *
 * 用 sessionStorage 而不是 localStorage：它是口令而不是登录态，不该在磁盘上长期留存，
 * 关掉标签页即失效。后端未配置该环境变量时这道门整体关闭，此时前端不带这个头也能用。
 */
const SETTINGS_KEY_STORAGE = 'deepsfv-settings-key';

/** 与后端 `app.ts` 里的 SETTINGS_GATED_PREFIXES 必须一致 */
const SETTINGS_GATED_PREFIXES = ['/api/setting/', '/api/agents/'];

export function getSettingsKey(): string {
  try {
    return sessionStorage.getItem(SETTINGS_KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

export function setSettingsKey(key: string): void {
  try {
    if (key) sessionStorage.setItem(SETTINGS_KEY_STORAGE, key);
    else sessionStorage.removeItem(SETTINGS_KEY_STORAGE);
  } catch {
    // sessionStorage 不可用时静默忽略：后端未开门时不影响使用
  }
}

/** 后端因缺少/错误口令拒了这次请求（403） */
export function isSettingsLockedError(err: unknown): boolean {
  return err instanceof HttpError && err.status === 403;
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

/** 带鉴权地发一次请求，并把 HTTP 层的失败（401/非 2xx/网络）统一转成错误对象 */
async function send(path: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${getAuthToken()}`);
  // 只在受保护路径上带口令，避免把设置口令发给无关接口
  if (SETTINGS_GATED_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    const settingsKey = getSettingsKey();
    if (settingsKey) headers.set('x-settings-key', settingsKey);
  }
  if (init.body !== undefined && !headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(path, { ...init, headers });
  } catch (err) {
    // 调用方主动取消（AbortController，如 StrictMode 重挂载）：原样抛出，不按网络错误处理
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
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

  return response;
}

/**
 * 二进制响应（分镜拼图下载：后端直接回 PNG 附件，没有信封）。
 * 后端在「没有一张有效图」时回 204，此处返回 null 交由调用方提示。
 */
export async function apiFetchBlob(path: string, init: RequestInit = {}): Promise<Blob | null> {
  const response = await send(path, init);
  if (response.status === 204) return null;
  return response.blob();
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await send(path, init);

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
