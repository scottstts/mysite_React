import { useState, useEffect, useCallback, lazy, Suspense } from 'react';

// Lazy load the StarsCanvas component (pure WebGL, small bundle)
const StarsCanvas = lazy(() => import('./StarsCanvas'));

const Stars = () => {
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

  // Callback when benchmark completes - memoized to prevent re-renders
  const handleBenchmarkComplete = useCallback((passed) => {
    setPassedBenchmark(passed);
  }, []);

  // Don't render before intro completes
  if (!introComplete) return null;

  // If benchmark failed, unmount completely
  if (passedBenchmark === false) return null;

  return (
    <div className="stars-canvas">
      <Suspense fallback={null}>
        <StarsCanvas onBenchmarkComplete={handleBenchmarkComplete} />
      </Suspense>
    </div>
  );
};

export default Stars;
