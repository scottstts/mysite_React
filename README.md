# My Website React Project

## Overview

This is my website *modular React project*.

**Visit at *https://scottsun.io***

The website was originally a plain html, css, javascript website. I now refactored it into a modular React project for better maintenance and expansion.

The original website is archived in [Original Website Codebase](refactor_archive/original_website_codebase.txt) - frozen reference. Additional docs used for the refactor process are in [Refactor Archive](./refactor_archive).

## 📋 Project Structure and How It All Comes Together

This project is organized for easy navigation, high modularity, and straightforward extension. The architecture separates concerns, ensuring that content, logic, and shared UI are kept distinct.

### Directory Overview

  * **`public/static_assets/`**: All static media (images, video covers, UI references). These are directly accessible in the code without needing to be imported or processed by the build system.
  * **`src/`**: All application logic and UI code.
      * **`app/`**: Contains `App.jsx` and its CSS. `App.jsx` is the main stateful component that handles routing, global effects (like the intro video and parallax background), and renders the primary layout.
      * **`features/`**: Contains self-contained folders for each main tab of the website (e.g., `about`, `projects`, `apps`, `inspirations`, `art-in-life`). This is the core of the website's content.
      * **`ui-kit/`**: Contains reusable UI components and hooks that are shared across different features. This includes the `Navigation`, `Footer` , `GlassCard`, `ImageSlider`, and the `useMouseParallax` hook.
      * **`styles/`**: Holds global CSS files, including design tokens (variables), animations, and base styles.
      * **`lib/`**: Contains utility functions, such as the `safeHtml.js` sanitizer.
      * **`main.jsx`**: The application's entry point. It sets up the React root, routing with `HashRouter`, and the `HelmetProvider` for SEO management.

### Key Architecture Decisions

#### Feature-Based Organization

All primary content is separated into self-contained feature folders inside `src/features`. Each tab (like "about", "projects", "apps") follows a consistent structure:

```
src/features/[feature-name]/
├── [FeatureName]Tab.jsx      # Main component for the tab
├── [FeatureName]Tab.module.css # Scoped styles for the tab
└── [featureName].data.js      # Content for the tab, kept as plain data
```

This separation ensures that content updates only require editing a `.js` data file, leaving the component's JSX structure untouched.

#### Route-Based Navigation

The application uses `react-router-dom` to manage navigation. Instead of using component state to show/hide tabs, `App.jsx` defines a series of routes:

  * `/about` (or `/`) maps to the `AboutTab`
  * `/projects` maps to the `ProjectsTab`
  * `/apps` maps to the `AppsTab`
  * `/inspirations` maps to the `InspirationsTab`
  * `/art-in-life` maps to the `ArtInLifeTab`

This approach provides unique URLs for each section, improving deep linking and browser history management.

#### Dynamic Browser Tab Titles

The `App.jsx` component uses a `useEffect` hook that listens for changes in the route's location. It dynamically updates the `document.title` based on the active tab, ensuring the browser tab always reflects the current content. This works alongside `react-helmet-async` for managing other SEO meta tags.

#### Styling Architecture

The project uses a hybrid styling strategy for consistency and maintainability:

  * **Global Styles**: Core design tokens (`variables.css`), keyframe animations (`animations.css`), and global resets (`globals.css`) are defined in `src/styles` and loaded once in `App.jsx`.
  * **Shared Component Styles**: Reusable UI components like `GlassCard` have their styles defined in a central file (`src/styles/glassCardEffect.css`) to ensure a consistent look and feel everywhere.
  * **Scoped Styles**: Each feature tab and UI component uses its own `.module.css` file (e.g., `AppsTab.module.css`). This scopes class names and prevents style conflicts between different parts of the application.
  * **Utility Classes**: Tailwind CSS is integrated into the build process, allowing for the use of utility classes directly in the JSX for fine-grained layout and styling adjustments.

#### Security & Best Practices

  * **HTML Sanitization**: A custom `safeHtml` utility in `src/lib/safeHtml.js` uses `DOMPurify` to sanitize any rich text content from data files before it is rendered with `dangerouslySetInnerHTML`, preventing XSS attacks.
  * **Absolute Imports**: The project is configured with a Vite alias, allowing for clean, absolute imports starting with `@/` (e.g., `import GlassCard from '@/ui-kit/GlassCard/GlassCard'`) instead of fragile relative paths.

-----

## 🚀 How to Add Tabs, Cards, or New Content

The project is designed for easy expansion. Follow these patterns to add new content.

### Adding a New Tab

#### 1\. Create the Feature Structure

Create a new folder under `src/features` (e.g., `src/features/books`) with three files:

  * `BooksTab.jsx`
  * `BooksTab.module.css`
  * `books.data.js`

#### 2\. Build Data File

In `books.data.js`, create and export an array of objects. Each object should represent a card and contain keys like `id`, `title`, and `description`.

#### 3\. Create the Tab Component

In `BooksTab.jsx`, import React, `Helmet` for SEO, `GlassCard`, data file, and the `safeHtml` utility. The component should map over data array and render a `GlassCard` for each item.

```jsx
import React from 'react';
import { Helmet } from 'react-helmet-async';
import GlassCard from '@/ui-kit/GlassCard/GlassCard';
import { books } from './books.data';
import { safeHtml } from '@/lib/safeHtml';

const BooksTab = () => (
  <>
    <Helmet>
      <title>Books – Scott Sun</title>
      <meta name="description" content="A list of my favorite books and what I've learned." />
    </Helmet>
    
    <div className="books-tab space-y-8">
      <h1 className="page-title text-4xl md:text-5xl font-bold text-center mb-12 fade-in">
        My Bookshelf
      </h1>
      
      {books.map((book, i) => (
        <GlassCard 
          key={book.id}
          className="rounded-2xl overflow-hidden fade-in"
          style={{ animationDelay: `${0.2 + i * 0.1}s` }}>
          <div className="p-5 md:p-8">
            <h2 className="text-2xl md:text-3xl font-bold mb-4 text-gray-200">
              {book.title}
            </h2>
            <p className="text-white text-base md:text-lg leading-relaxed"
               dangerouslySetInnerHTML={safeHtml(book.description)} />
          </div>
        </GlassCard>
      ))}
    </div>
  </>
);

export default BooksTab;
```

#### 4\. Register the Route & Dynamic Title

In `src/app/App.jsx`:

1.  Import new `BooksTab` component.
2.  Inside the `AnimatePresence` block, add a new line to render component when its route is active: `{activeTab === 'books' && <BooksTab />}`.
3.  Update the `getActiveTabFromPath` function to recognize the new path: `case '/books': return 'books';`.
4.  Update the `titles` object in the `useEffect` hook to include the title for the new tab: `books: 'Books - Scott Sun'`.

#### 5\. Add to Navigation

In `src/ui-kit/Navigation/Navigation.jsx`, add a new entry to the `tabs` array:

```javascript
{ id: 'books', label: 'My Books', path: '/books' }
```

### Adding "Art in Life" Instagram Posts

The "Art in Life" tab has a unique, streamlined update process:

1.  **Add Embed Code**: Open `src/features/art-in-life/embed.md`.
2.  **Paste New Post**: Paste the full `<blockquote>` embed code for a new Instagram post into this file.
3.  **Run Script**: Execute the helper script from the feature's directory: `python3 parse_embeds.py`.
4.  **Done**: The script will automatically parse the new embed code, extract the URL, and update the `artInLife.data.js` file. The website will pick up the new post and display it in the masonry grid on the next reload.

### Adding Glass Cards to Existing Tabs

To add new content (like a new project or app) to an existing tab:

1.  **Edit the data file**: Open the relevant `*.data.js` file (e.g., `src/features/projects/projects.data.js`).
2.  **Append a new object**: Add a new object to the exported array with the required content.
3.  The tab component will automatically render the new entry in its own `GlassCard`—no changes to the JSX are needed.

### Marking Apps as “No Longer Deployed”

Apps can surface a reusable status stamp beside their title without touching the component markup:

1. Open `src/features/apps/apps.data.js` and locate the app entry you want to flag.
2. Add a `status` field with a `type` and `label`. For example:

```js
{
  id: 'jobguru',
  title: 'Job Guru',
  status: {
    type: 'no-longer-deployed',
    label: 'No Longer Deployed',
  },
  // ...rest of the app metadata
}
```

The `AppsTab` component automatically renders the `StatusStamp` to the right of the title when `status` exists. You can reuse `type: 'no-longer-deployed'` for other entries or extend the styling in `src/features/apps/AppsTab.jsx` by adding new keys to the `statusStyles` map.

-----

## 📝 General Guidelines for Extension

### Quick Reference

| Task | Files to Update |
| :--- | :--- |
| Add a card to an existing tab | Just the `*.data.js` file for that feature. |
| Add a new "Art in Life" post | `src/features/art-in-life/embed.md`, then run `parse_embeds.py`. |
| Add a new tab | Create a feature folder (3 files), then update `App.jsx` (routing logic & title) and `Navigation.jsx`. |
| Add custom styling | The feature's `*.module.css` file for scoped styles, or `tailwind.config.js` for global theme changes. |
| Add media assets | Drop files into `public/static_assets/` and reference them by their path (e.g., `/static_assets/my-image.jpeg`). |

### Best Practices

1.  **Security**: Always wrap HTML content from data files in the `safeHtml()` utility before rendering with `dangerouslySetInnerHTML`.
2.  **Styling**: Use feature-specific CSS modules for styles that only apply to one tab. Avoid duplicating global effects like the glass card styling.
3.  **Imports**: Use absolute `@/` imports for cleaner, more maintainable code.
4.  **Browser Titles**: Remember to add an entry for any new tab to the `titles` object in `App.jsx` to ensure the document title updates correctly.
5.  **UX**: The `GlassCard` handles its own hover and parallax effects automatically. Focus on the content and layout within the card.

### Architecture Benefits

✅ **Isolated Changes**: Each feature is self-contained, so adding or removing one won't break others.

✅ **Clean Version Control**: Content changes (in `.data.js` files) are separate from logic changes (in `.jsx` files), making code reviews easier.

✅ **Consistent Design**: Core visual styles are defined once and reused, preventing style drift.

✅ **Easy Maintenance**: The modular structure makes it simple to find and update code without causing unintended side effects.

✅ **Enhanced UX**: Route-based navigation provides shareable links to specific sections, and dynamic browser titles improve user orientation.
