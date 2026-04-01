/// <reference types="vite/client" />

declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}

declare module '*.css';

interface InstagramApi {
  Embeds: {
    process: (element?: Element | Document) => void;
  };
}

interface YouTubePlayer {
  destroy: () => void;
}

interface YouTubePlayerEvent {
  data: number;
  target: YouTubePlayer;
}

interface YouTubePlayerOptions {
  events?: {
    onStateChange?: (event: YouTubePlayerEvent) => void;
  };
}

interface YouTubeApi {
  Player: new (
    elementId: string,
    options?: YouTubePlayerOptions
  ) => YouTubePlayer;
}

interface Window {
  YT?: YouTubeApi;
  onYouTubeIframeAPIReady?: () => void;
  instgrm?: InstagramApi;
}

interface WindowEventMap {
  'intro-video-complete': Event;
}
