import { QueryClientProvider } from '@tanstack/react-query';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { CallProvider } from '@/features/calls/CallProvider';
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
      {/* KeyboardProvider (react-native-keyboard-controller) — le clavier système Android
       * 15+ (edge-to-edge forcé) ne redimensionne plus la fenêtre comme avant : le
       * KeyboardAvoidingView natif de React Native reste alors aveugle au clavier et le
       * champ de saisie de la messagerie se retrouvait masqué. Doit englober TOUTE l'app
       * (pas seulement l'écran de conversation) : c'est ce provider qui abonne l'app aux
       * vrais événements d'insets du clavier, consommés ensuite par le KeyboardAvoidingView
       * importé de 'react-native-keyboard-controller' (et non plus de 'react-native') dans
       * messages/[id].tsx. */}
      <KeyboardProvider>
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
          {/* Appels audio/vidéo — montée au niveau racine (comme la messagerie temps réel
           * ci-dessus) pour que la sonnerie d'un appel entrant s'affiche quel que soit
           * l'écran ouvert, pas seulement dans la conversation concernée. */}
          <CallProvider />
        </ThemeProvider>
      </KeyboardProvider>
    </QueryClientProvider>
  );
}
