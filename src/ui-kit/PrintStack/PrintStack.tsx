import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { imageRatio, imageUrl } from '@/lib/images';
import { useInView, usePrefersReducedMotion } from '@/lib/mediaSignals';
import { useLift } from '@/ui-kit/Lift/liftContext';
import './PrintStack.css';

const STACK_MS = 4600;
const OUT_MS = 560;
const TILT = [0, 1.4, -1.1, 0.9, -1.6, 1.2];

interface PrintStackProps {
  images: string[];
  caption: string;
}

// Prints in one stage-sized footprint. Every few seconds the top print slides
// off and tucks under, revealing the next; clicking one lifts it off the wall.
const PrintStack = ({ images, caption }: PrintStackProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const visible = useInView(ref);
  const reduced = usePrefersReducedMotion();
  const { lift, lifted } = useLift();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [order, setOrder] = useState(() => images.map((_, index) => index));
  const [out, setOut] = useState(false);
  const cycling = images.length > 1 && visible && !reduced && !lifted;

  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () =>
      setSize({ width: box.clientWidth, height: box.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!cycling) return;
    const timer = window.setInterval(() => {
      if (ref.current?.matches(':hover')) return;
      setOut(true);
      window.setTimeout(() => {
        setOrder((current) => [...current.slice(1), current[0]]);
        setOut(false);
      }, OUT_MS);
    }, STACK_MS);
    return () => window.clearInterval(timer);
  }, [cycling]);

  // Each print is its photo at its true shape plus an even paper border,
  // centred in the footprint.
  const { width: W, height: H } = size;
  const border = Math.round(Math.max(8, W * 0.022));
  const items = images.map((file) => ({
    src: imageUrl(file),
    ratio: imageRatio(file),
  }));

  return (
    <div ref={ref}>
      <div ref={boxRef} className="stack">
        {images.map((file, index) => {
          const depth = order.indexOf(index);
          const { ratio } = items[index];
          const innerW = Math.max(
            0,
            Math.min(W - 2 * border, (H - 2 * border) * ratio)
          );
          const w = innerW + 2 * border;
          const h = innerW / ratio + 2 * border;
          return (
            <button
              key={file + index}
              className={`print${out && depth === 0 ? ' out' : ''}`}
              data-top={depth === 0 || undefined}
              aria-label={`Open screenshot ${index + 1} of ${images.length}`}
              style={
                {
                  width: w,
                  height: h,
                  left: (W - w) / 2,
                  top: (H - h) / 2,
                  zIndex: 20 - depth,
                  visibility: W ? undefined : 'hidden',
                  '--b': `${border}px`,
                  '--d': Math.min(depth, 3),
                  '--rot': depth === 0 ? 0 : TILT[index % TILT.length],
                } as CSSProperties
              }
              onClick={(event) =>
                lift({ items, index, from: event.currentTarget, caption })
              }
            >
              <img src={imageUrl(file)} alt="" loading="lazy" />
            </button>
          );
        })}
      </div>
      {images.length > 1 && (
        <div className="stack-meta">
          <span className="stack-dots" aria-hidden="true">
            {images.map((file, index) => (
              <i
                key={file + index}
                className={index === order[0] ? 'on' : ''}
              />
            ))}
          </span>
          <span>{images.length} prints</span>
        </div>
      )}
    </div>
  );
};

export default PrintStack;
