import {
  useEffect,
  useRef,
  type HTMLAttributes,
  type MouseEvent as ReactMouseEvent,
  type PropsWithChildren,
} from 'react';

type GlassCardProps = PropsWithChildren<HTMLAttributes<HTMLDivElement>>;

const GlassCard = ({ children, className = '', ...props }: GlassCardProps) => {
  const rafId = useRef<number | null>(null);

  const setVars = (
    target: HTMLDivElement,
    clientX: number,
    clientY: number
  ) => {
    if (window.innerWidth < 768) return; // Skip on mobile
    if (!target.isConnected) return;

    const rect = target.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    target.style.setProperty('--mouse-x', `${x}px`);
    target.style.setProperty('--mouse-y', `${y}px`);
  };

  const handleMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (rafId.current) return; // Throttle to 1 per frame

    const target = event.currentTarget;
    const { clientX, clientY } = event;

    rafId.current = requestAnimationFrame(() => {
      setVars(target, clientX, clientY);
      rafId.current = null;
    });
  };

  const handleMouseEnter = (event: ReactMouseEvent<HTMLDivElement>) => {
    setVars(event.currentTarget, event.clientX, event.clientY);
  };

  const handleMouseLeave = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.currentTarget.style.removeProperty('--mouse-x');
    event.currentTarget.style.removeProperty('--mouse-y');
  };

  useEffect(
    () => () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    },
    []
  );

  return (
    <div
      className={`glass-card ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMove}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {children}
    </div>
  );
};

export default GlassCard;
