# Complete Website Refactoring: HTML/CSS/JS to Vite React

## Initial Setup and Resources
In your current working directory, you have:
1. **`code_ref.txt`** - Contains the complete original website codebase (HTML, CSS, JavaScript). This is your sole source of truth for the refactoring. Reference this file at all times to ensure accurate migration of functionality, styling, and content.
2. **`static_assets/`** folder - Contains all image and video assets needed for the website:
   - intro.mp4
   - bg.jpeg
   - logo.jpg
   - All other .jpeg images referenced in the original code

The React project must reference these assets using the exact same filenames as in the original website.

## Project Overview
Refactor a single-page website from vanilla HTML/CSS/JavaScript into a maintainable Vite React application. The website has an intro video, animated backgrounds, tab-based navigation, image sliders, and glassmorphism styling. The refactored project must function exactly as the original and **must look identical to the original**. 

**CRITICAL CONTENT REQUIREMENT**: Every single piece of text from the original website MUST be copied exactly as-is. This includes:
- All paragraphs, headings, and descriptions
- All text in glass cards
- All button labels and navigation text
- All meta tags and SEO content
- All alt texts and aria-labels
- Do NOT write any content spontaneously - copy everything verbatim from `code_ref.txt`

Only when using replacement libraries (e.g., React-compatible slider instead of tiny-slider) are minimal visual differences acceptable, and even then they should be extremely close to the original implementation.

## Key Requirements
1. **Preserve all functionality**: intro video sequence, tab switching, sliders, animations, scroll-to-top, background effects
2. **Maintain EXACT visual design**: Every element must look identical to the original - same positioning, sizes, colors, animations, effects. The only acceptable differences are when React-compatible libraries (like slider libraries) make pixel-perfect replication technically impossible.
3. **Copy ALL text content EXACTLY**: Every word, sentence, paragraph from the original must be copied verbatim. No paraphrasing, no improvisation, no creative writing. This includes visible text, meta tags, alt attributes, and any other textual content.
4. **Use all static assets**: Copy all files from the root `static_assets/` folder to `public/static_assets/` in the React project. Reference them with the same filenames as in the original code.
5. **Component-based architecture**: Break down into logical, reusable components
6. **Modern React patterns**: Use hooks, functional components, proper state management

## Target Project Structure
```
my-website/
├── public/
│   └── static_assets/
│       ├── intro.mp4
│       ├── bg.jpeg
│       ├── logo.jpg
│       └── [all other images...]
├── src/
│   ├── components/
│   │   ├── IntroVideo/
│   │   │   ├── IntroVideo.jsx
│   │   │   └── IntroVideo.module.css
│   │   ├── BackgroundEffects/
│   │   │   ├── BackgroundEffects.jsx
│   │   │   └── BackgroundEffects.module.css
│   │   ├── Navigation/
│   │   │   ├── Navigation.jsx
│   │   │   └── Navigation.module.css
│   │   ├── Tabs/
│   │   │   ├── AboutTab/
│   │   │   │   ├── AboutTab.jsx
│   │   │   │   └── AboutTab.module.css
│   │   │   ├── ProjectsTab/
│   │   │   │   ├── ProjectsTab.jsx
│   │   │   │   ├── ProjectCard.jsx
│   │   │   │   └── ProjectsTab.module.css
│   │   │   ├── AppsTab/
│   │   │   │   ├── AppsTab.jsx
│   │   │   │   ├── AppCard.jsx
│   │   │   │   └── AppsTab.module.css
│   │   │   └── InspirationsTab/
│   │   │       ├── InspirationsTab.jsx
│   │   │       ├── InspirationCard.jsx
│   │   │       └── InspirationsTab.module.css
│   │   └── common/
│   │       ├── GlassCard/
│   │       │   ├── GlassCard.jsx
│   │       │   └── GlassCard.module.css
│   │       ├── ImageSlider/
│   │       │   ├── ImageSlider.jsx
│   │       │   └── ImageSlider.module.css
│   │       ├── ScrollToTop/
│   │       │   ├── ScrollToTop.jsx
│   │       │   └── ScrollToTop.module.css
│   │       └── Footer/
│   │           ├── Footer.jsx
│   │           └── Footer.module.css
│   ├── styles/
│   │   ├── globals.css
│   │   ├── animations.css
│   │   ├── variables.css
│   │   ├── browser-fixes.css
│   │   └── utilities.css
│   ├── data/
│   │   ├── projects.js
│   │   ├── apps.js
│   │   └── inspirations.js
│   ├── hooks/
│   │   ├── useLoadingSequence.js
│   │   ├── useMousePosition.js
│   │   ├── useTabTransition.js
│   │   ├── useImagePreloader.js
│   │   └── useScrollVisibility.js
│   ├── utils/
│   │   ├── browserDetection.js
│   │   └── performance.js
│   ├── App.jsx
│   ├── App.css
│   └── main.jsx
├── package.json
├── vite.config.js
├── .eslintrc.js
└── index.html
```

## Implementation Steps

### Step 1: Initialize Vite React Project
```bash
npm create vite@latest my-website -- --template react
cd my-website
npm install
```

After creating the project, copy the static assets:
```bash
# Copy the static_assets folder from root to public directory
cp -r ../static_assets public/
```

Ensure all image and video files are accessible at `public/static_assets/` with their original filenames.

### Step 2: Install Dependencies
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-helmet-async": "^2.0.0",
    "framer-motion": "^11.0.0",
    "embla-carousel-react": "^8.0.0",
    "embla-carousel-autoplay": "^8.0.0",
    "react-youtube": "^10.1.0",
    "react-intersection-observer": "^9.5.0",
    "@fortawesome/react-fontawesome": "^0.2.0",
    "@fortawesome/fontawesome-svg-core": "^6.5.0",
    "@fortawesome/free-solid-svg-icons": "^6.5.0",
    "@fortawesome/free-brands-svg-icons": "^6.5.0",
    "clsx": "^2.1.0"
  }
}
```

### Step 3: Component Implementation Details

**CRITICAL**: Every component must render exactly as its original HTML/CSS/JS counterpart. Copy CSS properties precisely, maintain exact spacing, preserve all visual details from `code_ref.txt`, and **copy all text content character-for-character, including punctuation and emojis**.

#### App.jsx - Main Application Component
```javascript
// State management for:
- activeTab: current visible tab
- introComplete: intro video finished playing
- contentVisible: main content should be shown
- Handle loading sequence coordination
- Render all major components conditionally
```

#### IntroVideo Component
- Use video element with refs for control
- Handle canplaythrough, ended, error events
- 5-second fallback timer
- Smooth fade-out transition
- Trigger contentVisible state in parent

#### Navigation Component
- Map through tabs array
- Active state styling
- Click handlers to change activeTab
- Responsive design (column on mobile)
- Animated underline effect

#### BackgroundEffects Component
- Three div layers: starfield, nebula, grid
- CSS animations preserved from original
- Mouse position tracking for parallax
- Performance optimized with will-change

#### Tab Components Structure
Each tab should:
- Use framer-motion for enter/exit animations
- Lazy load for performance
- Map through data arrays for repeated content
- Use common GlassCard component
- **Copy all text content EXACTLY from the original HTML**, including:
  - The philosophical statements in About tab
  - All project descriptions with their exact wording
  - App descriptions and taglines verbatim
  - Inspiration quotes and biographical text
  - Social media handles and links

#### ImageSlider Component (replacing tiny-slider)
- Use embla-carousel-react
- Autoplay with 5000ms delay
- Fade transitions between slides
- Navigation dots and arrows
- YouTube video pause/play integration

#### GlassCard Component
- Glassmorphism styling with backdrop-filter
- Mouse hover effects
- Light beam animation
- Consistent border radius and shadows

### Step 4: Data Migration
Move all content to data files by copying EXACTLY from `code_ref.txt`:

```javascript
// data/projects.js
export const projects = [
  {
    id: 'programming-start',
    title: 'Picked Up Programming Before the ChatGPT Moment', // COPY EXACTLY
    date: 'Mar. 2022', // COPY EXACTLY
    description: 'First stepping into a new field...', // COPY FULL TEXT EXACTLY
    images: ['alien_invasion.jpeg', 'bookshare.jpeg'],
    videos: []
  },
  // ... more projects - COPY ALL TEXT VERBATIM
];

// Example of EXACT copying:
// If the original says: "From the infinite potential of energy to the total actualization of entropy, intelligence charts a course for the pursuit of meaning, mission and love."
// You MUST copy it exactly as above, including the specific words, punctuation, and formatting

// data/apps.js
export const apps = [
  {
    id: 'learntube',
    title: 'LearnTube', // EXACT title from original
    tagline: 'Video to insights in seconds.', // EXACT tagline
    description: 'Unlock the full potential...', // COPY FULL DESCRIPTION
    images: ['learntube1.jpeg', 'learntube2.jpeg', ...],
    link: 'https://learntube.scottsun.io'
  },
  // ... more apps - ALL TEXT MUST BE COPIED EXACTLY
];
```

**IMPORTANT**: Do not summarize, paraphrase, or shorten any text. Copy every word exactly as it appears in the original HTML.

### Step 5: Hooks Implementation

#### useLoadingSequence.js
```javascript
// Manage complex loading states:
- videoLoaded, videoEnded, scriptsLoaded, slidersReady
- Coordinate initialization timing
- Return loading status and trigger functions
```

#### useMousePosition.js
```javascript
// Track mouse position for background effects
- Throttled updates
- CSS custom property updates
- Performance optimized
```

#### useImagePreloader.js
```javascript
// Preload images before slider initialization
- Track loading progress
- Handle errors gracefully
- Return loading state
```

### Step 6: CSS Architecture

#### globals.css
- Copy ALL styles from original CSS that apply globally
- Body styles, background setup
- Font imports
- Base resets
- Scrollbar styling

#### variables.css
```css
/* Copy EXACTLY from original CSS */
:root {
  --primary-bg: #0a0e17;
  --card-bg: #131c2e;
  --text-primary: #f8fafc;
  --text-secondary: #e2e8f0;
  --button-bg: #6366f1;
  --button-hover: #4f46e5;
  --accent-glow: rgba(99, 102, 241, 0.5);
  --electric-blue: #00e5ff;
  --neon-purple: #8b5cf6;
  --deep-space: #030711;
}
```

#### animations.css
- Copy ALL keyframe animations from original EXACTLY
- Starfield, nebula, grid pulse
- Fade in/out, shine, glow effects
- Button float, scan lines
- Preserve all timing functions and durations

### Step 7: Critical Implementation Notes

1. **SEO Management**: Use react-helmet-async to replicate ALL meta tags from the original HTML head section EXACTLY:
   - Copy all meta descriptions, keywords, author information
   - Copy all Open Graph tags verbatim
   - Copy all Twitter Card meta tags
   - Copy the exact title tag content
   - Preserve all other SEO-related tags

2. **Font Loading**: Add Google Fonts link in index.html (copy exact fonts from original)
3. **Accessibility**: Preserve all focus states, ARIA labels, and alt texts EXACTLY as in original
4. **Performance**: 
   - Lazy load tabs with React.lazy()
   - Use React.memo for static components
   - Implement intersection observer for animations
5. **Browser Fixes**: Detect iOS Safari for specific CSS fixes
6. **Error Boundaries**: Wrap major components for graceful failures

### Step 8: Animation Conversions

Replace GSAP with framer-motion:
```javascript
// Tab transition example
<AnimatePresence mode="wait">
  {activeTab === 'about' && (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
    >
      <AboutTab />
    </motion.div>
  )}
</AnimatePresence>
```

### Step 9: Vite Configuration
```javascript
// vite.config.js
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom'],
          'animations': ['framer-motion'],
          'carousel': ['embla-carousel-react'],
        }
      }
    }
  },
  server: {
    port: 3000
  }
}
```

### Step 10: Testing Checklist
- [ ] **Visual fidelity**: Side-by-side comparison shows identical appearance
- [ ] **Content accuracy**: Every piece of text matches the original exactly (use diff tool if needed)
- [ ] **SEO tags**: All meta tags are present and match original exactly
- [ ] Intro video plays and transitions correctly
- [ ] All tabs switch smoothly with animations
- [ ] Sliders work with autoplay and manual navigation (appearance extremely close to original)
- [ ] YouTube videos pause sliders when playing
- [ ] Background effects animate identically to original
- [ ] Responsive design matches original exactly
- [ ] All images load from public/static_assets/
- [ ] Scroll to top button appears/hides correctly
- [ ] Footer link works
- [ ] All hover effects function identically
- [ ] All animations match original timing and easing
- [ ] Colors, gradients, shadows match exactly
- [ ] Font sizes, weights, spacing match exactly
- [ ] All alt texts and aria-labels are preserved
- [ ] Performance is acceptable (Lighthouse score)
- [ ] No console errors
- [ ] Works on iOS Safari

## Special Considerations

1. **Visual Fidelity**: This is a visual clone project. Every pixel matters. Constantly compare your React output with the original to ensure identical appearance.

2. **Textual Accuracy**: This is also a content clone project. Every word matters. Copy ALL text exactly:
   - Do not paraphrase or summarize
   - Do not fix typos or grammar (copy as-is)
   - Do not add or remove punctuation
   - Include every emoji, icon reference, and special character
   - Copy all hidden text (meta tags, alt attributes, aria-labels)

3. **Loading Sequence**: The original has sophisticated loading where sliders only initialize after video ends AND scripts load. Implement this with proper state management.

4. **YouTube Integration**: Videos in sliders must pause the slider when playing. Use react-youtube's onStateChange event.

5. **Mouse Tracking**: Background effects respond to mouse movement. Implement with throttled event handlers updating CSS variables.

6. **iOS Safari Fixes**: Background-attachment: fixed doesn't work. Use position: absolute fallback.

7. **Tab Memory**: Original doesn't persist tab state. Keep this behavior.

8. **Highlight Effects**: The .highlight-glow class has complex animations. Preserve all keyframes exactly.

## Final Notes
- **Always reference `code_ref.txt`** for the exact implementation details, CSS properties, JavaScript logic, AND all text content
- **NEVER write content spontaneously** - copy every piece of text from the original, including:
  - All visible text in paragraphs, headings, lists
  - All meta tag content for SEO
  - All button and link text
  - All alt attributes and aria-labels
  - Even placeholder text if any
- **The React project MUST look identical to the original** - preserve all visual elements exactly
- Keep ALL original CSS animations and effects
- Maintain exact color scheme and gradients
- Test thoroughly on multiple browsers
- Ensure build output is optimized

The goal is a 1:1 visual and content match. Any visual differences should only exist where technical limitations of React libraries make exact replication impossible, and even then, differences should be minimal. NO textual differences are acceptable - every word must be copied exactly.