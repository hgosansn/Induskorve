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
export const buildingSchema = positionSchema.extend({
  id: z
    .number()
    .int()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER - 1),
  type: buildingKindSchema,
  on: z.boolean(),
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
export const draftSchema = z.object({
  kind: buildingKindSchema,
  height: z.number().min(24).max(85),
  seed: z.number().min(0).max(1),
  design: designSchema,
});
export type BuildingDraft = z.infer<typeof draftSchema>;
export const defaultDraft: BuildingDraft = {
  kind: 'factory',
  height: 48,
  seed: 0.5,
  design: {
    shape: 'stepped',
    stacks: true,
    balcony: true,
    display: 'animated',
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
      new Set(world.citizens.map((c) => c.id)).size !== world.citizens.length
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
