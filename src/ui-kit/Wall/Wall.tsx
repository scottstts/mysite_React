import { useEffect, useRef, useState } from 'react';
import {
  useDocumentVisible,
  usePrefersReducedMotion,
} from '@/lib/mediaSignals';
import type { TabId } from '@/types/content';
import type { Wall as WallScene } from './wallScene';

interface WallProps {
  tab: TabId;
}

// The sunlit wall behind every page. The scene (and Three.js with it) loads
// after the content, when the browser is idle; until then the plain wall
// colour stands in, and the lit wall fades in over it.
const Wall = ({ tab }: WallProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scene, setScene] = useState<WallScene | null>(null);
  const [lit, setLit] = useState(false);
  const pageVisible = useDocumentVisible();
  const reduced = usePrefersReducedMotion();
  // the gallery is its own room and covers the wall
  const covered = tab === 'art-in-life';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let created: WallScene | undefined;
    const start = () =>
      import('./wallScene').then(({ createWall }) => {
        if (cancelled) return;
        created = createWall(canvas, () => setLit(true));
        setScene(created);
      });
    // Safari has no idle callback; a short delay stands in for it.
    const hasIdle = typeof window.requestIdleCallback === 'function';
    const idle = hasIdle
      ? window.requestIdleCallback(start, { timeout: 2000 })
      : window.setTimeout(start, 600);
    return () => {
      cancelled = true;
      if (hasIdle) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      created?.dispose();
    };
  }, []);

  useEffect(() => {
    scene?.update({ tab, active: pageVisible && !covered, still: reduced });
  }, [scene, tab, pageVisible, covered, reduced]);

  return (
    <canvas
      ref={canvasRef}
      className={`wall${lit && !covered ? ' lit' : ''}`}
      aria-hidden="true"
    />
  );
};

export default Wall;
