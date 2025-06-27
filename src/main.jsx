import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import './index.css';
import './styles/glassCardEffect.css';
import App from '@/app/App.jsx';

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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </HelmetProvider>
  </StrictMode>
);
