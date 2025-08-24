"use client";
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const messages = [
  'Verifying your device…',
  'Securing your session…',
  'Loading your workspace…'
];

export function AuthTransitionOverlay({ active }: { active: boolean }) {
  const [progress, setProgress] = useState(0);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (!active) return;
    let start: number | null = null;
    let raf: number;
    function step(ts: number) {
      if (start === null) start = ts;
      const elapsed = ts - start;
      const pct = Math.min(100, (elapsed / 1200) * 100);
      setProgress(pct);
      if (pct < 100) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    const msgTimer = setInterval(() => {
      setIdx(i => (i + 1 < messages.length ? i + 1 : i));
    }, 450);
    return () => { cancelAnimationFrame(raf); clearInterval(msgTimer); };
  }, [active]);
  if (!active) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-[min(420px,90%)] rounded-xl border bg-card p-6 shadow-lg">
        <div className="mb-4 h-1 w-full overflow-hidden rounded bg-muted">
          <div className="h-full bg-primary transition-[width] duration-100 ease-linear" style={{ width: progress + '%' }} />
        </div>
        <p className="text-sm font-medium mb-1">Getting things ready…</p>
        <p className="text-xs text-muted-foreground h-4 transition-opacity">{messages[idx]}</p>
      </div>
    </div>,
    document.body
  );
}
