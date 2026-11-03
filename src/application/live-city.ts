import type {
  LiveCityCommand,
  CommandResult,
} from '../../shared/city/live-protocol';
export type { LiveId, CommandResult } from '../../shared/city/live-protocol';
export type CityCommand = LiveCityCommand;

// SDK-independent live boundary. Generated bindings belong in infrastructure.
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
export interface LiveCityGateway {
  readonly status: ConnectionStatus;
  connect(): Promise<void>;
  setViewport(viewport: Viewport): void;
  /** Resolves only for a terminal server result; transport failure leaves outcome unknown. */
  send(command: CityCommand): Promise<CommandResult>;
  /** These must use owner-filtered reads; private tables are not directly subscribable. */
  commandCursor(): Promise<bigint>;
  lookupCommand(
    requestId: string,
    sequence: bigint,
  ): Promise<CommandResult | 'expired' | null>;
  disconnect(): void;
}
