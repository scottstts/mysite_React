import React from 'react';
import Stars from './Stars';

const BackgroundEffects = () => {
  return (
    <>
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
      <Stars />
    </>
  );
};

export default BackgroundEffects;
