# My Website React Project

## Project Structure and How It All Comes Together

This project is organized to be easy to navigate, highly modular, and ready for straightforward extension. At the root, you’ll find `public/static_assets` for all static media like images and video covers. Reference images for the UI are placed here, and they’re simply linked to from the React code—no manual build steps needed.

All application logic and UI code lives under `src`. The entry point is `src/main.jsx`, which bootstraps the app, applies global CSS, and mounts the main `App` component with React Router and SEO support via Helmet.

Inside `src/app`, you’ll find `App.jsx` and its CSS. `App.jsx` is the only top-level stateful component, responsible for routing and global app effects (intro video, parallax, and conditional rendering). Here, the React Router routes are defined for all the main “tabs” of the site: `/about`, `/projects`, `/apps`, `/inspirations`, etc.

All primary user-facing content is separated into self-contained feature folders inside `src/features`. Each tab (like “about”, “projects”, “apps”, “inspirations”) lives in its own folder. Every feature has its own main tab component (`<FeatureName>Tab.jsx`), a module CSS file for styles scoped to this feature, and a `*.data.js` file that holds all content as plain data (titles, text, image filenames, links, etc). This separation keeps presentation and logic clean and means you never have to modify JSX just to update or add new content—simply add to the data file.

Reusable UI widgets live in `src/ui-kit`. This includes the navigation bar, intro video, background effects, image sliders, the glass card component, and a hooks folder for shared utilities like mouse parallax. All “glassmorphism” UI blocks are powered by the central `GlassCard` component, which handles all the dynamic mouse and highlight logic for you, leaving only presentation and content to be managed by feature components.

Design tokens and global styling (colors, glass effects, utility classes, variables, animations) are organized in `src/styles`, and are loaded just once from the top-level App. This ensures that feature-specific CSS modules never duplicate or override core effects, and every tab gets the same glass look and responsive polish.

A custom utility library, `src/lib/safeHtml.js`, is used everywhere user-authored rich text is rendered. This guarantees that anything marked as HTML is run through a sanitizer before being injected, ensuring both flexibility and security.

Absolute imports using the `@/` prefix are enabled by the Vite config, making it much easier to import from anywhere without ugly relative paths.

The project root also contains the frozen reference of the original static site (`original_website_codebase.txt`), plus the planning and improvement guides that explain the rationale and structure behind this refactor.

All together, this setup ensures each feature (tab) is isolated, highly portable, and trivial to modify or remove without impacting other parts of the codebase. Global styling and design primitives are single-source, and UI logic is minimal and consistent.

## How to Add Tabs, Cards, or New Content

The project is designed for effortless expansion, with every tab and card pattern standardized. Here’s how you extend or update your site:

### Adding a New Tab

First, create a new folder under `src/features` (for example, `src/features/books`). Inside that, add three files: `BooksTab.jsx`, `BooksTab.module.css`, and `books.data.js`.

Start by building out your data file. Create an exported array of objects, where each object contains at least an `id`, `title`, and `description` (plus any media, dates, or links you need).

In your `BooksTab.jsx`, follow the same pattern as other tabs: import the data, the `GlassCard` component, and the `safeHtml` utility. Map over your data array and wrap each block in a `<GlassCard>`, piping any rich text through `safeHtml`. Example scaffolding:

import React from 'react';
import { Helmet } from 'react-helmet-async';
import GlassCard from '@/ui-kit/GlassCard/GlassCard';
import { books } from './books.data';
import { safeHtml } from '@/lib/safeHtml';

const BooksTab = () => (
<> <Helmet> <title>Books – Scott Sun</title> <meta name="description" content="…" /> </Helmet>

```
<div className="books-tab space-y-8">
  <h1 className="page-title text-4xl md:text-5xl font-bold text-center mb-12 fade-in">
    My Bookshelf
  </h1>

  {books.map((bk, i) => (
    <GlassCard key={bk.id}
      className="rounded-2xl overflow-hidden fade-in"
      style={{ animationDelay: i === 0 ? '0.4s' : '0.2s' }}>
      <div className="p-5 md:p-8">
        <h2 className="text-2xl md:text-3xl font-bold mb-4 text-gray-200">
          {bk.title}
        </h2>
        <p className="text-white text-base md:text-lg leading-relaxed"
           dangerouslySetInnerHTML={safeHtml(bk.description)} />
      </div>
    </GlassCard>
  ))}
</div>
```

\</>
);

export default BooksTab;

Once you’ve created your new tab component, open `src/app/App.jsx`, import your new tab, and add a new `<Route path="/books" element={<BooksTab />} />` inside the `<Routes>` section. This is the only place you need to register new tabs for routing.

Next, add your new tab to the navigation bar. Open `Navigation.jsx` and add an entry to the `tabs` array, like `{ id:'books', label:'My Books', path:'/books' }`. The navigation logic automatically picks up new routes as long as you add them to this array.

To display any images or video covers, drop your media files into `public/static_assets/` and reference them by filename in your data array.

### Adding Glass Cards to a New or Existing Tab

In any tab component, you can create new cards simply by wrapping content with the shared `GlassCard` component. You don’t have to manage any highlight, parallax, or mouse tracking logic—this is handled in the shared component. If you want custom animation delay or order, use the `style={{ animationDelay: ... }}` prop as in the template above.

Add new content by editing the feature’s `*.data.js` file and appending new objects. Each will automatically be picked up by the tab’s `map` function and rendered in its own glass card. You don’t have to touch the JSX to add more cards; just update the data.

Any tab-specific styling can be added to its module CSS file, keeping it isolated. For new cards or tabs, avoid duplicating glassmorphism or global styles—these are centrally defined in `src/styles` and automatically applied.

### General Guidance for Extension

Only one file needs to be updated to add a new card to an existing tab: its data file.

New tabs require adding a folder with three files (component, data, CSS), a new route in `App.jsx`, and a new entry in the navigation tabs array.

All rich text rendered from user-authored data must be piped through `safeHtml` for security.

Media files are referenced from `public/static_assets` by name—just drop them in and link from your data.

Custom animation or layout tweaks can be handled inline or in the feature’s CSS module.

Absolute imports keep your code clean and make large refactors or reorganizations easier.

This system ensures all changes are isolated, version-control diffs stay clean, and the core visual style remains consistent everywhere. Every feature is self-contained and easy to delete or modify. Your core design system (glass cards and global styles) stays single-source, so you never duplicate effort.