import catalog from './parts-batch-01/catalog.json';
import type { ReusablePart } from './sprite-runtime';
export {
  loadReusablePart,
  paintReusablePart,
  readyReusablePart,
  reusableSpriteRevision,
} from './sprite-runtime';
export type { ReusablePart } from './sprite-runtime';
export const reusableParts: readonly ReusablePart[] = catalog.parts;

export interface PartPlacement {
  id: string;
  position: [number, number, number];
}

// Fixed-camera assembly example. Duct mouths meet with opposed normals;
// two stands touch straight duct skins, clear of larger flanges and bands.
// Cabinet spans both interior bearing rails.
export const extractionCell: readonly PartPlacement[] = [
  { id: 'equipment-frame', position: [0, 1.8, 0] },
  { id: 'service-cabinet', position: [0.2, 1.95, 1.5] },
  { id: 'saddle-stand', position: [0.6, 0, 0] },
  { id: 'saddle-stand', position: [2.4, 0, 0] },
  { id: 'duct-long', position: [0, 0, 0.9] },
  { id: 'duct-short', position: [2, 0, 0.9] },
  { id: 'duct-elbow', position: [3, 0, 0.9] },
  { id: 'duct-reducer', position: [3.7, 0, 1.6] },
];
