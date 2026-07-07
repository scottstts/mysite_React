/// <reference types="vite/client" />

declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}

declare module '*.css';

declare module '*.glb' {
  const src: string;
  export default src;
}

interface InstagramApi {
  Embeds: {
    process: (_element?: Element | Document) => void;
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
    onStateChange?: (_event: YouTubePlayerEvent) => void;
  };
}

interface YouTubeApi {
  Player: new (
    _elementId: string,
    _options?: YouTubePlayerOptions
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
