/**
 * Toonflow AI供应商模板 - DP 自建服务（Z-Image-Turbo 文生图 + MiniMax-H3 图生视频）
 * @version 2.1
 *
 * 同一台机器、同一把 sk-dp 密钥，两个能力：
 *
 * 【图像 / Z-Image-Turbo】POST {baseUrl}/img/generate
 * 1) 纯文生图，请求体 {prompt,width,height,steps,seed?}，响应是 PNG 二进制（不是 JSON），
 *    故直接读 arrayBuffer 再拼成有头 base64。
 * 2) **不支持参考图**：没有图生图入口，`config.referenceList`（分镜关联资产的形象图、
 *    资产工坊上传的参考图）会被丢弃。模型的 mode 也只声明 "text"，如实反映这一点。
 * 3) 宽高上限 2048、下限 256，超出范围由服务端静默夹取（不是报错）。
 *
 * 【视频 / MiniMax-H3】三步异步任务制
 * 1) 提交 POST {baseUrl}/video/generate?length&width&height&prompt&seed，multipart 传 `image`
 *    （**图生视频，参考图必填**），立即返回 {job_id,status,poll}。
 * 2) 轮询 GET {baseUrl}/video/job/<id> → {status: running|success|failed, file, error, params}。
 * 3) 下载 GET {baseUrl}/video/job/<id>/file → video/mp4。
 * 4) `length` 是**帧数**、按 32 的倍数吸附（实测 238→224、64→64）；帧率约 24fps
 *    （实测 224 帧 = 9.42s）。默认规格 544×960。
 * 5) 该能力**仅当家里 GPU 切到 H3 视频模式时可用**（GET {baseUrl}/video/health 可免密钥探测）。
 * 6) 实测耗时：提交 1-5s，96 帧≈54s、224 帧≈95s。
 */

// ============================================================
// 类型定义
// ============================================================

type VideoMode =
  | "singleImage" //单图参考
  | "startEndRequired" //首尾帧（两张都得有）
  | "endFrameOptional" //首尾帧（尾帧可选）
  | "startFrameOptional" //首尾帧（首帧可选）
  | "text" //文本
  | (`videoReference:${number}` | `imageReference:${number}` | `audioReference:${number}`)[]; //多参考（数字代表限制数量）

interface TextModel {
  name: string;
  modelName: string;
  type: "text";
  think: boolean;
}

interface ImageModel {
  name: string;
  modelName: string;
  type: "image";
  mode: ("text" | "singleImage" | "multiReference")[];
  associationSkills?: string;
}

interface VideoModel {
  name: string;
  modelName: string;
  type: "video";
  mode: VideoMode[];
  associationSkills?: string;
  audio: "optional" | false | true;
  durationResolutionMap: { duration: number[]; resolution: string[] }[];
}

interface TTSModel {
  name: string;
  modelName: string;
  type: "tts";
  voices: { title: string; voice: string }[];
}

interface VendorConfig {
  id: string;
  version: string;
  name: string;
  author: string;
  description?: string;
  icon?: string;
  inputs: { key: string; label: string; type: "text" | "password" | "url"; required: boolean; placeholder?: string }[];
  inputValues: Record<string, string>;
  models: (TextModel | ImageModel | VideoModel | TTSModel)[];
}

type ReferenceList =
  | { type: "image"; sourceType: "base64"; base64: string }
  | { type: "audio"; sourceType: "base64"; base64: string }
  | { type: "video"; sourceType: "base64"; base64: string };

interface ImageConfig {
  prompt: string;
  referenceList?: Extract<ReferenceList, { type: "image" }>[];
  size: "1K" | "2K" | "4K";
  aspectRatio: `${number}:${number}`;
}

interface VideoConfig {
  duration: number;
  resolution: string;
  aspectRatio: "16:9" | "9:16";
  prompt: string;
  referenceList?: ReferenceList[];
  audio?: boolean;
  mode: VideoMode[];
}

interface TTSConfig {
  text: string;
  voice: string;
  speechRate: number;
  pitchRate: number;
  volume: number;
  referenceList?: Extract<ReferenceList, { type: "audio" }>[];
}

interface PollResult {
  completed: boolean;
  data?: string;
  error?: string;
}

// ============================================================
// 全局声明
// ============================================================

declare const axios: any;
declare const logger: (msg: string) => void;
declare const jsonwebtoken: any;
declare const zipImage: (base64: string, size: number) => Promise<string>;
declare const zipImageResolution: (base64: string, w: number, h: number) => Promise<string>;
declare const mergeImages: (base64Arr: string[], maxSize?: string) => Promise<string>;
declare const urlToBase64: (url: string) => Promise<string>;
declare const pollTask: (fn: () => Promise<PollResult>, interval?: number, timeout?: number) => Promise<PollResult>;
declare const createOpenAI: any;
declare const createDeepSeek: any;
declare const createZhipu: any;
declare const createQwen: any;
declare const createAnthropic: any;
declare const createOpenAICompatible: any;
declare const createXai: any;
declare const createMinimax: any;
declare const createGoogleGenerativeAI: any;
declare const exports: {
  vendor: VendorConfig;
  textRequest: (m: TextModel, t: boolean, tl: 0 | 1 | 2 | 3) => any;
  imageRequest: (c: ImageConfig, m: ImageModel) => Promise<string>;
  videoRequest: (c: VideoConfig, m: VideoModel) => Promise<string>;
  ttsRequest: (c: TTSConfig, m: TTSModel) => Promise<string>;
  checkForUpdates?: () => Promise<{ hasUpdate: boolean; latestVersion: string; notice: string }>;
  updateVendor?: () => Promise<string>;
};

// ============================================================
// 视频参数（放在供应商配置之前：下面的 models 字面量要用到）
// ============================================================

/** 服务端实测帧率（224 帧 = 9.42s），按它把秒换算成 `length` 帧数 */
const VIDEO_FPS = 24;
/** 服务端默认规格，实测可用；两边都是 32 的倍数 */
const VIDEO_PORTRAIT = { width: 544, height: 960 };
const VIDEO_LANDSCAPE = { width: 960, height: 544 };
/** `length` 必须按 32 的倍数吸附（实测 238→224、64→64），这里自己先对齐好 */
const VIDEO_FRAME_STEP = 32;
/** 可申请的最长秒数（仅用于 durationResolutionMap 的展示信息） */
const VIDEO_MAX_SECONDS = 15;
const VIDEO_DURATIONS: number[] = [];
for (let i = 1; i <= VIDEO_MAX_SECONDS; i++) VIDEO_DURATIONS.push(i);
const VIDEO_RESOLUTION_LABEL = "544x960 / 960x544";

// ============================================================
// 供应商配置
// ============================================================

const vendor: VendorConfig = {
  id: "dp",
  // ≥2.0 才走现代参考图分支（referenceList2imageBase642 会按 version 分流）
  version: "2.1",
  author: "DeepSFV",
  name: "DP 自建服务",
  description:
    "自建推理服务，同一把密钥提供两个能力：\n\n- **Z-Image-Turbo**（文生图）：返回 PNG 二进制。**不支持参考图**，分镜/资产的形象参考图会被忽略。\n- **MiniMax-H3**（图生视频）：三步异步任务制，**必须有参考图**（分镜已生成的画面），产出 mp4。仅在服务端 GPU 切到 H3 视频模式时可用。",
  inputs: [
    { key: "apiKey", label: "API密钥", type: "password", required: true, placeholder: "sk-dp-..." },
    { key: "baseUrl", label: "请求地址", type: "url", required: true, placeholder: "示例：http://115.190.62.87/dp" },
  ],
  inputValues: { apiKey: "", baseUrl: "http://115.190.62.87/dp" },
  models: [
    {
      name: "Z-Image-Turbo",
      modelName: "z-image-turbo",
      // 接口没有图生图入口，只声明 text
      type: "image",
      mode: ["text"],
    },
    {
      name: "MiniMax-H3",
      modelName: "minimax-h3",
      type: "video",
      // 图生视频：必须要一张参考图（分镜已生成的画面）
      mode: ["singleImage"],
      // 服务端不产出音轨
      audio: false,
      durationResolutionMap: [{ duration: VIDEO_DURATIONS, resolution: [VIDEO_RESOLUTION_LABEL] }],
    },
  ],
};

// ============================================================
// 辅助工具
// ============================================================

/**
 * 生成接口的服务端单卡串行，排队时单张可能远超 20s；180s 是防挂死的兜底，不做自动重试。
 * 用 axios 的 timeout（沙箱里没有 AbortController，只能用 axios 自带的超时）。
 */
const IMAGE_TIMEOUT_MS = 180000;

/** 请求步数：Z-Image-Turbo 是 8 步蒸馏模型，接口默认值即 8 */
const IMAGE_STEPS = 8;

/** 视频三步各自的超时（实测 224 帧≈95s，留足余量） */
const SUBMIT_TIMEOUT_MS = 120000;
const POLL_TIMEOUT_MS = 30000;
const DOWNLOAD_TIMEOUT_MS = 180000;
/** 任务整体上限与轮询间隔 */
const JOB_TIMEOUT_MS = 600000;
const POLL_INTERVAL_MS = 5000;

/** 接口允许的宽高区间，超出会被服务端静默夹取 */
const MIN_SIDE = 256;
const MAX_SIDE = 2048;

/**
 * `size` 决定长边像素，短边按 `aspectRatio` 等比算出，两端夹到 [256, 2048]。
 * 服务端上限就是 2048，所以 4K 与 2K 同规格——这是模型能力边界，不在这里偷偷打折。
 */
const LONG_SIDE_BY_SIZE: Record<string, number> = {
  "1K": 1024,
  "2K": 2048,
  "4K": 2048,
  "1080P": 1920,
};

const clampSide = (n: number): number => Math.min(MAX_SIDE, Math.max(MIN_SIDE, Math.round(n)));

const resolveSize = (size: string, aspectRatio: string): { width: number; height: number } => {
  const longSide = LONG_SIDE_BY_SIZE[size] ?? 1024;
  const [rawW, rawH] = String(aspectRatio).split(":");
  const w = Number(rawW);
  const h = Number(rawH);
  // 画幅解析不出来时按方图处理（ImageConfig 理论上只给 9:16 / 16:9）
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return { width: clampSide(longSide), height: clampSide(longSide) };
  }
  const longIsWidth = w >= h;
  const ratio = Math.min(w, h) / Math.max(w, h);
  const shortSide = clampSide(longSide * ratio);
  const long = clampSide(longSide);
  return longIsWidth ? { width: long, height: shortSide } : { width: shortSide, height: long };
};

/**
 * 从响应里取可读原因：服务端失败回 `{"detail":"..."}`，取不到就回退到状态码。
 * `responseType: "arraybuffer"` 时失败体也是二进制，要先转回字符串再解析。
 *
 * 这里刻意不用 `error.response`：vendor 代码跑在 vm2 沙箱里，跨 realm 传出来的
 * axios 错误对象会丢掉 `response` 字段（实测只剩 message），拿不到服务端原因。
 * 故调用处用 `validateStatus` 让 axios 不抛错，由本函数自己判状态码。
 */
const errorReason = (response: any): string => {
  const raw = response?.data;
  const text = Buffer.isBuffer(raw) ? raw.toString("utf8") : typeof raw === "string" ? raw : "";
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed.detail === "string" && parsed.detail) return parsed.detail;
  } catch {
    if (text) return text.slice(0, 200);
  }
  return `HTTP ${response?.status ?? "未知"}`;
};

// ============================================================
// 适配器函数
// ============================================================

/** 未实现的模型类型保留空实现（模板要求不可省略导出） */
const textRequest = (model: TextModel, think: boolean, thinkLevel: 0 | 1 | 2 | 3) => {
  throw new Error("DP 图像服务不提供文本模型");
};

/**
 * 文生图：POST {baseUrl}/img/generate，请求体 JSON，响应 PNG 二进制。
 * 返回有头 base64（`data:image/png;base64,...`），由调用方落盘到 OSS。
 */
const imageRequest = async (config: ImageConfig, model: ImageModel): Promise<string> => {
  if (!vendor.inputValues.apiKey) throw new Error("缺少API Key");
  const baseUrl = vendor.inputValues.baseUrl.replace(/\/+$/, "");
  const { width, height } = resolveSize(config.size, config.aspectRatio);

  logger(`Z-Image-Turbo 文生图：${width}x${height}，steps=${IMAGE_STEPS}`);
  let response: any;
  try {
    response = await axios.post(
      `${baseUrl}/img/generate`,
      { prompt: config.prompt, width, height, steps: IMAGE_STEPS },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${vendor.inputValues.apiKey.replace(/^Bearer\s+/i, "")}`,
        },
        // 响应是 PNG 二进制而非 JSON
        responseType: "arraybuffer",
        timeout: IMAGE_TIMEOUT_MS,
        // 4xx/5xx 也正常返回，由下面自己判——见 errorReason 的注释
        validateStatus: () => true,
      },
    );
  } catch (e: any) {
    if (e?.code === "ECONNABORTED") throw new Error(`Z-Image 生图超时（${IMAGE_TIMEOUT_MS / 1000}s）`);
    throw new Error(`Z-Image 生图失败：${e?.message || "网络错误"}`);
  }

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Z-Image 生图失败：${errorReason(response)}`);
  }
  const buffer = Buffer.isBuffer(response.data) ? response.data : Buffer.from(response.data ?? []);
  if (!buffer.length) throw new Error("Z-Image 生图失败：响应为空");
  return `data:image/png;base64,${buffer.toString("base64")}`;
};

/** 按画幅挑服务端默认规格（放大没实测过，先不按 resolution 缩放） */
const resolveVideoSize = (aspectRatio: string): { width: number; height: number } => {
  const [rawW, rawH] = String(aspectRatio).split(":");
  const w = Number(rawW);
  const h = Number(rawH);
  // 解析不出来时按竖屏处理（项目默认 9:16）
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return VIDEO_PORTRAIT;
  return w >= h ? VIDEO_LANDSCAPE : VIDEO_PORTRAIT;
};

/** 秒 → 帧数：乘帧率后向下对齐到 32 的倍数，且至少一档 */
const resolveVideoFrames = (durationSec: number): number => {
  const raw = Math.round((Number(durationSec) || 0) * VIDEO_FPS);
  const snapped = Math.floor(raw / VIDEO_FRAME_STEP) * VIDEO_FRAME_STEP;
  return Math.max(VIDEO_FRAME_STEP, snapped);
};

/**
 * 图生视频：提交 → 轮询 → 下载，三步都带同一次 Authorization。
 *
 * 返回**有头 base64**（`data:video/mp4;base64,…`）而不是下载 URL——下载端点要鉴权，
 * 调用方拿 URL 去取会 401（AiVideo 的 urlToBase64 不带任何头）。
 */
const videoRequest = async (config: VideoConfig, model: VideoModel): Promise<string> => {
  if (!vendor.inputValues.apiKey) throw new Error("缺少API Key");
  const baseUrl = vendor.inputValues.baseUrl.replace(/\/+$/, "");
  const authHeader = { Authorization: `Bearer ${vendor.inputValues.apiKey.replace(/^Bearer\s+/i, "")}` };

  // 1) 参考图：端点只收 multipart 的 image，没有图就没法生成
  const reference = (config.referenceList ?? []).find((item) => item.type === "image");
  if (!reference || !reference.base64) {
    throw new Error("MiniMax-H3 是图生视频：该分镜还没有画面，请先在分镜工作区生成分镜图片");
  }
  const imageBuffer = Buffer.from(String(reference.base64).replace(/^data:[^;]+;base64,/, ""), "base64");
  if (!imageBuffer.length) throw new Error("参考图解码失败");

  const { width, height } = resolveVideoSize(config.aspectRatio);
  const frames = resolveVideoFrames(config.duration);
  const query = [
    `length=${frames}`,
    `width=${width}`,
    `height=${height}`,
    // prompt 只能走查询串；实测 291 字中文（编码后 2.4KB URL）服务端照收
    `prompt=${encodeURIComponent(config.prompt || "")}`,
  ].join("&");

  const form = new FormData();
  form.append("image", imageBuffer, { filename: "reference.jpg", contentType: "image/jpeg" });

  logger(`MiniMax-H3 图生视频：${width}x${height}，${frames} 帧（约 ${(frames / VIDEO_FPS).toFixed(1)}s）`);
  const submit = await axios.post(`${baseUrl}/video/generate?${query}`, form, {
    headers: { ...form.getHeaders(), ...authHeader },
    timeout: SUBMIT_TIMEOUT_MS,
    // 4xx/5xx 也正常返回，由下面自己判——见 errorReason 的注释（沙箱里 error.response 会丢）
    validateStatus: () => true,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });
  if (submit.status < 200 || submit.status >= 300) {
    throw new Error(`MiniMax-H3 提交失败：${errorReason(submit)}`);
  }
  const jobId = submit.data && submit.data.job_id;
  if (!jobId) throw new Error("MiniMax-H3 提交失败：响应里没有 job_id");

  // 2) 轮询到终态
  const polled = await pollTask(
    async () => {
      const state = await axios.get(`${baseUrl}/video/job/${jobId}`, {
        headers: authHeader,
        timeout: POLL_TIMEOUT_MS,
        validateStatus: () => true,
      });
      if (state.status < 200 || state.status >= 300) {
        return { completed: true, error: `查询任务失败：${errorReason(state)}` };
      }
      const data = state.data || {};
      if (data.status === "failed") return { completed: true, error: data.error || "视频生成失败" };
      if (data.status === "success") return { completed: true, data: jobId };
      return { completed: false };
    },
    POLL_INTERVAL_MS,
    JOB_TIMEOUT_MS,
  );
  // pollTask 在「任务失败 / 轮询抛错 / 超时」三种情况下都回 completed:false + error，
  // 超时的 error 是固定串 "timeout"，单独拎出来给可读文案
  if (polled.error) {
    throw new Error(
      polled.error === "timeout"
        ? `MiniMax-H3 生成超时（${JOB_TIMEOUT_MS / 1000}s）`
        : `MiniMax-H3 生成失败：${polled.error}`,
    );
  }
  if (!polled.completed) throw new Error("MiniMax-H3 生成未完成");

  // 3) 下载 mp4 并转成有头 base64
  const file = await axios.get(`${baseUrl}/video/job/${jobId}/file`, {
    headers: authHeader,
    responseType: "arraybuffer",
    timeout: DOWNLOAD_TIMEOUT_MS,
    validateStatus: () => true,
  });
  if (file.status < 200 || file.status >= 300) {
    throw new Error(`MiniMax-H3 下载失败：${errorReason(file)}`);
  }
  const videoBuffer = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data ?? []);
  if (!videoBuffer.length) throw new Error("MiniMax-H3 下载失败：响应为空");
  return `data:video/mp4;base64,${videoBuffer.toString("base64")}`;
};

const ttsRequest = async (config: TTSConfig, model: TTSModel): Promise<string> => {
  throw new Error("DP 图像服务不提供语音模型");
};

const checkForUpdates = async (): Promise<{ hasUpdate: boolean; latestVersion: string; notice: string }> => {
  return { hasUpdate: false, latestVersion: "2.0", notice: "" };
};

const updateVendor = async (): Promise<string> => {
  return "";
};

// ============================================================
// 导出
// ============================================================

exports.vendor = vendor;
exports.textRequest = textRequest;
exports.imageRequest = imageRequest;
exports.videoRequest = videoRequest;
exports.ttsRequest = ttsRequest;
exports.checkForUpdates = checkForUpdates;
exports.updateVendor = updateVendor;

// 这行代码用于确保当前文件被识别为模块，避免全局变量冲突
export {};
