import { DbConnection, type SubscriptionHandle } from './module-bindings';
import { collectLiveRows, type LiveRows } from './live-read-model';
import { encodeCommand, decodeCommand } from '../../../shared/city/wire';
import {
  REJECTION_CODES,
  type LiveCityCommand,
  type CommandResult,
  type RejectionCode,
} from '../../../shared/city/live-protocol';
import type {
  ConnectionStatus,
  LiveCityGateway,
} from '../../application/live-city';

const QUERIES = [
  'world',
  'building',
  'building_appearance',
  'building_module',
  'warehouse_stockpile',
  'citizen',
  'city_project',
  'project_contribution',
  'technology_unlock',
  'world_event',
  'presence',
  'terrain_tile',
  'billboard_asset',
  'my_receipts',
  'my_cursor',
  'my_player_state',
].map((name) => `SELECT * FROM ${name}`);
export interface GatewayOptions {
  uri: string;
  database: string;
  token?: string;
  tokenProvider?: () => Promise<string | undefined>;
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  onStatus(status: ConnectionStatus): void;
  onSnapshot(rows: LiveRows, identity: string): void;
}
export class SpacetimeGateway implements LiveCityGateway {
  status: ConnectionStatus = 'disconnected';
  connection: DbConnection | null = null;
  private subscription: SubscriptionHandle | null = null;
  private closed = false;
  private queued = false;
  private snapshotReady = false;
  private journalKey = '';
  private generation = 0;
  private cancelConnect: (() => void) | null = null;
  private statusChanged(status: ConnectionStatus) {
    if (this.closed) return;
    this.status = status;
    this.options.onStatus(status);
  }
  constructor(private readonly options: GatewayOptions) {}
  private publish = () => {
    if (this.queued || !this.snapshotReady || this.closed) return;
    this.queued = true;
    queueMicrotask(() => {
      this.queued = false;
      if (!this.connection?.identity || this.closed || !this.snapshotReady)
        return;
      try {
        this.options.onSnapshot(
          collectLiveRows(this.connection),
          this.connection.identity.toHexString(),
        );
      } catch {
        this.statusChanged('error');
      }
    });
  };
  async connect(): Promise<void> {
    if (this.connection) return;
    this.closed = false;
    const generation = ++this.generation;
    this.statusChanged('connecting');
    let token: string | undefined;
    try {
      token = this.options.tokenProvider
        ? await this.options.tokenProvider()
        : this.options.token;
    } catch (error) {
      if (generation === this.generation) this.statusChanged('error');
      throw error;
    }
    if (this.closed || generation !== this.generation) return;
    await new Promise<void>((resolve, reject) => {
      let completed = false;
      const timeout = setTimeout(() => {
        if (!completed) {
          completed = true;
          if (generation !== this.generation || this.closed) {
            resolve();
            return;
          }
          this.statusChanged('error');
          reject(Error('The live city could not be reached.'));
        }
      }, 15_000);
      this.cancelConnect = () => {
        if (!completed) {
          completed = true;
          clearTimeout(timeout);
          resolve();
        }
      };
      let builder = DbConnection.builder()
        .withUri(this.options.uri)
        .withDatabaseName(this.options.database)
        .withToken(token)
        .withAutomaticReconnect();
      if (token && this.options.tokenProvider)
        builder = builder.withTokenProvider(async () => {
          const value = await this.options.tokenProvider!();
          if (!value)
            throw Error('Your authentication session expired. Sign in again.');
          return value;
        });
      const connection = builder
        .onConnect((conn, identity) => {
          if (this.closed || generation !== this.generation) {
            conn.disconnect();
            return;
          }
          this.connection = conn;
          this.journalKey = `induskorve:live-command:${this.options.uri}:${this.options.database}:${identity.toHexString()}`;
          for (const table of [
            conn.db.world,
            conn.db.building,
            conn.db.buildingAppearance,
            conn.db.buildingModule,
            conn.db.warehouseStockpile,
            conn.db.citizen,
            conn.db.cityProject,
            conn.db.projectContribution,
            conn.db.technologyUnlock,
            conn.db.worldEvent,
            conn.db.presence,
            conn.db.billboardAsset,
            conn.db.myReceipts,
            conn.db.myCursor,
            conn.db.myPlayerState,
          ]) {
            table.onInsert(this.publish);
            table.onUpdate(this.publish);
            table.onDelete(this.publish);
          }
          this.statusChanged('synchronizing');
          this.subscription = conn
            .subscriptionBuilder()
            .onApplied(() => {
              if (this.closed || generation !== this.generation) return;
              this.snapshotReady = true;
              this.statusChanged('ready');
              this.publish();
              if (!completed) {
                completed = true;
                clearTimeout(timeout);
                resolve();
              }
            })
            .onError(() => {
              if (this.closed || generation !== this.generation) return;
              this.snapshotReady = false;
              this.statusChanged('error');
              if (!completed) {
                completed = true;
                clearTimeout(timeout);
                reject(Error('Live city subscription failed.'));
              }
            })
            .subscribe(QUERIES);
        })
        .onAutomaticReconnect(() => {
          if (this.closed || generation !== this.generation) return;
          this.snapshotReady = false;
          this.statusChanged('synchronizing');
        })
        .onConnectError(() => {
          if (this.closed || generation !== this.generation) return;
          this.snapshotReady = false;
          this.statusChanged('error');
          if (!completed) {
            completed = true;
            clearTimeout(timeout);
            reject(Error('The live city could not be reached.'));
          }
        })
        .onDisconnect(() => {
          if (this.closed || generation !== this.generation) return;
          this.snapshotReady = false;
          this.statusChanged('reconnecting');
        })
        .build();
      this.connection = connection;
    });
    if (this.closed || generation !== this.generation) return;
    this.cancelConnect = null;
    const pending = this.options.storage?.getItem(this.journalKey);
    if (pending) {
      const command = decodeCommand(pending),
        found = await this.lookupCommand(command.requestId, command.sequence);
      if (found === 'expired') {
        this.options.storage?.removeItem(this.journalKey);
        throw Error(
          'Your previous command was settled. Review the updated city before contributing again.',
        );
      }
      if (found) this.options.storage?.removeItem(this.journalKey);
      else await this.send(command);
    }
  }
  setViewport(): void {
    /* Initial live world is bounded by the shared 2,500-structure limit. One complete subscription keeps forecasts and source allocation coherent. */
  }
  async commandCursor() {
    if (!this.connection || this.status !== 'ready')
      throw Error('Wait for the live city to synchronize.');
    return [...this.connection.db.myCursor.iter()][0]?.lastSequence ?? 0n;
  }
  async lookupCommand(
    requestId: string,
    sequence: bigint,
  ): Promise<CommandResult | 'expired' | null> {
    if (!this.connection || this.status !== 'ready')
      throw Error('Wait for the live city to synchronize.');
    const row = [...this.connection.db.myReceipts.iter()].find(
      (r) => r.requestId === requestId,
    );
    if (!row)
      return (await this.commandCursor()) >= sequence ? 'expired' : null;
    const base = {
      requestId: row.requestId,
      sequence: row.sequence,
      revision: row.worldRevision,
    };
    if (row.accepted) return { ...base, accepted: true, eventId: row.eventId };
    if (
      !row.rejectionCode ||
      !REJECTION_CODES.includes(row.rejectionCode as RejectionCode)
    )
      throw Error('Unrecognized command result.');
    return {
      ...base,
      accepted: false,
      code: row.rejectionCode as RejectionCode,
      reason: row.reason ?? 'This contribution was rejected.',
    };
  }
  async send(command: LiveCityCommand): Promise<CommandResult> {
    if (!this.connection || this.status !== 'ready')
      throw Error('The live city is read-only until it reconnects.');
    const previous = this.options.storage?.getItem(this.journalKey);
    if (previous && previous !== encodeCommand(command))
      throw Error('Resolve the pending contribution before sending another.');
    this.options.storage?.setItem(this.journalKey, encodeCommand(command));
    try {
      await this.connection.reducers.executeCommand({
        payload: encodeCommand(command),
      });
    } catch (error) {
      const stored = await this.lookupCommand(
        command.requestId,
        command.sequence,
      ).catch(() => null);
      if (stored && stored !== 'expired') {
        this.options.storage?.removeItem(this.journalKey);
        return stored;
      }
      if (
        error instanceof Error &&
        (/\[(request-conflict|sequence-gap|receipt-expired|not-registered)\]/.test(
          error.message,
        ) ||
          error.message.includes('SpacetimeAuth') ||
          error.message.includes('Invalid command payload'))
      ) {
        this.options.storage?.removeItem(this.journalKey);
        throw Error(error.message, { cause: error });
      }
      throw Error(
        'Connection interrupted. The contribution’s outcome is pending; reconnect to reconcile it.',
        { cause: error },
      );
    }
    const started = Date.now();
    while (Date.now() - started < 12_000) {
      if (this.closed)
        throw Error('Connection closed while awaiting confirmation.');
      const result = await this.lookupCommand(
        command.requestId,
        command.sequence,
      );
      if (result === 'expired')
        throw Error('The command was already settled; refresh the live city.');
      if (result) {
        this.options.storage?.removeItem(this.journalKey);
        this.publish();
        return result;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw Error(
      'Confirmation is pending. Reconnect to reconcile this contribution.',
    );
  }
  disconnect() {
    this.generation++;
    this.closed = true;
    this.cancelConnect?.();
    this.cancelConnect = null;
    this.snapshotReady = false;
    try {
      this.subscription?.unsubscribe();
    } catch {
      /* An unapplied subscription may already have ended. */
    }
    this.connection?.disconnect();
    this.connection = null;
    this.subscription = null;
    this.status = 'disconnected';
  }
}
