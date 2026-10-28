import { z } from 'zod';
import type {
  CityRepository,
  LoadResult,
} from '../../application/city-repository';
import {
  appearanceSchema,
  buildingSchema,
  citizenSchema,
  worldSchema,
  type WorldSnapshot,
} from '../../domain/city/model';

export const SAVE_KEY = 'induskorve:city:v3';
export const LEGACY_KEY = 'onecity-v2';
const legacySchema = z.object({
  buildings: z
    .array(
      buildingSchema.omit({ creatorId: true }).extend({
        h: appearanceSchema.shape.height,
        variant: appearanceSchema.shape.seed,
        adImage: appearanceSchema.shape.billboard,
      }),
    )
    .max(2500),
  citizens: z.array(citizenSchema).max(100).default([]),
});
export function migrateLegacy(raw: unknown): WorldSnapshot {
  const legacy = legacySchema.parse(raw);
  return worldSchema.parse({
    version: 3,
    buildings: legacy.buildings.map((b) => ({
      id: b.id,
      x: b.x,
      y: b.y,
      type: b.type,
      on: b.on,
      creator: b.creator,
    })),
    appearances: legacy.buildings.map((b) => ({
      buildingId: b.id,
      height: b.h,
      seed: b.variant,
      billboard: b.adImage,
    })),
    citizens: legacy.citizens,
  });
}
export class LocalCityRepository implements CityRepository {
  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'>) {}
  load(): LoadResult {
    try {
      const current = this.storage.getItem(SAVE_KEY);
      if (current !== null)
        return { world: worldSchema.parse(JSON.parse(current)) };
      const legacy = this.storage.getItem(LEGACY_KEY);
      return {
        world: legacy === null ? null : migrateLegacy(JSON.parse(legacy)),
      };
    } catch {
      // Never replace a corrupt/unsupported save with the founding world.
      return {
        world: null,
        readOnly: true,
        warning:
          'Saved city could not be loaded. Original data preserved; this visit is temporary.',
      };
    }
  }
  save(world: WorldSnapshot): void {
    this.storage.setItem(SAVE_KEY, JSON.stringify(worldSchema.parse(world)));
  }
}
