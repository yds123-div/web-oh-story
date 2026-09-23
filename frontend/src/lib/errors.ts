/** 从捕获值里提取可展示的错误文案，取不到时用兜底文案 */
export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}
