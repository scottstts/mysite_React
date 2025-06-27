import { useEffect } from 'react';

const useMouseParallax = () => {
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (window.innerWidth < 768) return; // Skip on mobile

      const moveX = (e.clientX - window.innerWidth / 2) * 0.005;
      const moveY = (e.clientY - window.innerHeight / 2) * 0.005;

      document.body.style.setProperty('--mouse-x', `${moveX}deg`);
      document.body.style.setProperty('--mouse-y', `${moveY}deg`);

      document.body.style.backgroundPosition = `calc(50% + ${moveX}px) calc(50% + ${moveY}px)`;
    };

    document.addEventListener('mousemove', handleMouseMove, { passive: true });

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);
};

export default useMouseParallax;
