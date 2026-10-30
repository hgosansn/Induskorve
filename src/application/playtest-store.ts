import { create } from 'zustand';
import {
  actInPlaytest,
  advancePlaytest,
  newPlaytest,
  playtestSchema,
  type PlaytestAction,
  type PlaytestState,
} from '../domain/city/playtest';

export const PLAYTEST_SAVE_KEY = 'induskorve:daily-playtest:v1';
export interface PlaytestStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export function createPlaytestStore(storage?: PlaytestStorage) {
  let initial = newPlaytest(),
    warning = '',
    readOnly = false;
  try {
    const raw = storage?.getItem(PLAYTEST_SAVE_KEY);
    if (raw) initial = playtestSchema.parse(JSON.parse(raw));
  } catch {
    warning =
      'Playtest save could not be read. It has been preserved. Reset the experiment to start again.';
    readOnly = true;
  }
  return create<{
    world: PlaytestState;
    warning: string;
    readOnly: boolean;
    act(actor: number, action: PlaytestAction): boolean;
    advance(hours: number): void;
    reset(): void;
  }>((set, get) => {
    function commit(world: PlaytestState) {
      let message = '';
      try {
        storage?.setItem(PLAYTEST_SAVE_KEY, JSON.stringify(world));
      } catch {
        message =
          'Unable to save the experiment. This session still works; progress may be lost on reload.';
      }
      set({ world, warning: message, readOnly: false });
    }
    return {
      world: initial,
      warning,
      readOnly,
      act(actor, action) {
        if (get().readOnly) return false;
        try {
          commit(actInPlaytest(get().world, actor, action));
          return true;
        } catch (error) {
          set({ warning: (error as Error).message });
          return false;
        }
      },
      advance(hours) {
        if (get().readOnly) return;
        try {
          commit(advancePlaytest(get().world, hours));
        } catch (error) {
          set({ warning: (error as Error).message });
        }
      },
      reset() {
        commit(newPlaytest());
      },
    };
  });
}
