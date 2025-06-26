import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import IntroVideo from './components/IntroVideo/IntroVideo';
import BackgroundEffects from './components/BackgroundEffects/BackgroundEffects';
import Navigation from './components/Navigation/Navigation';
import AboutTab from './components/Tabs/AboutTab/AboutTab';
import ProjectsTab from './components/Tabs/ProjectsTab/ProjectsTab';
import AppsTab from './components/Tabs/AppsTab/AppsTab';
import InspirationsTab from './components/Tabs/InspirationsTab/InspirationsTab';
import ScrollToTop from './components/common/ScrollToTop/ScrollToTop';
import './styles/variables.css';
import './styles/globals.css';
import './styles/utilities.css';
import './styles/animations.css';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('about');
  const [introComplete, setIntroComplete] = useState(false);
  const [contentVisible, setContentVisible] = useState(false);

  // Handle intro video completion
  const handleVideoFinished = () => {
    setIntroComplete(true);
    setTimeout(() => {
      setContentVisible(true);
    }, 100);
  };

  // Add mouse movement tracking for background effects
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (window.innerWidth < 768) return; // Skip on mobile
      
      const moveX = (e.clientX - window.innerWidth / 2) * 0.005;
      const moveY = (e.clientY - window.innerHeight / 2) * 0.005;
      
      document.body.style.setProperty('--mouse-x', `${moveX}deg`);
      document.body.style.setProperty('--mouse-y', `${moveY}deg`);
      
      document.body.style.backgroundPosition = `calc(50% + ${moveX}px) calc(50% + ${moveY}px)`;
    };

    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Apply proper body classes and ensure content becomes visible
  useEffect(() => {
    // Remove any default classes that might interfere with custom CSS
    document.body.className = '';
  }, []);

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'about':
        return <AboutTab />;
      case 'projects':
        return <ProjectsTab />;
      case 'apps':
        return <AppsTab />;
      case 'inspirations':
        return <InspirationsTab />;
      default:
        return <AboutTab />;
    }
  };

  return (
    <>
      <Helmet>
        <title>Scott Sun</title>
        <meta name="description" content="Scott Sun | Frontier AI Chaser and Builder. Techno Optimist." />
        <meta name="keywords" content="Scott Sun, Frontier AI Chaser, Builder, Tech Innovation, AI Development, Tech-centric Solutions, Techno Optimist" />
        <meta name="author" content="Scott Sun" />
        
        <meta property="og:title" content="Scott Sun | Frontier AI Chaser & Techno Optimist" />
        <meta property="og:description" content="Scott Sun | Frontier AI Chaser and Builder. Techno Optimist." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://scottsun.io" />
        <meta property="og:image" content="/static_assets/logo.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="Scott Sun" />
        <meta property="og:locale" content="en_US" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@scottstts" />
        <meta name="twitter:creator" content="@scottstts" />
        <meta name="twitter:title" content="Scott Sun | Frontier AI Chaser & Techno Optimist" />
        <meta name="twitter:description" content="Scott Sun | Frontier AI Chaser and Builder. Techno Optimist." />
        <meta name="twitter:image" content="/static_assets/logo.jpg" />
        <meta name="twitter:image:alt" content="Scott Sun's Website logo" />

        <meta name="robots" content="index, follow" />
        <meta name="googlebot" content="index, follow" />
      </Helmet>

      {/* Intro Video */}
      {!introComplete && (
        <IntroVideo onVideoFinished={handleVideoFinished} />
      )}

      {/* Background Effects */}
      <BackgroundEffects />

      {/* Main Content */}
      <main className={`max-w-4xl mx-auto space-y-8 md:space-y-12 pt-8 md:pt-12 pb-4 md:pb-6 px-4 sm:px-6 lg:px-8 ${contentVisible ? 'visible' : ''}`}>
        <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Tab Content with Animation */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="react-tab-content space-y-8"
            style={{ display: 'block', opacity: 1, position: 'relative' }}
          >
            {renderActiveTab()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Scroll to Top Button */}
      {contentVisible && <ScrollToTop />}

      {/* Fixed Footer */}
      {contentVisible && (
        <a href="https://github.com/scottstts/mysite_React" target="_blank" rel="noopener noreferrer" className="fixed-footer">
          <div className="footer-content">
            <span className="font-bold text-blue-300">View Source Repo</span>
            <i className="fa-solid fa-code"></i>
          </div>
        </a>
      )}
    </>
  );
}

export default App; 