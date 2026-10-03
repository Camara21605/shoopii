/**
 * Briques communes des écrans « Paramètres » de la boutique :
 *   · SettingsShell  barre de titre, chargement / erreur, accès refusé,
 *                    bandeau « Lecture seule » (collaborateur sans settings.edit) ;
 *   · FormCard, ToggleRow, Input, SaveButton, Hint, Badge ;
 *   · toast() + ToastHost, confirmAction() (Alert natif, confirm sur le web).
 *
 * Le mode lecture seule passe par un contexte (équivalent du <fieldset disabled>
 * du site) : champs, interrupteurs et boutons se désactivent tout seuls.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field, PrimaryButton } from '@/components/form';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';

import { useSettings, useSettingsAccess } from '../hooks';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];
export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export const TONE: Record<Tone, { fg: string; bg: string }> = {
  success: { fg: '#047857', bg: '#ECFDF5' },
  warning: { fg: '#B45309', bg: '#FFFBEB' },
  danger: { fg: '#B91C1C', bg: '#FEF2F2' },
  info: { fg: Brand.primary, bg: '#F2F2F2' },
  neutral: { fg: '#6B6B6B', bg: '#F5F5F5' },
};

/* ── Lecture seule ─────────────────────────────────────────────────── */

const EditableContext = createContext(true);
export const useEditable = () => useContext(EditableContext);

/* ── Écran ─────────────────────────────────────────────────────────── */

export function SettingsShell({
  title,
  icon,
  subtitle,
  children,
  alwaysEditable,
  ownerOnly,
}: {
  title: string;
  icon: IconName;
  subtitle?: string;
  children: ReactNode;
  /** Préférence personnelle (langue) : jamais en lecture seule. */
  alwaysEditable?: boolean;
  /** Section réservée au propriétaire (zone sensible) : le bandeau est géré par l'écran. */
  ownerOnly?: boolean;
}) {
  const theme = useTheme();
  const access = useSettingsAccess();
  const q = useSettings();
  const editable = alwaysEditable || access.canEdit;

  let body: ReactNode;
  if (access.loading || (q.isPending && access.canView)) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator color={Brand.primary} />
        <ThemedText type="small" themeColor="textSecondary">
          Chargement des paramètres…
        </ThemedText>
      </View>
    );
  } else if (!access.canView) {
    body = (
      <View style={styles.center}>
        <Ionicons name="lock-closed" size={36} color={theme.textSecondary} />
        <ThemedText style={styles.deniedTitle}>Accès non autorisé</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          Votre rôle dans l’équipe ne permet pas de consulter les paramètres de la boutique. Demandez l’accès au propriétaire.
        </ThemedText>
      </View>
    );
  } else if (q.isError || !q.data) {
    body = (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={36} color={theme.textSecondary} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          {toUserMessage(q.error)}
        </ThemedText>
        <PrimaryButton title="Réessayer" onPress={() => void q.refetch()} pill />
      </View>
    );
  } else {
    body = (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.intro}>
            <View style={styles.introIco}>
              <Ionicons name={icon} size={20} color={Brand.primary} />
            </View>
            {subtitle ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                {subtitle}
              </ThemedText>
            ) : null}
          </View>
          {!editable && !ownerOnly ? (
            <Hint icon="lock-closed" tone="neutral" text="Lecture seule — vous pouvez consulter ces paramètres mais pas les modifier." />
          ) : null}
          <EditableContext.Provider value={editable}>{children}</EditableContext.Provider>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title={title} />
      {body}
      <ToastHost />
    </SafeAreaView>
  );
}

/* ── Carte de formulaire ───────────────────────────────────────────── */

export function FormCard({
  title,
  subtitle,
  icon,
  right,
  danger,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: IconName;
  right?: ReactNode;
  danger?: boolean;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { borderColor: danger ? '#FECACA' : theme.border }]}>
      <View style={styles.cardHead}>
        <View style={[styles.cardIco, { backgroundColor: danger ? TONE.danger.bg : TONE.info.bg }]}>
          <Ionicons name={icon} size={17} color={danger ? Brand.danger : Brand.primary} />
        </View>
        <View style={styles.flex}>
          <ThemedText style={styles.cardTitle}>{title}</ThemedText>
          {subtitle ? (
            <ThemedText type="small" themeColor="textSecondary">
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
        {right}
      </View>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

/* ── Interrupteur ──────────────────────────────────────────────────── */

export function ToggleRow({
  label,
  sub,
  value,
  onChange,
  disabled,
  busy,
  first,
}: {
  label: string;
  sub?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  busy?: boolean;
  first?: boolean;
}) {
  const theme = useTheme();
  const editable = useEditable();
  const off = disabled || !editable;
  return (
    <Pressable
      onPress={() => {
        if (!off) onChange(!value);
      }}
      disabled={off}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: off }}
      style={[styles.toggle, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
      <View style={styles.flex}>
        <ThemedText style={styles.toggleLabel}>{label}</ThemedText>
        {sub ? (
          <ThemedText type="small" themeColor="textSecondary">
            {sub}
          </ThemedText>
        ) : null}
      </View>
      {busy ? <ActivityIndicator size="small" color={Brand.primary} style={styles.busy} /> : null}
      <Switch
        value={value}
        onValueChange={(v) => {
          if (!off) onChange(v);
        }}
        disabled={off}
        trackColor={{ true: Brand.primary, false: '#D4D4D4' }}
        thumbColor="#fff"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    </Pressable>
  );
}

/* ── Champ texte (suit le mode lecture seule) ──────────────────────── */

export function Input(props: TextInputProps & { label?: string; error?: string | null; hint?: string; counter?: number }) {
  const editable = useEditable();
  const { hint, counter, ...rest } = props;
  return (
    <View style={styles.inputWrap}>
      <Field {...rest} editable={editable && props.editable !== false} />
      {hint || counter ? (
        <View style={styles.hintRow}>
          {hint ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
              {hint}
            </ThemedText>
          ) : (
            <View style={styles.flex} />
          )}
          {counter ? (
            <ThemedText type="small" themeColor="textSecondary">
              {String(props.value ?? '').length} / {counter}
            </ThemedText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function SaveButton({ label, onPress, loading, disabled }: { label: string; onPress: () => void; loading?: boolean; disabled?: boolean }) {
  const editable = useEditable();
  if (!editable) return null;
  return <PrimaryButton title={label} onPress={onPress} loading={loading} disabled={disabled} pill />;
}

/* ── Message, pastille ─────────────────────────────────────────────── */

export function Hint({ icon = 'information-circle', text, tone = 'info', children }: { icon?: IconName; text?: string; tone?: Tone; children?: ReactNode }) {
  const c = TONE[tone];
  return (
    <View style={[styles.hint, { backgroundColor: c.bg }]}>
      <Ionicons name={icon} size={16} color={c.fg} style={styles.hintIco} />
      <View style={styles.flex}>
        {text ? <ThemedText style={[styles.hintText, { color: c.fg }]}>{text}</ThemedText> : null}
        {children}
      </View>
    </View>
  );
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const c = TONE[tone];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <ThemedText style={[styles.badgeText, { color: c.fg }]}>{label}</ThemedText>
    </View>
  );
}

/* ── Toast (message bref en bas d'écran) ───────────────────────────── */

type ToastMsg = { text: string; tone: Tone; id: number } | null;
let current: ToastMsg = null;
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Message bref, effacé au bout de 2,8 s (même si l'on change d'écran entre-temps). */
export function toast(text: string, tone: Tone = 'success') {
  const id = ++seq;
  current = { text, tone, id };
  emit();
  setTimeout(() => {
    if (current?.id === id) {
      current = null;
      emit();
    }
  }, 2800);
}
export const toastError = (e: unknown, fallback = 'Erreur lors de la sauvegarde') =>
  toast(e instanceof Error && e.message ? e.message : fallback, 'danger');

function ToastHost() {
  const msg = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
  if (!msg) return null;
  const icon: IconName = msg.tone === 'danger' ? 'alert-circle' : msg.tone === 'warning' ? 'warning' : 'checkmark-circle';
  return (
    <View pointerEvents="none" style={styles.toastWrap}>
      <View style={styles.toast} accessibilityLiveRegion="polite" accessibilityRole="alert">
        <Ionicons name={icon} size={18} color={msg.tone === 'danger' ? '#FCA5A5' : msg.tone === 'warning' ? '#FCD34D' : '#6EE7B7'} />
        <ThemedText style={styles.toastText}>{msg.text}</ThemedText>
      </View>
    </View>
  );
}

/* ── Confirmation ──────────────────────────────────────────────────── */

export function confirmAction(title: string, message: string, ok: string, destructive = false): Promise<boolean> {
  if (Platform.OS === 'web') {
    const c = (globalThis as { confirm?: (m: string) => boolean }).confirm;
    return Promise.resolve(c ? c(`${title}\n\n${message}`) : true);
  }
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
      { text: ok, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]),
  );
}

export const gnf = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} GNF`;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  centerText: { textAlign: 'center' },
  deniedTitle: { fontSize: 18, lineHeight: 24, fontWeight: '900' },
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  intro: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  introIco: { width: 38, height: 38, borderRadius: 12, backgroundColor: TONE.info.bg, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 1, borderRadius: 18, overflow: 'hidden', backgroundColor: '#fff' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 14 },
  cardIco: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15.5, lineHeight: 20, fontWeight: '800' },
  cardBody: { padding: 14, gap: 12 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  toggleLabel: { fontSize: 14.5, lineHeight: 19, fontWeight: '700' },
  busy: { marginRight: 2 },
  inputWrap: { gap: 4 },
  hintRow: { flexDirection: 'row', gap: 8, marginTop: -4 },
  hint: { flexDirection: 'row', gap: 8, borderRadius: 12, padding: 12 },
  hintIco: { marginTop: 1 },
  hintText: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11.5, lineHeight: 15, fontWeight: '800' },
  toastWrap: { position: 'absolute', left: 16, right: 16, bottom: 28, alignItems: 'center' },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#111111', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, maxWidth: 480 },
  toastText: { color: '#fff', fontSize: 13.5, lineHeight: 18, fontWeight: '700', flexShrink: 1 },
});
