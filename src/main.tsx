import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from './app/error-boundary';
import { CityExperience } from './features/city/city-experience';
import { createCityStore } from './application/city-store';
import { browserRepository } from './infrastructure/persistence/browser-repository';
import './app/styles.css';

const store = createCityStore(browserRepository());
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <CityExperience store={store} />
    </ErrorBoundary>
  </StrictMode>,
);
