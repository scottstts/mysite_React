import React from 'react';
import { Link } from 'react-router-dom';

const Navigation = ({ activeTab }) => {
  const tabs = [
    { id: 'about', label: 'Me & My Beliefs', path: '/about' },
    { id: 'projects', label: 'My Learning & Projects', path: '/projects' },
    { id: 'apps', label: 'My Apps', path: '/apps' },
    { id: 'inspirations', label: 'My Inspirations', path: '/inspirations' },
    { id: 'art-in-life', label: 'Art in Life', path: '/art-in-life' },
  ];

  const handleTabClick = () => {
    // Scroll to top smoothly after the switch
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <nav>
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
