import videoDimensions from 'virtual:youtube-dimensions';

export const getVideoAspectRatio = (videoId: string) => {
  const dimensions = videoDimensions[videoId];
  return dimensions ? dimensions[0] / dimensions[1] : 16 / 9;
};

let apiPromise: Promise<void> | undefined;

export const loadYouTubeAPI = () => {
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<void>((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      resolve();
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => {
      script.remove();
      window.onYouTubeIframeAPIReady = previousReady;
      apiPromise = undefined;
      reject(new Error('Could not load YouTube player API'));
    };
    document.head.appendChild(script);
  });

  return apiPromise;
};
