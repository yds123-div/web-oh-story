import crypto from "crypto";

/**
 * 口令哈希。
 *
 * 历史情况：`o_user.password` 存的是**明文**，`login.ts` 用 `data.password == password`
 * 直接比对。改成哈希时不能一刀切——老库里躺着明文，若只认哈希就会把所有既有部署锁在门外。
 * 所以 `verifyPassword` 同时接受两种形态，并在明文命中时**顺手升级**成哈希（见 login.ts）。
 *
 * 强度说明：这里用 sha256 单轮、**没有加盐**，严格说不足以抵抗离线爆破，
 * 只是「不再明文落库」。真正的解法是 bcrypt/argon2（引入依赖 + 全量迁移），属独立改动。
 */
const SHA256_HEX_LENGTH = 64;

export function hashPassword(plain: string): string {
  return crypto.createHash("sha256").update(plain, "utf8").digest("hex");
}

/** 看起来像不像本模块产出的哈希（64 位十六进制） */
export function isHashedPassword(stored: string): boolean {
  return stored.length === SHA256_HEX_LENGTH && /^[0-9a-f]+$/.test(stored);
}

/**
 * 校验口令。返回 `{ ok, needsUpgrade }`：
 * `needsUpgrade` 为 true 表示这次是拿明文比对命中的，调用方应把库里的值改写成哈希。
 */
export function verifyPassword(stored: string, input: string): { ok: boolean; needsUpgrade: boolean } {
  if (isHashedPassword(stored)) {
    // 用固定时间比较，避免按字符提前返回
    const a = Buffer.from(stored, "utf8");
    const b = Buffer.from(hashPassword(input), "utf8");
    return { ok: a.length === b.length && crypto.timingSafeEqual(a, b), needsUpgrade: false };
  }
  return { ok: stored === input, needsUpgrade: true };
}