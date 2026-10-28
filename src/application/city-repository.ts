import type { WorldSnapshot } from '../domain/city/model';

export interface LoadResult {
  world: WorldSnapshot | null;
  warning?: string;
  readOnly?: boolean;
}
export interface CityRepository {
  load(): LoadResult;
  save(world: WorldSnapshot): void;
}
