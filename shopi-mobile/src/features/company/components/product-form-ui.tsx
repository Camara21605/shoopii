/**
 * Briques du formulaire produit : carte de section, champ texte (compteur,
 * erreur, aide, suffixe), sélecteur en feuille du bas, interrupteur,
 * mots-clés en pastilles. Fond blanc, même style que le reste de l'application.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, TextInput, View, type LayoutChangeEvent, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function FormSection({ icon, title, subtitle, right, error, onLayout, children }: {
  icon: IconName; title: string; subtitle?: string; right?: ReactNode; error?: string;
  onLayout?: (e: LayoutChangeEvent) => void; children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View onLayout={onLayout} style={[styles.card, { borderColor: error ? Brand.danger : theme.border }]}>
      <View style={styles.cardHead}>
        <View style={[styles.cardIco, { backgroundColor: theme.backgroundSelected }]}>
          <Ionicons name={icon} size={17} color={Brand.primary} />
        </View>
        <View style={styles.flex}>
          <ThemedText style={styles.cardTitle}>{title}</ThemedText>
          {subtitle ? <ThemedText type="small" themeColor="textSecondary">{subtitle}</ThemedText> : null}
        </View>
        {right}
      </View>
      {error ? <ErrorLine text={error} /> : null}
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

export function ErrorLine({ text }: { text: string }) {
  return (
    <View style={styles.errorLine} accessibilityRole="alert">
      <Ionicons name="alert-circle" size={14} color={Brand.danger} />
      <ThemedText type="small" style={styles.errorText}>{text}</ThemedText>
    </View>
  );
}

export function TextField({ label, required, error, hint, max, suffix, value, multiline, style, ...props }: TextInputProps & {
  label?: string; required?: boolean; error?: string; hint?: string; max?: number; suffix?: string; value: string;
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const over = max != null && value.length > max;
  return (
    <View style={styles.field}>
      {label ? (
        <ThemedText type="smallBold" style={styles.label}>
          {label}{required ? <ThemedText type="smallBold" style={{ color: Brand.danger }}> *</ThemedText> : null}
        </ThemedText>
      ) : null}
      <View style={[
        styles.box,
        multiline && styles.boxMulti,
        { backgroundColor: theme.backgroundElement, borderColor: error || over ? Brand.danger : focused ? Brand.primary : theme.border },
      ]}>
        <TextInput
          {...props}
          value={value}
          multiline={multiline}
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel={label ?? props.placeholder}
          onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
          style={[styles.input, multiline && styles.inputMulti, { color: theme.text }, style]}
        />
        {suffix ? <ThemedText type="smallBold" themeColor="textSecondary">{suffix}</ThemedText> : null}
      </View>
      <View style={styles.underRow}>
        <View style={styles.flex}>
          {error ? <ErrorLine text={error} /> : hint ? <ThemedText type="small" themeColor="textSecondary">{hint}</ThemedText> : null}
        </View>
        {max != null ? (
          <ThemedText type="small" style={[styles.counter, { color: over ? Brand.danger : theme.textSecondary }]}>{value.length}/{max}</ThemedText>
        ) : null}
      </View>
    </View>
  );
}

export type Option = { value: string; label: string; sub?: string };

/** Sélecteur : champ qui ouvre une liste en feuille du bas (recherche dès 8 choix). */
export function SelectField({ label, required, value, options, onChange, placeholder, error, disabled, allowEmpty }: {
  label: string; required?: boolean; value: string; options: readonly Option[]; onChange: (v: string) => void;
  placeholder?: string; error?: string; disabled?: boolean; allowEmpty?: string;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const current = options.find((o) => o.value === value);
  const list = q.trim() ? options.filter((o) => o.label.toLowerCase().includes(q.trim().toLowerCase())) : options;

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold" style={styles.label}>
        {label}{required ? <ThemedText type="smallBold" style={{ color: Brand.danger }}> *</ThemedText> : null}
      </ThemedText>
      <Pressable
        onPress={() => { setQ(''); setOpen(true); }}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label} : ${current?.label ?? 'non choisi'}`}
        style={[styles.box, { backgroundColor: theme.backgroundElement, borderColor: error ? Brand.danger : theme.border }, disabled && styles.disabled]}>
        <ThemedText numberOfLines={1} style={[styles.flex, styles.selectText, !current && { color: theme.textSecondary }]}>
          {current?.label ?? placeholder ?? 'Choisir…'}
        </ThemedText>
        <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
      </Pressable>
      {error ? <ErrorLine text={error} /> : null}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: theme.background }]} onPress={(e) => e.stopPropagation()}>
            <SafeAreaView edges={['bottom']}>
              <View style={styles.sheetHandle} />
              <ThemedText style={styles.sheetTitle}>{label}</ThemedText>
              {options.length >= 8 ? (
                <View style={[styles.box, styles.sheetSearch, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                  <Ionicons name="search" size={17} color={theme.textSecondary} />
                  <TextInput value={q} onChangeText={setQ} placeholder="Rechercher…" placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text }]} />
                </View>
              ) : null}
              <ScrollView style={styles.sheetList} keyboardShouldPersistTaps="handled">
                {allowEmpty ? (
                  <OptionRow label={allowEmpty} selected={!value} onPress={() => { onChange(''); setOpen(false); }} />
                ) : null}
                {list.map((o) => (
                  <OptionRow key={o.value} label={o.label} sub={o.sub} selected={o.value === value} onPress={() => { onChange(o.value); setOpen(false); }} />
                ))}
                {!list.length ? <ThemedText themeColor="textSecondary" style={styles.sheetEmpty}>Aucun résultat.</ThemedText> : null}
              </ScrollView>
            </SafeAreaView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function OptionRow({ label, sub, selected, onPress }: { label: string; sub?: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }}
      style={({ pressed }) => [styles.option, pressed && { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.flex}>
        <ThemedText style={[styles.optionText, selected && { color: Brand.primary, fontWeight: '800' }]}>{label}</ThemedText>
        {sub ? <ThemedText type="small" themeColor="textSecondary">{sub}</ThemedText> : null}
      </View>
      {selected ? <Ionicons name="checkmark-circle" size={22} color={Brand.primary} /> : null}
    </Pressable>
  );
}

export function SwitchRow({ icon, label, sub, value, onChange, last }: {
  icon?: IconName; label: string; sub?: string; value: boolean; onChange: (v: boolean) => void; last?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={() => onChange(!value)} accessibilityRole="switch" accessibilityState={{ checked: value }}
      style={[styles.switchRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}>
      {icon ? <Ionicons name={icon} size={19} color={value ? Brand.primary : theme.textSecondary} /> : null}
      <View style={styles.flex}>
        <ThemedText style={styles.switchLabel}>{label}</ThemedText>
        {sub ? <ThemedText type="small" themeColor="textSecondary">{sub}</ThemedText> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: Brand.primary, false: '#D0D5DD' }} thumbColor="#fff" />
    </Pressable>
  );
}

/** Mots-clés : virgule ou « Entrée » ajoute une pastille ; toucher une pastille la retire. */
export function TagsField({ label, tags, onChange, max, maxLen, error, hint }: {
  label: string; tags: string[]; onChange: (t: string[]) => void; max: number; maxLen: number; error?: string; hint?: string;
}) {
  const theme = useTheme();
  const [draft, setDraft] = useState('');
  const [local, setLocal] = useState<string | null>(null);

  function commit(raw: string) {
    const parts = raw.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
    if (!parts.length) return;
    const next = [...tags];
    for (const p of parts) {
      if (p.length > maxLen) { setLocal(`« ${p} » dépasse ${maxLen} caractères.`); continue; }
      if (next.includes(p)) continue;
      if (next.length >= max) { setLocal(`${max} mots-clés au maximum.`); break; }
      next.push(p);
    }
    onChange(next);
    setDraft('');
  }

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold" style={styles.label}>{label}</ThemedText>
      <View style={[styles.box, styles.tagsBox, { backgroundColor: theme.backgroundElement, borderColor: error ? Brand.danger : theme.border }]}>
        {tags.map((t) => (
          <Pressable key={t} onPress={() => onChange(tags.filter((x) => x !== t))} accessibilityRole="button" accessibilityLabel={`Retirer ${t}`} style={styles.tag}>
            <ThemedText style={styles.tagText}>{t}</ThemedText>
            <Ionicons name="close" size={13} color={Brand.primary} />
          </Pressable>
        ))}
        <TextInput
          value={draft}
          onChangeText={(v) => { setLocal(null); if (v.includes(',')) commit(v); else setDraft(v); }}
          onSubmitEditing={() => commit(draft)}
          onBlur={() => commit(draft)}
          blurOnSubmit={false}
          returnKeyType="done"
          placeholder={tags.length ? 'Ajouter…' : 'ex. robe, wax, coton'}
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          style={[styles.tagInput, { color: theme.text }]}
          accessibilityLabel={label}
        />
      </View>
      {error || local ? <ErrorLine text={(error ?? local)!} /> : <ThemedText type="small" themeColor="textSecondary">{hint ?? `${tags.length}/${max} · séparez par une virgule`}</ThemedText>}
    </View>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}
export function Col({ children }: { children: ReactNode }) {
  return <View style={styles.flex}>{children}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  disabled: { opacity: 0.55 },
  card: { borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 14 },
  cardIco: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 16, lineHeight: 21, fontWeight: '800' },
  cardBody: { padding: 14, gap: 12 },
  errorLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, paddingHorizontal: 2, marginTop: 4 },
  errorText: { color: Brand.danger, fontWeight: '600', flex: 1 },
  field: { gap: 5 },
  label: { paddingHorizontal: 2 },
  box: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.2, borderRadius: 12, paddingHorizontal: 12, minHeight: 48 },
  boxMulti: { alignItems: 'flex-start', paddingVertical: 8 },
  input: { flex: 1, fontSize: 15.5, paddingVertical: 10 },
  inputMulti: { minHeight: 96, textAlignVertical: 'top', paddingVertical: 2 },
  underRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  counter: { fontVariant: ['tabular-nums'] },
  selectText: { fontSize: 15.5 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.35)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '80%', paddingBottom: 8 },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#D0D5DD', marginTop: 8 },
  sheetTitle: { fontSize: 17, lineHeight: 22, fontWeight: '800', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 6 },
  sheetSearch: { marginHorizontal: 16, marginBottom: 6 },
  sheetList: { flexGrow: 0 },
  sheetEmpty: { textAlign: 'center', paddingVertical: 20 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 13 },
  optionText: { fontSize: 15.5 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  switchLabel: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  tagsBox: { flexWrap: 'wrap', paddingVertical: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: `${Brand.primary}14`, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  tagText: { color: Brand.primary, fontSize: 13, lineHeight: 17, fontWeight: '700' },
  tagInput: { flexGrow: 1, minWidth: 100, fontSize: 15, paddingVertical: 6 },
  row: { flexDirection: 'row', gap: 10 },
});
