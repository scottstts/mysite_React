export type TabId =
  | 'about'
  | 'projects'
  | 'apps'
  | 'inspirations'
  | 'art-in-life';

export interface VideoSlideData {
  videoId: string;
  title: string;
}

export interface Project {
  id: string;
  title: string;
  date: string;
  description: string;
  images: string[];
  videos: VideoSlideData[];
}

export interface AppStatus {
  type: string;
  label: string;
}

export type AppStatusValue = string | AppStatus;

export interface App {
  id: string;
  title: string;
  tagline: string;
  description: string;
  images?: string[];
  videos?: VideoSlideData[];
  link?: string;
  showLink: boolean;
  status?: AppStatusValue;
}

export interface Inspiration {
  id: string;
  name: string;
  description: string;
  image: string;
}

export interface NavigationTab {
  id: TabId;
  label: string;
  path: string;
}
