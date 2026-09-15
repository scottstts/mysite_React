import { useId, useRef, useState } from 'react';
import { useInView } from 'framer-motion';
import YouTubeEmbed from '@/ui-kit/YouTubeEmbed/YouTubeEmbed';
import { aboutHighlight } from './highlight.data';
import styles from './AboutHighlight.module.css';
import headingStyles from './AboutSectionHeading.module.css';

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M8 5.5a1 1 0 0 1 1.5-.86l10 6a1 1 0 0 1 0 1.72l-10 6A1 1 0 0 1 8 17.5z" />
  </svg>
);

const HighlightVideo = ({
  videoId,
  title,
  visible,
}: {
  videoId: string;
  title: string;
  visible: boolean;
}) => {
  const [playing, setPlaying] = useState(false);
  const [useFallbackThumbnail, setUseFallbackThumbnail] = useState(false);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);

  return (
    <YouTubeEmbed
      videoId={videoId}
      title={title}
      active={playing}
      autoplay
      privacyEnhanced
      frameClassName={styles.screen}
      surfaceClassName={styles.media}
      preview={
        <>
          <div className={styles.horizon} aria-hidden="true" />
          {videoId ? (
            <button
              className={styles.preview}
              type="button"
              onClick={() => setPlaying(true)}
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

const AboutHighlight = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const visible = useInView(sectionRef, { once: true, amount: 0.15 });
  const titleId = useId();
  const candidateId = aboutHighlight.youtubeId.trim();
  const videoId = /^[a-zA-Z0-9_-]{11}$/.test(candidateId) ? candidateId : '';

  return (
    <section
      ref={sectionRef}
      className={styles.section}
      aria-labelledby={titleId}
      data-visible={visible}
    >
      <div className={headingStyles.label}>
        <span className={headingStyles.icon} aria-hidden="true">
          ✦
        </span>
        Highlight
      </div>
      <div className={styles.layout}>
        <div className={styles.copy}>
          <div className={styles.headingGroup}>
            <span className={styles.eyebrow}>Director's Cut</span>
            <h2 className={styles.title} id={titleId}>
              {aboutHighlight.title}
            </h2>
          </div>
          <p className={styles.description}>{aboutHighlight.description}</p>
          {videoId && (
            <a
              className={`${styles.youtubeLink} static-footer-link`}
              href={`https://www.youtube.com/watch?v=${videoId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Watch on YouTube <span aria-hidden="true">↗</span>
            </a>
          )}
        </div>
        <HighlightVideo
          key={videoId}
          videoId={videoId}
          title={aboutHighlight.title}
          visible={visible}
        />
      </div>
    </section>
  );
};

export default AboutHighlight;
