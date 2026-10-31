import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const moduleId = 'virtual:icons';
const resolvedId = `\0${moduleId}`;

const packages = {
  solid: '@fortawesome/free-solid-svg-icons',
  regular: '@fortawesome/free-regular-svg-icons',
  brands: '@fortawesome/free-brands-svg-icons',
};

// Font Awesome class pairs as written in components and in data-file HTML,
// e.g. "fa-solid fa-fire".
export function findIcons(source) {
  return [
    ...source.matchAll(/fa-(solid|regular|brands)\s+fa-([a-z0-9-]+)/g),
  ].map(([, style, name]) => `${style} ${name}`);
}

const usedIcons = (root) => {
  const dir = resolve(root, 'src');
  const files = readdirSync(dir, { recursive: true })
    .filter((file) => /\.tsx?$/.test(file))
    .map((file) => resolve(dir, file));
  const used = new Set();
  for (const file of files) {
    findIcons(readFileSync(file, 'utf8')).forEach((icon) => used.add(icon));
  }
  return { files, used: [...used].sort() };
};

// Exposes { 'solid fire': [width, height, path], ... } for exactly the icons
// the site uses, taken from Font Awesome's SVG packages at build time. No
// icon font or stylesheet reaches the browser, and an icon added in a data
// file is picked up on its own.
export default function icons() {
  let root;
  let current = '';

  return {
    name: 'icons',
    configResolved(config) {
      root = config.root;
    },
    resolveId(id) {
      if (id === moduleId) return resolvedId;
    },
    async load(id) {
      if (id !== resolvedId) return;
      const { files, used } = usedIcons(root);
      files.forEach((file) => this.addWatchFile(file));
      current = used.join('|');
      const sets = {};
      for (const [style, name] of Object.entries(packages)) {
        sets[style] = Object.values(await import(name)).filter(
          (value) => value && typeof value === 'object' && value.iconName
        );
      }
      const result = {};
      for (const key of used) {
        const [style, name] = key.split(' ');
        const definition = sets[style].find((icon) => icon.iconName === name);
        if (!definition) {
          this.warn(`fa-${style} fa-${name}: not a Font Awesome Free icon`);
          continue;
        }
        const [width, height, , , path] = definition.icon;
        result[key] = [width, height, [].concat(path).join(' ')];
      }
      return `export default ${JSON.stringify(result)};`;
    },
    // Reload only when the set of icons in use changes, not on every edit.
    handleHotUpdate({ file, server }) {
      if (!/\.tsx?$/.test(file)) return;
      if (usedIcons(root).used.join('|') === current) return;
      const module = server.moduleGraph.getModuleById(resolvedId);
      if (module) {
        server.moduleGraph.invalidateModule(module);
        server.ws.send({ type: 'full-reload' });
      }
    },
  };
}
