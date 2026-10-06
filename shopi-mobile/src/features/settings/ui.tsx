/**
 * Briques visuelles des écrans « Paramètres » — thème blanc, mêmes codes que
 * le menu (menu.tsx) : titre de rubrique bleu précédé d'un trait, cartes
 * bordées aux coins arrondis, lignes avec pastille d'icône, interrupteurs,
 * états chargement / erreur, et un message bref en bas d'écran.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Switch,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Rubrique : « — TITRE » en bleu, puis son contenu. */
export function Section({ title, children, note }: { title?: string; children: ReactNode; note?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      {title ? (
        <View style={styles.sectionTitleRow}>
          <View style={styles.dash} />
          <ThemedText style={styles.sectionTitle} accessibilityRole="header">
            {title.toUpperCase()}
          </ThemedText>
        </View>
      ) : null}
      {children}
      {note ? (
        <ThemedText type="small" style={[styles.note, { color: theme.textSecondary }]}>
          {note}
        </ThemedText>
      ) : null}
    </View>
  );
}

/** Carte blanche bordée ; les lignes enfants sont séparées par un filet fin. */
export function Card({ children, danger, style }: { children: ReactNode; danger?: boolean; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const items = (Array.isArray(children) ? children : [children]).flat().filter(Boolean);
  return (
    <View style={[styles.card, { borderColor: danger ? '#F5C6C2' : theme.border }, style]}>
      {items.map((child, i) => (
        <View key={i} style={i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border } : undefined}>
          {child}
        </View>
      ))}
    </View>
  );
}

function IconTile({ icon, danger }: { icon: IconName; danger?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.rowIcon, { backgroundColor: danger ? '#FDECEA' : theme.backgroundElement }]}>
      <Ionicons name={icon} size={19} color={danger ? Brand.danger : Brand.primary} />
    </View>
  );
}

/**
 * Ligne de réglage. Selon `right` : chevron (ouvre un écran), flèche ↗ (page
 * du site), valeur texte, ou élément libre (interrupteur…).
 */
export function Row({
  icon,
  label,
  desc,
  value,
  onPress,
  external,
  danger,
  right,
  badge,
}: {
  icon?: IconName;
  label: string;
  desc?: string;
  value?: string;
  onPress?: () => void;
  external?: boolean;
  danger?: boolean;
  right?: ReactNode;
  badge?: number;
}) {
  const theme = useTheme();
  const content = (
    <>
      {icon ? <IconTile icon={icon} danger={danger} /> : null}
      <View style={styles.rowText}>
        <ThemedText style={[styles.rowLabel, danger && { color: Brand.danger }]}>{label}</ThemedText>
        {desc ? (
          <ThemedText type="small" themeColor="textSecondary">
            {desc}
          </ThemedText>
        ) : null}
      </View>
      {value ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.rowValue} numberOfLines={1}>
          {value}
        </ThemedText>
      ) : null}
      {badge ? (
        <View style={styles.badge}>
          <ThemedText style={styles.badgeText}>{badge}</ThemedText>
        </View>
      ) : null}
      {right ?? (onPress ? <Ionicons name={external ? 'open-outline' : 'chevron-forward'} size={17} color={theme.textSecondary} /> : null)}
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  /* Ligne cliquable ET élément interactif à droite (interrupteur) : deux zones
   * séparées — toucher l'interrupteur ne doit pas aussi ouvrir l'écran. */
  if (right) {
    return (
      <View style={[styles.row, styles.split]}>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={desc ? `${label}. ${desc}` : label}
          style={({ pressed }) => [styles.splitMain, pressed && { backgroundColor: theme.backgroundElement }]}>
          {icon ? <IconTile icon={icon} danger={danger} /> : null}
          <View style={styles.rowText}>
            <ThemedText style={[styles.rowLabel, danger && { color: Brand.danger }]}>{label}</ThemedText>
            {desc ? (
              <ThemedText type="small" themeColor="textSecondary">
                {desc}
              </ThemedText>
            ) : null}
          </View>
        </Pressable>
        <View style={styles.splitRight}>{right}</View>
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={desc ? `${label}. ${desc}` : label}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundElement }]}>
      {content}
    </Pressable>
  );
}

/** Interrupteur aux couleurs de la marque. */
export function Toggle({
  value,
  onChange,
  label,
  disabled,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Switch
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      accessibilityLabel={label}
      trackColor={{ false: theme.border, true: Brand.primary }}
      thumbColor="#ffffff"
      ios_backgroundColor={theme.border}
      /* react-native-web : couleur du rond une fois activé (sinon vert par défaut) */
      {...({ activeThumbColor: '#ffffff' } as object)}
    />
  );
}

/** Ligne avec interrupteur (libellé + description + switch). */
export function SwitchRow({
  icon,
  label,
  desc,
  value,
  onChange,
  disabled,
}: {
  icon?: IconName;
  label: string;
  desc?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Row
      icon={icon}
      label={label}
      desc={desc}
      right={<Toggle value={value} onChange={onChange} label={label} disabled={disabled} />}
    />
  );
}

/** Chargement / erreur avec « Réessayer » — à afficher tant que les données manquent. */
export function LoadState({ loading, error, onRetry }: { loading: boolean; error?: string | null; onRetry: () => void }) {
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Brand.primary} size="large" />
      </View>
    );
  }
  return (
    <View style={styles.center}>
      <Ionicons name="cloud-offline-outline" size={40} color="#A3A3A3" />
      <ThemedText themeColor="textSecondary" style={styles.centerText}>
        {error ?? 'Impossible de charger ces informations.'}
      </ThemedText>
      <Pressable onPress={onRetry} accessibilityRole="button" style={styles.retry}>
        <ThemedText type="smallBold" style={{ color: Brand.primary }}>
          Réessayer
        </ThemedText>
      </Pressable>
    </View>
  );
}

/** Bouton contour bleu pleine largeur (« Modifier… », « Vérifier… »). */
export function OutlineButton({
  icon,
  label,
  onPress,
  loading,
  danger,
  disabled,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  loading?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const color = danger ? Brand.danger : Brand.primary;
  const off = loading || disabled;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={({ pressed }) => [
        styles.outline,
        { borderColor: color, opacity: disabled ? 0.5 : 1 },
        pressed && { backgroundColor: danger ? '#FDECEA' : theme.backgroundSelected },
      ]}>
      {loading ? <ActivityIndicator color={color} /> : <Ionicons name={icon} size={18} color={color} />}
      <ThemedText type="smallBold" style={{ color }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** Lien discret centré (« Annuler », « Renvoyer le code »). */
export function TextButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={[styles.textBtn, disabled && { opacity: 0.5 }]}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** Pastille d'état (Vérifié, Actif…). */
export function Pill({ label, tone = 'neutral' }: { label: string; tone?: 'success' | 'warning' | 'neutral' | 'danger' }) {
  const colors = {
    success: { bg: '#E7F6EE', fg: Brand.success },
    warning: { bg: '#FFF4E0', fg: '#B26A00' },
    danger: { bg: '#FDECEA', fg: Brand.danger },
    neutral: { bg: '#F2F2F2', fg: '#6B6B6B' },
  }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: colors.bg }]}>
      <ThemedText style={[styles.pillText, { color: colors.fg }]}>{label}</ThemedText>
    </View>
  );
}

/**
 * Message bref en bas d'écran (« Enregistré », erreur…). Renvoie la fonction
 * d'affichage et l'élément à placer en dernier dans l'écran.
 */
export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const show = useCallback(
    (m: string) => {
      if (timer.current) clearTimeout(timer.current);
      setMessage(m);
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setMessage(null));
      }, 3200);
    },
    [opacity],
  );

  const element = message ? (
    <Animated.View style={[styles.toast, { opacity }]} pointerEvents="none" accessibilityLiveRegion="polite">
      <ThemedText type="smallBold" style={styles.toastText}>
        {message}
      </ThemedText>
    </Animated.View>
  ) : null;

  return { show, element };
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dash: { width: 18, height: 3, borderRadius: 2, backgroundColor: Brand.primary },
  sectionTitle: { fontSize: 13, lineHeight: 17, fontWeight: '800', letterSpacing: 1.6, color: Brand.primary },
  note: { paddingHorizontal: 4 },
  card: { borderWidth: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: '#ffffff' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, minHeight: 58 },
  split: { paddingHorizontal: 0, paddingVertical: 0 },
  splitMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 14, paddingVertical: 10, minHeight: 58 },
  splitRight: { paddingHorizontal: 14, paddingVertical: 10 },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 1 },
  rowLabel: { fontSize: 15, lineHeight: 21 },
  rowValue: { maxWidth: '45%' },
  badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: Brand.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { color: '#fff', fontSize: 11, lineHeight: 14, fontWeight: '800' },
  center: { alignItems: 'center', justifyContent: 'center', gap: Spacing.two, paddingVertical: Spacing.six },
  centerText: { textAlign: 'center', paddingHorizontal: Spacing.four },
  retry: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: Brand.primary },
  outline: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderRadius: 999, minHeight: 48, paddingHorizontal: 16 },
  textBtn: { alignItems: 'center', paddingVertical: 8 },
  pill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  pillText: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  toast: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    bottom: Spacing.five,
    backgroundColor: '#1F1F1F',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  toastText: { color: '#fff', textAlign: 'center' },
});
