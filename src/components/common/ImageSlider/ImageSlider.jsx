import React, { useState, useEffect, useRef } from 'react';
import YouTube from 'react-youtube';

const ImageSlider = ({ images = [], videos = [], projectId, autoplay = true, autoplayDelay = 5000 }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoplay);
  const intervalRef = useRef(null);
  const sliderRef = useRef(null);

  // Combine images and videos into slides
  const slides = [
    ...images.map((image, index) => ({
      type: 'image',
      src: `/static_assets/${image}`,
      alt: `Screenshot ${index + 1}`,
      id: `image-${index}`
    })),
    ...videos.map((video, index) => ({
      type: 'video',
      ...video,
      id: `video-${index}`
    }))
  ];

  const totalSlides = slides.length;

  // Auto-advance slides
  useEffect(() => {
    if (isPlaying && totalSlides > 1) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % totalSlides);
      }, autoplayDelay);
    } else {
      clearInterval(intervalRef.current);
    }

    return () => clearInterval(intervalRef.current);
  }, [isPlaying, totalSlides, autoplayDelay]);

  const goToSlide = (index) => {
    setCurrentIndex(index);
  };

  const goToPrevious = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === 0 ? totalSlides - 1 : prevIndex - 1
    );
  };

  const goToNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % totalSlides);
  };

  const handleYouTubePlay = () => {
    setIsPlaying(false);
  };

  const handleYouTubePause = () => {
    setIsPlaying(autoplay);
  };

  // YouTube player options
  const youtubeOpts = {
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: 0,
      controls: 1,
      rel: 0,
      showinfo: 0,
      modestbranding: 1,
      enablejsapi: 1,
      origin: window.location.origin
    },
  };

  if (totalSlides === 0) {
    return null;
  }

  const sliderId = `project${projectId}-slider`;

  return (
    <div className={sliderId}>
      {/* Slider Container */}
      <div className="relative overflow-hidden rounded-xl">
        <div 
          className="flex transition-transform duration-600 ease-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {slides.map((slide, index) => (
            <div key={slide.id} className="w-full flex-shrink-0">
              {slide.type === 'image' ? (
                <img 
                  src={slide.src} 
                  alt={slide.alt} 
                  className="rounded-xl w-full object-cover"
                  style={{ aspectRatio: '16/9' }}
                />
              ) : (
                <div className="video-container">
                  <iframe 
                    id={slide.id}
                    src={`https://www.youtube.com/embed/${slide.videoId}?enablejsapi=1`} 
                    title={slide.title}
                    frameBorder="0" 
                    allow="accelerometer; clipboard-write; encrypted-media;" 
                    allowFullScreen
                    loading="lazy"
                    onLoad={() => {
                      // Initialize YouTube player when iframe loads
                      if (window.YT && window.YT.Player) {
                        new window.YT.Player(slide.id, {
                          events: {
                            'onStateChange': function(event) {
                              if (event.data === 1) { // Playing
                                handleYouTubePlay();
                              } else if (event.data === 2 || event.data === 0) { // Paused or ended
                                handleYouTubePause();
                              }
                            }
                          }
                        });
                      }
                    }}
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
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`tns-nav-button ${index === currentIndex ? 'tns-nav-active' : ''}`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ImageSlider; 