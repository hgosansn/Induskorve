export const SPACETIMEAUTH_AUTHORITY = 'https://auth.spacetimedb.com/oidc';
export function acceptsSpacetimeAuth(
  jwt: { issuer: string; audience: readonly string[] } | null,
  clientId: string | undefined,
): boolean {
  return (
    !!clientId &&
    !!jwt &&
    jwt.issuer === SPACETIMEAUTH_AUTHORITY &&
    jwt.audience.includes(clientId)
  );
}
