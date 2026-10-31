import icons from 'virtual:icons';

const CLASSES = /fa-(solid|regular|brands)\s+fa-([a-z0-9-]+)/;

// The icon named by Font Awesome classes ("fa-solid fa-fire"), if the site
// uses it.
export const findIcon = (classes: string) => {
  const match = CLASSES.exec(classes);
  return match ? icons[`${match[1]} ${match[2]}`] : undefined;
};

// Each icon is as wide as its own glyph, at 1em tall, sitting on the text
// baseline the way Font Awesome's own SVG icons do.
export const iconWidth = (width: number, height: number) =>
  `${(width / height).toFixed(4)}em`;

const markup = (classes: string) => {
  const icon = findIcon(classes);
  if (!icon) return '';
  const [width, height, path] = icon;
  return `<svg class="icon" viewBox="0 0 ${width} ${height}" style="width:${iconWidth(width, height)}" aria-hidden="true"><path fill="currentColor" d="${path}"></path></svg>`;
};

// Data files write icons as Font Awesome tags, <i class="fa-solid fa-fire">;
// they become inline SVG.
export const inlineIcons = (html: string) =>
  html.replace(/<i\s+class="([^"]*)"[^>]*>\s*<\/i>/g, (tag, classes: string) =>
    CLASSES.test(classes) ? markup(classes) : tag
  );
