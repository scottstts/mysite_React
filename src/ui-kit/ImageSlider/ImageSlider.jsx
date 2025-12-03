import React, { useState, useEffect, useRef, useCallback } from 'react';

const ImageSlider = ({
  images = [],
  videos = [],
  projectId,
  autoplay = true,
  autoplayDelay = 5000,
}) => {
  // Combine images and videos into slides first to determine initial index
  const originalSlides = [
    ...images.map((image, index) => ({
      type: 'image',
      src: `/static_assets/${image}`,
      alt: `Screenshot ${index + 1}`,
      id: `image-${index}`,
    })),
    ...videos.map((video, index) => ({
      type: 'video',
      ...video,
      id: `video-${index}-${projectId}`, // Make ID unique across components
    })),
  ];

  const totalSlides = originalSlides.length;

  const [currentIndex, setCurrentIndex] = useState(totalSlides > 1 ? 1 : 0); // Start at index 1 for infinite loop, 0 for single slide
  const [isPlaying, setIsPlaying] = useState(autoplay);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const [youtubePlayersReady, setYoutubePlayersReady] = useState(false);
  const intervalRef = useRef(null);
  const _sliderRef = useRef(null);
  const youtubePlayersRef = useRef({});

  // Create infinite loop by duplicating slides: [last, ...original, first]
  const slides =
    totalSlides > 1
      ? [
          {
            ...originalSlides[totalSlides - 1],
            id: `${originalSlides[totalSlides - 1].id}-clone-start`,
          },
          ...originalSlides,
          { ...originalSlides[0], id: `${originalSlides[0].id}-clone-end` },
        ]
      : originalSlides;

  // Define YouTube state change handler before it's used
  const handleYouTubeStateChange = useCallback(
    (event, _playerId) => {
      const playerState = event.data;

      // YouTube player states:
      // -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (video cued)

      if (playerState === 1) {
        // Playing
        setIsPlaying(false); // Stop slider auto-play
      } else if (playerState === 0 || playerState === 2) {
        // Ended or Paused
        setIsPlaying(autoplay); // Resume slider auto-play if originally enabled
      }
    },
    [autoplay, setIsPlaying]
  );

  // Load YouTube API
  useEffect(() => {
    if (videos.length === 0) return;

    const loadYouTubeAPI = () => {
      if (window.YT && window.YT.Player) {
        setYoutubePlayersReady(true);
        return;
      }

      if (!window.onYouTubeIframeAPIReady) {
        window.onYouTubeIframeAPIReady = () => {
          setYoutubePlayersReady(true);
        };

        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      }
    };

    loadYouTubeAPI();
  }, [videos.length]);

  // Initialize YouTube players when API is ready
  useEffect(() => {
    if (!youtubePlayersReady || videos.length === 0) return;

    const initializePlayers = () => {
      videos.forEach((video, index) => {
        const playerId = `video-${index}-${projectId}`;

        if (
          document.getElementById(playerId) &&
          !youtubePlayersRef.current[playerId]
        ) {
          try {
            youtubePlayersRef.current[playerId] = new window.YT.Player(
              playerId,
              {
                events: {
                  onStateChange: (event) =>
                    handleYouTubeStateChange(event, playerId),
                },
              }
            );
          } catch {
            console.warn(
              'YouTube player initialization delayed for:',
              playerId
            );
            // Try again after a short delay
            setTimeout(() => {
              if (
                document.getElementById(playerId) &&
                !youtubePlayersRef.current[playerId]
              ) {
                try {
                  youtubePlayersRef.current[playerId] = new window.YT.Player(
                    playerId,
                    {
                      events: {
                        onStateChange: (event) =>
                          handleYouTubeStateChange(event, playerId),
                      },
                    }
                  );
                } catch {
                  console.error(
                    'Failed to initialize YouTube player:',
                    playerId
                  );
                }
              }
            }, 1000);
          }
        }
      });
    };

    // Wait a bit for iframes to be rendered
    const timer = setTimeout(initializePlayers, 500);
    return () => clearTimeout(timer);
  }, [youtubePlayersReady, videos, projectId, handleYouTubeStateChange]);

  // Auto-advance slides
  useEffect(() => {
    if (isPlaying && totalSlides > 1) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prevIndex) => prevIndex + 1);
      }, autoplayDelay);
    } else {
      clearInterval(intervalRef.current);
    }

    return () => clearInterval(intervalRef.current);
  }, [isPlaying, totalSlides, autoplayDelay]);

  // Handle infinite loop transitions
  useEffect(() => {
    if (totalSlides <= 1) return;

    if (currentIndex === 0) {
      // At the cloned last slide, jump to the real last slide
      setTimeout(() => {
        setIsTransitioning(false);
        setCurrentIndex(totalSlides);
        setTimeout(() => setIsTransitioning(true), 50);
      }, 600); // Wait for transition to complete
    } else if (currentIndex === totalSlides + 1) {
      // At the cloned first slide, jump to the real first slide
      setTimeout(() => {
        setIsTransitioning(false);
        setCurrentIndex(1);
        setTimeout(() => setIsTransitioning(true), 50);
      }, 600); // Wait for transition to complete
    }
  }, [currentIndex, totalSlides]);

  const goToSlide = (index) => {
    // Convert original slide index to infinite loop index
    setCurrentIndex(totalSlides > 1 ? index + 1 : index);
  };

  const goToPrevious = () => {
    setCurrentIndex((prevIndex) => prevIndex - 1);
  };

  const goToNext = () => {
    setCurrentIndex((prevIndex) => prevIndex + 1);
  };

  // Cleanup YouTube players on unmount
  useEffect(() => {
    const playersSnapshot = youtubePlayersRef.current;
    return () => {
      Object.values(playersSnapshot).forEach((player) => {
        try {
          if (player && typeof player.destroy === 'function') {
            player.destroy();
          }
        } catch {
          console.error('Error destroying YouTube player');
        }
      });
    };
  }, []);

  if (totalSlides === 0) {
    return null;
  }

  const sliderId = `project${projectId}-slider`;

  // Match macOS window corner radius (~12px)
  const slideRadius = '12px';

  return (
    <div className={sliderId}>
      {/* Slider Container */}
      <div className="relative overflow-hidden rounded-xl">
        <div
          className={`flex ${isTransitioning ? 'transition-transform duration-600 ease-out' : ''}`}
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {slides.map((slide, _index) => (
            <div
              key={slide.id}
              className="w-full flex-shrink-0 flex justify-center"
              style={{ borderRadius: slideRadius, overflow: 'hidden' }}
            >
              {slide.type === 'image' ? (
                <img
                  src={slide.src}
                  alt={slide.alt}
                  className="block w-full h-auto"
                  style={{
                    borderRadius: slideRadius,
                    clipPath: `inset(0 round ${slideRadius})`,
                  }}
                />
              ) : (
                <div
                  className="video-container"
                  style={{ aspectRatio: '16/9', borderRadius: slideRadius, overflow: 'hidden' }}
                >
                  <iframe
                    id={slide.id}
                    src={`https://www.youtube.com/embed/${slide.videoId}?enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
                    title={slide.title}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                    width="100%"
                    height="100%"
                    style={{ borderRadius: slideRadius }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Navigation Controls */}
        {totalSlides > 1 && (
          <div className="tns-controls">
            <button
              onClick={goToPrevious}
              className="tns-controls-prev"
              data-controls="prev"
              aria-label="Previous slide"
            >
              ←
            </button>
            <button
              onClick={goToNext}
              className="tns-controls-next"
              data-controls="next"
              aria-label="Next slide"
            >
              →
            </button>
          </div>
        )}
      </div>

      {/* Navigation Dots */}
      {totalSlides > 1 && (
        <div className="tns-nav">
          {originalSlides.map((_, index) => {
            // Calculate the active index from the infinite loop index
            let activeIndex = currentIndex - 1;
            if (activeIndex < 0) activeIndex = totalSlides - 1;
            if (activeIndex >= totalSlides) activeIndex = 0;

            return (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`tns-nav-button ${index === activeIndex ? 'tns-nav-active' : ''}`}
                aria-label={`Go to slide ${index + 1}`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ImageSlider;
