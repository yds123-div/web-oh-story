import type { CSSProperties } from 'react';
import bCss from './variants/custom-b.css?raw';
import cCss from './variants/demo-c.css?raw';

/** 统计口径：非空行，剔除纯注释行 */
const cssLines = (raw: string) =>
  raw.split('\n').filter((l) => l.trim() && !l.trim().startsWith('/*') && !l.trim().startsWith('*')).length;

export interface VariantDef {
  key: 'A' | 'B' | 'C';
  name: string;
  cssLines: number;
}

export const VARIANTS: VariantDef[] = [
  { key: 'A', name: '纯 token（零自定义 CSS）', cssLines: 0 },
  { key: 'B', name: 'token + 定向 CSS', cssLines: cssLines(bCss) },
  { key: 'C', name: 'demo CSS 原样移植', cssLines: cssLines(cCss) },
];

export default function PrototypeSwitcher({
  current,
  onCycle,
}: {
  current: string;
  onCycle: (dir: 1 | -1) => void;
}) {
  const def = VARIANTS.find((v) => v.key === current) ?? VARIANTS[0];
  const arrowBtn: CSSProperties = {
    border: 'none',
    background: '#111',
    color: '#fff',
    borderRadius: 999,
    width: 24,
    height: 24,
    cursor: 'pointer',
    fontSize: 11,
    lineHeight: 1,
  };
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: '#fff',
        color: '#111',
        borderRadius: 999,
        padding: '9px 16px',
        boxShadow: '0 6px 24px rgba(0,0,0,.6)',
        fontFamily: 'Consolas, monospace',
        fontSize: 12,
        whiteSpace: 'nowrap',
      }}
    >
      <button style={arrowBtn} onClick={() => onCycle(-1)} aria-label="上一个变体">◀</button>
      <span>
        <b>{def.key}</b> — {def.name} · 自定义 CSS {def.cssLines} 行
      </span>
      <button style={arrowBtn} onClick={() => onCycle(1)} aria-label="下一个变体">▶</button>
    </div>
  );
}
