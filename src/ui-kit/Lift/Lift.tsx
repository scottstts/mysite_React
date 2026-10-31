import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { LiftContext, type LiftRequest } from './liftContext';
import './Lift.css';
import Icon from '@/ui-kit/Icon/Icon';

const SETTLE_MS = 650;
const PAD = 28; // the print's paper border, both sides

const rectOf = (element: HTMLElement) => {
  const { left, top, width, height } = element.getBoundingClientRect();
  return { left, top, width, height };
};

// The largest print of this shape that fits the middle of the screen.
const targetRect = (ratio: number) => {
  const maxW = window.innerWidth * 0.86;
  const maxH = window.innerHeight * 0.78;
  let width = maxW;
  let height = width / ratio + PAD;
  if (height > maxH) {
    height = maxH;
    width = (height - PAD) * ratio + PAD;
  }
  return {
    left: (window.innerWidth - width) / 2,
    top: (window.innerHeight - height) / 2 - 18,
    width,
    height,
  };
};

interface LiftViewProps {
  request: LiftRequest;
  onClosed: () => void;
}

// The print comes off the wall toward you, and goes back where it was.
const LiftView = ({ request, onClosed }: LiftViewProps) => {
  const { items, from, caption = '' } = request;
  const [index, setIndex] = useState(request.index);
  const [phase, setPhase] = useState<'enter' | 'open' | 'leave'>('enter');
  const [, setViewport] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const many = items.length > 1;

  const close = useCallback(() => setPhase('leave'), []);
  const step = useCallback(
    (delta: number) =>
      setIndex((current) => (current + delta + items.length) % items.length),
    [items.length]
  );

  // Start on top of the print, then let it travel.
  useLayoutEffect(() => {
    void cardRef.current?.offsetWidth;
    const frame = requestAnimationFrame(() => setPhase('open'));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (phase === 'open') closeRef.current?.focus({ preventScroll: true });
    if (phase !== 'leave') return;
    const timer = window.setTimeout(() => {
      from.focus({ preventScroll: true });
      onClosed();
    }, SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [phase, from, onClosed]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (many && event.key === 'ArrowRight') step(1);
      if (many && event.key === 'ArrowLeft') step(-1);
    };
    const onResize = () => setViewport(window.innerWidth);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [close, step, many]);

  const item = items[index];
  const on = phase === 'open' ? ' on' : '';
  const rect = phase === 'open' ? targetRect(item.ratio) : rectOf(from);
  const label = [caption, many ? `${index + 1} of ${items.length}` : '']
    .filter(Boolean)
    .join(' · ');

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={label || 'Image'}>
      <div className={`lift-veil${on}`} onClick={close} />
      <div
        ref={cardRef}
        className="lift"
        style={{
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          transition: phase === 'enter' ? 'none' : undefined,
        }}
      >
        <img src={item.src} alt={label} />
      </div>
      <div className={`lift-ui${on}`}>
        {many && (
          <button aria-label="Previous" onClick={() => step(-1)}>
            <Icon name="fa-solid fa-arrow-left" />
          </button>
        )}
        <span className="cap">{label}</span>
        {many && (
          <button aria-label="Next" onClick={() => step(1)}>
            <Icon name="fa-solid fa-arrow-right" />
          </button>
        )}
      </div>
      <div className={`lift-x${on}`}>
        <button ref={closeRef} aria-label="Close" onClick={close}>
          <Icon name="fa-solid fa-xmark" />
        </button>
      </div>
    </div>,
    document.body
  );
};

export const LiftProvider = ({ children }: { children: ReactNode }) => {
  const [request, setRequest] = useState<LiftRequest | null>(null);
  const closed = useCallback(() => setRequest(null), []);
  const api = useMemo(
    () => ({ lift: setRequest, lifted: request !== null }),
    [request]
  );

  return (
    <LiftContext.Provider value={api}>
      {children}
      {request && <LiftView request={request} onClosed={closed} />}
    </LiftContext.Provider>
  );
};
