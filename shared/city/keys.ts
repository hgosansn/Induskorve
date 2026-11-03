import type { ProjectId } from './ids';
export const CHUNK_SIZE = 16;
export const chunkKey = (x: number, y: number) =>
  `${Math.floor(x / CHUNK_SIZE)},${Math.floor(y / CHUNK_SIZE)}`;
export const cellKey = (x: number, y: number) => `${x},${y}`;
export function identityKey(identity: string): string {
  if (!/^[0-9a-f]{64}$/i.test(identity))
    throw Error('Invalid authenticated identity.');
  return identity.toLowerCase();
}
export const receiptKey = (actor: string, requestId: string) =>
  `${identityKey(actor)}:${requestId}`;
export const sequenceKey = (actor: string, sequence: bigint) =>
  `${identityKey(actor)}:${sequence}`;
export const contributionKey = (projectId: ProjectId, actor: string) =>
  `${projectId}:${identityKey(actor)}`;
