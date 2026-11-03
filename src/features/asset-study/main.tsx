import { createRoot } from 'react-dom/client';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BuildingPreview } from '../city/building-preview';
import { composeBuilding } from '../../rendering/assembly/compose';
import { validateAssembly } from '../../rendering/assembly/model';
import { defaultDraft, draftSchema } from '../../domain/city/model';
import { readPalette } from '../../rendering/palette';
import { SolidView, STUDY_VIEWS } from './solid-views';
import '../../app/styles.css';

const recipeSchema = z.object({
  draft: draftSchema,
  stock: z.number().int().min(0).max(400).default(0),
});
function loadRecipe() {
  const query = new URLSearchParams(location.search);
  const raw = query.get('recipe');
  return recipeSchema.parse(
    raw
      ? JSON.parse(raw)
      : {
          draft: {
            ...defaultDraft,
            height: 78,
            modules: ['furnace', 'scrubber'],
          },
          stock: 0,
        },
  );
}
function Study({ recipe }: { recipe: z.infer<typeof recipeSchema> }) {
  const diagnostics = new URLSearchParams(location.search).has('diagnostics');
  const pieces = new URLSearchParams(location.search).has('pieces');
  const assembly = composeBuilding({
    type: recipe.draft.kind,
    h: recipe.draft.height,
    variant: recipe.draft.seed,
    design: recipe.draft.design,
    modules: recipe.draft.modules,
    stock: recipe.stock,
  });
  const errors = validateAssembly(assembly);
  const grid = assembly.parts.find((p) => p.id === 'grid')!.volume;
  // Keep the baseline camera when a shorter termination lowers the asset bounds.
  const framingTop = (grid.z + 2.7) * 3;
  const p = readPalette();
  const metadata = {
    schemaVersion: 1,
    recipe,
    errors,
    assembly,
    palette: p,
    framingTop,
    views: {
      artwork:
        'Fixed city camera only; animation frozen at clock 0 by reduced motion.',
      solids:
        'Front +Y, right +X, back -Y, left -X, top +Z. Conservative assembly solids; no rear facade artwork. Units are local kit art units.',
    },
  };
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6" data-study-ready="true">
      <header className="space-y-2">
        <h1 className="text-2xl">Single asset study</h1>
        <p className="text-muted-foreground">
          One recipe. Production artwork and spatial inspection. This page never
          loads or saves a city.
        </p>
        <p role="status">
          {errors.length
            ? `Fit failed: ${errors.join('; ')}`
            : 'Fit checked: assembly constraints pass'}
        </p>
      </header>
      <form className="flex items-end gap-3" method="get">
        <div className="grow space-y-2">
          <Label htmlFor="recipe">Asset recipe (JSON)</Label>
          <Input
            id="recipe"
            name="recipe"
            defaultValue={JSON.stringify(recipe)}
          />
        </div>
        <Button type="submit">Load recipe</Button>
        <Label className="flex items-center gap-2 pb-2">
          <input
            type="checkbox"
            name="diagnostics"
            defaultChecked={diagnostics}
          />
          Geometry diagnostics
        </Label>
      </form>
      <section
        className="grid gap-4 md:grid-cols-2"
        aria-label="Production artwork"
      >
        {(['operating', 'idle', 'close', 'city-scale'] as const).map((view) => (
          <figure
            key={view}
            data-capture={view}
            className={`border border-border bg-background p-4 ${view === 'close' ? 'md:col-span-2' : ''}`}
          >
            <figcaption className="mb-2">
              {view} — actual city renderer
            </figcaption>
            <BuildingPreview
              draft={recipe.draft}
              active={view !== 'idle'}
              stock={recipe.stock}
              study={{ focus: 'all', exploded: false }}
              maxZoom={view === 'close' ? 12 : 6}
              framingTop={framingTop}
              className={
                view === 'city-scale'
                  ? 'mx-auto h-28 max-w-40'
                  : view === 'close'
                    ? 'h-[760px]'
                    : 'h-96'
              }
            />
          </figure>
        ))}
      </section>
      {pieces && (
        <section
          className="grid gap-4 md:grid-cols-3"
          aria-label="Individual production pieces"
        >
          {assembly.parts
            .filter(
              (part, index, all) =>
                all.findIndex((p) => p.kind === part.kind) === index,
            )
            .map((part) => (
              <figure
                key={part.id}
                data-capture={`piece-${part.kind}`}
                className="border border-border p-3"
              >
                <figcaption>{part.label}</figcaption>
                <BuildingPreview
                  draft={recipe.draft}
                  active
                  stock={recipe.stock}
                  maxZoom={18}
                  study={{
                    focus: 'all',
                    exploded: false,
                    part: part.id,
                    isolate: true,
                  }}
                  className="h-56"
                />
              </figure>
            ))}
        </section>
      )}
      {diagnostics && (
        <section className="space-y-4" aria-label="Spatial diagnostics">
          <h2 className="text-xl">All sides — assembly solids</h2>
          <p className="text-muted-foreground">
            Spatial diagnostics show support and massing. They omit facade
            detail, pipes and fittings. Rear and side artwork is not implemented
            by these views.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {STUDY_VIEWS.map((view) => (
              <figure
                key={view}
                data-capture={`solid-${view}`}
                className="border border-border p-4"
              >
                <figcaption>{view} — solids only</figcaption>
                <SolidView assembly={assembly} view={view} palette={p} />
              </figure>
            ))}
          </div>
        </section>
      )}
      <details>
        <summary>Recipe, checks and assembly</summary>
        <pre id="study-metadata" className="overflow-auto text-xs">
          {JSON.stringify(metadata, null, 2)}
        </pre>
      </details>
    </main>
  );
}
try {
  const recipe = loadRecipe();
  createRoot(document.getElementById('root')!).render(
    <Study recipe={recipe} />,
  );
} catch (error) {
  const alert = document.createElement('p');
  alert.setAttribute('role', 'alert');
  alert.textContent = `Invalid study recipe: ${String(error)}`;
  document.getElementById('root')!.replaceChildren(alert);
}
