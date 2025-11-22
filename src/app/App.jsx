import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import IntroVideo from '@/ui-kit/IntroVideo/IntroVideo';
import BackgroundEffects from '@/ui-kit/BackgroundEffects/BackgroundEffects';
import Navigation from '@/ui-kit/Navigation/Navigation';
import AboutTab from '@/features/about/AboutTab';
import ProjectsTab from '@/features/projects/ProjectsTab';
import AppsTab from '@/features/apps/AppsTab';
import InspirationsTab from '@/features/inspirations/InspirationsTab';
import ArtInLifeTab from '@/features/art-in-life/ArtInLifeTab';
import ScrollToTop from '@/ui-kit/ScrollToTop/ScrollToTop';
import useMouseParallax from '@/ui-kit/hooks/useMouseParallax';
import '@/styles/variables.css';
import '@/styles/globals.css';
import '@/styles/utilities.css';
import '@/styles/animations.css';
import '@/styles/glassCardEffect.css';
import './App.css';

function App() {
  const location = useLocation();
  const [introComplete, setIntroComplete] = useState(false);
  const [contentVisible, setContentVisible] = useState(false);

  // Determine active tab from route
  const getActiveTabFromPath = (pathname) => {
    switch (pathname) {
      case '/projects':
        return 'projects';
      case '/apps':
        return 'apps';
      case '/inspirations':
        return 'inspirations';
      case '/art-in-life':
        return 'art-in-life';
      case '/':
      case '/about':
      default:
        return 'about';
    }
  };

  const activeTab = getActiveTabFromPath(location.pathname);

  // Dynamically update the document title when route changes
  useEffect(() => {
    const titles = {
      about: 'About - Scott Sun',
      projects: 'Projects - Scott Sun',
      apps: 'Apps - Scott Sun',
      inspirations: 'Inspirations - Scott Sun',
      'art-in-life': 'Art in Life - Scott Sun',
    };

    // Fallback title if the route is unknown
    document.title = titles[activeTab] || 'Scott Sun';
  }, [activeTab]);

  // Handle intro video completion
  const handleVideoFinished = () => {
    setIntroComplete(true);
    document.body.classList.remove('intro-video-playing');
    setTimeout(() => {
      setContentVisible(true);
    }, 100);
  };

  // Add mouse movement tracking for background effects
  useMouseParallax();

  // Apply proper body classes and ensure content becomes visible
  useEffect(() => {
    // Remove any default classes that might interfere with custom CSS
    document.body.className = '';
    if (!introComplete) {
      document.body.classList.add('intro-video-playing');
    }
  }, [introComplete]);

  return (
    <>
      {/* Intro Video */}
      {!introComplete && <IntroVideo onVideoFinished={handleVideoFinished} />}

      {/* Background Effects */}
      <BackgroundEffects />

      {/* Main Content */}
      <main
        className={`max-w-4xl mx-auto space-y-8 md:space-y-12 pt-8 md:pt-12 pb-4 md:pb-6 px-4 sm:px-6 lg:px-8 ${contentVisible ? 'visible' : ''}`}
      >
        <Navigation activeTab={activeTab} />

        {/* Tab Content with Conditional Mounting - Only active tab is mounted */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="react-tab-content space-y-8"
          >
            {activeTab === 'about' && <AboutTab />}
            {activeTab === 'projects' && <ProjectsTab />}
            {activeTab === 'apps' && <AppsTab />}
            {activeTab === 'inspirations' && <InspirationsTab />}
            {activeTab === 'art-in-life' && <ArtInLifeTab />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Scroll to Top Button */}
      {contentVisible && <ScrollToTop />}

      {/* Fixed Footer */}
      {contentVisible && (
        <a
          href="https://github.com/scottstts/mysite_React"
          target="_blank"
          rel="noopener noreferrer"
          className="fixed-footer"
        >
          <div className="footer-content">
            <span className="font-bold text-white">View Source Repo</span>
            <i className="fa-solid fa-code" aria-hidden="true"></i>
          </div>
        </a>
      )}
    </>
  );
}

export default App;
