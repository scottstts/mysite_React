import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react';
import { useIsPresent } from 'framer-motion';
import styles from './SocialConstellation.module.css';
import { bindSocialLinkTouch } from './socialLinkTouch';

const portrait = '/static_assets/logo.png';
const socials = [
  {
    id: 'github',
    anchor: [70, 147],
    name: 'GitHub',
    handle: 'scottstts',
    icon: 'fa-github',
    segment: 'right_arm',
    color: '#ffffff',
    dark: [0.16, 0.16, 0.18],
    light: [1, 1, 1],
    href: 'https://github.com/scottstts',
  },
  {
    id: 'x',
    anchor: [150, 58],
    name: 'X',
    handle: '@scottstts',
    icon: 'fa-x-twitter',
    segment: 'head',
    color: '#d06749',
    dark: [0.24, 0.065, 0.025],
    light: [1, 0.7, 0.5],
    href: 'https://x.com/scottstts',
  },
  {
    id: 'instagram',
    anchor: [95, 268],
    name: 'Instagram',
    handle: '@scottstts',
    icon: 'fa-instagram',
    segment: 'guitar',
    color: '#f09ac5',
    dark: [0.24, 0.035, 0.12],
    light: [1, 0.7, 0.87],
    href: 'https://www.instagram.com/scottstts/',
  },
  {
    id: 'linkedin',
    anchor: [212, 202],
    name: 'LinkedIn',
    handle: 'Scott Sun',
    icon: 'fa-linkedin-in',
    segment: 'left_arm',
    color: '#71b7ff',
    dark: [0.025, 0.1, 0.24],
    light: [0.59, 0.82, 1],
    href: 'https://www.linkedin.com/in/st-scottsun-inireland/',
  },
] as const;
type SocialId = (typeof socials)[number]['id'];

const scanlineLayers = Array.from({ length: 200 }, (_, index) => (
  <span
    key={index}
    className="cybr-glitch-img__scanline"
    style={
      {
        top: `${index / 2}%`,
        height: '0.5%',
        backgroundImage: `url(${portrait})`,
        backgroundSize: '100% 20000%',
        backgroundPosition: `0 ${(index / 199) * 100}%`,
        '--glitch-offset-y': `${(index / 199) * 100}%`,
        animationDelay: `${-index / 50}s`,
      } as CSSProperties
    }
  />
));

export default function SocialConstellation() {
  const isPresent = useIsPresent();
  const stageRef = useRef<HTMLDivElement>(null);
  const portraitRef = useRef<HTMLDivElement>(null);
  const linkRefs = useRef(new Map<SocialId, HTMLAnchorElement>());
  const [connections, setConnections] = useState<{
    width: number;
    height: number;
    paths: Partial<Record<SocialId, string>>;
  }>({ width: 1, height: 1, paths: {} });
  const [pageVisible, setPageVisible] = useState(() => !document.hidden);
  const hitMaps = useRef(new Map<SocialId, Uint8ClampedArray>());
  const [visible, setVisible] = useState(false);
  const [portraitVisible, setPortraitVisible] = useState(false);
  const [loadedSegments, setLoadedSegments] = useState<SocialId[]>([]);
  const [baseLoaded, setBaseLoaded] = useState(false);
  const [active, setActive] = useState<SocialId | null>(null);
  const filterId = useId().replace(/:/g, '');
  const isVisible = visible && pageVisible && isPresent;
  const animatePortrait = isVisible && portraitVisible;

  useEffect(() => {
    const cleanups = Array.from(linkRefs.current.values(), bindSocialLinkTouch);
    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);

  useEffect(() => {
    // Observe persistent layout boxes, not the render trees that are culled.
    // This allows the artwork to mount again without changing scroll geometry.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const intersects =
            entry.isIntersecting &&
            entry.intersectionRect.width > 0 &&
            entry.intersectionRect.height > 0;
          if (entry.target === stageRef.current) setVisible(intersects);
          if (entry.target === portraitRef.current)
            setPortraitVisible(intersects);
        }
      },
      { rootMargin: '0px', threshold: [0, 0.001] }
    );
    if (stageRef.current) observer.observe(stageRef.current);
    if (portraitRef.current) observer.observe(portraitRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const update = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    const image = portraitRef.current;
    if (!isVisible || !stage || !image) return;
    let frame = 0;
    const measure = () => {
      const bounds = stage.getBoundingClientRect();
      const art = image.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const mobile = window.matchMedia('(max-width: 640px)').matches;
      const paths: Partial<Record<SocialId, string>> = {};
      for (const social of socials) {
        const button = linkRefs.current.get(social.id)?.getBoundingClientRect();
        if (!button) continue;
        const startX =
          art.left - bounds.left + (social.anchor[0] / 320) * art.width;
        const startY =
          art.top - bounds.top + (social.anchor[1] / 320) * art.height;
        const left = social.id === 'github' || social.id === 'instagram';
        const top = social.id === 'github' || social.id === 'x';
        const endX =
          (mobile
            ? button.left + button.width / 2
            : left
              ? button.right
              : button.left) - bounds.left;
        const endY =
          (mobile
            ? top
              ? button.bottom
              : button.top
            : button.top + button.height / 2) - bounds.top;
        // Straight segments meet at a bend, then enter the button edge perpendicularly.
        const bendX = mobile
          ? endX
          : endX + (left ? 1 : -1) * Math.abs(startX - endX) * 0.55;
        const bendY = mobile
          ? endY + (top ? 1 : -1) * Math.abs(startY - endY) * 0.55
          : endY;
        paths[social.id] =
          `M ${startX} ${startY} L ${bendX} ${bendY} L ${endX} ${endY}`;
      }
      setConnections({ width: bounds.width, height: bounds.height, paths });
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(stage);
    observer.observe(image);
    linkRefs.current.forEach((link) => observer.observe(link));
    measure();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [isVisible]);

  // The base image has priority; segment requests start only after it has loaded.
  useEffect(() => {
    if (
      !animatePortrait ||
      !baseLoaded ||
      hitMaps.current.size === socials.length
    )
      return;
    let cancelled = false;
    async function loadSegments() {
      for (const social of socials) {
        if (cancelled) return;
        if (hitMaps.current.has(social.id)) continue;
        const img = new Image();
        img.src = `/static_assets/segments/${social.segment}.png`;
        try {
          await img.decode();
          if (cancelled) return;
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 320;
          const context = canvas.getContext('2d', { willReadFrequently: true });
          if (!context) continue;
          context.drawImage(img, 0, 0);
          hitMaps.current.set(
            social.id,
            context.getImageData(0, 0, 320, 320).data
          );
          setLoadedSegments((previous) => [...previous, social.id]);
        } catch {
          /* Profile links remain usable if a segment cannot load. */
        }
      }
    }
    void loadSegments();
    return () => {
      cancelled = true;
    };
  }, [baseLoaded, animatePortrait]);

  function highlightAtPointer(event: PointerEvent<HTMLDivElement>) {
    if (!animatePortrait) return;
    if (event.pointerType !== 'mouse' && event.buttons === 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.min(
      319,
      Math.max(
        0,
        Math.floor(((event.clientX - bounds.left) / bounds.width) * 320)
      )
    );
    const y = Math.min(
      319,
      Math.max(
        0,
        Math.floor(((event.clientY - bounds.top) / bounds.height) * 320)
      )
    );
    const pixel = (y * 320 + x) * 4 + 3;
    let best: SocialId | null = null;
    let alpha = 100;
    for (const social of socials) {
      const value = hitMaps.current.get(social.id)?.[pixel] ?? 0;
      if (value > alpha) {
        best = social.id;
        alpha = value;
      }
    }
    setActive(best);
  }

  return (
    <section
      className={styles.section}
      aria-labelledby={`${filterId}-title`}
      data-visible={isVisible}
    >
      <h3 id={`${filterId}-title`} className={styles.title}>
        I'm on
      </h3>
      <div
        ref={stageRef}
        className={styles.stage}
        onPointerLeave={() => setActive(null)}
        onPointerCancel={() => setActive(null)}
      >
        {animatePortrait && (
          <svg className={styles.definitions} aria-hidden="true">
            <defs>
              {socials.map((social) => (
                <filter
                  key={social.id}
                  id={`${filterId}-${social.id}`}
                  colorInterpolationFilters="sRGB"
                >
                  <feColorMatrix type="saturate" values="0" />
                  <feComponentTransfer>
                    <feFuncR
                      type="linear"
                      slope={social.light[0] - social.dark[0]}
                      intercept={social.dark[0]}
                    />
                    <feFuncG
                      type="linear"
                      slope={social.light[1] - social.dark[1]}
                      intercept={social.dark[1]}
                    />
                    <feFuncB
                      type="linear"
                      slope={social.light[2] - social.dark[2]}
                      intercept={social.dark[2]}
                    />
                  </feComponentTransfer>
                </filter>
              ))}
            </defs>
          </svg>
        )}
        {isVisible && (
          <svg
            className={styles.wires}
            viewBox={`0 0 ${connections.width} ${connections.height}`}
            aria-hidden="true"
          >
            {socials.map((social) => (
              <g
                key={social.id}
                style={{ '--social-color': social.color } as CSSProperties}
                data-active={isVisible && active === social.id}
              >
                <path
                  className={styles.wire}
                  d={connections.paths[social.id]}
                />
                <path
                  className={styles.wireTarget}
                  d={connections.paths[social.id]}
                  onPointerEnter={(event) => {
                    if (event.pointerType === 'mouse') setActive(social.id);
                  }}
                  onPointerLeave={() => setActive(null)}
                  onPointerDown={() => setActive(social.id)}
                  onPointerUp={(event) => {
                    if (event.pointerType !== 'mouse') setActive(null);
                  }}
                />
              </g>
            ))}
          </svg>
        )}
        <div
          ref={portraitRef}
          className={styles.portrait}
          data-visible={animatePortrait}
          onPointerMove={highlightAtPointer}
          onPointerDown={highlightAtPointer}
          onPointerLeave={() => setActive(null)}
          onPointerUp={(event) => {
            if (event.pointerType !== 'mouse') setActive(null);
          }}
        >
          {/* Cull masks, filters and images too: pausing keyframes alone leaves
              the portrait's compositing layers mounted after scrolling away. */}
          {animatePortrait && (
            <>
              {baseLoaded && (
                <div className={styles.glow} aria-hidden="true">
                  <img src={portrait} alt="" className={styles.glowImage} />
                </div>
              )}
              <div className={`cybr-glitch-img ${styles.art}`}>
                <img
                  src={portrait}
                  alt="Black and white illustration of Scott playing guitar"
                  width="320"
                  height="320"
                  loading="lazy"
                  decoding="async"
                  onLoad={() => setBaseLoaded(true)}
                  className={styles.base}
                />
                {baseLoaded && (
                  <>
                    <img
                      src={portrait}
                      alt=""
                      className={`cybr-glitch-img__slice cybr-glitch-img__slice--cyan ${styles.reflection}`}
                    />
                    <img
                      src={portrait}
                      alt=""
                      className={`cybr-glitch-img__slice cybr-glitch-img__slice--magenta ${styles.reflection}`}
                    />
                    <div className={styles.scanlines} aria-hidden="true">
                      {scanlineLayers}
                    </div>
                  </>
                )}
                {socials
                  .filter((social) => loadedSegments.includes(social.id))
                  .map((social) => (
                    <div
                      key={social.id}
                      className={styles.segment}
                      data-active={isVisible && active === social.id}
                    >
                      <img
                        src={`/static_assets/segments/${social.segment}.png`}
                        alt=""
                        style={{ filter: `url(#${filterId}-${social.id})` }}
                      />
                    </div>
                  ))}
              </div>
            </>
          )}
        </div>
        {socials.map((social) => (
          <a
            key={social.id}
            ref={(element) => {
              if (element) linkRefs.current.set(social.id, element);
              else linkRefs.current.delete(social.id);
            }}
            href={social.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`${styles.link} ${styles[social.id]}`}
            style={{ '--social-color': social.color } as CSSProperties}
            data-active={isVisible && active === social.id}
            onPointerEnter={(event) => {
              if (event.pointerType === 'mouse') setActive(social.id);
            }}
            onPointerLeave={(event) => {
              if (event.pointerType === 'mouse') setActive(null);
            }}
            onPointerDown={() => setActive(social.id)}
            onPointerCancel={() => setActive(null)}
            onClick={() => setActive(null)}
            onFocus={(event) => {
              if (event.currentTarget.matches(':focus-visible')) {
                setActive(social.id);
              }
            }}
            onBlur={() => setActive(null)}
            aria-label={`${social.name}: ${social.handle} (opens in a new tab)`}
          >
            <i className={`fa-brands ${social.icon}`} aria-hidden="true" />
            <span className={styles.username}>{social.handle}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
