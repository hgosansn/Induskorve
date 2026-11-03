// Served only by tools/live-browser.mjs, never referenced by the production entry.
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CityExperience } from '../../src/features/city/city-experience';
import { createLiveCityStore } from '../../src/infrastructure/spacetimedb/live-store';
import '../../src/app/styles.css';

const params = new URLSearchParams(location.search),
  uri = params.get('server')!;
if (!['127.0.0.1', 'localhost'].includes(new URL(uri).hostname))
  throw Error('This test harness is loopback-only.');
function Harness() {
  const [controller] = useState(() =>
    createLiveCityStore({
      uri,
      database: params.get('database')!,
      signedIn: true,
      storage: sessionStorage,
      async signIn() {},
      async signOut() {},
    }),
  );
  useEffect(() => {
    void controller.start();
    return () => controller.dispose();
  }, [controller]);
  return <CityExperience store={controller.store} />;
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
);
