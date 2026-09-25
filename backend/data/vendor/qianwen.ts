/**
 * Toonflow AI供应商模板 - Qianwen MaaS（Wan 2.7 图像）
 * @version 2.0
 *
 * 兼容模式（OpenAI 风格）的多模态生图端点，**图像从 chat/completions 回来**：
 *
 * 【调用形状】
 * POST {baseUrl}/chat/completions
 * body: {
 *   model: "wan2.7-image-pro",
 *   messages: [{ role: "user", content: [
 *     { type: "image", image: "<data URL>" },   // 参考图，可多张、可省略
 *     { type: "text",  text: "<提示词>" }
 *   ]}],
 *   parameters: { size: "1152*2048" }           // 注意是 `*` 不是 `x`
 * }
 *
 * 响应不是 OpenAI 的 chat.completion，而是 DashScope 风格：
 *   { output: { choices: [ { message: { content: [ { type: "image", image: "<URL>" } ] } } ] },
 *     usage: { size: "1152*2048", image_count: 1 } }
 *
 * 【实测要点（2026-09-25，改这个文件前先读）】
 * 1. **尺寸只认 `parameters.size`**，形如 `1152*2048`（乘号是 `*`）。
 *    顶层 `size`、`parameters` 之外的任何位置、以及 `1024x1792` 这种 `x` 写法
 *    都会被**静默忽略**，回落到默认的 2048*2048 —— 不报错，所以很难发现。
 * 2. **必须传 `parameters` 才会走指定尺寸**；不传就固定 2048*2048 方图。
 * 3. `messages[].content` 必须是**数组**，传字符串会报
 *    `Input should be a valid list: input.messages.0.content`。
 * 4. **支持参考图**（多模态输入）：`{type:"image", image:"data:image/png;base64,..."}`，
 *    实测 1 张、3 张都能跑通；参考图**最小 240×240**，更小报
 *    `resolution must be at least 240x240`。data URL 会被服务端转存到它自己的 OSS。
 *    → 这条让「资产形象 / 分镜关联资产」的参考图真正生效，不再是纯文生图。
 * 5. 返回的是**签名 OSS URL**，免鉴权即可下载（与 dp 的鉴权下载端点不同）；
 *    这里仍自行下载转 base64，不依赖调用方的 urlToBase64（它不带请求头）。
 * 6. 未知字段被静默忽略（不校验、不报错），所以参数写错位置不会有任何提示。
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
  id: "qianwen",
  // ≥2.0 才走现代参考图分支（referenceList2imageBase642 会按 version 分流）
  version: "2.0",
  author: "DeepSFV",
  name: "千问 MaaS（Wan 图像）",
  description:
    "OpenAI 兼容模式的多模态生图服务，图像从 chat/completions 返回。\n\n- **Wan 2.7 Image Pro**（文生图 / 参考图生图）：**支持参考图**（可多张，单张最小 240×240），资产的形象图与分镜关联资产图会作为多模态输入参与生成。\n- 输出尺寸由 `parameters.size` 控制，形如 `1152*2048`。\n- 本供应商**不提供**文本与视频模型。",
  inputs: [
    { key: "apiKey", label: "API密钥", type: "password", required: true, placeholder: "sk-sp-..." },
    {
      key: "baseUrl",
      label: "请求地址",
      type: "url",
      required: true,
      placeholder: "示例：https://token-plan.maas.qianwenaiapi.com/compatible-mode/v1",
    },
  ],
  inputValues: { apiKey: "", baseUrl: "https://token-plan.maas.qianwenaiapi.com/compatible-mode/v1" },
  models: [
    {
      name: "Wan 2.7 Image Pro",
      modelName: "wan2.7-image-pro",
      type: "image",
      // 参考图实测可用（1 张 / 3 张都跑通），故三种模式都声明
      mode: ["text", "singleImage", "multiReference"],
    },
  ],
};

// ============================================================
// 辅助工具
// ============================================================

/** 服务端单张耗时随尺寸上涨（实测 2048² 约 20-30s），180s 是防挂死的兜底，不做自动重试 */
const IMAGE_TIMEOUT_MS = 180000;
/** 下载签名 URL 的兜底超时 */
const DOWNLOAD_TIMEOUT_MS = 120000;

/**
 * 边长区间与「size → 长边」表**照抄自 dp.ts 的 Z-Image 实现**，不是本端点的实测结论：
 * 本端点只实测过 576×1024 / 1024×1024 / 1024×1792 / 1152×2048 / 2048×1152 这几档，
 * **上下限与越界行为没有探过**（不保证服务端是夹取还是报错）。沿用同一套是为了让两个
 * 图像供应商在「1K/2K」选项下表现一致；换供应商或改选项时请以实测为准。
 */
const MIN_SIDE = 256;
const MAX_SIDE = 2048;

/** `size` 决定长边像素，短边按 `aspectRatio` 等比算出，两端夹到 [MIN_SIDE, MAX_SIDE] */
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
 * 从响应里取可读原因。这个端点的失败体有两种：
 * 服务端参数错回 `{code, message}`，网关/上游错回 `{error:{message}}`。
 * 取不到就回退到状态码。
 *
 * 刻意不用 `error.response`：vendor 代码跑在 vm2 沙箱里，跨 realm 传出来的 axios
 * 错误对象会丢 `response` 字段，所以调用处用 `validateStatus` 让 axios 不抛错。
 */
const errorReason = (response: any): string => {
  const data = response?.data;
  if (data && typeof data === "object") {
    if (typeof data.message === "string" && data.message) return data.message;
    const nested = data.error;
    if (nested && typeof nested === "object" && typeof nested.message === "string" && nested.message) {
      return nested.message;
    }
    if (typeof nested === "string" && nested) return nested;
  }
  if (typeof data === "string" && data) return data.slice(0, 200);
  return `HTTP ${response?.status ?? "未知"}`;
};

/**
 * 从响应里挑出第一张图：`output.choices[0].message.content[]` 里 `type === "image"` 那项的 `image` 字段。
 * 只实现实测到的这一种形状——上游换形状时报「响应里没有图片」比猜错形状好排查。
 */
const pickImage = (data: any): string => {
  const content = data?.output?.choices?.[0]?.message?.content;
  if (!Array.isArray(content)) return "";
  const hit = content.find((item: any) => item && item.type === "image" && item.image);
  return hit ? String(hit.image) : "";
};

// ============================================================
// 适配器函数
// ============================================================

/** 未实现的模型类型保留空实现（模板要求四个导出齐全） */
const textRequest = (model: TextModel, think: boolean, thinkLevel: 0 | 1 | 2 | 3) => {
  throw new Error("千问 MaaS（Wan 图像）不提供文本模型");
};

/**
 * 生图：POST {baseUrl}/chat/completions，多模态 content 数组，
 * 参考图在前、提示词在后，尺寸走 `parameters.size`（乘号是 `*`）。
 * 返回有头 base64（`data:image/png;base64,...`）。
 */
const imageRequest = async (config: ImageConfig, model: ImageModel): Promise<string> => {
  if (!vendor.inputValues.apiKey) throw new Error("缺少API Key");
  const baseUrl = vendor.inputValues.baseUrl.replace(/\/+$/, "");
  const { width, height } = resolveSize(config.size, config.aspectRatio);

  // 参考图是完整的 data URL（后端 getImageBase64 直接给 data:image/jpeg;base64,...）
  const references = (config.referenceList ?? []).filter((item) => item && item.base64);
  const content: any[] = references.map((item) => ({ type: "image", image: item.base64 }));
  content.push({ type: "text", text: config.prompt });

  logger(`Wan 2.7 生图：${width}x${height}，参考图 ${references.length} 张`);

  let response: any;
  try {
    response = await axios.post(
      `${baseUrl}/chat/completions`,
      {
        model: model.modelName,
        messages: [{ role: "user", content }],
        // 尺寸只有放在这里才生效；写成 `x` 或放到顶层都会被静默忽略
        parameters: { size: `${width}*${height}` },
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${vendor.inputValues.apiKey.replace(/^Bearer\s+/i, "")}`,
        },
        timeout: IMAGE_TIMEOUT_MS,
        // 4xx/5xx 也正常返回，由下面自己判——见 errorReason 的注释
        validateStatus: () => true,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      },
    );
  } catch (e: any) {
    if (e?.code === "ECONNABORTED") throw new Error(`Wan 2.7 生图超时（${IMAGE_TIMEOUT_MS / 1000}s）`);
    throw new Error(`Wan 2.7 生图失败：${e?.message || "网络错误"}`);
  }

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Wan 2.7 生图失败：${errorReason(response)}`);
  }

  const imageRef = pickImage(response.data);
  if (!imageRef) throw new Error("Wan 2.7 生图失败：响应里没有图片");
  // 上游偶尔会直接回 base64 而不是 URL
  if (imageRef.startsWith("data:")) return imageRef;

  // 签名 URL 免鉴权，但这里仍自己下载转码，不依赖调用方的 urlToBase64
  let file: any;
  try {
    file = await axios.get(imageRef, {
      responseType: "arraybuffer",
      timeout: DOWNLOAD_TIMEOUT_MS,
      validateStatus: () => true,
    });
  } catch (e: any) {
    if (e?.code === "ECONNABORTED") throw new Error(`Wan 2.7 图片下载超时（${DOWNLOAD_TIMEOUT_MS / 1000}s）`);
    throw new Error(`Wan 2.7 图片下载失败：${e?.message || "网络错误"}`);
  }
  if (file.status < 200 || file.status >= 300) {
    throw new Error(`Wan 2.7 图片下载失败：HTTP ${file.status}`);
  }
  const buffer = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data ?? []);
  if (!buffer.length) throw new Error("Wan 2.7 生图失败：图片为空");
  // 上游给的是 PNG（实测）；MIME 不影响下游，统一按 png 落盘
  return `data:image/png;base64,${buffer.toString("base64")}`;
};

const videoRequest = async (config: VideoConfig, model: VideoModel): Promise<string> => {
  throw new Error("千问 MaaS（Wan 图像）不提供视频模型");
};

const ttsRequest = async (config: TTSConfig, model: TTSModel): Promise<string> => {
  throw new Error("千问 MaaS（Wan 图像）不提供语音模型");
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