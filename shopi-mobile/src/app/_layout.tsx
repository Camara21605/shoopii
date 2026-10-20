import { QueryClientProvider } from '@tanstack/react-query';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { PhotoConfirmHost } from '@/components/photo-confirm';
import { AuthPromptHost } from '@/features/auth/auth-gate';
import { CallProvider } from '@/features/calls/CallProvider';
import { MessagingSync } from '@/features/messagerie/sync';
import { PresenceProvider } from '@/features/presence';
import { useSession } from '@/features/auth/session-store';
import { startMessagingCache } from '@/lib/messaging-cache';
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

  /* Messagerie gardée sur le téléphone (comme WhatsApp) : remise en mémoire
   * pour le compte connecté, enregistrée au fil des changements. */
  const userId = useSession((s) => s.user?.id ?? null);
  useEffect(() => {
    if (status !== 'signedIn' || !userId) return;
    return startMessagingCache(queryClient, userId);
  }, [status, userId]);

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
            {/* L'application s'ouvre sur l'Accueil SANS connexion, comme le site : les
             * écrans publics sont ouverts à tous, les écrans privés sont protégés dans
             * (app)/_layout.tsx et les actions réservées passent par features/auth/auth-gate.tsx. */}
            <Stack.Screen name="(app)" />
            {/* Connexion / inscription présentées PAR-DESSUS l'écran en cours : une fois
             * connecté, le garde devient faux, (auth) se referme et l'on retrouve l'écran
             * d'où l'on venait. Inaccessibles (même par lien profond) une fois connecté. */}
            <Stack.Protected guard={status === 'signedOut'}>
              <Stack.Screen name="(auth)" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            </Stack.Protected>
          </Stack>
          {/* Fenêtre « Connectez-vous pour continuer » (une seule pour toute l'application) */}
          <AuthPromptHost />
          {/* Aperçu + « Enregistrer la photo » après le choix d'une photo (profil, logo…) */}
          <PhotoConfirmHost />
          {/* Appels audio/vidéo — montée au niveau racine (comme la messagerie temps réel
           * ci-dessus) pour que la sonnerie d'un appel entrant s'affiche quel que soit
           * l'écran ouvert, pas seulement dans la conversation concernée. */}
          {/* Messagerie temps réel pour toute la session (listes + fils + reconnexion) */}
          {status === 'signedIn' && userId ? <MessagingSync key={userId} /> : null}
          <CallProvider />
          <PresenceProvider />
        </ThemeProvider>
      </KeyboardProvider>
    </QueryClientProvider>
  );
}
