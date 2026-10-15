/**
 * Carte d'une adresse : type (icône teintée), libellé, pastille « Par défaut »,
 * rue, quartier · commune, ville, téléphone, consignes pour le livreur, état de
 * la position GPS — puis les actions (par défaut · modifier · supprimer).
 * Toucher la carte ouvre la modification.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { addressLines, addressTitle, formatPhone, typeMeta, type Address } from '../api';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function AddressCard({
  address: a,
  onEdit,
  onMakeDefault,
  onDelete,
  busy,
}: {
  address: Address;
  onEdit: () => void;
  onMakeDefault: () => void;
  onDelete: () => void;
  busy?: boolean;
}) {
  const theme = useTheme();
  const t = typeMeta(a.typeAdresse);
  const { street, place } = addressLines(a);
  const phone = formatPhone(a.telephone);
  const hasGps = a.latitude != null && a.longitude != null;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.background, borderColor: a.estDefaut ? Brand.primary : theme.border },
        a.estDefaut && styles.cardDefault,
        busy && styles.busy,
      ]}>
      <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel={`Modifier l’adresse ${addressTitle(a)}`} style={({ pressed }) => [styles.main, pressed && styles.pressed]}>
        <View style={[styles.icon, { backgroundColor: `${t.color}12` }]}>
          <Ionicons name={t.icon} size={22} color={t.color} />
        </View>
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <ThemedText style={styles.title} numberOfLines={1}>
              {addressTitle(a)}
            </ThemedText>
            {a.estDefaut ? (
              <View style={styles.defaultPill}>
                <Ionicons name="checkmark-circle" size={12} color="#fff" />
                <ThemedText style={styles.defaultText}>Par défaut</ThemedText>
              </View>
            ) : null}
          </View>
          {a.libelle ? (
            <ThemedText style={styles.type} themeColor="textSecondary">
              {t.label}
            </ThemedText>
          ) : null}
          {street ? <ThemedText style={styles.street}>{street}</ThemedText> : null}
          <ThemedText style={styles.place} themeColor="textSecondary">
            {place || 'Ville non précisée'}
          </ThemedText>

          <View style={styles.metaList}>
            {phone ? <Meta icon="call-outline" text={phone} /> : null}
            {a.instructions ? <Meta icon="chatbubble-ellipses-outline" text={a.instructions} italic /> : null}
            <Meta
              icon={hasGps ? 'navigate' : 'navigate-outline'}
              text={hasGps ? 'Position GPS enregistrée' : 'Pas encore épinglée sur la carte'}
              color={hasGps ? Brand.success : '#B45309'}
            />
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
      </Pressable>

      <View style={[styles.actions, { borderTopColor: theme.border }]}>
        {a.estDefaut ? (
          <View style={styles.action}>
            <Ionicons name="star" size={15} color={Brand.primary} />
            <ThemedText style={styles.actionMuted} themeColor="textSecondary">
              Utilisée pour vos livraisons
            </ThemedText>
          </View>
        ) : (
          <Action icon="star-outline" label="Par défaut" onPress={onMakeDefault} disabled={busy} />
        )}
        <View style={styles.actionsRight}>
          <Action icon="create-outline" label="Modifier" onPress={onEdit} disabled={busy} />
          <Action icon="trash-outline" label="Supprimer" onPress={onDelete} disabled={busy} danger />
        </View>
      </View>
    </View>
  );
}

function Meta({ icon, text, color, italic }: { icon: IconName; text: string; color?: string; italic?: boolean }) {
  const theme = useTheme();
  return (
    <View style={styles.meta}>
      <Ionicons name={icon} size={14} color={color ?? theme.textSecondary} style={styles.metaIco} />
      <ThemedText style={[styles.metaText, { color: color ?? theme.textSecondary }, italic && styles.italic]} numberOfLines={2}>
        {text}
      </ThemedText>
    </View>
  );
}

function Action({ icon, label, onPress, disabled, danger }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  const color = danger ? Brand.danger : Brand.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [styles.action, styles.actionBtn, pressed && styles.actionPressed]}>
      <Ionicons name={icon} size={16} color={color} />
      <ThemedText style={[styles.actionText, { color }]}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  cardDefault: { borderWidth: 1.5 },
  busy: { opacity: 0.6 },
  pressed: { opacity: 0.85 },
  main: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  icon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flexShrink: 1, fontSize: 16, lineHeight: 21, fontWeight: '800' },
  defaultPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Brand.primary, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  defaultText: { color: '#fff', fontSize: 11, lineHeight: 15, fontWeight: '800' },
  type: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  street: { fontSize: 14.5, lineHeight: 20, marginTop: 4 },
  place: { fontSize: 14, lineHeight: 19 },
  metaList: { gap: 4, marginTop: 8 },
  meta: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  metaIco: { marginTop: 2 },
  metaText: { flex: 1, fontSize: 12.5, lineHeight: 17 },
  italic: { fontStyle: 'italic' },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 8, minHeight: 46 },
  actionsRight: { flexDirection: 'row', alignItems: 'center' },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 6 },
  actionBtn: { minHeight: 40, borderRadius: 10, paddingHorizontal: 8 },
  actionPressed: { backgroundColor: 'rgba(0,0,0,0.05)' },
  actionText: { fontSize: 13, lineHeight: 17, fontWeight: '700' },
  actionMuted: { fontSize: 12.5, lineHeight: 17, fontWeight: '600' },
});
