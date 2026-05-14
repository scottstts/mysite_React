import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Link } from 'react-router-dom';
import type { NavigationTab, TabId } from '@/types/content';

interface NavigationProps {
  activeTab: TabId;
}

const tabs: NavigationTab[] = [
  {
    id: 'about',
    label: 'About Me',
    path: '/about',
    iconClass: 'fa-regular fa-address-card',
  },
  {
    id: 'projects',
    label: 'Learning Journey',
    path: '/journey',
    iconClass: 'fa-solid fa-route',
  },
  {
    id: 'apps',
    label: 'Apps',
    path: '/apps',
    iconClass: 'fa-solid fa-computer',
  },
  {
    id: 'inspirations',
    label: 'Inspirations',
    path: '/inspirations',
    iconClass: 'fa-solid fa-sun',
  },
  {
    id: 'art-in-life',
    label: 'Art in Life',
    path: '/art-in-life',
    iconClass: 'fa-solid fa-photo-film',
  },
];

const Navigation = ({ activeTab }: NavigationProps) => {
  const tabRefs = useRef<Record<TabId, HTMLAnchorElement | null>>({
    about: null,
    projects: null,
    apps: null,
    inspirations: null,
    'art-in-life': null,
  });
  const [indicatorStyle, setIndicatorStyle] = useState({
    isReady: false,
    width: 0,
    x: 0,
  });
  const isGalleryNavigation = activeTab === 'art-in-life';

  const updateIndicator = useCallback(() => {
    if (isGalleryNavigation) return;

    const activeElement = tabRefs.current[activeTab];
    if (!activeElement) return;

    setIndicatorStyle({
      isReady: true,
      width: activeElement.offsetWidth,
      x: activeElement.offsetLeft,
    });
  }, [activeTab, isGalleryNavigation]);

  useLayoutEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  useEffect(() => {
    if (isGalleryNavigation) return undefined;

    window.addEventListener('resize', updateIndicator);

    return () => {
      window.removeEventListener('resize', updateIndicator);
    };
  }, [isGalleryNavigation, updateIndicator]);

  const handleTabClick = () => {
    // Scroll to top smoothly after the switch
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <nav
      className={`site-navigation ${
        isGalleryNavigation ? 'site-navigation--gallery' : ''
      }`}
      aria-label="Site sections"
    >
      {!isGalleryNavigation && (
        <span
          className={`tab-active-indicator ${
            indicatorStyle.isReady ? 'is-ready' : ''
          }`}
          style={{
            transform: `translateX(${indicatorStyle.x}px)`,
            width: `${indicatorStyle.width}px`,
          }}
          aria-hidden="true"
        ></span>
      )}

      {tabs.map((tab) => (
        <Link
          key={tab.id}
          ref={(element) => {
            tabRefs.current[tab.id] = element;
          }}
          to={tab.path}
          className={`tab-button text-lg font-semibold px-4 py-2 ${
            activeTab === tab.id ? 'active' : ''
          }`}
          onClick={handleTabClick}
          data-tab={tab.id}
          aria-label={tab.label}
          title={tab.label}
        >
          <i
            className={`tab-button-icon ${tab.iconClass}`}
            aria-hidden="true"
          ></i>
          <span className="tab-button-label">{tab.label}</span>
        </Link>
      ))}
    </nav>
  );
};

export default Navigation;
