import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { artInLifeData } from './artInLife.data.js';
import { safeHtml } from '../../lib/safeHtml.js';
import styles from './ArtInLifeTab.module.css';

// Helper function to shuffle an array
const shuffleArray = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// Function to enhance iframe accessibility with lazy loading
const enhanceIframeAccessibility = (container) => {
  const iframes = container.querySelectorAll('iframe[src*="instagram.com"]');
  iframes.forEach((iframe, index) => {
    // Add accessibility attributes
    iframe.setAttribute(
      'title',
      `Instagram post by Scott Sun - Art in Life photo ${index + 1}`
    );
    iframe.setAttribute(
      'aria-label',
      'Instagram post featuring natural scenery photography'
    );

    // Ensure iframe has proper role
    iframe.setAttribute('role', 'img');

    // Add native lazy loading for better performance
    if (!iframe.hasAttribute('loading')) {
      iframe.setAttribute('loading', 'lazy');
    }

    // Check for data-instgrm-class attribute for custom lazy loading
    if (iframe.dataset.instgrmClass === 'loading-lazy') {
      iframe.loading = 'lazy';
    }
  });
};

// Lazy-loading component for Instagram embeds - processes per card
const LazyEmbed = ({ htmlContent }) => {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '0px 0px 200px 0px', // Load 200px before it enters the viewport
      }
    );

    const currentRef = ref.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, []);

  // Process Instagram embed when the card becomes visible
  useEffect(() => {
    if (isVisible && ref.current && window.instgrm) {
      // Only process this card, not the whole page
      window.instgrm.Embeds.process(ref.current);
      enhanceIframeAccessibility(ref.current);
    }
  }, [isVisible]);

  return (
    <div
      ref={ref}
      className={`${styles.embedContainer} ${isVisible ? styles.loaded : ''}`}
    >
      {isVisible && <div dangerouslySetInnerHTML={{ __html: htmlContent }} />}
    </div>
  );
};

const ArtInLifeTab = () => {
  const [shuffledEmbeds, setShuffledEmbeds] = useState([]);

  useEffect(() => {
    setShuffledEmbeds(shuffleArray(artInLifeData));
  }, []);

  // No longer needed - Instagram SDK is loaded in HTML and processing is handled per-card

  return (
    <>
      <Helmet>
        <title>Art in Life – Scott Sun</title>
        <meta
          name="description"
          content="A collection of natural scenery photos."
        />
      </Helmet>

      <div className="art-in-life-tab">
        <h1 className="page-title text-4xl md:text-5xl font-bold text-center mb-4 fade-in">
          Art in Life
        </h1>

        <div className="w-full mb-8">
          <p
            className="font-semibold text-yellow-200 text-left"
            dangerouslySetInnerHTML={safeHtml(
              `&nbsp;&nbsp;&nbsp;&nbsp;Make an effort to see... <i class="fa-solid fa-eye" aria-hidden="true"></i>`
            )}
          />
        </div>

        <div className={styles.masonryGrid}>
          {shuffledEmbeds.map((embedHtml, index) => (
            <div key={index} className={styles.masonryItem}>
              <LazyEmbed htmlContent={embedHtml} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default ArtInLifeTab;
