/**
 * Champ « liste à choisir » avec recherche, en plein écran — équivalent
 * mobile du SearchableSelect / CompanyTypeCombobox du site : on touche le
 * champ, une liste triée s'ouvre, on tape pour filtrer (sans accents,
 * casse, apostrophes : « nzere » trouve « N'Zérékoré »).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SelectOption = { value: string; label: string; hint?: string; icon?: string };

export const normalize = (s: string) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function SelectField({
  label,
  placeholder,
  options,
  value,
  onChange,
  loading,
  disabled,
  disabledHint,
  error,
  title,
  pinned,
}: {
  label?: string;
  placeholder: string;
  options: SelectOption[];
  value: string | null | undefined;
  onChange: (value: string) => void;
  loading?: boolean;
  disabled?: boolean;
  /** Affiché à la place du texte d'aide quand le champ est désactivé. */
  disabledHint?: string;
  error?: string | null;
  /** Titre de la liste plein écran (par défaut : le libellé). */
  title?: string;
  /** Option toujours affichée en bas de liste (ex. « Autre quartier… »). */
  pinned?: SelectOption;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const selected = options.find((o) => o.value === value) ?? (pinned?.value === value ? pinned : undefined);

  const list = useMemo(() => {
    const n = normalize(q.trim());
    const sorted = [...options].sort((a, b) => a.label.localeCompare(b.label, 'fr'));
    return n ? sorted.filter((o) => normalize(o.label).includes(n)) : sorted;
  }, [options, q]);

  const off = disabled || loading;

  return (
    <View style={styles.group}>
      {label ? (
        <ThemedText type="smallBold" style={styles.label}>
          {label}
        </ThemedText>
      ) : null}
      <Pressable
        onPress={() => {
          setQ('');
          setOpen(true);
        }}
        disabled={off}
        accessibilityRole="button"
        accessibilityLabel={label ?? placeholder}
        style={[
          styles.box,
          {
            borderColor: error ? Brand.danger : theme.border,
            backgroundColor: off ? theme.backgroundElement : theme.background,
          },
        ]}>
        {selected?.icon ? <ThemedText style={styles.icon}>{selected.icon}</ThemedText> : null}
        <ThemedText numberOfLines={1} style={styles.value} themeColor={selected ? 'text' : 'textSecondary'}>
          {loading ? 'Chargement…' : selected ? selected.label : disabled && disabledHint ? disabledHint : placeholder}
        </ThemedText>
        {loading ? <ActivityIndicator size="small" color={Brand.primary} /> : <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />}
      </Pressable>
      {error ? (
        <ThemedText type="small" style={{ color: Brand.danger }} accessibilityRole="alert">
          {error}
        </ThemedText>
      ) : null}

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={[styles.modal, { backgroundColor: theme.background }]}>
          <View style={styles.head}>
            <ThemedText style={styles.title}>{title ?? label ?? placeholder}</ThemedText>
            <Pressable onPress={() => setOpen(false)} accessibilityRole="button" hitSlop={10}>
              <ThemedText type="smallBold" style={{ color: Brand.primary }}>
                Fermer
              </ThemedText>
            </Pressable>
          </View>
          {options.length > 8 && (
            <View style={styles.search}>
              <Field variant="outline" placeholder="Rechercher…" value={q} onChangeText={setQ} autoCorrect={false} autoFocus />
            </View>
          )}
          <FlatList
            data={pinned ? [...list, pinned] : list}
            keyExtractor={(o) => o.value}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: theme.border }]} />}
            ListEmptyComponent={
              <ThemedText themeColor="textSecondary" style={styles.empty}>
                Aucun résultat.
              </ThemedText>
            }
            renderItem={({ item }) => {
              const on = item.value === value;
              return (
                <Pressable
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundElement }]}>
                  {item.icon ? <ThemedText style={styles.icon}>{item.icon}</ThemedText> : null}
                  <View style={styles.flex}>
                    <ThemedText style={on ? { color: Brand.primary, fontWeight: '700' } : undefined}>{item.label}</ThemedText>
                    {item.hint ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        {item.hint}
                      </ThemedText>
                    ) : null}
                  </View>
                  {on ? <Ionicons name="checkmark" size={20} color={Brand.primary} /> : null}
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  group: { gap: 6 },
  label: { fontSize: 13 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 16,
    minHeight: 58,
    paddingHorizontal: Spacing.three,
  },
  value: { flex: 1, fontSize: 16 },
  icon: { fontSize: 18, lineHeight: 24 },
  modal: { flex: 1 },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '800', flex: 1, marginRight: Spacing.two },
  search: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.four, paddingVertical: 15 },
  sep: { height: StyleSheet.hairlineWidth, marginHorizontal: Spacing.four },
  empty: { padding: Spacing.four, textAlign: 'center' },
});
