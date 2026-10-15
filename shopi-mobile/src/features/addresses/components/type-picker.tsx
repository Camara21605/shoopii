/** Choix du type d'adresse : tuiles icône + nom, trois par ligne. */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ADDRESS_TYPES, type AddressType } from '../api';

export function TypePicker({ value, onChange }: { value: AddressType; onChange: (t: AddressType) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.grid} accessibilityRole="radiogroup">
      {ADDRESS_TYPES.map((t) => {
        const on = t.value === value;
        return (
          <Pressable
            key={t.value}
            onPress={() => onChange(t.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t.label}
            style={({ pressed }) => [
              styles.tile,
              { borderColor: on ? Brand.primary : theme.border, backgroundColor: on ? Brand.primarySoft : theme.background },
              on && styles.tileOn,
              pressed && styles.pressed,
            ]}>
            <View style={[styles.ico, { backgroundColor: on ? Brand.primary : `${t.color}12` }]}>
              <Ionicons name={t.icon} size={18} color={on ? '#fff' : t.color} />
            </View>
            <ThemedText style={[styles.label, on && styles.labelOn]} numberOfLines={1}>
              {t.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { flexBasis: '31%', flexGrow: 1, alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 4 },
  tileOn: { borderWidth: 1.5 },
  pressed: { opacity: 0.8 },
  ico: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12.5, lineHeight: 16, fontWeight: '600' },
  labelOn: { fontWeight: '800' },
});
