import React, { useRef, useEffect, useState } from 'react';

const IntroVideo = ({ onVideoFinished }) => {
  const videoRef = useRef(null);
  const [isVisible, setIsVisible] = useState(true);
  const [videoPlaybackFinished, setVideoPlaybackFinished] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Function to handle video completion (ended, error, skipped)
    const handleVideoFinished = () => {
      if (videoPlaybackFinished) return; // Prevent multiple calls
      // console.log("Video playback finished (ended, error, or skipped)."); // For debugging
      setVideoPlaybackFinished(true); // Set the flag

      // Hide video container and trigger parent callback
      setIsVisible(false);
      onVideoFinished();

      // Clean up video container after transition
      setTimeout(() => {
        window.scrollTo(0, 0); // Ensure scroll to top after content appears
      }, 700); // Match the CSS transition duration for opacity
    };

    // Start loading video immediately
    video.load();

    // When video can play through, play it
    const handleCanPlayThrough = () => {
      video.play().catch((error) => {
        console.error('Video play failed:', error);
        handleVideoFinished(); // Treat inability to play as an error/skip
      });
    };

    // When video ends normally
    const handleEnded = () => {
      handleVideoFinished();
    };

    // If video fails to load or play
    const handleError = (e) => {
      console.error('Intro video error:', e);
      handleVideoFinished();
    };

    // Fallback: Skip intro if video takes too long to become playable
    const videoLoadTimeout = setTimeout(() => {
      // Check readyState: < 3 means it hasn't reached HAVE_FUTURE_DATA/CAN_PLAY_THROUGH
      if (!videoPlaybackFinished && video.readyState < 3) {
        console.warn('Video fallback timeout triggered (5s). Skipping video.'); // Debug log
        handleVideoFinished();
      }
    }, 5000); // 5 seconds

    // Add event listeners
    video.addEventListener('canplaythrough', handleCanPlayThrough);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);

    // Cleanup
    return () => {
      clearTimeout(videoLoadTimeout);
      video.removeEventListener('canplaythrough', handleCanPlayThrough);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
    };
  }, [onVideoFinished, videoPlaybackFinished]);

  if (!isVisible) return null;

  return (
    <div
      id="intro-video-container"
      className={`fixed inset-0 z-50 bg-black ${!isVisible ? 'hidden' : ''}`}
      role="banner"
      aria-label="Introduction video"
    >
      <video
        ref={videoRef}
        id="intro-video"
        className="w-full h-full object-cover"
        playsInline
        muted
        preload="auto"
      >
        <source src="/static_assets/intro.mp4" type="video/mp4" />
      </video>
    </div>
  );
};

export default IntroVideo;
