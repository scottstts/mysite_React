import React, { useState } from 'react';

const GlassCard = ({ children, className = '', ...props }) => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const handleMouseEnter = (e) => {
    if (window.innerWidth < 768) return; // Skip on mobile
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setMousePosition({ x, y });
    
    e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
  };

  return (
    <div 
      className={`glass-card ${className}`}
      onMouseEnter={handleMouseEnter}
      {...props}
    >
      {children}
    </div>
  );
};

export default GlassCard; 