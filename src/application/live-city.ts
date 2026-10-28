import type { BuildingKind, Position } from '../domain/city/model';

// SDK-independent live boundary. Generated bindings belong in infrastructure.
export type LiveId = bigint;
export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'synchronizing'
  | 'ready'
  | 'reconnecting'
  | 'error';
export interface Viewport {
  minChunkX: number;
  maxChunkX: number;
  minChunkY: number;
  maxChunkY: number;
}
export type CityCommand =
  | { kind: 'join'; name: string }
  | {
      kind: 'place';
      requestId: string;
      buildingKind: BuildingKind;
      position: Position;
    }
  | {
      kind: 'set-operating';
      requestId: string;
      buildingId: LiveId;
      enabled: boolean;
      expectedRevision: bigint;
    }
  | {
      kind: 'set-billboard';
      requestId: string;
      buildingId: LiveId;
      assetId: LiveId | null;
      expectedRevision: bigint;
    };
export type CommandResult =
  | { requestId: string; accepted: true; revision: bigint }
  | { requestId: string; accepted: false; reason: string };
export interface LiveCityGateway {
  readonly status: ConnectionStatus;
  connect(): Promise<void>;
  setViewport(viewport: Viewport): void;
  send(command: CityCommand): Promise<CommandResult | void>;
  disconnect(): void;
}
