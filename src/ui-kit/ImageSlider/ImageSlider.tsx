import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { useInView } from 'framer-motion';
import type { VideoSlideData } from '@/types/content';
import YouTubeEmbed from '@/ui-kit/YouTubeEmbed/YouTubeEmbed';
import styles from './ImageSlider.module.css';

interface ImageSliderProps {
  images?: string[];
  videos?: VideoSlideData[];
  label: string;
  autoplay?: boolean;
  autoplayDelay?: number;
}

type Slide =
  | { type: 'image'; src: string; alt: string; id: string }
  | ({ type: 'video'; id: string } & VideoSlideData);

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches
  );

  useEffect(() => {
    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    const update = () => setReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return reduced;
};

const useDocumentVisible = () => {
  const [visible, setVisible] = useState(
    () => document.visibilityState === 'visible'
  );

  useEffect(() => {
    const update = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  return visible;
};

const Chevron = ({ direction }: { direction: 'prev' | 'next' }) => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path
      d={direction === 'prev' ? 'M10 3 5 8l5 5' : 'm6 3 5 5-5 5'}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="square"
    />
  </svg>
);

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M8 5.5a1 1 0 0 1 1.5-.86l10 6a1 1 0 0 1 0 1.72l-10 6A1 1 0 0 1 8 17.5z" />
  </svg>
);

const PauseIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
  </svg>
);

const VideoPoster = ({
  videoId,
  title,
  onPlay,
}: {
  videoId: string;
  title: string;
  onPlay: () => void;
}) => {
  const [fallback, setFallback] = useState(false);
  const [failed, setFailed] = useState(false);
  const downgrade = () => (fallback ? setFailed(true) : setFallback(true));

  return (
    <button
      type="button"
      className={styles.poster}
      onClick={onPlay}
      aria-label={`Play ${title}`}
    >
      {!failed && (
        <img
          className={styles.posterImage}
          src={`https://i.ytimg.com/vi/${videoId}/${fallback ? 'hqdefault' : 'maxresdefault'}.jpg`}
          alt=""
          width={fallback ? 480 : 1280}
          height={fallback ? 360 : 720}
          loading="lazy"
          decoding="async"
          onLoad={(event) => {
            // YouTube can return a 120px placeholder for missing HD art.
            if (event.currentTarget.naturalWidth <= 120) downgrade();
          }}
          onError={downgrade}
        />
      )}
      <span className={styles.posterPlay} aria-hidden="true">
        <PlayIcon />
      </span>
    </button>
  );
};

const ImageSlider = ({
  images = [],
  videos = [],
  label,
  autoplay = true,
  autoplayDelay = 5000,
}: ImageSliderProps) => {
  const slides: Slide[] = [
    ...images.map((image, index) => ({
      type: 'image' as const,
      src: `/content_imgs/${image}`,
      alt: `${label}, screenshot ${index + 1}`,
      id: `image-${index}`,
    })),
    ...videos.map((video, index) => ({
      type: 'video' as const,
      ...video,
      id: `video-${index}`,
    })),
  ];
  const total = slides.length;

  const rootRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<number | undefined>(undefined);

  const [current, setCurrent] = useState(0);
  // Slides stay mounted once reached, so swiping back never refetches.
  const [reached, setReached] = useState(() => new Set([0, 1, total - 1]));
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const [userPaused, setUserPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  const inView = useInView(rootRef, { amount: 0.4 });
  const nearView = useInView(rootRef, { once: true, margin: '400px 0px' });
  const reducedMotion = usePrefersReducedMotion();
  const documentVisible = useDocumentVisible();

  const settle = useCallback(
    (index: number) => {
      setCurrent(index);
      setReached((prev) => {
        const neighbours = [index - 1, index, index + 1].map(
          (i) => (i + total) % total
        );
        if (neighbours.every((i) => prev.has(i))) return prev;
        return new Set([...prev, ...neighbours]);
      });
    },
    [total]
  );

  const goTo = useCallback(
    (index: number) => {
      const track = trackRef.current;
      if (!track || total === 0) return;
      const target = (index + total) % total;
      settle(target);
      track.scrollTo({
        left: target * track.clientWidth,
        behavior: reducedMotion ? 'auto' : 'smooth',
      });
    },
    [reducedMotion, settle, total]
  );

  // Swipes and trackpad scrolls settle via scroll-snap; read the result once
  // movement stops instead of reacting to every intermediate frame.
  const handleScroll = () => {
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      const track = trackRef.current;
      if (!track || track.clientWidth === 0) return;
      const index = Math.round(track.scrollLeft / track.clientWidth);
      settle(Math.min(Math.max(index, 0), total - 1));
    }, 120);
  };

  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  // The deck takes the current slide's own height, so every image and video
  // sits at its native aspect ratio with nothing framing it.
  const [height, setHeight] = useState<number>();
  useEffect(() => {
    const slide = trackRef.current?.children[current];
    if (!slide) return;
    const observer = new ResizeObserver(() =>
      setHeight(slide.getBoundingClientRect().height || undefined)
    );
    observer.observe(slide);
    return () => observer.disconnect();
  }, [current]);

  // Leaving a video slide tears its player down, which stops playback.
  const currentId = slides[current]?.id;
  useEffect(() => {
    if (playingVideo && playingVideo !== currentId) setPlayingVideo(null);
  }, [currentId, playingVideo]);

  // A finished video hands the deck back to autoplay; a paused one keeps it
  // still so the viewer can pick up where they left off.
  const handleVideoState = useCallback((state: number) => {
    if (state === 0) setPlayingVideo(null);
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goTo(current - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      goTo(current + 1);
    }
  };

  if (total === 0) return null;

  const canAutoplay = autoplay && total > 1 && !reducedMotion;
  const running =
    canAutoplay &&
    !userPaused &&
    inView &&
    documentVisible &&
    !hovered &&
    !focused &&
    playingVideo === null;

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <section
      ref={rootRef}
      className={styles.deck}
      aria-roledescription="carousel"
      aria-label={label}
      onKeyDown={handleKeyDown}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onFocus={(event) => {
        // Only keyboard focus holds the deck; a mouse click on a key shouldn't.
        if (event.target.matches(':focus-visible')) setFocused(true);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setFocused(false);
        }
      }}
    >
      <div className={styles.screen}>
        <div
          ref={trackRef}
          className={styles.track}
          style={{ height }}
          onScroll={handleScroll}
        >
          {slides.map((slide, index) => (
            <div
              key={slide.id}
              className={styles.slide}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${total}`}
              aria-hidden={index !== current}
              inert={index !== current}
            >
              {nearView &&
                reached.has(index) &&
                (slide.type === 'image' ? (
                  <img
                    className={styles.image}
                    src={slide.src}
                    alt={slide.alt}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                  />
                ) : (
                  <div className={styles.video}>
                    <YouTubeEmbed
                      videoId={slide.videoId}
                      title={slide.title}
                      active={playingVideo === slide.id}
                      autoplay
                      privacyEnhanced
                      onStateChange={handleVideoState}
                      preview={
                        <VideoPoster
                          videoId={slide.videoId}
                          title={slide.title}
                          onPlay={() => setPlayingVideo(slide.id)}
                        />
                      }
                    />
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>

      {total > 1 && (
        <div className={styles.bar}>
          <button
            type="button"
            className={styles.key}
            onClick={() => goTo(current - 1)}
            aria-label="Previous slide"
          >
            <Chevron direction="prev" />
          </button>

          <span className={styles.counter} aria-live="polite">
            {pad(current + 1)}
            <span className={styles.counterTotal}> / {pad(total)}</span>
          </span>

          <div className={styles.segments}>
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                className={styles.segment}
                data-state={
                  index === current
                    ? 'current'
                    : index < current
                      ? 'past'
                      : 'future'
                }
                onClick={() => goTo(index)}
                aria-label={`Go to slide ${index + 1}${slide.type === 'video' ? ' (video)' : ''}`}
                aria-current={index === current}
              >
                <span className={styles.segmentTrack}>
                  {index === current && canAutoplay && (
                    <span
                      key={current}
                      className={styles.segmentFill}
                      style={{
                        animationDuration: `${autoplayDelay}ms`,
                        animationPlayState: running ? 'running' : 'paused',
                      }}
                      onAnimationEnd={() => goTo(current + 1)}
                    />
                  )}
                </span>
              </button>
            ))}
          </div>

          {canAutoplay && (
            <button
              type="button"
              className={styles.key}
              onClick={() => setUserPaused((paused) => !paused)}
              aria-label={userPaused ? 'Resume slideshow' : 'Pause slideshow'}
              aria-pressed={userPaused}
            >
              {userPaused ? <PlayIcon /> : <PauseIcon />}
            </button>
          )}

          <button
            type="button"
            className={styles.key}
            onClick={() => goTo(current + 1)}
            aria-label="Next slide"
          >
            <Chevron direction="next" />
          </button>
        </div>
      )}
    </section>
  );
};

export default ImageSlider;
