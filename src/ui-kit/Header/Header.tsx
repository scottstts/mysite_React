import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { TabId } from '@/types/content';

export interface Tab {
  id: TabId;
  label: string;
  path: string;
  icon: string;
}

interface HeaderProps {
  tabs: Tab[];
  activeTab: TabId;
}

// The tabs always sit on one line. When their labels don't fit the room the
// header leaves them, they become icons.
const Header = ({ tabs, activeTab }: HeaderProps) => {
  const headerRef = useRef<HTMLElement>(null);
  const markRef = useRef<HTMLAnchorElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [compact, setCompact] = useState(false);
  const inArt = activeTab === 'art-in-life';

  useLayoutEffect(() => {
    const header = headerRef.current;
    const mark = markRef.current;
    const measure = measureRef.current;
    if (!header || !mark || !measure) return;
    const fit = () => {
      const style = getComputedStyle(header);
      const inner =
        header.clientWidth -
        parseFloat(style.paddingLeft) -
        parseFloat(style.paddingRight);
      // stacked, the tabs get the full width; side by side, what the name leaves
      const room =
        style.flexDirection === 'column'
          ? inner
          : inner - mark.offsetWidth - parseFloat(style.columnGap || '0');
      setCompact(measure.offsetWidth > room);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(header);
    observer.observe(mark);
    void document.fonts?.ready.then(fit);
    return () => observer.disconnect();
  }, [inArt]);

  return (
    <header ref={headerRef} className="top">
      <Link ref={markRef} className="mark" to="/">
        <img src="/static_assets/logo.png" alt="" width="34" height="34" />
        <span>Scott Sun</span>
      </Link>
      <nav className={`tabs${compact ? ' compact' : ''}`} aria-label="Sections">
        {tabs.map((tab) => {
          const on = tab.id === activeTab;
          return (
            <Link
              key={tab.id}
              to={tab.path}
              className={on ? 'on' : undefined}
              aria-current={on ? 'page' : undefined}
              aria-label={compact ? tab.label : undefined}
              title={compact ? tab.label : undefined}
            >
              <i className={tab.icon} aria-hidden="true" />
              <span className="label">{tab.label}</span>
            </Link>
          );
        })}
      </nav>
      {/* the labels at their natural width, to decide whether they fit */}
      <span ref={measureRef} className="tabs-measure" aria-hidden="true">
        {tabs.map((tab) => (
          <span key={tab.id}>{tab.label}</span>
        ))}
      </span>
    </header>
  );
};

export default Header;
