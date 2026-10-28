// A shared lifecycle for city and workshop canvases. Ambient motion runs at 30 Hz;
// interactions can request display-rate frames. Covered/hidden canvases do no work.
export function createCanvasLoop(
  canvas: HTMLCanvasElement,
  draw: (time: number) => void,
  animated: () => boolean,
) {
  let raf = 0,
    disposed = false,
    dirty = true,
    last = -Infinity,
    interactiveUntil = 0;
  let covered = false;
  const allowed = () => !document.hidden && !covered;
  const schedule = () => {
    if (!disposed && !raf && allowed() && (dirty || animated()))
      raf = requestAnimationFrame(tick);
  };
  function tick(time: number) {
    raf = 0;
    if (disposed || !allowed()) return;
    const interval = time < interactiveUntil ? 0 : 1000 / 30;
    if (dirty || time - last >= interval - 0.5) {
      dirty = false;
      last = time;
      draw(time);
    }
    schedule();
  }
  const invalidate = (interactive = false) => {
    dirty = true;
    if (interactive) interactiveUntil = performance.now() + 180;
    schedule();
  };
  const visibility = () => {
    covered = !!canvas.closest('[aria-hidden="true"], [inert]');
    if (!allowed()) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else {
      last = -Infinity;
      invalidate();
    }
  };
  const observer = new MutationObserver(visibility);
  observer.observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-hidden', 'inert'],
    childList: true,
  });
  document.addEventListener('visibilitychange', visibility);
  visibility();
  return {
    invalidate,
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener('visibilitychange', visibility);
    },
  };
}
