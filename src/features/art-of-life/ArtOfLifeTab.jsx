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
const LazyEmbed = ({ htmlContent, index }) => {
    const ref = useRef(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

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

    // Effect to process embeds when they become visible
    useEffect(() => {
        if (isVisible && window.instgrm) {
            const processEmbed = () => {
                const result = window.instgrm.Embeds.process();

                const onProcessed = () => {
                    if (ref.current) {
                        enhanceIframeAccessibility(ref.current);
                    }
                    setIsLoaded(true);
                };

                // Handle both Promise and non-Promise returns
                if (result && typeof result.then === 'function') {
                    result.then(onProcessed);
                } else {
                    // If process() doesn't return a Promise, use a timeout to ensure processing is complete
                    setTimeout(onProcessed, 500);
                }
            };
            
            if (document.readyState === "complete") {
                processEmbed();
            } else {
                window.addEventListener("load", processEmbed);
                return () => window.removeEventListener("load", processEmbed);
            }
        }
    }, [isVisible]);

    return (
        <div
            ref={ref}
            className={`${styles.embedContainer} ${isLoaded ? styles.loaded : ''}`}
        >
            {isVisible && <div dangerouslySetInnerHTML={{ __html: htmlContent }} />}
        </div>
    );
};


const ArtOfLifeTab = () => {
    const [shuffledEmbeds, setShuffledEmbeds] = useState([]);

    useEffect(() => {
        setShuffledEmbeds(shuffleArray(artOfLifeData));
    }, []);

    useEffect(() => {
        // Instagram's embed script
        const scriptId = 'instagram-embed-script';
        const scriptSrc = 'https://www.instagram.com/embed.js';

        if (document.getElementById(scriptId)) {
            return;
        }

        const script = document.createElement('script');
        script.id = scriptId;
        script.src = scriptSrc;
        script.async = true;
        document.body.appendChild(script);

        // Set up a mutation observer to catch dynamically created iframes
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        enhanceIframeAccessibility(node);
                    }
                });
            });
        });

        // Start observing
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        return () => {
            const existingScript = document.getElementById(scriptId);
            if (existingScript) {
                 document.body.removeChild(existingScript);
            }
            observer.disconnect();
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

                <div className={styles.masonryGrid}>
                    {shuffledEmbeds.map((embedHtml, index) => (
                        <div key={index} className={styles.masonryItem}>
                           <LazyEmbed htmlContent={embedHtml} index={index} />
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
};

export default ArtOfLifeTab; 