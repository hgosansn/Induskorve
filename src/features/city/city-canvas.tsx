import { useEffect, useRef } from 'react';
import type { CityStore } from '../../application/city-store';
import { createCityScene, type CityScene } from '../../rendering/canvas/scene';
import { toast } from 'sonner';

export function CityCanvas({
  store,
  onReady,
}: {
  store: CityStore;
  onReady(scene: CityScene | null): void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvas.current) return;
    const scene = createCityScene(canvas.current, store.getState(), {
      select: (id) => store.getState().select(id),
      cancel: () => store.getState().cancel(),
      place: (p) => {
        try {
          store.getState().place(p);
          toast.success('Built · nearby services connect automatically');
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : 'Construction failed.',
          );
        }
      },
    });
    const unsubscribe = store.subscribe((state) => scene.update(state));
    onReady(scene);
    return () => {
      unsubscribe();
      scene.dispose();
      onReady(null);
    };
  }, [store, onReady]);
  return (
    <canvas
      ref={canvas}
      className="absolute inset-0 block h-full w-full touch-none"
      aria-label="Isometric industrial city. Drag to pan, scroll to zoom. Use the controls to join and build."
    />
  );
}
