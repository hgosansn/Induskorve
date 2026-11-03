import { z } from 'zod';
import { liveConfigurationSchema } from './contracts';
export const liveAppConfigurationSchema = liveConfigurationSchema.extend({
  clientId: z.string().min(1),
  redirectUri: z.url().optional(),
});
export type LiveAppConfiguration = z.infer<typeof liveAppConfigurationSchema>;
/** Relative Vite bases must resolve against the page path, including Pages subdirectories. */
export function cityRedirectUri(base: string, page: string, explicit?: string) {
  const result = new URL(explicit ?? base, page);
  if (result.origin !== new URL(page).origin)
    throw Error('The sign-in callback must use this app’s origin.');
  result.search = '';
  result.hash = '';
  return result.href;
}
export function readCityConfiguration(
  env: Record<string, unknown>,
): { mode: 'local' } | { mode: 'live'; configuration: LiveAppConfiguration } {
  if (env.VITE_CITY_MODE === undefined || env.VITE_CITY_MODE === 'local')
    return { mode: 'local' };
  if (env.VITE_CITY_MODE !== 'live')
    throw Error('Set VITE_CITY_MODE to local or live.');
  const parsed = liveAppConfigurationSchema.safeParse({
    uri: env.VITE_SPACETIMEDB_URI,
    database: env.VITE_SPACETIMEDB_DATABASE,
    clientId: env.VITE_SPACETIMEAUTH_CLIENT_ID,
    redirectUri: env.VITE_SPACETIMEAUTH_REDIRECT_URI || undefined,
  });
  if (!parsed.success)
    throw Error(
      'Live city configuration is incomplete. Set the server URL, database name and public SpacetimeAuth client ID.',
    );
  return { mode: 'live', configuration: parsed.data };
}
