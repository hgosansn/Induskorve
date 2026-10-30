import { z } from 'zod';
import type { BuildingDesign } from './model';

// Experimental balance, deliberately independent of the founding city's rules.
export const PLAYTEST = {
  energyCap: 3,
  hoursPerEnergy: 24,
  buffer: 20,
  projectCost: 160,
  power: 30,
  powerExpansion: 18,
  freight: 24,
  freightExpansion: 24,
  hubDemand: 6,
  foundryDemand: 12,
  foundryOutput: 12,
  furnaceDemand: 6,
  furnaceOutput: 6,
  heatOutput: 4,
} as const;
export const PARTICIPANTS = ['Mira', 'Ivo', 'Sol'] as const;
export const PLAYTEST_PLOTS = [
  { x: 1, y: 2 },
  { x: 2, y: 2 },
  { x: 3, y: 2 },
  { x: 1, y: 3 },
  { x: 2, y: 3 },
  { x: 3, y: 3 },
] as const;
const foundrySchema = z.object({
  plot: z.number().int().min(0).max(5),
  shape: z.enum(['block', 'stepped', 'tower']),
  furnace: z.boolean(),
  heat: z.boolean(),
  creator: z.number().int().min(0).max(2),
});
export const playtestSchema = z
  .object({
    version: z.literal(1),
    hour: z.number().int().min(0).max(1_000_000),
    energy: z.tuple([
      z.number().min(0).max(3),
      z.number().min(0).max(3),
      z.number().min(0).max(3),
    ]),
    foundries: z.array(foundrySchema).max(6),
    generator: z.number().int().min(0).max(4),
    handling: z.number().int().min(0).max(2),
    freightConnected: z.boolean(),
    stock: z.number().min(0).max(20),
    delivered: z.number().min(0).max(10_000_000),
    produced: z.number().min(0).max(10_000_000),
    powerLost: z.number().min(0).max(10_000_000),
    freightLost: z.number().min(0).max(10_000_000),
    completedAt: z.number().int().min(0).nullable(),
    actions: z.number().int().nonnegative(),
    log: z
      .array(
        z.object({
          hour: z.number().int().nonnegative(),
          text: z.string().max(300),
        }),
      )
      .max(120),
  })
  .superRefine((s, ctx) => {
    if (
      new Set(s.foundries.map((f) => f.plot)).size !== s.foundries.length ||
      Math.abs(s.produced - s.delivered - s.stock) > 0.001 ||
      (s.completedAt !== null) !== s.delivered >= PLAYTEST.projectCost ||
      (s.completedAt !== null && s.completedAt > s.hour)
    )
      ctx.addIssue({ code: 'custom', message: 'Inconsistent playtest state' });
  });
export type PlaytestState = z.infer<typeof playtestSchema>;
export type PlaytestAction =
  | { type: 'place'; plot: number; shape: BuildingDesign['shape'] }
  | { type: 'expand'; target: 'generator' | 'handling' | number }
  | { type: 'connect'; target: 'freight' | number };
export function newPlaytest(): PlaytestState {
  return {
    version: 1,
    hour: 0,
    energy: [1, 1, 1],
    foundries: [],
    generator: 0,
    handling: 0,
    freightConnected: false,
    stock: 0,
    delivered: 0,
    produced: 0,
    powerLost: 0,
    freightLost: 0,
    completedAt: null,
    actions: 0,
    log: [],
  };
}
export function playtestMetrics(s: PlaytestState) {
  const power = PLAYTEST.power + s.generator * PLAYTEST.powerExpansion;
  const freight =
    PLAYTEST.freight +
    s.handling * PLAYTEST.freightExpansion +
    (s.freightConnected ? PLAYTEST.freightExpansion : 0) +
    (s.completedAt !== null ? PLAYTEST.freightExpansion : 0);
  let load = PLAYTEST.hubDemand,
    demand = load,
    potential = 0,
    output = 0;
  const powered = new Set<number>();
  // Stable placement order preserves existing consumers when capacity is exhausted.
  for (const f of s.foundries) {
    const need =
      PLAYTEST.foundryDemand + (f.furnace ? PLAYTEST.furnaceDemand : 0);
    const production =
      PLAYTEST.foundryOutput +
      (f.furnace ? PLAYTEST.furnaceOutput : 0) +
      (f.heat ? PLAYTEST.heatOutput : 0);
    demand += need;
    potential += production;
    if (load + need <= power) {
      load += need;
      output += production;
      powered.add(f.plot);
    }
  }
  const bottleneck = !s.foundries.length
    ? 'No industry yet'
    : output < potential
      ? 'Power shortage'
      : output > freight
        ? 'Freight bottleneck'
        : 'Capacity available';
  return {
    power,
    freight,
    load,
    demand,
    potential,
    output,
    powered,
    bottleneck,
  };
}
function appendLog(s: PlaytestState, text: string) {
  s.log = [{ hour: s.hour, text }, ...s.log].slice(0, 120);
}
// Validation and forecast run the exact same command. Failed actions are atomic.
export function actInPlaytest(
  s: PlaytestState,
  actor: number,
  action: PlaytestAction,
): PlaytestState {
  if (!Number.isInteger(actor) || actor < 0 || actor >= PARTICIPANTS.length)
    throw Error('Choose a participant.');
  if (s.energy[actor]! < 1 - 1e-9)
    throw Error('Not enough energy. Advance the clock to recharge.');
  const next = structuredClone(s);
  let description: string;
  if (action.type === 'place') {
    if (
      !PLAYTEST_PLOTS[action.plot] ||
      !['block', 'stepped', 'tower'].includes(action.shape)
    )
      throw Error('Choose a valid plot and shape.');
    if (s.foundries.some((f) => f.plot === action.plot))
      throw Error('This plot is occupied.');
    next.foundries.push({
      plot: action.plot,
      shape: action.shape,
      furnace: false,
      heat: false,
      creator: actor,
    });
    description = `placed foundry ${action.plot + 1}`;
  } else if (action.type === 'expand') {
    if (action.target === 'generator') {
      if (s.generator >= 4)
        throw Error('All generator expansion bays are occupied.');
      next.generator++;
      description = 'expanded generation (+18 power)';
    } else if (action.target === 'handling') {
      if (s.handling >= 2)
        throw Error('Both freight handling bays are occupied.');
      next.handling++;
      description = 'expanded freight handling (+24/day)';
    } else {
      const foundry = next.foundries.find((f) => f.plot === action.target);
      if (!foundry) throw Error('Select an existing foundry.');
      if (foundry.furnace) throw Error('This furnace bay is already occupied.');
      foundry.furnace = true;
      description = `expanded foundry ${foundry.plot + 1} (+6 output, +6 power demand)`;
    }
  } else {
    if (action.target === 'freight') {
      if (s.freightConnected) throw Error('The freight route already exists.');
      next.freightConnected = true;
      description = 'connected the terminal approach (+24 freight/day)';
    } else {
      const foundry = next.foundries.find((f) => f.plot === action.target);
      if (!foundry) throw Error('Select an existing foundry.');
      if (foundry.heat) throw Error('Heat recovery is already connected.');
      foundry.heat = true;
      description = `connected heat recovery to foundry ${foundry.plot + 1} (+4 output/day)`;
    }
  }
  next.energy[actor] = Math.max(0, next.energy[actor]! - 1);
  next.actions++;
  appendLog(next, `${PARTICIPANTS[actor]} ${description}.`);
  return next;
}
export function advancePlaytest(
  s: PlaytestState,
  hours: number,
): PlaytestState {
  if (
    !Number.isInteger(hours) ||
    hours < 1 ||
    hours > 168 ||
    s.hour + hours > 1_000_000
  )
    throw Error('Advance between 1 and 168 hours within the experiment limit.');
  const next = structuredClone(s);
  for (let i = 0; i < hours; i++) {
    const m = playtestMetrics(next);
    const produced = Math.min(
      m.output / 24,
      m.freight / 24 + PLAYTEST.buffer - next.stock,
    );
    const shipped = Math.min(m.freight / 24, next.stock + produced);
    next.stock = Math.max(
      0,
      Math.min(PLAYTEST.buffer, next.stock + produced - shipped),
    );
    next.produced += produced;
    next.delivered += shipped;
    next.powerLost += (m.potential - m.output) / 24;
    next.freightLost += Math.max(0, m.output / 24 - produced);
    next.hour++;
    next.energy = next.energy.map((e) =>
      Math.min(PLAYTEST.energyCap, e + 1 / PLAYTEST.hoursPerEnergy),
    ) as PlaytestState['energy'];
    if (next.completedAt === null && next.delivered >= PLAYTEST.projectCost) {
      next.completedAt = next.hour;
      appendLog(
        next,
        'Freight terminal completed. Public freight capacity increased by 24/day.',
      );
    }
  }
  return next;
}
