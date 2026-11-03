import { BUILDINGS, MODULES } from './catalog';
import { buildingKindSchema, moduleSchema } from './model';
import { EXCHANGES, RESOURCES } from './exchanges';
import { PROJECTS, TECHNOLOGIES, type TechnologyId } from './technology';

/** Run in verification whenever extending the static content catalog. */
export function validateContentDefinitions(): void {
  for (const id of buildingKindSchema.options) {
    const b = BUILDINGS[id];
    if (
      b.version < 1 ||
      b.footprint.width < 1 ||
      b.footprint.depth < 1 ||
      new Set(b.ports.map((p) => p.id)).size !== b.ports.length
    )
      throw Error(`Invalid building definition: ${id}`);
    for (const p of b.ports) {
      if (
        !(p.exchange in EXCHANGES) ||
        ('resource' in p && !(p.resource in RESOURCES))
      )
        throw Error(`Invalid exchange port: ${id}/${p.id}`);
    }
  }
  for (const id of moduleSchema.options)
    if (!BUILDINGS[MODULES[id].kind])
      throw Error(`Invalid module target: ${id}`);
  const visited = new Set<TechnologyId>(),
    visiting = new Set<TechnologyId>();
  const visit = (id: TechnologyId) => {
    if (visiting.has(id)) throw Error(`Technology prerequisite cycle: ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const prerequisite of TECHNOLOGIES[id].prerequisites)
      visit(prerequisite);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of Object.keys(TECHNOLOGIES) as TechnologyId[]) visit(id);
  for (const p of Object.values(PROJECTS)) {
    if (
      !Number.isSafeInteger(p.cost) ||
      p.cost <= 0 ||
      !(p.resource in RESOURCES) ||
      !(p.unlock in TECHNOLOGIES)
    )
      throw Error(`Invalid project: ${p.label}`);
    for (const prerequisite of TECHNOLOGIES[p.unlock].prerequisites)
      if (!(p.prerequisites as readonly TechnologyId[]).includes(prerequisite))
        throw Error(`Project omits a prerequisite: ${p.label}`);
  }
}
