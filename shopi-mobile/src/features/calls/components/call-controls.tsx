/**
 * Boutons de l'écran d'appel : grands ronds avec leur libellé dessous
 * (lisibles d'un coup d'œil, zone de toucher ≥ 56 px).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function CallButton({ icon, label, onPress, active, busy, tone = 'glass', size = 58, iconStyle }: {
  icon: IconName; label: string; onPress: () => void;
  active?: boolean; busy?: boolean; tone?: 'glass' | 'danger' | 'success'; size?: number;
  iconStyle?: object;
}) {
  const bg = tone === 'danger' ? Brand.danger : tone === 'success' ? Brand.success : active ? '#fff' : 'rgba(255,255,255,.16)';
  const fg = tone === 'glass' && active ? '#1F1F1F' : '#fff';
  return (
    <View style={styles.item}>
      <Pressable
        onPress={onPress}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: !!active, busy: !!busy }}
        style={({ pressed }) => [styles.btn, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }, pressed && styles.pressed]}>
        {busy ? <ActivityIndicator color={fg} /> : <Ionicons name={icon} size={size * 0.42} color={fg} style={iconStyle} />}
      </Pressable>
      <ThemedText numberOfLines={1} style={styles.label}>{label}</ThemedText>
    </View>
  );
}

export function ControlsRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  item: { alignItems: 'center', gap: 8, minWidth: 72 },
  btn: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.75, transform: [{ scale: 0.95 }] },
  label: { fontSize: 12, lineHeight: 16, color: 'rgba(255,255,255,.88)', fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'flex-start' },
});
