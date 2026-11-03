import type { LiveCityCommand } from './live-protocol';
import { parseLiveCommand } from './validate-command';
/** JSON RPC payload retains u64 values explicitly; no Number(bigint) conversion. */
export function encodeCommand(command: LiveCityCommand): string {
  parseLiveCommand(command);
  return JSON.stringify(command, (_key, value) =>
    typeof value === 'bigint' ? { $u64: value.toString() } : value,
  );
}
export function decodeCommand(payload: string): LiveCityCommand {
  if (payload.length > 32_768)
    throw Error('Command exceeds transport size limit.');
  const input = JSON.parse(payload, (_key, value) => {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.keys(value).length === 1 &&
      typeof value.$u64 === 'string' &&
      /^(0|[1-9][0-9]{0,19})$/.test(value.$u64)
    )
      return BigInt(value.$u64);
    return value;
  });
  return parseLiveCommand(input);
}
