import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './lib/install'; // catches the browser's install offer as early as possible
import { startOffline, startUpdates } from './lib/update';
import './styles.css';

startUpdates();
startOffline();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary label="The tool could not start.">
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
