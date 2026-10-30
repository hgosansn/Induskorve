import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import { ErrorBoundary } from '../../app/error-boundary';
import { DailyPlaytest } from './daily-playtest';
import '../../app/styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <DailyPlaytest />
      </MotionConfig>
    </ErrorBoundary>
  </StrictMode>,
);
