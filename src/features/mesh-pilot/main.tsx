import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { BakedView, MeshView, type MeshScene } from './mesh-view';
import { ContextView } from './context-view';
import '../../app/styles.css';

interface Sheet {
  id: string;
  reference: string;
  legacy: string;
  candidates: {
    label: string;
    assetId: string;
    baseUrl: string;
    machinePassed: boolean;
    decision?: { promoted: boolean; reasons: string[] } | null;
  }[];
}
function Candidate({ candidate }: { candidate: Sheet['candidates'][number] }) {
  const [scene, setScene] = useState<MeshScene>(),
    [error, setError] = useState(''),
    [angle, setAngle] = useState(0),
    [loadMesh, setLoadMesh] = useState(false);
  useEffect(() => {
    if (!loadMesh) return;
    let live = true;
    fetch(`${candidate.baseUrl}/scene.json`)
      .then((r) => {
        if (!r.ok) throw Error('Mesh data unavailable');
        return r.json();
      })
      .then((value) => {
        if (live) setScene(value);
      })
      .catch((e) => {
        if (live) setError(String(e));
      });
    return () => {
      live = false;
    };
  }, [candidate.baseUrl, loadMesh]);
  const size = candidate.assetId === 'electrical-termination' ? 64 : 96;
  return (
    <article
      data-candidate={candidate.label}
      className="space-y-4 border border-border bg-background p-5"
    >
      <h2 className="text-xl">
        {candidate.label} · {candidate.assetId}
      </h2>
      <p className="text-sm text-muted-foreground">
        {candidate.machinePassed
          ? candidate.decision
            ? 'Geometry/file checks pass; review completed.'
            : 'Geometry/file checks pass; visual acceptance pending.'
          : 'Machine checks failed; acceptance blocked.'}
      </p>
      {candidate.decision && (
        <p className="text-sm">
          {candidate.decision.promoted
            ? 'Accepted for experimental library'
            : 'Incumbent retained'}
          : {candidate.decision.reasons.join('; ')}
        </p>
      )}
      <div
        data-capture={`${candidate.label}-normal`}
        className="grid min-h-40 place-items-center bg-background p-3"
      >
        <BakedView src={`${candidate.baseUrl}/beauty.png`} pixelWidth={size} />
        <p className="text-xs text-muted-foreground">{size}px normal review</p>
      </div>
      <div
        data-capture={`${candidate.label}-close`}
        className="grid min-h-96 place-items-center bg-background p-3"
      >
        <BakedView
          src={`${candidate.baseUrl}/beauty.png`}
          pixelWidth={size * 4}
        />
        <p className="text-xs text-muted-foreground">4× close review</p>
      </div>
      <div
        data-capture={`${candidate.label}-idle`}
        className="grid min-h-40 place-items-center bg-background p-3"
      >
        <BakedView src={`${candidate.baseUrl}/idle.png`} pixelWidth={size} />
        <p className="text-xs text-muted-foreground">Idle</p>
      </div>
      {!loadMesh && (
        <Button variant="outline" onClick={() => setLoadMesh(true)}>
          Load mesh and city context
        </Button>
      )}
      {loadMesh && !scene && !error && <p role="status">Loading mesh…</p>}
      {error && <p role="alert">{error}</p>}
      {scene && (
        <>
          <div data-capture={`${candidate.label}-context`}>
            <ContextView scene={scene} />
            <p className="text-xs text-muted-foreground">
              Actual city renderer with retained-mesh replacement. Electrical
              units retain kit scale; the furnace assembly is uniformly fitted
              to the current machinery bay. This is an isolated fit study.
            </p>
          </div>
          <div data-capture={`${candidate.label}-context-idle`}>
            <ContextView scene={scene} active={false} />
            <p className="text-xs text-muted-foreground">
              Idle context · module permutations remain pending.
            </p>
          </div>
          {candidate.assetId === 'electrical-termination' && (
            <div data-capture={`${candidate.label}-modules-off`}>
              <ContextView scene={scene} modulesOff />
              <p className="text-xs text-muted-foreground">
                Optional foundry modules off: the electrical termination is a
                permanent service component.
              </p>
            </div>
          )}
        </>
      )}
      <details>
        <summary>Inspect actual indexed mesh</summary>
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setAngle(0)}>
              City camera
            </Button>
            <Button variant="outline" onClick={() => setAngle(angle + 45)}>
              Rotate inspection
            </Button>
          </div>
          {error && <p role="alert">{error}</p>}
          {scene && <MeshView scene={scene} angle={angle} />}
          <p className="text-xs text-muted-foreground">
            Depth-tested triangles from the export. Inspector shading differs
            from the baked beauty; it is a geometry check.
          </p>
        </div>
      </details>
    </article>
  );
}
function App() {
  const run =
    new URLSearchParams(location.search).get('run') ?? '2026-10-30-pilot-01';
  const [sheet, setSheet] = useState<Sheet>(),
    [error, setError] = useState('');
  useEffect(() => {
    if (!/^[\w-]{1,80}$/.test(run)) return;
    let live = true;
    fetch(`/asset-studies/mesh-pilot/runs/${run}/review-sheet.json`)
      .then((r) => {
        if (!r.ok) throw Error('Run review sheet unavailable');
        return r.json();
      })
      .then((value) => {
        if (live) setSheet(value);
      })
      .catch((e) => {
        if (live) setError(String(e));
      });
    return () => {
      live = false;
    };
  }, [run]);
  return (
    <main
      className="mx-auto max-w-7xl space-y-6 p-6"
      data-pilot-ready={sheet ? 'true' : 'false'}
    >
      <h1 className="text-2xl">Mesh pilot · {run}</h1>
      <p className="text-muted-foreground">
        Anonymous candidates. Real editable meshes, fixed camera, common
        lighting. Local review tool; no city state is loaded or saved.
      </p>
      {error && <p role="alert">{error}</p>}
      {sheet && (
        <>
          <details>
            <summary>Frozen reference and legacy incumbent</summary>
            <div className="grid gap-4 md:grid-cols-2">
              <img
                src={sheet.reference}
                alt="Frozen industrial detail reference"
              />
              <img src={sheet.legacy} alt="Legacy Canvas foundry incumbent" />
            </div>
          </details>
          <div className="grid items-start gap-6 md:grid-cols-2">
            {sheet.candidates.map((c) => (
              <Candidate key={c.label} candidate={c} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
