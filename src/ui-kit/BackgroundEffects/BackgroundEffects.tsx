import { useEffect, useRef, useState } from 'react';
import Stars from './Stars';

const BG_VIDEO_SRC = '/static_assets/bg_video.webm';

interface BackgroundEffectsProps {
  introComplete: boolean;
}

const BackgroundEffects = ({ introComplete }: BackgroundEffectsProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPageVisible, setIsPageVisible] = useState(
    () => document.visibilityState !== 'hidden'
  );
  const [isBackgroundMounted, setIsBackgroundMounted] = useState(false);
  const [isBackgroundPlaying, setIsBackgroundPlaying] = useState(false);

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
    if (!introComplete) {
      return;
    }

    setIsBackgroundMounted(true);
  }, [introComplete]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !isBackgroundMounted) {
      return;
    }

    if (!isPageVisible) {
      video.pause();
      return;
    }

    const playPromise = video.play();
    if (playPromise) {
      playPromise.catch((error) => {
        console.warn('Background video playback was interrupted:', error);
      });
    }
  }, [isBackgroundMounted, isPageVisible]);

  return (
    <>
      {isBackgroundMounted && (
        <video
          ref={videoRef}
          className="bg-video"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          onPlaying={() => setIsBackgroundPlaying(true)}
          onPause={() => setIsBackgroundPlaying(false)}
          onWaiting={() => setIsBackgroundPlaying(false)}
        >
          <source src={BG_VIDEO_SRC} type="video/webm" />
        </video>
      )}
      <Stars
        shouldMount={isBackgroundMounted}
        isActive={isBackgroundPlaying && isPageVisible}
      />
    </>
  );
};

export default BackgroundEffects;
