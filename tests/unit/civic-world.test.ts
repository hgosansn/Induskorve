import { describe, expect, it } from 'vitest';
import {
  defaultDraft,
  worldSchema,
  type BuildingKind,
  type WorldSnapshot,
} from '../../src/domain/city/model';
import { advanceProduction } from '../../src/domain/city/production';
import { calculateNetworks } from '../../src/domain/city/networks';
import {
  createFoundingWorld,
  placeBuilding,
} from '../../src/domain/city/world';
import { projectPlacement } from '../../src/rendering/canvas/view-model';
import { buildingStats } from '../../src/domain/city/catalog';

const industrial: WorldSnapshot = {
  version: 3,
  citizens: [{ id: 'owner', name: 'Owner' }],
  buildings: [
    {
      id: 1,
      x: 1,
      y: 1,
      type: 'power',
      on: true,
      creatorId: 'owner',
      creator: 'Owner',
    },
    { id: 2, x: 1, y: 2, type: 'warehouse', on: true },
    { id: 3, x: 2, y: 1, type: 'factory', on: true },
  ],
  appearances: [1, 2, 3].map((buildingId) => ({
    buildingId,
    height: 48,
    seed: 0.5,
  })),
  economy: { cycle: 0, stockpiles: [{ buildingId: 2, metal: 50 }] },
};
describe('mixed civic and industrial city', () => {
  it('places, forecasts and roundtrips each civic type without rewriting the industrial records', () => {
    for (const kind of ['residential', 'skyscraper', 'shop'] as const) {
      const before = JSON.stringify(industrial);
      const draft = {
        ...defaultDraft,
        kind,
        modules: [],
        design: {
          ...defaultDraft.design,
          shape: 'tower' as const,
          display: 'animated' as const,
        },
      };
      expect(
        projectPlacement(industrial, draft, { x: 2, y: 2 })?.building.type,
      ).toBe(kind);
      const placed = placeBuilding(
        industrial,
        'owner',
        kind,
        { x: 2, y: 2 },
        draft,
      );
      const roundtrip = worldSchema.parse(JSON.parse(JSON.stringify(placed)));
      expect(roundtrip.buildings.slice(0, 3)).toEqual(industrial.buildings);
      expect(roundtrip.appearances.slice(0, 3)).toEqual(industrial.appearances);
      expect(roundtrip.buildings.at(-1)!.creator).toBe('Owner');
      expect(JSON.stringify(industrial)).toBe(before);
      expect(buildingStats(roundtrip.buildings.at(-1)!).output).toBe(0);
      expect(buildingStats(roundtrip.buildings.at(-1)!).emissions).toBe(0);
    }
  });
  it('powers civic uses without a warehouse and keeps foundry production and civic outages honest', () => {
    const extra = (['residential', 'skyscraper', 'shop'] as BuildingKind[]).map(
      (type, i) => ({
        id: 10 + i,
        type,
        x: 2 + (i % 2),
        y: 2 + Math.floor(i / 2),
        on: true,
      }),
    );
    const mixed = {
      ...industrial,
      buildings: [...industrial.buildings, ...extra],
      appearances: [
        ...industrial.appearances,
        ...extra.map((b) => ({ buildingId: b.id, height: 78, seed: 0.3 })),
      ],
    };
    const net = calculateNetworks(mixed.buildings);
    for (const b of extra) {
      expect(net.services.get(b.id)!.active).toBe(true);
      expect(net.services.get(b.id)!.storageId).toBeUndefined();
    }
    const noStore = calculateNetworks(
      mixed.buildings.filter((b) => b.type !== 'warehouse'),
    );
    for (const b of extra)
      expect(noStore.services.get(b.id)!.active).toBe(true);
    expect(advanceProduction(mixed).economy!.stockpiles).toEqual(
      advanceProduction(industrial).economy!.stockpiles,
    );
    const outage = calculateNetworks(
      mixed.buildings.map((b) =>
        b.type === 'power' ? { ...b, on: false } : b,
      ),
    );
    for (const b of extra)
      expect(outage.services.get(b.id)!.active).toBe(false);
  });
  it('seeds a mixed town only for a newly generated world', () => {
    const world = createFoundingWorld();
    expect(worldSchema.safeParse(world).success).toBe(true);
    for (const type of [
      'factory',
      'power',
      'warehouse',
      'residential',
      'skyscraper',
      'shop',
    ])
      expect(world.buildings.some((b) => b.type === type)).toBe(true);
    expect(
      world.appearances.some(
        (a) =>
          a.design?.display === 'animated' &&
          world.buildings.find((b) => b.id === a.buildingId)?.type ===
            'skyscraper',
      ),
    ).toBe(true);
    expect(worldSchema.parse(JSON.parse(JSON.stringify(industrial)))).toEqual(
      industrial,
    );
  });
});
