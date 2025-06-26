import React, { useState, useEffect } from 'react';
import './ScrollToTop.css';

const ScrollToTop = () => {
  const [isVisible, setIsVisible] = useState(false);

  const toggleScrollButton = () => {
    if (window.scrollY > 200) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  useEffect(() => {
    // Throttle scroll event for better performance
    let isScrolling = false;
    
    const handleScroll = () => {
      if (!isScrolling) {
        window.requestAnimationFrame(() => {
          toggleScrollButton();
          isScrolling = false;
        });
        isScrolling = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <button 
      id="scroll-top-button" 
      className={`scroll-top-button ${!isVisible ? 'hidden' : ''}`}
      onClick={scrollToTop}
      aria-label="Scroll to top"
    >
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="white" 
        className="w-6 h-6"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth="2" 
          d="M5 10l7-7m0 0l7 7m-7-7v18" 
        />
      </svg>
      <span className="text-white">Top</span>
    </button>
  );
};

export default ScrollToTop; 