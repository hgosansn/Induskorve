import { z } from 'zod';
import { buildingKindSchema, positionSchema } from '../../domain/city/model';

export const CHUNK_SIZE = 16;
export const chunkKey = (x: number, y: number): string =>
  `${Math.floor(x / CHUNK_SIZE)},${Math.floor(y / CHUNK_SIZE)}`;
export const u64Schema = z.bigint().min(0n).max(18_446_744_073_709_551_615n);
export const buildingRowSchema = positionSchema
  .extend({
    id: u64Schema,
    cellKey: z.string(),
    chunkKey: z.string(),
    kind: buildingKindSchema,
    enabled: z.boolean(),
    creator: z.string().regex(/^[a-f0-9]{64}$/i),
    revision: u64Schema,
  })
  .superRefine((row, ctx) => {
    if (
      row.cellKey !== `${row.x},${row.y}` ||
      row.chunkKey !== chunkKey(row.x, row.y)
    )
      ctx.addIssue({ code: 'custom', message: 'Invalid spatial keys' });
  });
export type BuildingRow = z.infer<typeof buildingRowSchema>;
export interface LiveBuilding {
  id: bigint;
  x: number;
  y: number;
  type: z.infer<typeof buildingKindSchema>;
  on: boolean;
  creatorIdentity: string;
  revision: bigint;
}
// Keep u64 IDs lossless. Do not cast them to the local prototype's numeric IDs.
export function mapBuildingRow(input: unknown): LiveBuilding {
  const row = buildingRowSchema.parse(input);
  return {
    id: row.id,
    x: row.x,
    y: row.y,
    type: row.kind,
    on: row.enabled,
    creatorIdentity: row.creator,
    revision: row.revision,
  };
}
export const liveConfigurationSchema = z.object({
  uri: z
    .url()
    .refine(
      (value) =>
        ['https:', 'wss:'].includes(new URL(value).protocol) ||
        (['http:', 'ws:'].includes(new URL(value).protocol) &&
          ['localhost', '127.0.0.1', '[::1]'].includes(
            new URL(value).hostname,
          )),
      'Use TLS except for local development',
    ),
  database: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z0-9_-]+$/),
});
