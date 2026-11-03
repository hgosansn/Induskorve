import { z } from 'zod';
import {
  PROJECT_IDS,
  TECHNOLOGY_IDS,
  type TechnologyId,
} from '../../../shared/city/ids';
import { PROJECTS } from '../../../shared/city/technology';
export * from '../../../shared/city/technology';
export const projectIdSchema = z.enum(PROJECT_IDS);
export const technologyIdSchema = z.enum(TECHNOLOGY_IDS);

const quantity = z.number().int().min(0).max(1_000_000_000);
export const progressionSchema = z
  .object({
    version: z.literal(1),
    projects: z
      .array(
        z.object({
          id: projectIdSchema,
          delivered: quantity,
          contributors: z
            .array(
              z.object({
                citizenId: z.string().min(1).max(128),
                amount: quantity,
              }),
            )
            .max(100),
        }),
      )
      .max(projectIdSchema.options.length),
    events: z
      .array(
        z.object({
          id: z
            .number()
            .int()
            .nonnegative()
            .max(Number.MAX_SAFE_INTEGER - 1),
          cycle: z
            .number()
            .int()
            .nonnegative()
            .max(Number.MAX_SAFE_INTEGER - 1),
          actorId: z.string().min(1).max(128),
          actor: z.string().min(1).max(24),
          summary: z.string().min(1).max(300),
          buildingId: z
            .number()
            .int()
            .nonnegative()
            .max(Number.MAX_SAFE_INTEGER - 1)
            .optional(),
        }),
      )
      .max(120),
  })
  .superRefine((s, ctx) => {
    const invalid =
      new Set(s.projects.map((p) => p.id)).size !== s.projects.length ||
      s.projects.some(
        (p) =>
          p.delivered > PROJECTS[p.id].cost ||
          p.contributors.reduce((sum, c) => sum + c.amount, 0) !==
            p.delivered ||
          new Set(p.contributors.map((c) => c.citizenId)).size !==
            p.contributors.length,
      ) ||
      s.events.some((e, i) => i > 0 && e.id <= s.events[i - 1]!.id);
    const completed = new Set<TechnologyId>(
      s.projects
        .filter((p) => p.delivered === PROJECTS[p.id].cost)
        .map((p) => PROJECTS[p.id].unlock),
    );
    if (
      invalid ||
      s.projects.some(
        (p) =>
          p.delivered > 0 &&
          PROJECTS[p.id].prerequisites.some((t) => !completed.has(t)),
      )
    )
      ctx.addIssue({
        code: 'custom',
        message:
          'Inconsistent project contributions or technology prerequisites',
      });
  });
export type Progression = z.infer<typeof progressionSchema>;
