import type { DbConnection } from './module-bindings';
import {
  buildingKindSchema,
  moduleSchema,
  type WorldSnapshot,
  type Building,
  type BuildingAppearance,
} from '../../domain/city/model';
import { projectIdSchema } from '../../domain/city/technology';
import { CONTENT_VERSION } from '../../../shared/city/ids';

export function collectLiveRows(c: DbConnection) {
  return {
    world: [...c.db.world.iter()][0],
    buildings: [...c.db.building.iter()],
    appearances: [...c.db.buildingAppearance.iter()],
    modules: [...c.db.buildingModule.iter()],
    citizens: [...c.db.citizen.iter()],
    stock: [...c.db.warehouseStockpile.iter()],
    projects: [...c.db.cityProject.iter()],
    contributions: [...c.db.projectContribution.iter()],
    unlocks: [...c.db.technologyUnlock.iter()],
    events: [...c.db.worldEvent.iter()],
    presence: [...c.db.presence.iter()],
    assets: [...c.db.billboardAsset.iter()],
    receipts: [...c.db.myReceipts.iter()],
    cursor: [...c.db.myCursor.iter()][0],
    playerState: [...c.db.myPlayerState.iter()][0],
  };
}
export type LiveRows = ReturnType<typeof collectLiveRows>;
export function boundedNumber(
  value: bigint,
  label: string,
  max = Number.MAX_SAFE_INTEGER,
) {
  if (value < 0n || value > BigInt(max))
    throw Error(`${label} is outside this client’s supported display range.`);
  return Number(value);
}
/** Explicit reversible renderer handles, never Number(liveId). Never sent or persisted. */
export class RendererIds {
  private forward = new Map<bigint, number>();
  private reverse = new Map<number, bigint>();
  get(id: bigint) {
    let value = this.forward.get(id);
    if (value === undefined) {
      value = this.forward.size;
      this.forward.set(id, value);
      this.reverse.set(value, id);
    }
    return value;
  }
  live(id: number) {
    const value = this.reverse.get(id);
    if (value === undefined) throw Error('Unknown structure handle.');
    return value;
  }
}
export class LiveReadModel {
  readonly ids = new RendererIds();
  private eventIds = new RendererIds();
  private cache = new Map<
    bigint,
    { key: string; building: Building; appearance: BuildingAppearance }
  >();
  private previous: WorldSnapshot | null = null;
  private projectionKey = '';
  project(rows: LiveRows): WorldSnapshot {
    const w = rows.world;
    if (!w || w.schemaVersion !== 1 || w.contentVersion !== CONTENT_VERSION)
      throw Error('This city requires a compatible client version.');
    const projectionKey = JSON.stringify([
      w.revision.toString(),
      rows.citizens.map((c) => [
        c.identity.toHexString(),
        c.revision.toString(),
      ]),
      rows.assets.map((a) => [a.id.toString(), a.url]),
    ]);
    if (this.previous && this.projectionKey === projectionKey)
      return this.previous;
    const profiles = new Map(
      rows.citizens.map((c) => [c.identity.toHexString(), c]),
    );
    const buildings: Building[] = [],
      appearances: BuildingAppearance[] = [];
    for (const b of [...rows.buildings].sort((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
    )) {
      const type = buildingKindSchema.parse(b.kind),
        a = rows.appearances.find((a) => a.buildingId === b.id);
      if (!a) throw Error('City appearance data is incomplete.');
      const modules = rows.modules
        .filter((m) => m.buildingId === b.id)
        .map((m) => moduleSchema.parse(m.kind))
        .sort();
      const creatorId = b.creator?.toHexString(),
        creator = creatorId ? profiles.get(creatorId)?.name : undefined;
      const asset =
        a.billboardAssetId === undefined
          ? undefined
          : rows.assets.find((v) => v.id === a.billboardAssetId)?.url;
      const key = [
        b.revision,
        a.revision,
        modules.join(','),
        creator ?? '',
        asset ?? '',
      ].join('|');
      let cached = this.cache.get(b.id);
      if (!cached || cached.key !== key) {
        const id = this.ids.get(b.id);
        cached = {
          key,
          building: {
            id,
            x: b.x,
            y: b.y,
            type,
            on: b.enabled,
            modules,
            creatorId,
            creator,
          },
          appearance: {
            buildingId: id,
            height: a.height,
            seed: a.seed,
            billboard: asset,
            design: {
              shape: a.shape as 'block' | 'stepped' | 'tower',
              stacks: false,
              balcony: a.balcony,
              display: a.display as 'animated' | 'none',
            },
          },
        };
        this.cache.set(b.id, cached);
      }
      buildings.push(cached.building);
      appearances.push(cached.appearance);
    }
    const citizens = rows.citizens.map((c) => {
      const id = c.identity.toHexString(),
        joinedAt = boundedNumber(
          c.createdAt.microsSinceUnixEpoch / 1000n,
          'Join time',
        );
      const old = this.previous?.citizens.find((v) => v.id === id);
      return old?.name === c.name && old.joinedAt === joinedAt
        ? old
        : { id, name: c.name, joinedAt };
    });
    const sortedEvents = [...rows.events].sort((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
    );
    const events = sortedEvents
      .filter((e) => e.actor !== undefined)
      .slice(-120)
      .map((e) => ({
        id: this.eventIds.get(e.id),
        cycle: boundedNumber(e.worldRevision, 'Event revision'),
        actorId: e.actor!.toHexString(),
        actor:
          e.actorName ??
          profiles.get(e.actor!.toHexString())?.name ??
          'Citizen',
        summary: e.summary,
        buildingId:
          e.buildingId === undefined ? undefined : this.ids.get(e.buildingId),
      }));
    const next: WorldSnapshot = {
      version: 3,
      buildings,
      appearances,
      citizens,
      economy: {
        cycle: boundedNumber(w.tick, 'World tick'),
        shippedMetal: boundedNumber(w.shippedMetal, 'Dispatched metal'),
        stockpiles: rows.stock.map((s) => ({
          buildingId: this.ids.get(s.buildingId),
          metal: boundedNumber(s.metal, 'Stored metal', 400),
        })),
      },
      progression: {
        version: 1,
        projects: rows.projects.map((p) => ({
          id: projectIdSchema.parse(p.id),
          delivered: boundedNumber(p.deliveredAmount, 'Project deliveries'),
          contributors: rows.contributions
            .filter((v) => v.projectId === p.id)
            .map((v) => ({
              citizenId: v.actor.toHexString(),
              amount: boundedNumber(v.amount, 'Contribution'),
            })),
        })),
        events,
      },
    };
    const reuse = <T>(a: T[], b: T[] | undefined) =>
      b && a.length === b.length && a.every((v, i) => v === b[i]) ? b : a;
    next.buildings = reuse(buildings, this.previous?.buildings);
    next.appearances = reuse(appearances, this.previous?.appearances);
    next.citizens = reuse(citizens, this.previous?.citizens);
    this.projectionKey = projectionKey;
    this.previous = next;
    return next;
  }
}
