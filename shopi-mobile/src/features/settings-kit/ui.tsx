/**
 * Briques communes des écrans « Paramètres » des espaces pro (livreur,
 * correspondant…) :
 *   · SettingsShell   barre de titre + chargement / erreur / « Réessayer » ;
 *   · FormCard, ToggleRow, Input, SaveButton, Hint, Badge, Sheet ;
 *   · toast() + ToastHost, confirmAction() (Alert natif, confirm sur le web) ;
 *   · useUnsavedGuard()  « Quitter sans enregistrer ? » au retour (le site
 *                        demande la même chose en changeant de section).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type { UseQueryResult } from '@tanstack/react-query';
import { useNavigation } from 'expo-router';
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field, PrimaryButton } from '@/components/form';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, toUserMessage } from '@/lib/api/errors';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];
export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export const TONE: Record<Tone, { fg: string; bg: string }> = {
  success: { fg: '#047857', bg: '#ECFDF5' },
  warning: { fg: '#B45309', bg: '#FFFBEB' },
  danger: { fg: '#B91C1C', bg: '#FEF2F2' },
  info: { fg: Brand.primary, bg: 'rgba(0,0,0,0.05)' },
  neutral: { fg: '#6B6B6B', bg: '#F6F6F6' },
};

/* ── Écran ─────────────────────────────────────────────────────────── */

/**
 * @param query    données de l'écran (fiche complète de l'espace, ou données
 *                 propres : notifications, confidentialité, zone sensible…).
 * @param children rendu une fois les données reçues.
 */
export function SettingsShell<T>({
  title,
  icon,
  subtitle,
  danger,
  query,
  loadingText = 'Chargement des paramètres…',
  children,
}: {
  title: string;
  icon: IconName;
  subtitle?: string;
  danger?: boolean;
  query: UseQueryResult<T>;
  loadingText?: string;
  children: (data: T) => ReactNode;
}) {
  const theme = useTheme();
  const q = query;

  let body: ReactNode;
  if (q.isPending) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator color={Brand.primary} />
        <ThemedText type="small" themeColor="textSecondary">
          {loadingText}
        </ThemedText>
      </View>
    );
  } else if (q.isError || q.data === undefined) {
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
            <View style={[styles.introIco, danger && { backgroundColor: TONE.danger.bg }]}>
              <Ionicons name={icon} size={20} color={danger ? Brand.danger : Brand.primary} />
            </View>
            {subtitle ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                {subtitle}
              </ThemedText>
            ) : null}
          </View>
          {children(q.data)}
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

export function FormCard({ title, subtitle, icon, right, danger, children }: { title: string; subtitle?: string; icon: IconName; right?: ReactNode; danger?: boolean; children: ReactNode }) {
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
  note,
  icon,
  value,
  onChange,
  disabled,
  first,
}: {
  label: string;
  sub?: string;
  /** Effet du choix actuel, en italique (confidentialité). */
  note?: string;
  icon?: IconName;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  first?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => {
        if (!disabled) onChange(!value);
      }}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      aria-checked={value}
      style={[
        styles.toggle,
        !first && {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.border,
        },
      ]}>
      {icon ? <Ionicons name={icon} size={18} color={Brand.primary} style={styles.toggleIco} /> : null}
      <View style={styles.flex}>
        <ThemedText style={styles.toggleLabel}>{label}</ThemedText>
        {sub ? (
          <ThemedText type="small" themeColor="textSecondary">
            {sub}
          </ThemedText>
        ) : null}
        {note ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            {note}
          </ThemedText>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={(v) => {
          if (!disabled) onChange(v);
        }}
        disabled={disabled}
        trackColor={{ true: Brand.primary, false: '#D4D4D4' }}
        thumbColor="#fff"
        // react-native-web : rond vert par défaut sans cette couleur
        {...({ activeThumbColor: '#fff' } as object)}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    </Pressable>
  );
}

/* ── Champ texte + compteur ────────────────────────────────────────── */

export function Input(
  props: TextInputProps & {
    label?: string;
    error?: string | null;
    hint?: string;
    counter?: number;
    left?: ReactNode;
  },
) {
  const { hint, counter, ...rest } = props;
  return (
    <View style={styles.inputWrap}>
      <Field {...rest} maxLength={counter ?? props.maxLength} />
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

export function Badge({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const c = TONE[tone];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      {icon ? <Ionicons name={icon} size={12} color={c.fg} /> : null}
      <ThemedText style={[styles.badgeText, { color: c.fg }]}>{label}</ThemedText>
    </View>
  );
}

/* ── Feuille du bas (confirmation, 2FA…) ───────────────────────────── */

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const theme = useTheme();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fermer" />
        <SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: theme.background }]}>
          <View style={styles.sheetHead}>
            <ThemedText style={styles.sheetTitle}>{title}</ThemedText>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fermer">
              <Ionicons name="close" size={24} color={theme.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
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
/** Message d'erreur lisible : les limites d'essais du serveur (429, message anglais du limiteur) sont traduites. */
export function errorMessage(e: unknown, fallback = 'Erreur lors de la sauvegarde') {
  if (e instanceof ApiError && e.isRateLimited) return 'Trop de tentatives en peu de temps : patientez quelques minutes avant de réessayer.';
  return e instanceof Error && e.message ? e.message : fallback;
}
export const toastError = (e: unknown, fallback = 'Erreur lors de la sauvegarde') => toast(errorMessage(e, fallback), 'danger');

function ToastHost() {
  const msg = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
  if (!msg) return null;
  const icon: IconName = msg.tone === 'danger' ? 'alert-circle' : msg.tone === 'warning' ? 'warning' : msg.tone === 'info' ? 'time-outline' : 'checkmark-circle';
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
      {
        text: ok,
        style: destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]),
  );
}

/** Retour arrière avec une saisie non enregistrée → confirmation (comme le site). */
export function useUnsavedGuard(dirty: boolean) {
  const navigation = useNavigation();
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (!dirtyRef.current) return;
        e.preventDefault();
        void confirmAction('Modifications non enregistrées', 'Vous avez des modifications non sauvegardées. Quitter quand même ?', 'Quitter', true).then((ok) => {
          if (ok) {
            dirtyRef.current = false;
            navigation.dispatch(e.data.action);
          }
        });
      }),
    [navigation],
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  centerText: { textAlign: 'center' },
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  intro: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  introIco: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: TONE.info.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  cardIco: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 15.5, lineHeight: 20, fontWeight: '800' },
  cardBody: { padding: 14, gap: 12 },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  toggleIco: { alignSelf: 'flex-start', marginTop: 1 },
  toggleLabel: { fontSize: 14.5, lineHeight: 19, fontWeight: '700' },
  note: { fontStyle: 'italic', marginTop: 3 },
  inputWrap: { gap: 4 },
  hintRow: { flexDirection: 'row', gap: 8, marginTop: -4 },
  hint: { flexDirection: 'row', gap: 8, borderRadius: 12, padding: 12 },
  hintIco: { marginTop: 1 },
  hintText: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 11.5, lineHeight: 15, fontWeight: '800' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
  },
  sheetTitle: { flex: 1, fontSize: 17, lineHeight: 22, fontWeight: '900' },
  sheetBody: { paddingHorizontal: 16, paddingBottom: 24, gap: 14 },
  toastWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 28,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1F1F1F',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    maxWidth: 480,
  },
  toastText: {
    color: '#fff',
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '700',
    flexShrink: 1,
  },
});
