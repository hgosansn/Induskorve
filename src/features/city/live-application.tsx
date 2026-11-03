import { useEffect, useMemo } from 'react';
import { AuthProvider, useAuth } from 'react-oidc-context';
import { UserManager, WebStorageStateStore } from 'oidc-client-ts';
import { Button } from '@/components/ui/button';
import { CityExperience } from './city-experience';
import { createLiveCityStore } from '../../infrastructure/spacetimedb/live-store';
import type { LiveAppConfiguration } from '../../infrastructure/spacetimedb/configuration';
import { cityRedirectUri } from '../../infrastructure/spacetimedb/configuration';
import { SPACETIMEAUTH_AUTHORITY } from '../../../shared/city/auth';

const JOIN_INTENT = 'induskorve:live-join-after-auth';
function LiveSession({
  configuration,
  manager,
}: {
  configuration: LiveAppConfiguration;
  manager: UserManager;
}) {
  const auth = useAuth(),
    subject = auth.isAuthenticated ? (auth.user?.profile.sub ?? '') : '';
  const controller = useMemo(
    () =>
      createLiveCityStore({
        uri: configuration.uri,
        database: configuration.database,
        tokenProvider: async () => {
          const user = await manager.getUser();
          if (subject && (!user || user.expired || !user.id_token))
            throw Error(
              'Your sign-in session expired. Sign out and sign in again.',
            );
          return user && !user.expired ? user.id_token : undefined;
        },
        signedIn: !!subject,
        storage: sessionStorage,
        async signIn() {
          sessionStorage.setItem(JOIN_INTENT, '1');
          await manager.signinRedirect();
        },
        async signOut() {
          await manager.signoutRedirect();
        },
      }),
    [configuration, manager, subject],
  );
  useEffect(() => {
    let active = true;
    void controller
      .start()
      .then(async () => {
        if (
          !active ||
          !subject ||
          sessionStorage.getItem(JOIN_INTENT) !== '1' ||
          controller.gateway.status !== 'ready'
        )
          return;
        sessionStorage.removeItem(JOIN_INTENT);
        const profile = controller.rows?.citizens.find(
          (c) =>
            c.identity.toHexString() ===
            controller.gateway.connection?.identity?.toHexString(),
        );
        if (profile) await controller.store.getState().join(profile.name);
        else controller.store.setState({ joinPrompt: true });
      })
      .catch(() => {
        if (active)
          controller.store.setState({
            warning:
              'Sign-in succeeded, but joining the city could not complete. Try joining again.',
          });
      });
    return () => {
      active = false;
      controller.dispose();
    };
  }, [controller, subject]);
  return <CityExperience store={controller.store} />;
}
export function LiveApplication({
  configuration,
}: {
  configuration: LiveAppConfiguration;
}) {
  const manager = useMemo(() => {
    const redirect = cityRedirectUri(
      import.meta.env.BASE_URL,
      location.href,
      configuration.redirectUri,
    );
    return new UserManager({
      authority: SPACETIMEAUTH_AUTHORITY,
      client_id: configuration.clientId,
      redirect_uri: redirect,
      post_logout_redirect_uri: redirect,
      response_type: 'code',
      scope: 'openid profile email',
      automaticSilentRenew: false,
      loadUserInfo: false,
      userStore: new WebStorageStateStore({ store: sessionStorage }),
      stateStore: new WebStorageStateStore({ store: sessionStorage }),
    });
  }, [configuration]);
  useEffect(() => {
    manager.startSilentRenew();
    return () => manager.stopSilentRenew();
  }, [manager]);
  return (
    <AuthProvider
      userManager={manager}
      onSigninCallback={() => {
        history.replaceState({}, document.title, manager.settings.redirect_uri);
      }}
    >
      <LiveAuthenticationGate configuration={configuration} manager={manager} />
    </AuthProvider>
  );
}
function LiveAuthenticationGate(props: {
  configuration: LiveAppConfiguration;
  manager: UserManager;
}) {
  const auth = useAuth();
  if (auth.isLoading)
    return (
      <main className="grid h-dvh place-items-center bg-background text-foreground">
        <p role="status">Restoring your city session…</p>
      </main>
    );
  if (auth.error)
    return (
      <main className="grid h-dvh place-items-center bg-background p-6 text-foreground">
        <div className="space-y-4">
          <h1 className="text-xl">Sign-in could not complete</h1>
          <p>Return to the city and try signing in again.</p>
          <Button
            onClick={() => {
              void auth.removeUser().then(() => {
                location.href = cityRedirectUri(
                  import.meta.env.BASE_URL,
                  location.href,
                );
              });
            }}
          >
            Return to city
          </Button>
        </div>
      </main>
    );
  return <LiveSession {...props} />;
}
