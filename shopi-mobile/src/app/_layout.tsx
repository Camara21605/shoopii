import { QueryClientProvider } from '@tanstack/react-query';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { useSession } from '@/features/auth/session-store';
import { queryClient, setupQueryClientListeners } from '@/lib/query-client';
import { connectRealtime, disconnectRealtime } from '@/lib/realtime/socket';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const status = useSession((s) => s.status);

  useEffect(() => {
    void useSession.getState().bootstrap();
    return setupQueryClientListeners();
  }, []);

  useEffect(() => {
    if (status !== 'loading') void SplashScreen.hideAsync();
  }, [status]);

  /* Le temps réel n'existe que pour une session ouverte. */
  useEffect(() => {
    if (status === 'signedIn') connectRealtime();
    else disconnectRealtime();
    return disconnectRealtime;
  }, [status]);

  if (status === 'loading') return null;

  return (
    <QueryClientProvider client={queryClient}>
      {/* Thème clair imposé (voir hooks/use-theme.ts) : icônes de la barre d'état en foncé */}
      <StatusBar style="dark" />
      <ThemeProvider value={DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          {/* Un écran protégé est inaccessible (même par lien profond) tant que le garde est faux. */}
          <Stack.Protected guard={status === 'signedIn'}>
            <Stack.Screen name="(app)" />
          </Stack.Protected>
          <Stack.Protected guard={status === 'signedOut'}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
        </Stack>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
