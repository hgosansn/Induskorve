import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/button';
import {
  extractionCell,
  reusableParts,
  loadReusablePart,
  paintReusablePart,
  type PartPlacement,
} from '../../rendering/assets/reusable-parts';
import { readPalette } from '../../rendering/palette';
import { createGeometry } from '../../rendering/canvas/geometry';

function Assembly({ close }: { close: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    const edge = close ? 512 : 256;
    void Promise.all(reusableParts.map((part) => loadReusablePart(part, edge)))
      .then((images) => {
        if (!live || !ref.current) return;
        const canvas = ref.current;
        const ctx = canvas.getContext('2d')!;
        const p = readPalette();
        ctx.resetTransform();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = p.background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.translate(close ? 350 : 400, close ? 370 : 270);
        ctx.scale(close ? 24 : 8, close ? 24 : 8);
        const g = createGeometry(ctx, p);
        g.box(-0.5 / 12, -0.6 / 12, 5 / 12, 4 / 12, -0.12, 0.12, g.dark);
        // The wall louver is reviewed separately until a host is defined.
        const placements: PartPlacement[] = [...extractionCell];
        placements.sort((a, b) => {
          if (a.id === 'service-cabinet') return 1;
          if (b.id === 'service-cabinet') return -1;
          const depth = (v: PartPlacement) => {
            const part = reusableParts.find((p) => p.id === v.id)!;
            return (
              v.position[0] +
              v.position[1] +
              (part.bounds.max[0]! + part.bounds.max[1]!) / 2
            );
          };
          return depth(a) - depth(b);
        });
        for (const placement of placements) {
          const index = reusableParts.findIndex((p) => p.id === placement.id);
          paintReusablePart(
            ctx,
            reusableParts[index]!,
            images[index]!,
            placement.position,
            edge,
          );
        }
        canvas.dataset.rendered = 'true';
      })
      .catch((e: unknown) => setError(String(e)));
    return () => {
      live = false;
    };
  }, [close]);
  return (
    <>
      <canvas
        ref={ref}
        width={900}
        height={650}
        className="w-full border border-border"
        aria-label="Reusable extraction service cell"
      />
      {error && <p role="alert">{error}</p>}
    </>
  );
}

export function ReusablePartsStudy() {
  const [close, setClose] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [images, setImages] = useState<HTMLImageElement[]>([]);
  useEffect(() => {
    let live = true;
    void Promise.all(reusableParts.map((p) => loadReusablePart(p)))
      .then((loaded) => {
        if (live) {
          setImages(loaded);
          setReady(true);
        }
      })
      .catch((e: unknown) => setError(String(e)));
    return () => {
      live = false;
    };
  }, []);
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6" data-parts-ready={ready}>
      <h2 className="text-2xl">Reusable service kit</h2>
      <p>
        Compatible flanged ducts, grounded supports and service hardware. This
        assembly study does not change the city.
      </p>
      <p>
        Assembly study: inlet → long duct → short duct → rising elbow →
        reducer/discharge. Two grounded saddles; cabinet on braced equipment
        frame. Wall louver requires its own host surface.
      </p>
      <Button variant="outline" onClick={() => setClose(!close)}>
        {close ? 'Normal assembly view' : 'Closer view'}
      </Button>
      <Assembly close={close} />
      {error && <p role="alert">{error}</p>}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4" data-contact-sheet>
        {reusableParts.map((part, index) => (
          <article key={part.id} className="space-y-2 border border-border p-4">
            <h2>{part.label}</h2>
            {images[index] && (
              <img
                src={images[index].src}
                className="h-44 w-full object-contain"
                alt={part.label}
              />
            )}
            <p className="text-sm text-muted-foreground">
              {(part.variants[256].bytes / 1000).toFixed(1)} KB · {part.mount}
            </p>
          </article>
        ))}
      </div>
    </main>
  );
}
