import type { CityRepository } from '../../application/city-repository';
import { LocalCityRepository } from './local-city-repository';

export function browserRepository(): CityRepository {
  try {
    return new LocalCityRepository(window.localStorage);
  } catch {
    return {
      load: () => ({
        world: null,
        warning: 'Browser storage unavailable. Changes last for this visit.',
        readOnly: true,
      }),
      save: () => {
        throw new Error('Storage unavailable');
      },
    };
  }
}
