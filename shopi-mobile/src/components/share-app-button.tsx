/**
 * « Partager Shoneya » — envoie l'application à quelqu'un, en un seul fichier
 * complet, par Bluetooth, Nearby Share, Xender, WhatsApp… (Android).
 * Voir modules/shopi-calls (AppSharer.kt) et plugins/with-shareable-apk.js.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { nativeCallsAvailable, shareApp } from '../../modules/shopi-calls';

export function ShareAppButton({ style }: { style?: object }) {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  if (Platform.OS !== 'android' || !nativeCallsAvailable) return null;

  async function onPress() {
    setBusy(true);
    const r = await shareApp();
    setBusy(false);
    if (r === 'split') {
      Alert.alert(
        'Mise à jour nécessaire',
        'Cette version de Shoneya ne peut pas être partagée. Mettez l’application à jour depuis le Play Store, puis réessayez.',
      );
    } else if (r === 'error') {
      Alert.alert('Partage impossible', 'Réessayez dans un instant.');
    }
  }

  return (
    <Pressable
      onPress={() => void onPress()}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel="Partager l’application Shoneya"
      style={({ pressed }) => [styles.row, { borderColor: theme.border }, pressed && styles.pressed, style]}>
      <View style={styles.icon}>
        {busy ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="share-social" size={18} color="#fff" />}
      </View>
      <View style={styles.text}>
        <ThemedText type="smallBold">Partager Shoneya</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">Bluetooth, Xender, WhatsApp, Nearby Share…</ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#8A93A3" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, marginTop: 12 },
  pressed: { opacity: 0.7 },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
});
