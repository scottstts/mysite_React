# Modular-maintenance guide

**Goal:** keep the *current* visual/UX identical while making the React refactor easier to extend, test and reason about.
Follow the numbered sections sequentially; every bullet is a concrete change an automated agent can execute without further design work.

**Important:** You must *deliver* on its promise of maintainability—without shifting a single pixel for site visitors. That means pure technical improvements without changing anything about looks, functionalities, aesthetics, etc.

---

## 1 ↠ Folder & import architecture

* **Introduce a `features / ui-kit / app` layout**

  1. Create `src/features/{about,projects,apps,inspirations}` and move each `*Tab.jsx` plus its local `.module.css`, images and mock-data there.
  2. Move generic building blocks (`GlassCard`, `ImageSlider`, `ScrollToTop`, etc.) to `src/ui-kit`.
  3. Keep `src/app` for `App.jsx`, routing, providers and global styles.
  4. Replace deep relative imports such as
     `import GlassCard from '././common/GlassCard/GlassCard'`&#x20;
     with a Vite alias:

     ```ts
     // vite.config.js
     export default defineConfig({
       resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } }
     });

     // usage
     import GlassCard from '@/ui-kit/GlassCard';
     ```
  5. Delete the now-empty `components/common` and `components/Tabs` folders.

* **Co-locate data with its feature**
  Move `src/data/apps.js` → `src/features/apps/apps.data.js`, etc., then update imports.

---

## 2 ↠ Component API & code-quality fixes

1. **`GlassCard.jsx` spread-props typo**

   ```diff
   -const GlassCard = ({ children, className = '', .props }) => {
   +const GlassCard = ({ children, className = '', ...props }) => {
       …
   -  <div … {.props}>
   +  <div … {...props}>
   ```



2. **`ImageSlider.jsx` placeholder tokens** – replace the two `.<something>` fragments:

   ```diff
   -const originalSlides = [
   -  .images.map(…
   -  …
   -  .videos.map(…
   +const originalSlides = [
   +  ...images.map((src, i) => ({
   +    type: 'image',
   +    src: `/static_assets/${src}`,
   +    alt: `Screenshot ${i + 1}`,
   +    id: `image-${i}`
   +  })),
   +  ...videos.map((video, i) => ({
   +    type: 'video',
   +    video,
   +    id: `video-${i}-${projectId}`
   +  }))
   ];
   ```

   (Apply the same fix to the `slides` cloning line.)&#x20;

3. **Extract side-effects into hooks**

   * Create `src/ui-kit/hooks/useMouseParallax.js` containing the body-level `mousemove` listener currently in `App.jsx` (lines 31-45).&#x20;
   * Replace that entire `useEffect` with `useMouseParallax()`.

4. **Convert tab state to routes** (optional, non-breaking) – add `react-router-dom` and swap the `activeTab` switch for routes (`/about`, `/projects`, …). Keep existing JSX.

5. **Strict linting** – run `eslint --init`, add Prettier, and enable the TypeScript parser even for JS to catch unused imports.

---

## 3 ↠ Styling & CSS consolidation

Below is a **surgical, file‑and‑line–level blueprint** for executing § 3 ↠ Styling & CSS consolidation **without altering the current visual output**.

### 0 ― Ground rules

| Risk                                                             | Mitigation                                                                                         |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Tailwind Preflight overrides** (margins on `h*`, `body`, etc.) | Disable Preflight (`corePlugins: { preflight: false }`).                                           |
| **JIT tree‑shaking removes classes created at runtime**          | Add a `safelist` and glob all JSX `className` strings.                                             |
| Duplicate keyframes / glass‑card styles shadow each other        | Keep *one* canonical copy in the shared files and **delete every other copy**.                     |
| Merge order breaks cascade                                       | In `globals.css` put **Tailwind directives first**, then your existing reset so the original wins. |

### 1 ― Integrate Tailwind as a build‑time stylesheet

1. **Remove CDN link**
   Delete lines 38 ‑ 44 in `index.html` (Tailwind script tag).

2. **Install & scaffold**

   ```bash
   npm i -D tailwindcss postcss autoprefixer
   npx tailwindcss init -p
   ```

3. **Edit `tailwind.config.js`**

   ```js
   /** @type {import('tailwindcss').Config} */
   module.exports = {
     content: ["./index.html", "./src/**/*.{js,jsx}"],
     corePlugins: { preflight: false },   // ⬅ critical
     safelist: [
       "fade-in", "fade-out",             // static utility wrappers
       { pattern: /^tns-,^embla/ },       // third‑party slider classes
     ],
     theme: { extend: {
       animation: {                         // expose our canonical keyframes
         "fade-in": "fadeIn 0.6s ease-out both",
         "fade-out": "fadeOut 0.6s ease-out both",
       },
       keyframes: {
         fadeIn: { from:{opacity:"0",transform:"translateY(20px)"}, to:{opacity:"1",transform:"translateY(0)"} },
         fadeOut:{ from:{opacity:"1"}, to:{opacity:"0"} },
       }
     }},
     plugins: [],
   };
   ```

4. **Prepend Tailwind directives** to the *top* of `src/styles/globals.css`:

   ```css
   @tailwind base;
   @tailwind components;
   @tailwind utilities;
   ```

---

### 2 ― Canonicalise keyframes in `src/styles/animations.css`

#### 2.1  Copy in canonical definitions (if not already present)

Add **once** inside `animations.css`:

```css
@keyframes fadeIn   { from {opacity:0;transform:translateY(20px)} to {opacity:1;transform:translateY(0)} }
@keyframes fadeOut  { from {opacity:1;}                       to {opacity:0;} }
```

(Check that they already exist at lines 57‑61 & 138‑142 – if so keep only one copy).

#### 2.2  Delete duplicates

| File                                             | Lines to delete          | Why                                          |                                                |
| ------------------------------------------------ | ------------------------ | -------------------------------------------- | ---------------------------------------------- |
| `AboutTab.module.css`                            | 97 ‑ 109                 | duplicate **fadeIn**                         |                                                |
| `ImageSlider.module.css`                         | 404 ‑ 406                | duplicate **fadeIn**                         |                                                |
| `codebase.txt` (legacy dump) tiny‑slider section | 2050 ‑ 2056, 2055 ‑ 2057 | **fadeIn/Out** in HTML dump                  |                                                |
| Any other \`@keyframes fadeIn                    | fadeOut                  | glow-\*`found by`grep -R "@keyframes fade"\` | Remove – they are already in `animations.css`. |

#### 2.3  Convert helper class

Keep the utility wrapper, but make it build‑time:

```css
/* in globals.css, under Tailwind directives */
.fade-in  {@apply animate-fade-in;}
.fade-out {@apply animate-fade-out;}
```

---

### 3 ― Glass‑card single source‑of‑truth

`src/styles/glassCardEffect.css` already contains the *good* version at lines 4‑18.

Delete the duplicates:

* `codebase.txt` dump `glass-card` 502 ‑ 518
* Any `glass-card` block inside per‑tab CSS.

Then import the shared file once in `App.jsx` (top level) or via Vite `main.jsx`:

```js
import "@/styles/glassCardEffect.css";
```

---

### 4 ― Move stray global component styles into co‑located modules

| Global file                                                    | Action                                                                                                                                                 |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Navigation.css`, `ScrollToTop.css`, `Footer.css` (if present) | Rename to `Navigation.module.css` etc. Place next to the component, import with `import styles from './Navigation.module.css'`, convert class strings. |
| Inline `<style>` blocks in components                          | Move rules into the new module files.                                                                                                                  |

Because Preflight is **off**, there is no risk of conflicting resets.

---

### 5 ― Purge dead selectors

Run once:

```bash
npx tailwindcss --content "src/**/*.{js,jsx,html}" --dry-run | less
```

Manually delete:

* `.tns-*` rules in `globals.css` lines 1181‑1208 etc.
* Any selector that the dry‑run marks as unused.

---

### 6 ― Regression test checklist

1. `npm run dev` – visually diff against the original. No spacing or font‑weight shifts should appear (pre‑flight is off).
2. In DevTools ► **Styles** ensure every `.fade-in` now pulls its animation from one place (`animations.css`).
3. Lighthouse → performance/CLS unchanged.
4. Search once more: `grep -R "@keyframes fadeIn" src` → should return **only** `animations.css`.
5. Build: `npm run build && npm run preview` – confirm bundle size drops (duplicate CSS gone).

Follow the blueprint above and the refactor will *finally* have **one Tailwind build + scoped modules + one animations file**—with **zero pixel drift**.

---

## 4 ↠ Safe HTML injection & XSS

1. Install DOMPurify:

   ```bash
   npm i dompurify
   ```
2. Create `src/lib/safeHtml.js`:

   ```js
   import DOMPurify from 'dompurify';

   export const safeHtml = (html) => ({
     __html: DOMPurify.sanitize(html),
   });
   ```
3. Replace every raw `dangerouslySetInnerHTML` with:

   ```jsx
   <span dangerouslySetInnerHTML={safeHtml(...)} />
   ```

   in:

   * `ProjectsTab.jsx` (18-21)&#x20;
   * `AppsTab.jsx` (18-21)&#x20;
   * `InspirationsTab.jsx` (22-24)&#x20;

---

## 5 ↠ Accessibility & SEO

* **Icons** – add `aria-hidden="true"` to decorative FontAwesome `<i>` tags (`grep "fa-"`).
* **Focus rings** – remove `outline: none` from `.scroll-top-button` (line 28) and similar rules so keyboard focus is visible.&#x20;
* **Helmet titles** – move the static `<title>` out of `App.jsx` and set per tab with `react-helmet-async`.
* **Colour contrast** – run `npx @axe-core/react` in dev to catch low-contrast text/gradients.

---

### What you gain

* Shallow imports and co-located data make features easy to move or delete.
* Single-source animations cut style drift and bundle size.
* Sanitisation and clearer DOM improve security and accessibility.
* A tidy assets folder keeps repo history slim and CI fast.

Execute these steps and your React refactor will finally *deliver* on its promise of maintainability—without shifting a single pixel for site visitors.