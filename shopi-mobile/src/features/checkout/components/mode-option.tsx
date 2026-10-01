/**
 * Option de mode de livraison (bouton radio) : icône, titre, description, prix,
 * et — si une boutique du panier ne le propose pas — la raison, option grisée.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function ModeOption({
  icon,
  title,
  description,
  price,
  selected,
  disabledReason,
  onPress,
}: {
  icon: IconName;
  title: string;
  description: string;
  price: string;
  selected: boolean;
  disabledReason?: string | null;
  onPress: () => void;
}) {
  const theme = useTheme();
  const off = !!disabledReason;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: off }}
      accessibilityLabel={`${title}, ${price}${off ? `, indisponible : ${disabledReason}` : ''}`}
      style={[
        styles.card,
        { borderColor: selected ? Brand.primary : theme.border, backgroundColor: selected ? theme.backgroundSelected : theme.background },
        off && styles.off,
      ]}>
      <View style={[styles.ico, { backgroundColor: selected ? Brand.primary : theme.backgroundElement }]}>
        <Ionicons name={icon} size={20} color={selected ? '#fff' : Brand.primary} />
      </View>
      <View style={styles.flex}>
        <View style={styles.row}>
          <ThemedText style={[styles.title, styles.flex]}>{title}</ThemedText>
          <ThemedText style={[styles.price, { color: price === 'Gratuit' ? Brand.success : Brand.primary }]}>{price}</ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {description}
        </ThemedText>
        {off ? (
          <ThemedText type="small" style={styles.reason}>
            {disabledReason}
          </ThemedText>
        ) : null}
      </View>
      <View style={[styles.radio, { borderColor: selected ? Brand.primary : theme.border }]}>{selected ? <View style={styles.radioDot} /> : null}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: 14, padding: 12 },
  off: { opacity: 0.55 },
  ico: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  price: { fontSize: 13, lineHeight: 18, fontWeight: '800' },
  reason: { color: Brand.danger, marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: Brand.primary },
});
