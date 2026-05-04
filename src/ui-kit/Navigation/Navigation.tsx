import { Link } from 'react-router-dom';
import type { NavigationTab, TabId } from '@/types/content';

interface NavigationProps {
  activeTab: TabId;
}

const tabs: NavigationTab[] = [
  { id: 'about', label: 'About Me', path: '/about' },
  { id: 'projects', label: 'Learning Journey', path: '/projects' },
  { id: 'apps', label: 'Apps', path: '/apps' },
  { id: 'inspirations', label: 'Inspirations', path: '/inspirations' },
  { id: 'art-in-life', label: 'Art in Life', path: '/art-in-life' },
];

const Navigation = ({ activeTab }: NavigationProps) => {
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
        activeTab === 'art-in-life' ? 'site-navigation--gallery' : ''
      }`}
      aria-label="Site sections"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          to={tab.path}
          className={`tab-button text-lg font-semibold px-4 py-2 ${
            activeTab === tab.id ? 'active' : ''
          }`}
          onClick={handleTabClick}
          data-tab={tab.id}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
};

export default Navigation;
