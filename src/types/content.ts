export type TabId =
  | 'about'
  | 'projects'
  | 'portfolio'
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

export interface SocialLink {
  name: string;
  handle: string;
  href: string;
  icon: string;
}

export interface AboutContent {
  title: string;
  heading: string;
  lead: string;
  body: string;
  socialsHeading: string;
  socials: SocialLink[];
}

export interface PageEnding {
  text: string;
  image?: string;
}
