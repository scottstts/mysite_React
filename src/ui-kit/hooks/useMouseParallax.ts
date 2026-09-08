import { useEffect } from 'react';

const useMouseParallax = () => {
  useEffect(() => {
    let frame = 0;
    let clientX = 0;
    let clientY = 0;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      frame = 0;
      const moveX = (clientX - window.innerWidth / 2) * 0.005;
      const moveY = (clientY - window.innerHeight / 2) * 0.005;

      document.body.style.setProperty('--mouse-x', `${moveX}deg`);
      document.body.style.setProperty('--mouse-y', `${moveY}deg`);
      document.body.style.backgroundPosition = `calc(50% + ${moveX}px) calc(50% + ${moveY}px)`;
    };
    const handleMouseMove = (event: MouseEvent) => {
      if (window.innerWidth < 768 || document.hidden || motion.matches) return;
      clientX = event.clientX;
      clientY = event.clientY;
      // High-polling-rate mice must not trigger repeated style writes in one frame.
      if (!frame) frame = requestAnimationFrame(update);
    };

    document.addEventListener('mousemove', handleMouseMove, { passive: true });

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(frame);
    };
  }, []);
};

export default useMouseParallax;
