import React, { useRef } from 'react';

const GlassCard = ({ children, className = '', ...props }) => {
  const rafId = useRef(null);

  const setVars = (e) => {
    if (window.innerWidth < 768) return; // Skip on mobile
    if (!e.currentTarget) return; // Guard against null currentTarget

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
  };

  const handleMove = (e) => {
    if (rafId.current) return; // Throttle to 1 per frame
    rafId.current = requestAnimationFrame(() => {
      setVars(e);
      rafId.current = null;
    });
  };

  const handleMouseLeave = (e) => {
    if (!e.currentTarget) return; // Guard against null currentTarget
    e.currentTarget.style.removeProperty('--mouse-x');
    e.currentTarget.style.removeProperty('--mouse-y');
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
