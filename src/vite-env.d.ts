/// <reference types="vite/client" />

declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}

declare module '*.css';

declare module 'virtual:youtube-meta' {
  const meta: Record<
    string,
    { w: number; h: number; len: number; title: string }
  >;
  export default meta;
}

declare module 'virtual:image-ratios' {
  const ratios: Record<string, number>;
  export default ratios;
}

declare module 'virtual:icons' {
  // 'solid fire': [width, height, path]
  const icons: Record<string, [number, number, string]>;
  export default icons;
}

declare module '*.glb' {
  const src: string;
  export default src;
}

interface InstagramApi {
  Embeds: {
    process: (_element?: Element | Document) => void;
  };
}

interface Window {
  instgrm?: InstagramApi;
}
