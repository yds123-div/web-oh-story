/**
 * Toonflow AI供应商模板 - DP 图像服务（Z-Image-Turbo）
 * @version 2.0
 *
 * 说明：
 * 1) 纯文生图。接口 POST {baseUrl}/img/generate，请求体 {prompt,width,height,steps,seed?}，
 *    响应是 PNG 二进制（不是 JSON），故这里直接读 arrayBuffer 再拼成有头 base64。
 * 2) **不支持参考图**：接口没有图生图/多图参考入口，`config.referenceList`（分镜关联资产的
 *    形象图、资产工坊上传的参考图）会被丢弃。模型的 mode 也只声明 "text"，如实反映这一点。
 * 3) 宽高上限 2048、下限 256，超出范围由服务端静默夹取（不是报错）。
 * 4) 服务端单卡串行、高并发自动排队；同 prompt 不传 seed 时每次出图都不同。
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
// 供应商配置
// ============================================================

const vendor: VendorConfig = {
  id: "dp",
  version: "2.0",
  author: "DeepSFV",
  name: "DP 图像服务",
  description: "自建 Z-Image-Turbo 文生图服务，返回 PNG 二进制。\n\n**不支持参考图**：纯文本生成，分镜/资产的形象参考图会被忽略。",
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

const videoRequest = async (config: VideoConfig, model: VideoModel): Promise<string> => {
  throw new Error("DP 图像服务不提供视频模型");
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
