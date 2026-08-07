import { useEffect, useState } from 'react';

/** Calcule H/M/S restants jusqu'à une date ISO. Null si dépassée/absente. */
export function useCountdown(target: string | null) {
  const [left, setLeft] = useState<{ h: number; m: number; s: number } | null>(null);

  useEffect(() => {
    if (!target) { setLeft(null); return; }
    const targetMs = new Date(target).getTime();

    function tick() {
      const diff = Math.max(0, targetMs - Date.now());
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setLeft({ h, m, s });
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  return left;
}
