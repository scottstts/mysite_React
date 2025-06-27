# My Website React Project Technical Guide

## 📋 Project Structure and How It All Comes Together

This project is organized for easy navigation, high modularity, and straightforward extension. 

### Directory Overview

- **`public/static_assets/`** - All static media (images, video covers, UI references)
  - Simply link to these from React code—no manual build steps needed
- **`src/`** - All application logic and UI code
  - **`main.jsx`** - Entry point that bootstraps the app, applies global CSS, and mounts the main App component with React Router and SEO support via Helmet
  - **`app/`** - Contains `App.jsx` and its CSS
    - The only top-level stateful component
    - Handles routing and global app effects (intro video, parallax, conditional rendering)
    - Defines React Router routes for all main tabs: `/about`, `/projects`, `/apps`, `/inspirations`, etc.
  - **`features/`** - Self-contained feature folders for each tab
  - **`ui-kit/`** - Reusable UI widgets
  - **`styles/`** - Design tokens and global styling
  - **`lib/`** - Utility libraries

### Key Architecture Decisions

#### Feature-Based Organization
All primary user-facing content is separated into self-contained feature folders inside `src/features`. Each tab (like "about", "projects", "apps", "inspirations") follows this structure:

```
src/features/[feature-name]/
├── [FeatureName]Tab.jsx      # Main tab component
├── [FeatureName]Tab.module.css # Scoped styles
└── [featureName].data.js      # Content as plain data
```

This separation keeps presentation and logic clean—you never need to modify JSX just to update content.

#### Shared UI Components
The `src/ui-kit` directory contains:
- Navigation bar
- Intro video
- Background effects
- Image sliders
- Glass card component (central to the glassmorphism UI)
- Hooks folder for shared utilities (e.g., mouse parallax)

The `GlassCard` component handles all dynamic mouse and highlight logic, leaving only presentation and content to be managed by feature components.

#### Styling Architecture
- Design tokens and global styling are in `src/styles`
- Loaded once from the top-level App
- Feature-specific CSS modules never duplicate or override core effects
- Every tab gets the same glass look and responsive polish

#### Security & Best Practices
- Custom utility `src/lib/safeHtml.js` sanitizes all user-authored rich text before rendering
- Absolute imports using `@/` prefix (configured in Vite) eliminate ugly relative paths

### Additional Project Files
- **`original_website_codebase.txt`** - Frozen reference of the original static site
- **`refactor_docs/`** - Explain the rationale and structure behind this refactor

## 🚀 How to Add Tabs, Cards, or New Content

The project uses standardized patterns for effortless expansion.

### Adding a New Tab

#### 1. Create the Feature Structure
Create a new folder under `src/features` (e.g., `src/features/books`) with three files:
- `BooksTab.jsx`
- `BooksTab.module.css`
- `books.data.js`

#### 2. Build Your Data File
Create an exported array of objects with at least:
- `id`
- `title`
- `description`
- Plus any media, dates, or links you need

#### 3. Create the Tab Component
Follow this pattern in your `BooksTab.jsx`:

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
      <meta name="description" content="..." />
    </Helmet>
    
    <div className="books-tab space-y-8">
      <h1 className="page-title text-4xl md:text-5xl font-bold text-center mb-12 fade-in">
        My Bookshelf
      </h1>
      
      {books.map((bk, i) => (
        <GlassCard 
          key={bk.id}
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
  </>
);

export default BooksTab;
```

#### 4. Register the Route
In `src/app/App.jsx`:
1. Import your new tab component
2. Add a new route inside the `<Routes>` section:
   ```jsx
   <Route path="/books" element={<BooksTab />} />
   ```

#### 5. Add to Navigation
In `Navigation.jsx`, add an entry to the `tabs` array:
```javascript
{ id: 'books', label: 'My Books', path: '/books' }
```

#### 6. Add Media Assets
Drop any images or video covers into `public/static_assets/` and reference them by filename in your data array.

### Adding Glass Cards to Existing Tabs

To add new cards to any tab:

1. **Edit the data file** - Simply append new objects to the feature's `*.data.js` file
2. **Automatic rendering** - Each new object will be picked up by the tab's `map` function and rendered in its own glass card
3. **No JSX changes needed** - Just update the data!

### Customizing Cards

The `GlassCard` component handles all highlight, parallax, and mouse tracking logic automatically. You can customize:
- **Animation delay**: Use `style={{ animationDelay: '...' }}`
- **Styling**: Add classes via the `className` prop
- **Layout**: Wrap content however you need inside the card

## 📝 General Guidelines for Extension

### Quick Reference

| Task | Files to Update |
|------|----------------|
| Add a card to existing tab | Just the `*.data.js` file |
| Add a new tab | Create feature folder (3 files) + update `App.jsx` + update `Navigation.jsx` |
| Add custom styling | Feature's `*.module.css` file |
| Add media assets | Drop in `public/static_assets/` |

### Best Practices

1. **Security**: Always pipe rich text through `safeHtml` when using `dangerouslySetInnerHTML`
2. **Media**: Reference files from `public/static_assets` by name
3. **Styling**: 
   - Use feature CSS modules for tab-specific styles
   - Don't duplicate glassmorphism or global styles (they're centrally defined)
4. **Imports**: Use absolute imports (`@/...`) for cleaner code
5. **Animation**: Handle custom animations inline or in the feature's CSS module

### Architecture Benefits

✅ **Isolated changes** - Each feature is self-contained  
✅ **Clean version control** - Diffs stay focused  
✅ **Consistent design** - Core visual style is single-source  
✅ **Easy maintenance** - Delete or modify features without side effects  
✅ **No duplication** - Glass cards and global styles stay DRY  

This system ensures your site remains maintainable, extensible, and visually consistent as it grows.