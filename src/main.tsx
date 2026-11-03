import { StrictMode, Suspense, lazy, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from './app/error-boundary';
import { CityExperience } from './features/city/city-experience';
import { createCityStore } from './application/city-store';
import { browserRepository } from './infrastructure/persistence/browser-repository';
import './app/styles.css';
import { readPalette } from './rendering/palette';
import { readCityConfiguration } from './infrastructure/spacetimedb/configuration';
const LiveApplication = lazy(() =>
  import('./features/city/live-application').then((m) => ({
    default: m.LiveApplication,
  })),
);

document
  .querySelector('meta[name="theme-color"]')
  ?.setAttribute('content', readPalette().background);
function App() {
  const [mode] = useState(() => readCityConfiguration(import.meta.env));
  const [localStore] = useState(() =>
    mode.mode === 'local' ? createCityStore(browserRepository()) : null,
  );
  if (mode.mode === 'live')
    return (
      <Suspense fallback={<p role="status">Connecting to the live city…</p>}>
        <LiveApplication configuration={mode.configuration} />
      </Suspense>
    );
  return <CityExperience store={localStore!} />;
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
