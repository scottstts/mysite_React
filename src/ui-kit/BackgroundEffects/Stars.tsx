import { useState, useEffect, useCallback, lazy, Suspense } from 'react';

// Lazy load the StarsCanvas component (pure WebGL, small bundle)
const StarsCanvas = lazy(() => import('./StarsCanvas'));

interface StarsProps {
  shouldMount: boolean;
  isActive: boolean;
}

const Stars = ({ shouldMount, isActive }: StarsProps) => {
  const [passedBenchmark, setPassedBenchmark] = useState<boolean | null>(null); // null = pending, true = passed, false = failed

  // Callback when benchmark completes - memoized to prevent re-renders
  const handleBenchmarkComplete = useCallback((passed: boolean) => {
    setPassedBenchmark(passed);
  }, []);

  useEffect(() => {
    if (!shouldMount) {
      setPassedBenchmark(null);
    }
  }, [shouldMount]);

  // Don't render until the background video is mounted
  if (!shouldMount) return null;

  // If benchmark failed, unmount completely
  if (passedBenchmark === false) return null;

  return (
    <div className="stars-canvas">
      <Suspense fallback={null}>
        <StarsCanvas
          isActive={isActive}
          onBenchmarkComplete={handleBenchmarkComplete}
        />
      </Suspense>
    </div>
  );
};

export default Stars;
