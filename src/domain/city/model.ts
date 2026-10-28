import { z } from 'zod';

export const buildingKindSchema = z.enum(['factory', 'power', 'warehouse']);
export type BuildingKind = z.infer<typeof buildingKindSchema>;
export const positionSchema = z.object({
  x: z.number().int().min(-1_000_000).max(1_000_000),
  y: z.number().int().min(-1_000_000).max(1_000_000),
});
export type Position = z.infer<typeof positionSchema>;
export const citizenSchema = z.object({
  id: z.string().min(1).max(128),
  name: z.string().trim().min(1).max(24),
});
export type Citizen = z.infer<typeof citizenSchema>;
export const moduleSchema = z.enum([
  'turbine',
  'heat-exchanger',
  'furnace',
  'scrubber',
  'loading-bay',
  'solar-roof',
]);
export type BuildingModule = z.infer<typeof moduleSchema>;
export const moduleKinds: Record<BuildingModule, BuildingKind> = {
  turbine: 'power',
  'heat-exchanger': 'power',
  furnace: 'factory',
  scrubber: 'factory',
  'loading-bay': 'warehouse',
  'solar-roof': 'warehouse',
};
const modulesSchema = z
  .array(moduleSchema)
  .max(2)
  .refine((v) => new Set(v).size === v.length, 'Duplicate module');
export const buildingSchema = positionSchema.extend({
  id: z
    .number()
    .int()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER - 1),
  type: buildingKindSchema,
  on: z.boolean(),
  modules: modulesSchema.optional(),
  creatorId: z.string().max(128).optional(),
  creator: z.string().max(24).optional(),
});
export type Building = z.infer<typeof buildingSchema>;
export const imageSourceSchema = z
  .string()
  .max(2_000_100)
  .regex(
    /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/,
    'Unsupported local billboard image',
  );
export const designSchema = z.object({
  shape: z.enum(['block', 'stepped', 'tower']),
  stacks: z.boolean(),
  balcony: z.boolean(),
  display: z.enum(['animated', 'none']),
});
export type BuildingDesign = z.infer<typeof designSchema>;
export const draftSchema = z
  .object({
    kind: buildingKindSchema,
    modules: modulesSchema.optional(),
    height: z.number().min(24).max(85),
    seed: z.number().min(0).max(1),
    design: designSchema,
  })
  .refine(
    (d) => d.modules?.every((m) => moduleKinds[m] === d.kind) ?? true,
    'Module does not fit this building',
  );
export type BuildingDraft = z.infer<typeof draftSchema>;
export const defaultDraft: BuildingDraft = {
  kind: 'factory',
  height: 48,
  seed: 0.5,
  design: {
    shape: 'stepped',
    stacks: true,
    balcony: true,
    display: 'none',
  },
};
// Presentation metadata is deliberately absent from Building and simulation rules.
export const appearanceSchema = z.object({
  buildingId: buildingSchema.shape.id,
  height: z.number().finite().min(8).max(160),
  seed: z.number().finite().min(0).max(1),
  billboard: imageSourceSchema.optional(),
  design: designSchema.optional(),
});
export type BuildingAppearance = z.infer<typeof appearanceSchema>;
export const worldSchema = z
  .object({
    version: z.literal(3),
    buildings: z.array(buildingSchema).max(2500),
    appearances: z.array(appearanceSchema).max(2500),
    citizens: z.array(citizenSchema).max(100),
    economy: z
      .object({
        shippedMetal: z
          .number()
          .int()
          .nonnegative()
          .max(Number.MAX_SAFE_INTEGER)
          .optional(),
        cycle: z
          .number()
          .int()
          .nonnegative()
          .max(Number.MAX_SAFE_INTEGER - 1),
        stockpiles: z
          .array(
            z.object({
              buildingId: buildingSchema.shape.id,
              metal: z.number().int().min(0).max(400),
            }),
          )
          .max(2500),
      })
      .optional(),
  })
  .superRefine((world, ctx) => {
    const ids = new Set(world.buildings.map((b) => b.id));
    const cells = new Set(world.buildings.map((b) => tileKey(b.x, b.y)));
    const appearanceIds = new Set(world.appearances.map((a) => a.buildingId));
    if (
      ids.size !== world.buildings.length ||
      cells.size !== world.buildings.length ||
      appearanceIds.size !== world.appearances.length ||
      appearanceIds.size !== ids.size ||
      world.appearances.some((a) => !ids.has(a.buildingId)) ||
      new Set(world.citizens.map((c) => c.id)).size !== world.citizens.length ||
      world.buildings.some((b) =>
        b.modules?.some((m) => moduleKinds[m] !== b.type),
      ) ||
      (world.economy &&
        (new Set(world.economy.stockpiles.map((s) => s.buildingId)).size !==
          world.economy.stockpiles.length ||
          world.economy.stockpiles.some(
            (s) =>
              !world.buildings.some(
                (b) => b.id === s.buildingId && b.type === 'warehouse',
              ),
          )))
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Duplicate, missing, or orphaned city records',
      });
    }
  });
export type WorldSnapshot = z.infer<typeof worldSchema>;
export type NetworkLayer = 'all' | 'power' | 'materials' | 'off';
export type Tool = 'inspect' | BuildingKind;
export const tileKey = (x: number, y: number) => `${x},${y}`;
