import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import VariantA from './variants/VariantA';
import VariantB from './variants/VariantB';
import VariantC from './variants/VariantC';
import PrototypeSwitcher, { VARIANTS } from './PrototypeSwitcher';

const COMPONENTS: Record<string, ComponentType> = {
  A: VariantA,
  B: VariantB,
  C: VariantC,
};

export default function App() {
  const [variant, setVariant] = useState<string>(() => {
    const v = new URLSearchParams(location.search).get('variant');
    return v && v in COMPONENTS ? v : 'B';
  });

  const cycle = (dir: 1 | -1) => {
    const i = VARIANTS.findIndex((v) => v.key === variant);
    const next = VARIANTS[(i + dir + VARIANTS.length) % VARIANTS.length].key;
    history.replaceState(null, '', `?variant=${next}`);
    setVariant(next);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'ArrowLeft') cycle(-1);
      if (e.key === 'ArrowRight') cycle(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [variant]);

  const Cmp = COMPONENTS[variant];
  return (
    <>
      <Cmp />
      <PrototypeSwitcher current={variant} onCycle={cycle} />
    </>
  );
}
