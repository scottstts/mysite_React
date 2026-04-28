import React, { Suspense, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import BackgroundEffects from '@/ui-kit/BackgroundEffects/BackgroundEffects';
import Navigation from '@/ui-kit/Navigation/Navigation';
import ScrollToTop from '@/ui-kit/ScrollToTop/ScrollToTop';
import useMouseParallax from '@/ui-kit/hooks/useMouseParallax';
import type { TabId } from '@/types/content';
import '@/styles/variables.css';
import '@/styles/globals.css';
import '@/styles/utilities.css';
import '@/styles/animations.css';
import '@/styles/glassCardEffect.css';
import './App.css';

// Keep tab imports reusable so the active tab can be preloaded during the intro
// without mounting/running the tab component yet.
const tabImports = {
  about: () => import('@/features/about/AboutTab'),
  projects: () => import('@/features/projects/ProjectsTab'),
  apps: () => import('@/features/apps/AppsTab'),
  inspirations: () => import('@/features/inspirations/InspirationsTab'),
  'art-in-life': () => import('@/features/art-in-life/ArtInLifeTab'),
};

// Lazy load tabs for better initial load performance.
const AboutTab = React.lazy(tabImports.about);
const ProjectsTab = React.lazy(tabImports.projects);
const AppsTab = React.lazy(tabImports.apps);
const InspirationsTab = React.lazy(tabImports.inspirations);
const ArtInLifeTab = React.lazy(tabImports['art-in-life']);

// Route-level preloaders. For Art in Life, also preload the nested gallery chunk
// during the intro so the JS can download early without mounting the WebGL scene.
const tabPreloads = {
  about: tabImports.about,
  projects: tabImports.projects,
  apps: tabImports.apps,
  inspirations: tabImports.inspirations,
  'art-in-life': () =>
    Promise.all([
      tabImports['art-in-life'](),
      import('@/features/art-in-life/ArtInLifeGallery'),
    ]),
};

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
  const getActiveTabFromPath = (pathname: string): TabId => {
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
  const isArtInLifeMode = activeTab === 'art-in-life';
  const shouldUseArtInLifeLayout = isArtInLifeMode && contentVisible;
  const shouldMountTabContent = contentVisible;
  const shouldShowGlobalBackground = !isArtInLifeMode;

  // Start downloading the active tab code as soon as the route is known,
  // including while the intro video is still playing. This only imports modules;
  // components are not mounted/run until shouldMountTabContent is true.
  useEffect(() => {
    void tabPreloads[activeTab]();
  }, [activeTab]);

  // Dynamically update the document title when route changes
  useEffect(() => {
    const titles: Record<TabId, string> = {
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
    const wasComplete = document.body.classList.contains('intro-complete');

    document.body.classList.remove('intro-video-playing');

    if (!introComplete && !wasComplete) {
      document.body.classList.add('intro-video-playing');
    } else if (wasComplete) {
      document.body.classList.add('intro-complete');
    }
  }, [introComplete]);

  useEffect(() => {
    document.body.classList.toggle(
      'art-in-life-mode',
      shouldUseArtInLifeLayout
    );

    return () => {
      document.body.classList.remove('art-in-life-mode');
    };
  }, [shouldUseArtInLifeLayout]);

  return (
    <>
      {/* Background Effects */}
      {shouldShowGlobalBackground && (
        <BackgroundEffects introComplete={introComplete} />
      )}

      {/* Main Content */}
      <main
        className={`site-main ${
          shouldUseArtInLifeLayout
            ? 'site-main--gallery'
            : 'max-w-4xl mx-auto space-y-8 md:space-y-12 pt-8 md:pt-12 pb-4 md:pb-6 px-4 sm:px-6 lg:px-8'
        } ${contentVisible ? 'visible' : ''}`}
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
            className={
              shouldUseArtInLifeLayout
                ? 'react-tab-content react-tab-content--gallery'
                : 'react-tab-content space-y-8'
            }
          >
            <Suspense
              fallback={
                <div className="h-96 flex items-center justify-center text-white/50">
                  Loading...
                </div>
              }
            >
              {shouldMountTabContent && activeTab === 'about' && <AboutTab />}
              {shouldMountTabContent && activeTab === 'projects' && <ProjectsTab />}
              {shouldMountTabContent && activeTab === 'apps' && <AppsTab />}
              {shouldMountTabContent && activeTab === 'inspirations' && (
                <InspirationsTab />
              )}
              {shouldMountTabContent && activeTab === 'art-in-life' && (
                <ArtInLifeTab />
              )}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Scroll to Top Button */}
      {contentVisible && !isArtInLifeMode && <ScrollToTop />}

      {/* Fixed Footer */}
      {/* Static Footer Link */}
      {contentVisible && !isArtInLifeMode && (
        <footer className="w-full py-8 text-center">
          <a
            href="https://github.com/scottstts/mysite_React"
            target="_blank"
            rel="noopener noreferrer"
            className="static-footer-link inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors duration-300"
          >
            <i className="fa-solid fa-code text-xs" aria-hidden="true"></i>
            <span className="text-sm font-medium">Source Repo</span>
          </a>
          <br />
          <a
            href="/llms.txt"
            className="static-footer-link inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors duration-300 mt-2"
          >
            <i className="fa-solid fa-robot text-xs" aria-hidden="true"></i>
            <span className="text-sm font-medium">llms.txt</span>
          </a>
        </footer>
      )}
    </>
  );
}

export default App;
