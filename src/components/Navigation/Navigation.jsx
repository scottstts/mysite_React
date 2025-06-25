import React from 'react';

const Navigation = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'about', label: 'Me & My Beliefs' },
    { id: 'projects', label: 'My Learning & Projects' },
    { id: 'apps', label: 'My Apps' },
    { id: 'inspirations', label: 'My Inspirations' }
  ];

  const handleTabClick = (tabId) => {
    onTabChange(tabId);
    
    // Scroll to top smoothly after the switch
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <nav>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`tab-button text-lg font-semibold px-4 py-2 ${
            activeTab === tab.id ? 'active' : ''
          }`}
          onClick={() => handleTabClick(tab.id)}
          data-tab={tab.id}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
};

export default Navigation; 