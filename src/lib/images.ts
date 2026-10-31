import imageRatios from 'virtual:image-ratios';

export const imageUrl = (file: string) => `/content_imgs/${file}`;

// width / height, measured from the file at build time.
export const imageRatio = (file: string) => imageRatios[file] ?? 1.6;
