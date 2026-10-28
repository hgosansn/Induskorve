import type { RenderFrame } from './view-model';
export function createArtwork(ctx: CanvasRenderingContext2D): {
  draw(frame: RenderFrame): void;
  clearCaches(): void;
  dispose(): void;
};
