import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { useInView } from 'framer-motion';
import YouTubeEmbed from '@/ui-kit/YouTubeEmbed/YouTubeEmbed';
import {
  useDocumentVisible,
  usePrefersReducedMotion,
} from '@/lib/mediaSignals';
import { aboutHighlight } from './highlight.data';
import styles from './AboutHighlight.module.css';
import headingStyles from './AboutSectionHeading.module.css';

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M8 5.5a1 1 0 0 1 1.5-.86l10 6a1 1 0 0 1 0 1.72l-10 6A1 1 0 0 1 8 17.5z" />
  </svg>
);

// Matches the Portfolio sliders' rotation pace.
const AUTOPLAY_DELAY = 4000;

const Chevron = ({ direction }: { direction: 'prev' | 'next' }) => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path
      d={direction === 'prev' ? 'M10 3 5 8l5 5' : 'm6 3 5 5-5 5'}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const YOUTUBE_ID = /^[a-zA-Z0-9_-]{11}$/;

const reel = aboutHighlight.youtubeIds.map((id, index) => {
  const candidateId = id.trim();
  return {
    key: `${index}-${candidateId}`,
    videoId: YOUTUBE_ID.test(candidateId) ? candidateId : '',
  };
});

const pad = (n: number) => String(n).padStart(2, '0');

const HighlightVideo = ({
  videoId,
  title,
  visible,
  playing,
  onPlay,
  onStateChange,
}: {
  videoId: string;
  title: string;
  visible: boolean;
  playing: boolean;
  onPlay: () => void;
  onStateChange: (_state: number) => void;
}) => {
  const [useFallbackThumbnail, setUseFallbackThumbnail] = useState(false);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);

  return (
    <YouTubeEmbed
      videoId={videoId}
      title={title}
      active={playing}
      autoplay
      privacyEnhanced
      onStateChange={onStateChange}
      frameClassName={styles.screen}
      surfaceClassName={styles.media}
      preview={
        <>
          <div className={styles.horizon} aria-hidden="true" />
          {videoId ? (
            <button
              className={styles.preview}
              type="button"
              onClick={onPlay}
              aria-label={`Play ${title}`}
            >
              {visible && !thumbnailFailed && (
                <img
                  className={styles.thumbnail}
                  src={`https://i.ytimg.com/vi/${videoId}/${useFallbackThumbnail ? 'hqdefault' : 'maxresdefault'}.jpg`}
                  alt=""
                  width={useFallbackThumbnail ? 480 : 1280}
                  height={useFallbackThumbnail ? 360 : 720}
                  loading="lazy"
                  decoding="async"
                  fetchPriority="low"
                  onLoad={(event) => {
                    // YouTube can return a 120px placeholder for missing HD art.
                    if (event.currentTarget.naturalWidth <= 120) {
                      if (useFallbackThumbnail) setThumbnailFailed(true);
                      else setUseFallbackThumbnail(true);
                    }
                  }}
                  onError={() => {
                    if (useFallbackThumbnail) setThumbnailFailed(true);
                    else setUseFallbackThumbnail(true);
                  }}
                />
              )}
              <span className={styles.shade} aria-hidden="true" />
              <span className={styles.play}>
                <PlayIcon />
              </span>
              <span className={styles.watch}>Watch the video</span>
            </button>
          ) : (
            <div className={styles.placeholder}>
              <span className={styles.placeholderMark} aria-hidden="true">
                <PlayIcon />
              </span>
              <span>Video coming soon</span>
            </div>
          )}
        </>
      }
    />
  );
};

const ReelThumb = ({ videoId }: { videoId: string }) => {
  const [failed, setFailed] = useState(false);
  if (!videoId || failed) {
    return <span className={styles.thumbBlank} aria-hidden="true" />;
  }
  return (
    <img
      className={styles.thumbImage}
      src={`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`}
      alt=""
      width={320}
      height={180}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
};

const AboutHighlight = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const reelRef = useRef<HTMLDivElement>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const visible = useInView(sectionRef, { once: true, amount: 0.15 });
  // Rotation only runs while the reel itself is on screen.
  const inView = useInView(reelRef, { amount: 0.4 });
  const reducedMotion = usePrefersReducedMotion();
  const documentVisible = useDocumentVisible();
  const titleId = useId();
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  const { title, description } = aboutHighlight;
  const total = reel.length;
  // Even with no IDs listed, the stage keeps its placeholder.
  const item = reel[current] ?? { key: 'empty', videoId: '' };

  const goTo = (index: number) => {
    if (total < 2) return;
    // Leaving a reel unmounts its player, which stops playback.
    setPlaying(false);
    setCurrent((index + total) % total);
  };

  // Keep the active frame in view without nudging the page's own scroll.
  useEffect(() => {
    const strip = stripRef.current;
    const frame = strip?.children[current] as HTMLElement | undefined;
    if (!strip || !frame) return;
    const left = frame.offsetLeft;
    const right = left + frame.offsetWidth;
    if (left < strip.scrollLeft) {
      strip.scrollTo({ left: left - 8, behavior: 'smooth' });
    } else if (right > strip.scrollLeft + strip.clientWidth) {
      strip.scrollTo({
        left: right - strip.clientWidth + 8,
        behavior: 'smooth',
      });
    }
  }, [current]);

  // A finished video hands the reel back to autoplay; a paused one keeps it
  // still so the viewer can pick up where they left off.
  const handleVideoState = useCallback((state: number) => {
    if (state === 0) setPlaying(false);
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

  // Touch swipes on the poster change reels; a playing iframe keeps its own.
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') return;
    swipeStart.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      goTo(current + (dx < 0 ? 1 : -1));
    }
  };

  const multiple = total > 1;
  const canAutoplay = multiple && !reducedMotion;
  const running =
    canAutoplay &&
    inView &&
    documentVisible &&
    !hovered &&
    !focused &&
    !playing;

  return (
    <section
      ref={sectionRef}
      className={styles.section}
      aria-labelledby={titleId}
      aria-roledescription={multiple ? 'carousel' : undefined}
      data-visible={visible}
      onKeyDown={multiple ? handleKeyDown : undefined}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onFocus={(event) => {
        // Only keyboard focus holds the reel; a mouse click on a key shouldn't.
        if (event.target.matches(':focus-visible')) setFocused(true);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setFocused(false);
        }
      }}
    >
      <div className={headingStyles.label}>
        <span className={headingStyles.icon} aria-hidden="true">
          ✦
        </span>
        Highlights
      </div>
      <div className={styles.layout}>
        <div className={styles.copy}>
          <div className={styles.copyInner}>
            <div className={styles.headingGroup}>
              <span className={styles.eyebrow}>
                {multiple && (
                  <span className={styles.eyebrowCount}>
                    {pad(current + 1)}
                    <span className={styles.eyebrowTotal}> / {pad(total)}</span>
                  </span>
                )}
              </span>
              <h2 className={styles.title} id={titleId}>
                {title}
              </h2>
            </div>
            <p className={styles.description}>{description}</p>
          </div>
        </div>

        <div
          className={styles.stage}
          onPointerDown={multiple ? handlePointerDown : undefined}
          onPointerUp={multiple ? handlePointerUp : undefined}
          onPointerCancel={() => (swipeStart.current = null)}
        >
          <div
            key={item.key}
            className={styles.stageInner}
            role={multiple ? 'group' : undefined}
            aria-roledescription={multiple ? 'slide' : undefined}
            aria-label={multiple ? `${current + 1} of ${total}` : undefined}
          >
            <HighlightVideo
              videoId={item.videoId}
              title={multiple ? `${title} (video ${current + 1})` : title}
              visible={visible}
              playing={playing}
              onPlay={() => setPlaying(true)}
              onStateChange={handleVideoState}
            />
          </div>
        </div>

        {multiple && (
          <div ref={reelRef} className={styles.reel}>
            <div className={styles.reelKeys}>
              <button
                type="button"
                className={styles.reelKey}
                onClick={() => goTo(current - 1)}
                aria-label="Previous video"
              >
                <Chevron direction="prev" />
              </button>
            </div>

            <div ref={stripRef} className={styles.strip}>
              {reel.map((entry, index) => (
                <button
                  key={entry.key}
                  type="button"
                  className={styles.frame}
                  data-active={index === current}
                  onClick={() => goTo(index)}
                  aria-label={`Video ${index + 1}`}
                  aria-current={index === current}
                >
                  <span className={styles.frameImage}>
                    {visible && <ReelThumb videoId={entry.videoId} />}
                    <span className={styles.frameNumber}>{pad(index + 1)}</span>
                  </span>
                  <span className={styles.frameProgress} aria-hidden="true">
                    {index === current && canAutoplay && (
                      <span
                        key={current}
                        className={styles.frameProgressFill}
                        style={{
                          animationDuration: `${AUTOPLAY_DELAY}ms`,
                          animationPlayState: running ? 'running' : 'paused',
                        }}
                        onAnimationEnd={() => goTo(current + 1)}
                      />
                    )}
                  </span>
                </button>
              ))}
            </div>

            <div className={styles.reelKeys}>
              <button
                type="button"
                className={styles.reelKey}
                onClick={() => goTo(current + 1)}
                aria-label="Next video"
              >
                <Chevron direction="next" />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default AboutHighlight;
