import React, { useState, useEffect, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import BackgroundEffects from '@/ui-kit/BackgroundEffects/BackgroundEffects';
import Navigation from '@/ui-kit/Navigation/Navigation';
import ScrollToTop from '@/ui-kit/ScrollToTop/ScrollToTop';
import useMouseParallax from '@/ui-kit/hooks/useMouseParallax';
import '@/styles/variables.css';
import '@/styles/globals.css';
import '@/styles/utilities.css';
import '@/styles/animations.css';
import '@/styles/glassCardEffect.css';
import './App.css';

// Lazy load tabs for better initial load performance
const AboutTab = React.lazy(() => import('@/features/about/AboutTab'));
const ProjectsTab = React.lazy(() => import('@/features/projects/ProjectsTab'));
const AppsTab = React.lazy(() => import('@/features/apps/AppsTab'));
const InspirationsTab = React.lazy(
  () => import('@/features/inspirations/InspirationsTab')
);
const ArtInLifeTab = React.lazy(
  () => import('@/features/art-in-life/ArtInLifeTab')
);

function App() {
  const location = useLocation();
  // Check if video already finished (if React loaded late)
  const [introComplete, setIntroComplete] = useState(() =>
    document.body.classList.contains('intro-complete')
  );
  const [contentVisible, setContentVisible] = useState(() =>
    document.body.classList.contains('intro-complete')
  );

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

  // Listen for video completion event from index.html
  useEffect(() => {
    if (introComplete) return;

    const handleVideoFinished = () => {
      setIntroComplete(true);
      document.body.classList.remove('intro-video-playing');
      setTimeout(() => {
        setContentVisible(true);
      }, 100);
    };

    window.addEventListener('intro-video-complete', handleVideoFinished);

    // Check again in case it fired before listener was attached
    if (document.body.classList.contains('intro-complete')) {
      handleVideoFinished();
    }

    return () => {
      window.removeEventListener('intro-video-complete', handleVideoFinished);
    };
  }, [introComplete]);

  // Add mouse movement tracking for background effects
  useMouseParallax();

  // Apply proper body classes
  useEffect(() => {
    // Remove any default classes that might interfere with custom CSS
    // But preserve intro-complete if it exists
    const wasComplete = document.body.classList.contains('intro-complete');
    document.body.className = '';

    if (!introComplete && !wasComplete) {
      document.body.classList.add('intro-video-playing');
    } else if (wasComplete) {
      document.body.classList.add('intro-complete');
    }
  }, [introComplete]);

  return (
    <>
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
            <Suspense
              fallback={
                <div className="h-96 flex items-center justify-center text-white/50">
                  Loading...
                </div>
              }
            >
              {activeTab === 'about' && <AboutTab />}
              {activeTab === 'projects' && <ProjectsTab />}
              {activeTab === 'apps' && <AppsTab />}
              {activeTab === 'inspirations' && <InspirationsTab />}
              {activeTab === 'art-in-life' && <ArtInLifeTab />}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Scroll to Top Button */}
      {contentVisible && <ScrollToTop />}

      {/* Fixed Footer */}
      {/* Static Footer Link */}
      {contentVisible && (
        <footer className="w-full py-8 text-center">
          <a
            href="https://github.com/scottstts/mysite_React"
            target="_blank"
            rel="noopener noreferrer"
            className="static-footer-link inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors duration-300"
          >
            <span className="text-sm font-medium">View Source Repo</span>
            <i className="fa-solid fa-code text-xs" aria-hidden="true"></i>
          </a>
        </footer>
      )}
    </>
  );
}

export default App;
