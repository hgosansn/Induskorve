import { SenderError, type ReducerCtx } from 'spacetimedb/server';
import type database from './index';
import {
  admitCommand,
  terminalReceipt,
  type Admission,
  type CommandReceipt,
} from './authority';
import { receiptKey, sequenceKey } from '../../shared/city/keys';
import {
  REJECTION_CODES,
  type CommandResult,
  type RejectionCode,
} from '../../shared/city/live-protocol';
import {
  parseLiveCommand,
  CommandValidationError,
} from '../../shared/city/validate-command';

type Context = ReducerCtx<typeof database.schemaType>;
/** Helpers only: these are not exported reducer endpoints. Sender always comes from ctx. */
export function readCommandAdmission(ctx: Context, input: unknown): Admission {
  let command;
  try {
    command = parseLiveCommand(input);
  } catch (error) {
    if (error instanceof CommandValidationError)
      throw new SenderError(error.message);
    throw error;
  }
  const actor = ctx.sender.toHexString();
  const cursor = ctx.db.commandCursor.identity.find(ctx.sender);
  const stored = ctx.db.commandReceipt.id.find(
    receiptKey(actor, command.requestId),
  );
  let receipt: CommandReceipt | null = null;
  if (stored) {
    if (
      stored.identity.toHexString() !== actor ||
      stored.sequenceKey !== sequenceKey(actor, stored.sequence)
    )
      throw Error('Invalid stored receipt ownership.');
    const base = {
      requestId: stored.requestId,
      sequence: stored.sequence,
      revision: stored.worldRevision,
    };
    let result: CommandResult;
    if (stored.accepted)
      result = { ...base, accepted: true, eventId: stored.eventId };
    else {
      if (
        !stored.rejectionCode ||
        !REJECTION_CODES.includes(stored.rejectionCode as RejectionCode) ||
        !stored.reason
      )
        throw Error('Invalid rejected receipt.');
      result = {
        ...base,
        accepted: false,
        code: stored.rejectionCode as RejectionCode,
        reason: stored.reason,
      };
    }
    receipt = {
      actor,
      requestId: stored.requestId,
      sequence: stored.sequence,
      fingerprint: stored.fingerprint,
      result,
    };
  }
  return admitCommand({
    sender: actor,
    registered: !!ctx.db.citizen.identity.find(ctx.sender),
    command,
    cursor: cursor ? { actor, lastSequence: cursor.lastSequence } : null,
    receipt,
  });
}
/** Call after all planning succeeds. Any DB exception must escape the reducer unchanged. */
export function writeTerminalReceipt(
  ctx: Context,
  admission: Extract<Admission, { kind: 'fresh' }>,
  result: CommandResult,
): void {
  if (ctx.sender.toHexString() !== admission.actor)
    throw Error('Admission belongs to another sender.');
  const planned = terminalReceipt(admission, result),
    cursor = ctx.db.commandCursor.identity.find(ctx.sender);
  if ((cursor?.lastSequence ?? 0n) !== result.sequence - 1n)
    throw Error('Command cursor changed before settlement.');
  ctx.db.commandReceipt.insert({
    id: admission.key,
    identity: ctx.sender,
    sequenceKey: sequenceKey(admission.actor, result.sequence),
    requestId: result.requestId,
    sequence: result.sequence,
    fingerprint: planned.receipt.fingerprint,
    accepted: result.accepted,
    worldRevision: result.revision,
    eventId: result.accepted ? result.eventId : undefined,
    rejectionCode: result.accepted ? undefined : result.code,
    reason: result.accepted ? undefined : result.reason,
    createdAt: ctx.timestamp,
  });
  if (cursor)
    ctx.db.commandCursor.identity.update({
      ...cursor,
      lastSequence: planned.cursor.lastSequence,
    });
  else
    ctx.db.commandCursor.insert({
      identity: ctx.sender,
      lastSequence: planned.cursor.lastSequence,
    });
}
