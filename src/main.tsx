import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from '@/app/App';

// Add @axe-core/react for accessibility testing in development
if (import.meta.env.DEV) {
  import('react').then((React) => {
    import('react-dom').then((ReactDOM) => {
      import('@axe-core/react').then((axe) => {
        axe.default(React, ReactDOM, 1000);
      });
    });
  });
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>
);
