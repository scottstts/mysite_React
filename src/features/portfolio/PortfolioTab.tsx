import { useLayoutEffect, useRef, useState } from 'react';
import { safeHtml } from '@/lib/safeHtml';
import Ending from '@/ui-kit/Ending/Ending';
import PrintStack from '@/ui-kit/PrintStack/PrintStack';
import Reel from '@/ui-kit/Reel/Reel';
import type { App } from '@/types/content';
import { apps, portfolioEnding } from './apps.data';
import Icon from '@/ui-kit/Icon/Icon';

const statusLabel = ({ status }: App) =>
  typeof status === 'string' ? status : (status?.label ?? '');

const host = (url: string) =>
  url.replace(/^https?:\/\//, '').replace(/\/$/, '');

const Visit = ({ app }: { app: App }) => {
  if (app.showLink && app.link) {
    return (
      <a
        className="visit"
        href={app.link}
        target="_blank"
        rel="noopener noreferrer"
      >
        {/github\.com/.test(app.link) ? 'Source on GitHub' : host(app.link)}
        <Icon name="fa-solid fa-arrow-right" />
      </a>
    );
  }
  const sunset = statusLabel(app);
  return sunset ? <span className="sunset">{sunset}</span> : null;
};

// Title, tagline and link share one line only when all three fit; otherwise
// each gets its own line, the link set to the right.
const TitleRow = ({ app }: { app: App }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [stacked, setStacked] = useState(false);

  useLayoutEffect(() => {
    const row = ref.current;
    if (!row) return;
    const fit = () => {
      // items keep their natural width in both layouts, so the sum is stable
      const items = [...row.children] as HTMLElement[];
      const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
      const need =
        items.reduce((sum, item) => sum + item.offsetWidth, 0) +
        gap * (items.length - 1);
      setStacked(need > row.clientWidth);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(row);
    void document.fonts?.ready.then(fit);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`title${stacked ? ' stacked' : ''}`}>
      <h2>{app.title}</h2>
      <span className="tag">{app.tagline}</span>
      <Visit app={app} />
    </div>
  );
};

const PortfolioTab = () => {
  return (
    <>
      <div className="grid page-head">
        <h1>Portfolio</h1>
      </div>
      {apps.map((app, index) => {
        const videos = app.videos ?? [];
        const images = app.images ?? [];
        const classes = [
          'grid',
          'work',
          index % 2 ? 'flip' : '',
          app.status ? 'is-sunset' : '',
          videos.length || images.length ? '' : 'text-only',
        ];
        return (
          <article key={app.id} className={classes.filter(Boolean).join(' ')}>
            <TitleRow app={app} />
            <div className="media">
              {videos.length > 0 && <Reel videos={videos} />}
              {images.length > 0 && (
                <PrintStack images={images} caption={app.title} />
              )}
            </div>
            <div
              className="copy prose"
              dangerouslySetInnerHTML={safeHtml(app.description)}
            />
          </article>
        );
      })}
      <Ending ending={portfolioEnding} />
    </>
  );
};

export default PortfolioTab;
