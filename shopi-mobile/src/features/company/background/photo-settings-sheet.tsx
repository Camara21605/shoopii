/**
 * « Réglages photo » — ce que fait ⚡ Arranger en un toucher (et le point de
 * départ de « Retoucher ») : style, intensité, fond, cadrage, et
 * « Arranger chaque nouvelle photo automatiquement ». Enregistré aussitôt
 * sur ce téléphone.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { savePhotoSettings, STRENGTHS, STYLES, usePhotoSettings, DEFAULT_PHOTO_SETTINGS } from './photo-settings';

export function PhotoSettingsSheet({ onClose }: { onClose: () => void }) {
  const theme = useTheme();
  const s = usePhotoSettings();

  return (
    <BottomSheet title="Réglages photo" onClose={onClose} height={0.82}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="small" themeColor="textSecondary">
          Choisissez une fois : ⚡ Arranger applique ces réglages à vos photos en un toucher.
        </ThemedText>

        <Title text="Style" />
        <View style={styles.grid}>
          {STYLES.map((st) => {
            const on = s.style === st.key;
            return (
              <Pressable
                key={st.key}
                onPress={() => savePhotoSettings({ style: st.key })}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={[styles.styleCard, { borderColor: on ? Brand.primary : theme.border, backgroundColor: on ? theme.backgroundSelected : theme.background }]}>
                <View style={styles.styleHead}>
                  <ThemedText style={styles.styleLabel}>{st.label}</ThemedText>
                  {on ? <Ionicons name="checkmark-circle" size={18} color={Brand.primary} /> : null}
                </View>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
                  {st.sub}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {s.style !== 'orig' ? (
          <>
            <Title text="Intensité" />
            <Segmented
              options={STRENGTHS.map((x) => ({ key: String(x.value), label: x.label }))}
              value={String(STRENGTHS.reduce((best, x) => (Math.abs(x.value - s.strength) < Math.abs(best.value - s.strength) ? x : best)).value)}
              onChange={(k) => savePhotoSettings({ strength: Number(k) })}
            />
          </>
        ) : null}

        <Title text="Fond" />
        <Row
          icon="cut-outline"
          label="Retirer le fond"
          sub="Le produit seul — idéal sur fond uni. Vérifiez le résultat : un fond chargé peut demander une retouche."
          value={s.removeBg}
          onChange={(v) => savePhotoSettings({ removeBg: v })}
        />
        {s.removeBg ? (
          <>
            <Segmented
              options={[{ key: 'white', label: 'Fond blanc' }, { key: 'transparent', label: 'Transparent' }]}
              value={s.bg}
              onChange={(k) => savePhotoSettings({ bg: k as 'white' | 'transparent' })}
            />
            <Row icon="crop-outline" label="Cadrer le produit" sub="Photo carrée, produit au centre" value={s.crop} onChange={(v) => savePhotoSettings({ crop: v })} />
          </>
        ) : null}

        <Title text="Automatique" />
        <Row
          icon="flash-outline"
          label="Arranger chaque nouvelle photo"
          sub="Dès qu’elle est ajoutée, avant l’envoi. Vous pouvez toujours la retoucher ensuite."
          value={s.autoOnAdd}
          onChange={(v) => savePhotoSettings({ autoOnAdd: v })}
        />

        <Pressable onPress={() => savePhotoSettings(DEFAULT_PHOTO_SETTINGS)} accessibilityRole="button" style={styles.reset}>
          <Ionicons name="refresh" size={16} color={theme.textSecondary} />
          <ThemedText type="smallBold" themeColor="textSecondary">Réglages par défaut</ThemedText>
        </Pressable>
      </ScrollView>
    </BottomSheet>
  );
}

function Title({ text }: { text: string }) {
  return <ThemedText style={styles.title}>{text}</ThemedText>;
}

function Segmented({ options, value, onChange }: { options: { key: string; label: string }[]; value: string; onChange: (k: string) => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.seg, { borderColor: theme.border }]}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} accessibilityRole="radio" accessibilityState={{ checked: on }}
            style={[styles.segBtn, on && { backgroundColor: Brand.primary }]}>
            <ThemedText style={[styles.segText, on && { color: '#fff' }]}>{o.label}</ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

function Row({ icon, label, sub, value, onChange }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; sub: string; value: boolean; onChange: (v: boolean) => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { borderColor: theme.border }]}>
      <Ionicons name={icon} size={20} color={Brand.primary} />
      <View style={styles.flex}>
        <ThemedText style={styles.rowLabel}>{label}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">{sub}</ThemedText>
      </View>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} trackColor={{ true: Brand.primary, false: '#D0D5DD' }} thumbColor="#fff" />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: 10, paddingBottom: 24 },
  title: { fontSize: 14, lineHeight: 19, fontWeight: '900', marginTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  styleCard: { width: '48.5%', borderWidth: 1.5, borderRadius: 14, padding: 10, gap: 2 },
  styleHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  styleLabel: { fontSize: 14.5, lineHeight: 19, fontWeight: '800' },
  seg: { flexDirection: 'row', borderWidth: 1.2, borderRadius: 12, overflow: 'hidden' },
  segBtn: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  segText: { fontSize: 13.5, lineHeight: 18, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 12 },
  rowLabel: { fontSize: 14.5, lineHeight: 19, fontWeight: '800' },
  reset: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
});
