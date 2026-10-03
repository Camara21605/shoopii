/** Message bref en bas d'écran (succès / erreur), effacé au bout de 3 s. */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

export type SnackMsg = { text: string; error?: boolean; id: number } | null;

export function useSnack() {
  const [msg, setMsg] = useState<SnackMsg>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3000);
    return () => clearTimeout(t);
  }, [msg]);
  return { msg, show: (text: string, error = false) => setMsg({ text, error, id: Date.now() }) };
}

export function Snack({ msg, bottom = 24 }: { msg: SnackMsg; bottom?: number }) {
  if (!msg) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom }]}>
      <View style={styles.snack} accessibilityRole="alert" accessibilityLiveRegion="polite">
        <Ionicons name={msg.error ? 'alert-circle' : 'checkmark-circle'} size={18} color={msg.error ? '#FCA5A5' : '#86EFAC'} />
        <ThemedText style={styles.text}>{msg.text}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 20 },
  snack: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#2A2A2A', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, maxWidth: 480 },
  text: { color: '#fff', fontSize: 13.5, lineHeight: 18, fontWeight: '700', flexShrink: 1 },
});
