import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { artOfLifeData } from './artOfLife.data.js';
import styles from './ArtOfLifeTab.module.css';

// Helper function to shuffle an array
const shuffleArray = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// Function to enhance iframe accessibility
const enhanceIframeAccessibility = (container) => {
    const iframes = container.querySelectorAll('iframe[src*="instagram.com"]');
    iframes.forEach((iframe, index) => {
        // Add accessibility attributes
        iframe.setAttribute('title', `Instagram post by Scott Sun - Art of Life photo ${index + 1}`);
        iframe.setAttribute('aria-label', 'Instagram post featuring natural scenery photography');
        
        // Ensure iframe has proper role
        iframe.setAttribute('role', 'img');
        
        // Add loading attribute for better performance
        if (!iframe.hasAttribute('loading')) {
            iframe.setAttribute('loading', 'lazy');
        }
    });
};

// Lazy-loading component for Instagram embeds
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

    return (
        <div
            ref={ref}
            className={`${styles.embedContainer} ${isVisible ? styles.loaded : ''}`}
        >
            {isVisible && <div dangerouslySetInnerHTML={{ __html: htmlContent }} />}
        </div>
    );
};


const ArtOfLifeTab = () => {
    const [shuffledEmbeds, setShuffledEmbeds] = useState([]);
    const gridRef = useRef(null);

    useEffect(() => {
        setShuffledEmbeds(shuffleArray(artOfLifeData));
    }, []);

    useEffect(() => {
        const scriptId = 'instagram-embed-script';
        const scriptSrc = 'https://www.instagram.com/embed.js';

        if (document.getElementById(scriptId)) {
            if (window.instgrm) {
                window.instgrm.Embeds.process();
            }
        } else {
            const script = document.createElement('script');
            script.id = scriptId;
            script.src = scriptSrc;
            script.async = true;
            document.body.appendChild(script);
        }

        const container = gridRef.current;
        if (!container) return;

        let timeoutId;
        const debouncedProcess = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                if (window.instgrm) {
                    window.instgrm.Embeds.process();
                }
            }, 100);
        };

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    debouncedProcess();
                    return;
                }
            }
        });

        observer.observe(container, { childList: true, subtree: true });

        return () => {
            observer.disconnect();
            clearTimeout(timeoutId);
        };
    }, []);

    return (
        <>
            <Helmet>
                <title>Art of Life – Scott Sun</title>
                <meta name="description" content="A collection of natural scenery photos." />
            </Helmet>

            <div className="art-of-life-tab">
                <h1 className="page-title text-4xl md:text-5xl font-bold text-center mb-12 fade-in">
                    Art of Life
                </h1>

                <div className={styles.masonryGrid} ref={gridRef}>
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

export default ArtOfLifeTab; 