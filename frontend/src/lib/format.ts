/** ISO 时间 → `YYYY-MM-DD HH:mm`（取前 chars 个字符，默认到分钟） */
export function formatDateTime(iso: string | null, chars = 16): string {
  if (!iso) return '—';
  return iso.slice(0, chars).replace('T', ' ');
}
