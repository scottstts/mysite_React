import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useInView } from 'framer-motion';
import { getVideoAspectRatio, loadYouTubeAPI } from '@/lib/youtube';
import styles from './YouTubeEmbed.module.css';

/* global YouTubePlayer -- ambient type from vite-env.d.ts */

interface YouTubeEmbedProps {
  videoId: string;
  title: string;
  active?: boolean;
  autoplay?: boolean;
  privacyEnhanced?: boolean;
  preview?: ReactNode;
  frameClassName?: string;
  surfaceClassName?: string;
  onStateChange?: (_state: number) => void;
}

const YouTubeEmbed = ({
  videoId,
  title,
  active = true,
  autoplay = false,
  privacyEnhanced = false,
  preview,
  frameClassName = '',
  surfaceClassName = '',
  onStateChange,
}: YouTubeEmbedProps) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const visible = useInView(hostRef, { once: true });
  const playerId = useId();
  const [started, setStarted] = useState(false);
  const stateCallback = useRef(onStateChange);

  useEffect(() => {
    stateCallback.current = onStateChange;
  }, [onStateChange]);

  useEffect(() => {
    const host = hostRef.current;
    if (!active || !visible || !host) return;

    let disposed = false;
    let player: YouTubePlayer | undefined;
    // The API owns this iframe; React owns only its host, so cleanup is safe.
    const iframe = document.createElement('iframe');
    iframe.id = playerId;
    iframe.title = title;
    iframe.allow =
      'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    const domain = privacyEnhanced
      ? 'www.youtube-nocookie.com'
      : 'www.youtube.com';
    iframe.src = `https://${domain}/embed/${videoId}?enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}&autoplay=${autoplay ? 1 : 0}&rel=0&playsinline=1`;

    const handleState = (state: number) => {
      if (disposed) return;
      if (state === 1) setStarted(true);
      else if (state === -1 || state === 0 || state === 5) setStarted(false);
      stateCallback.current?.(state);
    };

    iframe.onload = () => {
      void loadYouTubeAPI()
        .then(() => {
          if (disposed || player || !window.YT?.Player) return;
          player = new window.YT.Player(playerId, {
            events: {
              onReady: (event) => handleState(event.target.getPlayerState()),
              onStateChange: (event) => handleState(event.data),
            },
          });
        })
        .catch(() => {
          // The embed still plays if the optional sizing API is unavailable.
          console.warn('YouTube playback sizing unavailable:', videoId);
        });
    };
    host.appendChild(iframe);

    return () => {
      disposed = true;
      iframe.onload = null;
      player?.destroy();
      host.replaceChildren();
    };
  }, [active, autoplay, playerId, privacyEnhanced, title, videoId, visible]);

  const videoRatio = getVideoAspectRatio(videoId);
  // Wider recordings reserve room before playback so their width can grow
  // without clipping, overflowing the page, or changing the preview height.
  const stageRatio = Math.max(16 / 9, videoRatio);
  const frameRatio = started ? videoRatio : 16 / 9;

  return (
    <div className={styles.stage} style={{ aspectRatio: stageRatio }}>
      <div
        className={`${styles.frame} ${frameClassName}`}
        style={{ width: `${(frameRatio / stageRatio) * 100}%` }}
      >
        <div className={`${styles.surface} ${surfaceClassName}`}>
          <div ref={hostRef} className={styles.player} />
          {!active && preview}
        </div>
      </div>
    </div>
  );
};

export default YouTubeEmbed;
