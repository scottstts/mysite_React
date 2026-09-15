import { useEffect, useRef, useState } from 'react';

const BG_VIDEO_SRC = '/static_assets/bg_video.webm';

interface BackgroundEffectsProps {
  introComplete: boolean;
  isActive: boolean;
}

const BackgroundEffects = ({
  introComplete,
  isActive,
}: BackgroundEffectsProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stillRef = useRef<HTMLCanvasElement | null>(null);
  const [hasStillFrame, setHasStillFrame] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(
    () => document.visibilityState !== 'hidden'
  );
  const [isBackgroundMounted, setIsBackgroundMounted] = useState(false);
  const [playbackState, setPlaybackState] = useState<
    'playing' | 'capturing' | 'frozen'
  >('playing');

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(document.visibilityState !== 'hidden');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!introComplete || !isActive) {
      return;
    }

    setIsBackgroundMounted(true);
  }, [introComplete, isActive]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !isBackgroundMounted) {
      return;
    }

    // Never call play() on an ended video: it would restart from the beginning.
    if (
      !isPageVisible ||
      !isActive ||
      video.ended ||
      playbackState !== 'playing'
    ) {
      video.pause();
      return;
    }

    const playPromise = video.play();
    if (playPromise) {
      playPromise.catch((error) => {
        console.warn('Background video playback was interrupted:', error);
      });
    }
    return () => video.pause();
  }, [isBackgroundMounted, isPageVisible, isActive, playbackState]);

  if (!isBackgroundMounted) {
    return null;
  }

  const freezeFrame = () => {
    const video = videoRef.current;
    const still = stillRef.current;
    const context = still?.getContext('2d');

    // Bake the grade once, at source resolution. Resizing and navigation reuse it.
    // If canvas filters are unavailable, retain the ended video with static CSS.
    if (video && still && context && 'filter' in context) {
      still.width = video.videoWidth;
      still.height = video.videoHeight;
      context.filter = getComputedStyle(video)
        .getPropertyValue('--bg-still-filter')
        .trim();
      context.drawImage(video, 0, 0);
      setHasStillFrame(true);
    }

    setPlaybackState('frozen');
  };

  return (
    <>
      <video
        ref={videoRef}
        className={`bg-video bg-video--${playbackState}`}
        hidden={!isActive || hasStillFrame}
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        onEnded={() => {
          if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            freezeFrame();
          } else {
            setPlaybackState('capturing');
          }
        }}
        onAnimationEnd={freezeFrame}
      >
        <source src={BG_VIDEO_SRC} type="video/webm" />
      </video>
      <canvas
        ref={stillRef}
        className="bg-video bg-video--still"
        hidden={!isActive || !hasStillFrame}
        aria-hidden="true"
      />
      {playbackState === 'capturing' && (
        <div
          className="bg-capture-flash"
          hidden={!isActive}
          aria-hidden="true"
        />
      )}
    </>
  );
};

export default BackgroundEffects;
