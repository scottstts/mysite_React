import {
  useRef,
  type HTMLAttributes,
  type MouseEvent as ReactMouseEvent,
  type PropsWithChildren,
} from 'react';

type GlassCardProps = PropsWithChildren<HTMLAttributes<HTMLDivElement>>;

const GlassCard = ({
  children,
  className = '',
  ...props
}: GlassCardProps) => {
  const rafId = useRef<number | null>(null);

  const setVars = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (window.innerWidth < 768) return; // Skip on mobile

    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    event.currentTarget.style.setProperty('--mouse-x', `${x}px`);
    event.currentTarget.style.setProperty('--mouse-y', `${y}px`);
  };

  const handleMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (rafId.current) return; // Throttle to 1 per frame
    rafId.current = requestAnimationFrame(() => {
      setVars(event);
      rafId.current = null;
    });
  };

  const handleMouseLeave = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.currentTarget.style.removeProperty('--mouse-x');
    event.currentTarget.style.removeProperty('--mouse-y');
  };

  return (
    <div
      className={`glass-card ${className}`}
      onMouseEnter={setVars}
      onMouseMove={handleMove}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {children}
    </div>
  );
};

export default GlassCard;
