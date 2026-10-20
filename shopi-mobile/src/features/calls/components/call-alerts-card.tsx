/**
 * Messages › ⚙ Paramètres › « Appels » : l'autorisation Android 14+
 * « Notifications en plein écran ». Sans elle, un appel n'apparaît pas en
 * grand quand le téléphone est verrouillé (seulement après avoir retiré le
 * code). État relu à chaque retour dans l'application (après le réglage).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { canUseFullScreenIntent, nativeCallsAvailable, openFullScreenIntentSettings } from '../../../../modules/shopi-calls';

export function CallAlertsCard() {
  const theme = useTheme();
  const [allowed, setAllowed] = useState(() => canUseFullScreenIntent());

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') setAllowed(canUseFullScreenIntent()); });
    return () => sub.remove();
  }, []);

  if (!nativeCallsAvailable) return null;

  return (
    <View style={styles.line}>
      <Ionicons name={allowed ? 'checkmark-circle' : 'alert-circle'} size={20} color={allowed ? Brand.success : '#D97706'} />
      <View style={styles.flex}>
        <ThemedText style={styles.title}>Appels en plein écran</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {allowed
            ? 'Activé : un appel s’affiche en grand et sonne même téléphone verrouillé.'
            : 'Désactivé : un appel n’apparaît pas en grand quand le téléphone est verrouillé.'}
        </ThemedText>
      </View>
      {!allowed ? (
        <Pressable onPress={openFullScreenIntentSettings} accessibilityRole="button" style={({ pressed }) => [styles.btn, { borderColor: theme.border }, pressed && styles.pressed]}>
          <ThemedText type="smallBold" style={{ color: Brand.primary }}>Activer</ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  title: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  btn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
});
