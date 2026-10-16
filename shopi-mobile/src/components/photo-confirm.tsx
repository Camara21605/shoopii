/**
 * Dernière étape du choix d'une photo (profil, logo, couverture) : aperçu tel qu'il
 * s'affichera, puis un bouton final clair « Enregistrer la photo ».
 *
 * Pourquoi : après la galerie, Android montre son propre écran de recadrage dont le bouton
 * de validation (en haut à droite) passait inaperçu — on croyait le parcours bloqué. Cet
 * écran-ci rend l'étape finale évidente et permet de choisir une autre photo sans recommencer.
 *
 *   const choix = await confirmPhoto({ uri, shape: 'round' }); // 'ok' | 'again' | 'cancel'
 *
 * Rendu une seule fois par <PhotoConfirmHost /> (app/_layout.tsx).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { SecondaryButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type PhotoChoice = 'ok' | 'again' | 'cancel';
type Request = {
  uri: string;
  /** round = photo de profil / logo, wide = couverture (3:1) */
  shape: 'round' | 'square' | 'wide';
  title?: string;
  confirmLabel?: string;
};

const useRequest = create<{ req: (Request & { resolve: (c: PhotoChoice) => void }) | null; set: (r: (Request & { resolve: (c: PhotoChoice) => void }) | null) => void }>((set) => ({
  req: null,
  set: (req) => set({ req }),
}));

export function confirmPhoto(req: Request): Promise<PhotoChoice> {
  return new Promise((resolve) => useRequest.getState().set({ ...req, resolve }));
}

export function PhotoConfirmHost() {
  const theme = useTheme();
  const req = useRequest((s) => s.req);
  if (!req) return null;
  const done = (c: PhotoChoice) => {
    useRequest.getState().set(null);
    req.resolve(c);
  };
  const preview = req.shape === 'wide' ? styles.wide : req.shape === 'square' ? styles.square : styles.round;
  return (
    <Modal visible animationType="slide" onRequestClose={() => done('cancel')}>
      <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]}>
        <View style={styles.body}>
          <ThemedText type="subtitle" style={styles.center}>
            {req.title ?? 'Votre nouvelle photo'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            Voici comment elle s’affichera sur Shoneya.
          </ThemedText>
          <Image source={{ uri: req.uri }} style={[preview, { backgroundColor: theme.backgroundElement }]} contentFit="cover" accessibilityLabel="Aperçu de la photo choisie" />
        </View>
        <View style={styles.actions}>
          {/* Bouton final plein (pas le style clair habituel) : c'est l'action attendue sur cet écran */}
          <Pressable
            onPress={() => done('ok')}
            accessibilityRole="button"
            accessibilityLabel={req.confirmLabel ?? 'Enregistrer la photo'}
            style={({ pressed }) => [styles.main, pressed && styles.pressed]}>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <ThemedText type="smallBold" style={styles.mainText}>
              {req.confirmLabel ?? 'Enregistrer la photo'}
            </ThemedText>
          </Pressable>
          <SecondaryButton title="Choisir une autre photo" onPress={() => done('again')} pill />
          <Pressable onPress={() => done('cancel')} accessibilityRole="button" accessibilityLabel="Annuler" hitSlop={10} style={styles.cancel}>
            <ThemedText themeColor="textSecondary" type="smallBold">
              Annuler
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: Spacing.four },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  center: { textAlign: 'center' },
  round: { width: 220, height: 220, borderRadius: 110, marginTop: Spacing.four },
  square: { width: 240, height: 240, borderRadius: 20, marginTop: Spacing.four },
  wide: { width: '100%', aspectRatio: 3, borderRadius: 16, marginTop: Spacing.four },
  main: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, borderRadius: 999, backgroundColor: Brand.primary },
  mainText: { color: '#fff', fontSize: 16 },
  pressed: { opacity: 0.85 },
  actions: { gap: Spacing.two, paddingBottom: Spacing.three },
  cancel: { alignSelf: 'center', paddingVertical: Spacing.two },
});
