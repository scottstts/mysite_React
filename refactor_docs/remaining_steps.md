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

> Target state: **one Tailwind build, scoped CSS Modules, and one shared `animations.css`** (no duplicated keyframes).

1. **Remove Tailwind CDN** from `index.html` (line 41) , then:

   ```bash
   npm i -D tailwindcss postcss autoprefixer
   npx tailwindcss init -p
   ```

   Prepend

   ```css
   @tailwind base;
   @tailwind components;
   @tailwind utilities;
   ```

   to `src/styles/globals.css`.

2. **Standardise classes**

   * Keep Tailwind for layout (`flex`, `gap-8`).
   * Keep or add `.module.css` for bespoke visuals (e.g. `.glass-card`).

3. **Centralise keyframes**

   * Edit `src/styles/animations.css`; add one canonical `@keyframes fadeIn` / `fadeOut`.
   * Delete duplicates in:

     * `AppsTab.module.css` (42-51)&#x20;
     * `AboutTab.module.css` (100-109)&#x20;
     * `ImageSlider.module.css` (403-406)&#x20;
     * any other matches (`grep -R "@keyframes fadeIn"`).
   * Either use Tailwind utilities (`@apply animate-fadeIn`) or add:

     ```css
     .fade-in { animation: fadeIn 0.6s ease-out both; }
     ```

4. **Globals vs Modules**

   * Keep global:

     * `globals.css` (reset/vars)
     * `variables.css` (CSS custom props)
     * `glassCardEffect.css` (shared)
     * `animations.css` (keyframes)
   * Move others (`Navigation.css`, `ScrollToTop.css`, …) next to their components as `.module.css`, camel-casing class imports.

5. **Purge dead selectors**

   ```bash
   npx tailwindcss --content "src/**/*.{js,jsx,html}" --watch
   ```

   Remove unused utilities and any `.tns-*` (tiny-slider) remnants.

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

## 6 ↠ Dead code & assets

1. **Remove legacy tokens** – delete the `.images` / `.videos` placeholders fixed in §2.
2. **Drop tiny-slider CSS** – remove `.tns-*` rules in `globals.css` (144-149)  and the HTML dump (2050-2064).
3. **Prune unused images**:

   ```bash
   npx globby "public/static_assets/**/*" \
     | grep -v -f <(grep -Roh "static_assets/[A-Za-z0-9._-]*" src | sort -u) \
     | xargs rm
   ```
4. **Delete commented blocks** – clear the starfield/nebula code at HTML dump lines 2012-2018.&#x20;

---

### What you gain

* Shallow imports and co-located data make features easy to move or delete.
* Single-source animations cut style drift and bundle size.
* Sanitisation and clearer DOM improve security and accessibility.
* A tidy assets folder keeps repo history slim and CI fast.

Execute these steps and your React refactor will finally *deliver* on its promise of maintainability—without shifting a single pixel for site visitors.