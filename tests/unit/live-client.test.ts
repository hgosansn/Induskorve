import { describe, expect, it } from 'vitest';
import {
  acceptsSpacetimeAuth,
  SPACETIMEAUTH_AUTHORITY,
} from '../../shared/city/auth';
import {
  RendererIds,
  boundedNumber,
} from '../../src/infrastructure/spacetimedb/live-read-model';
import {
  cityRedirectUri,
  readCityConfiguration,
} from '../../src/infrastructure/spacetimedb/configuration';
import { encodeCommand, decodeCommand } from '../../shared/city/wire';

describe('live client boundaries', () => {
  it('keeps authentication callbacks inside the deployed Pages subpath', () => {
    expect(
      cityRedirectUri(
        './',
        'https://owner.github.io/Induskorve/?code=callback&state=s',
      ),
    ).toBe('https://owner.github.io/Induskorve/');
    expect(
      cityRedirectUri('./', 'https://owner.github.io/Induskorve/index.html'),
    ).toBe('https://owner.github.io/Induskorve/');
    expect(() =>
      cityRedirectUri(
        './',
        'https://owner.github.io/Induskorve/',
        'https://other.example/',
      ),
    ).toThrow(/origin/);
  });
  it('requires both the trusted issuer and this application’s audience', () => {
    expect(
      acceptsSpacetimeAuth(
        { issuer: SPACETIMEAUTH_AUTHORITY, audience: ['city'] },
        'city',
      ),
    ).toBe(true);
    expect(
      acceptsSpacetimeAuth(
        { issuer: 'https://other.example', audience: ['city'] },
        'city',
      ),
    ).toBe(false);
    expect(
      acceptsSpacetimeAuth(
        { issuer: SPACETIMEAUTH_AUTHORITY, audience: ['another-city'] },
        'city',
      ),
    ).toBe(false);
    expect(acceptsSpacetimeAuth(null, 'city')).toBe(false);
    expect(
      acceptsSpacetimeAuth(
        { issuer: SPACETIMEAUTH_AUTHORITY, audience: ['city'] },
        undefined,
      ),
    ).toBe(false);
  });
  it('keeps adjacent u64 identifiers distinct and reverses renderer handles exactly', () => {
    const ids = new RendererIds(),
      a = 18446744073709551614n,
      b = a + 1n;
    expect(ids.get(a)).not.toBe(ids.get(b));
    expect(ids.live(ids.get(a))).toBe(a);
    expect(ids.live(ids.get(b))).toBe(b);
    expect(() => ids.live(99)).toThrow();
    expect(() => boundedNumber(b, 'quantity')).toThrow();
  });
  it('fails closed for incomplete live configuration', () => {
    expect(readCityConfiguration({}).mode).toBe('local');
    expect(() => readCityConfiguration({ VITE_CITY_MODE: 'live' })).toThrow(
      /incomplete/,
    );
    expect(
      readCityConfiguration({
        VITE_CITY_MODE: 'live',
        VITE_SPACETIMEDB_URI: 'https://maincloud.spacetimedb.com',
        VITE_SPACETIMEDB_DATABASE: 'city',
        VITE_SPACETIMEAUTH_CLIENT_ID: 'public-client',
      }).mode,
    ).toBe('live');
  });
  it('round trips u64 command fields without numeric coercion', () => {
    const command = {
      kind: 'set-operating' as const,
      protocolVersion: 1 as const,
      contentVersion: 1 as const,
      requestId: crypto.randomUUID(),
      sequence: 18446744073709551615n,
      buildingId: 18446744073709551614n,
      expectedBuildingRevision: 0n,
      enabled: false,
    };
    expect(decodeCommand(encodeCommand(command))).toEqual(command);
    expect(() => decodeCommand('{"kind":"place-building"}')).toThrow();
  });
});
