import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { useInView, usePrefersReducedMotion } from '@/lib/mediaSignals';
import {
  embedUrl,
  formatLength,
  getFilm,
  posterUrl,
  type Film,
} from '@/lib/youtube';
import type { VideoSlideData } from '@/types/content';
import './Reel.css';
import Icon from '@/ui-kit/Icon/Icon';

const REEL_MS = 5200;
const pad2 = (n: number) => String(n).padStart(2, '0');

// maxresdefault doesn't exist for every upload; YouTube answers with a 404.
const Poster = ({ id }: { id: string }) => (
  <img
    src={posterUrl(id)}
    alt=""
    onError={(event) => {
      const img = event.currentTarget;
      if (img.dataset.fallback) return;
      img.dataset.fallback = '1';
      img.src = posterUrl(id, 'hqdefault');
    }}
  />
);

interface ReelProps {
  videos: VideoSlideData[];
}

// One container for every film: a 16:9 stage of key art, and a strip of the
// reel underneath that fills as it auto-advances. The player mounts on play.
const Reel = ({ videos }: ReelProps) => {
  const films: Film[] = useMemo(
    () => videos.map((video) => getFilm(video.videoId, video.title)),
    [videos]
  );
  const many = films.length > 1;
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref);
  const reduced = usePrefersReducedMotion();
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  // Posters load as the reel reaches them, one ahead.
  const [reached, setReached] = useState(() => new Set([0, 1]));
  const running = many && visible && !playing && !reduced;
  // The strip keeps its frames one size and scrolls when they overflow.
  const strip = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ prev: false, next: false });

  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    const measure = () => {
      const max = el.scrollWidth - el.clientWidth;
      const prev = el.scrollLeft > 1;
      const next = el.scrollLeft < max - 1;
      setEdges((old) =>
        old.prev === prev && old.next === next ? old : { prev, next }
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    el.addEventListener('scroll', measure, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener('scroll', measure);
    };
  }, [films.length]);

  // Bring the current frame into view as the reel advances.
  useEffect(() => {
    const el = strip.current;
    const thumb = el?.children[current] as HTMLElement | undefined;
    if (!el || !thumb) return;
    const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0;
    const start = thumb.offsetLeft - pad;
    const end = thumb.offsetLeft + thumb.offsetWidth + pad;
    let left: number | undefined;
    if (start < el.scrollLeft) left = start;
    else if (end > el.scrollLeft + el.clientWidth) left = end - el.clientWidth;
    if (left !== undefined)
      el.scrollTo({ left, behavior: reduced ? 'auto' : 'smooth' });
  }, [current, reduced]);

  const page = (dir: 1 | -1) =>
    strip.current?.scrollBy({
      left: dir * strip.current.clientWidth * 0.8,
      behavior: reduced ? 'auto' : 'smooth',
    });

  useEffect(() => {
    const next = (current + 1) % films.length;
    setReached((set) =>
      set.has(current) && set.has(next) ? set : new Set([...set, current, next])
    );
  }, [current, films.length]);

  useEffect(() => {
    if (!running) return;
    let left = REEL_MS;
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      if (!ref.current?.matches(':hover')) left -= now - last;
      last = now;
      if (left <= 0) setCurrent((index) => (index + 1) % films.length);
    }, 200);
    return () => window.clearInterval(timer);
  }, [running, current, films.length]);

  if (!films.length) return null;
  const film = films[current];
  const show = (index: number) => {
    setPlaying(false);
    setCurrent(index);
  };

  return (
    <div
      ref={ref}
      className={`reel${playing ? ' playing' : ''}`}
      style={
        {
          '--dur': `${REEL_MS}ms`,
        } as CSSProperties
      }
    >
      {/* posters are 16:9 key art; a playing film takes its own shape */}
      <div
        className="reel-stage"
        style={playing ? { aspectRatio: film.ratio } : undefined}
      >
        {films.map((item, index) => (
          <div
            key={index}
            className={`reel-slide${index === current ? ' on' : ''}`}
          >
            {reached.has(index) && <Poster id={item.id} />}
          </div>
        ))}
        <button
          className="reel-hit"
          aria-label={`Play ${film.title}`}
          onClick={() => setPlaying(true)}
        />
        <div className="reel-play" aria-hidden="true">
          <i />
          <span>
            <b>{film.title}</b>
            {film.length > 0 && <small>{formatLength(film.length)}</small>}
          </span>
        </div>
        {many && (
          <div className="reel-count" aria-hidden="true">
            {pad2(current + 1)} / {pad2(films.length)}
          </div>
        )}
        {playing && (
          <div className="reel-player">
            <iframe
              src={embedUrl(film.id)}
              title={film.title}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
            <button
              className="reel-close"
              aria-label="Close film"
              onClick={() => setPlaying(false)}
            >
              <Icon name="fa-solid fa-xmark" />
            </button>
          </div>
        )}
      </div>
      {many && (
        <div className="reel-rail">
          <div ref={strip} className="reel-strip">
            {films.map((item, index) => {
              const on = index === current;
              return (
                <button
                  key={index}
                  className={`reel-thumb${on ? ' on' : ''}${on && running ? ' running' : ''}`}
                  aria-label={item.title}
                  aria-current={on}
                  onClick={() => show(index)}
                >
                  <span className="im">
                    <img
                      src={posterUrl(item.id, 'mqdefault')}
                      alt=""
                      loading="lazy"
                    />
                  </span>
                  <span className="bar">
                    {/* a fresh bar restarts its fill each time the film comes up */}
                    <i key={on && running ? `run-${index}` : 'idle'} />
                  </span>
                  {item.length > 0 && (
                    <span className="len">{formatLength(item.length)}</span>
                  )}
                </button>
              );
            })}
          </div>
          <button
            className={`reel-arrow prev${edges.prev ? ' on' : ''}`}
            aria-label="Earlier films"
            tabIndex={edges.prev ? 0 : -1}
            onClick={() => page(-1)}
          >
            <Icon name="fa-solid fa-chevron-left" />
          </button>
          <button
            className={`reel-arrow next${edges.next ? ' on' : ''}`}
            aria-label="Later films"
            tabIndex={edges.next ? 0 : -1}
            onClick={() => page(1)}
          >
            <Icon name="fa-solid fa-chevron-right" />
          </button>
        </div>
      )}
    </div>
  );
};

export default Reel;
