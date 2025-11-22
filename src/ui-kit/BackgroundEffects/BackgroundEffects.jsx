import React from 'react';

const BackgroundEffects = () => {
  return (
    <video
      className="bg-video"
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden="true"
    >
      <source src="/static_assets/bg_video.webm" type="video/webm" />
    </video>
  );
};

export default BackgroundEffects;
