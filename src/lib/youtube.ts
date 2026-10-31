import youtubeMeta from 'virtual:youtube-meta';

export interface Film {
  id: string;
  title: string;
  ratio: number;
  length: number;
}

// Playback ratio, length and YouTube's own title are read at build time.
// A video YouTube wouldn't describe falls back to a 16:9 frame.
export const getFilm = (videoId: string, title = ''): Film => {
  const meta = youtubeMeta[videoId];
  return {
    id: videoId,
    title: title || meta?.title || '',
    ratio: meta ? meta.w / meta.h : 16 / 9,
    length: meta?.len ?? 0,
  };
};

export const posterUrl = (
  videoId: string,
  quality: 'maxresdefault' | 'hqdefault' | 'mqdefault' = 'maxresdefault'
) => `https://i.ytimg.com/vi/${videoId}/${quality}.jpg`;

export const embedUrl = (videoId: string) =>
  `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&playsinline=1`;

export const formatLength = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
