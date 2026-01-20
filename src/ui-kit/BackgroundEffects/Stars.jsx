import { useState, useEffect, lazy, Suspense } from 'react';

const DESKTOP_BREAKPOINT = 768;

// Lazy load the entire StarsCanvas component (includes Three.js)
const StarsCanvas = lazy(() => import('./StarsCanvas'));

const Stars = () => {
  const [isDesktop, setIsDesktop] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [introComplete, setIntroComplete] = useState(false);
  const [passedBenchmark, setPassedBenchmark] = useState(null); // null = pending, true = passed, false = failed

  // Handle intro video completion
  useEffect(() => {
    if (document.body.classList.contains('intro-complete')) {
      setIntroComplete(true);
    }

    const handleIntroComplete = () => setIntroComplete(true);
    window.addEventListener('intro-video-complete', handleIntroComplete);

    return () => {
      window.removeEventListener('intro-video-complete', handleIntroComplete);
    };
  }, []);

  // Handle desktop detection
  useEffect(() => {
    const checkDesktop = () => window.innerWidth >= DESKTOP_BREAKPOINT;

    if (checkDesktop()) {
      setIsDesktop(true);
      setShouldRender(true);
    }

    const handleResize = () => {
      const desktop = checkDesktop();
      setIsDesktop(desktop);
      if (desktop) setShouldRender(true);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Callback when benchmark completes
  const handleBenchmarkComplete = (passed) => {
    setPassedBenchmark(passed);
    if (!passed) {
      console.log('Stars effect disabled: device below 15fps threshold');
    }
  };

  // Don't render on mobile or before intro completes
  if (!shouldRender || !introComplete) return null;

  // If benchmark failed, unmount completely
  if (passedBenchmark === false) return null;

  return (
    <div className="stars-canvas" style={{ display: isDesktop ? 'block' : 'none' }}>
      <Suspense fallback={null}>
        <StarsCanvas onBenchmarkComplete={handleBenchmarkComplete} />
      </Suspense>
    </div>
  );
};

export default Stars;
