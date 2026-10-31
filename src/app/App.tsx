import React, { Suspense, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Header, { type Tab } from '@/ui-kit/Header/Header';
import { LiftProvider } from '@/ui-kit/Lift/Lift';
import Wall from '@/ui-kit/Wall/Wall';
import type { TabId } from '@/types/content';
import '@/styles/site.css';

// Each tab is its own chunk, loaded when it's first opened.
const tabViews: Record<
  TabId,
  React.LazyExoticComponent<() => React.ReactNode>
> = {
  about: React.lazy(() => import('@/features/about/AboutTab')),
  projects: React.lazy(() => import('@/features/projects/ProjectsTab')),
  portfolio: React.lazy(() => import('@/features/portfolio/PortfolioTab')),
  inspirations: React.lazy(
    () => import('@/features/inspirations/InspirationsTab')
  ),
  'art-in-life': React.lazy(
    () => import('@/features/art-in-life/ArtInLifeTab')
  ),
};

const tabs: Tab[] = [
  {
    id: 'about',
    label: 'About',
    path: '/',
    icon: 'fa-regular fa-address-card',
  },
  {
    id: 'projects',
    label: 'Learning Journey',
    path: '/journey',
    icon: 'fa-solid fa-route',
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    path: '/portfolio',
    icon: 'fa-solid fa-computer',
  },
  {
    id: 'inspirations',
    label: 'Inspirations',
    path: '/inspirations',
    icon: 'fa-solid fa-sun',
  },
  {
    id: 'art-in-life',
    label: 'Art in Life',
    path: '/art-in-life',
    icon: 'fa-solid fa-photo-film',
  },
];

const titles: Record<TabId, string> = {
  about: 'About - Scott Sun',
  projects: 'Learning Journey - Scott Sun',
  portfolio: 'Portfolio - Scott Sun',
  inspirations: 'Inspirations - Scott Sun',
  'art-in-life': 'Art in Life - Scott Sun',
};

const tabFromPath = (pathname: string): TabId => {
  switch (pathname) {
    case '/journey':
      return 'projects';
    case '/portfolio':
    case '/apps':
      return 'portfolio';
    case '/inspirations':
      return 'inspirations';
    case '/art-in-life':
      return 'art-in-life';
    default:
      return 'about';
  }
};

function App() {
  const location = useLocation();
  const activeTab = tabFromPath(location.pathname);
  const inArt = activeTab === 'art-in-life';
  const View = tabViews[activeTab];

  // The gallery tab loads its WebGL scene as a second chunk; fetch it
  // alongside the tab instead of after it.
  useEffect(() => {
    if (inArt) void import('@/features/art-in-life/ArtInLifeGallery');
  }, [inArt]);

  useEffect(() => {
    document.title = titles[activeTab];
    window.scrollTo(0, 0);
  }, [activeTab]);

  // The gallery is its own room: it covers the wall and has no footer.
  useEffect(() => {
    document.body.classList.toggle('in-art', inArt);
    return () => document.body.classList.remove('in-art');
  }, [inArt]);

  return (
    <LiftProvider>
      <Wall tab={activeTab} />
      <div className="site">
        <Header tabs={tabs} activeTab={activeTab} />
        <main>
          <Suspense fallback={<div className="view-pending" />}>
            <div key={activeTab} className={inArt ? 'art-room' : 'view'}>
              <View />
            </div>
          </Suspense>
        </main>
        {!inArt && (
          <footer className="foot">
            <span>Scott Sun</span>
            <nav aria-label="Site">
              <a
                href="https://github.com/scottstts/mysite_React"
                target="_blank"
                rel="noopener noreferrer"
              >
                <i className="fa-solid fa-code" aria-hidden="true"></i>
                Source
              </a>
              <a href="https://scottsun.io/llms.txt" target="_blank">
                <i className="fa-solid fa-robot" aria-hidden="true"></i>
                llms.txt
              </a>
            </nav>
          </footer>
        )}
      </div>
    </LiftProvider>
  );
}

export default App;
