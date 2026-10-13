/**
 * Paramètres du correspondant — écran d'accueil, organisé comme le menu
 * « Paramètres » du site sur téléphone (ParamMobileMenu.tsx) :
 *   en-tête profil (photo, nom, complétion, vérification) → Profil & identité ;
 *   Identité : profil, point de dépôt · Activité : zone & horaires, entités
 *   partenaires, gestion des colis · Finances : paiement · Compte : documents,
 *   sécurité, notifications, confidentialité, langue · Zone sensible ·
 *   Se déconnecter.
 * Chaque rubrique affiche un résumé de son état RÉEL (le site affiche des
 * pourcentages qui comptent aussi des réglages sans effet). Une rubrique pas
 * encore disponible dans l'application s'ouvre sur le site (↗).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/form';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useSession } from '@/features/auth/session-store';
import { openSite } from '@/features/catalog/open';
import { Badge, confirmAction, type IconName, type Tone } from '@/features/settings-kit';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';

import { completionPct, COMPLETION_STEPS, displayName, RELAY_TYPES, VERIFICATION, type CorrespondantSettings } from '../api';
import { useCorrespondantSettings } from '../hooks';

/** `href` : écran de l'application ; sinon la section s'ouvre sur le site (`?section=<web>`). */
type Item = { key: string; label: string; icon: IconName; href?: Href };

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: 'Identité',
    items: [
      { key: 'profil', label: 'Profil & identité', icon: 'person-outline', href: '/correspondant/parametres/profil' },
      { key: 'depot', label: 'Point de dépôt', icon: 'storefront-outline', href: '/correspondant/parametres/depot' },
    ],
  },
  {
    title: 'Activité',
    items: [
      { key: 'zone', label: 'Zone & horaires', icon: 'map-outline', href: '/correspondant/parametres/zone' },
      { key: 'entites', label: 'Entités partenaires', icon: 'people-outline', href: '/correspondant/parametres/entites' },
      { key: 'colis', label: 'Gestion des colis', icon: 'cube-outline', href: '/correspondant/parametres/colis' },
    ],
  },
  { title: 'Finances', items: [{ key: 'paiement', label: 'Paiement', icon: 'wallet-outline', href: '/correspondant/parametres/paiement' }] },
  {
    title: 'Compte',
    items: [
      { key: 'documents', label: 'Documents', icon: 'document-lock-outline', href: '/correspondant/parametres/documents' },
      { key: 'securite', label: 'Sécurité', icon: 'lock-closed-outline', href: '/correspondant/parametres/securite' },
      { key: 'notifications', label: 'Notifications', icon: 'notifications-outline', href: '/correspondant/parametres/notifications' },
      { key: 'confidentialite', label: 'Confidentialité', icon: 'shield-half-outline', href: '/correspondant/parametres/confidentialite' },
      { key: 'langue', label: 'Langue', icon: 'language-outline', href: '/correspondant/parametres/langue' },
    ],
  },
];
const DANGER: Item = { key: 'danger', label: 'Zone sensible', icon: 'warning-outline', href: '/correspondant/parametres/zone-sensible' };

const open = (it: Item) => (it.href ? router.push(it.href) : openSite(`/dashboard/correspondant/parametres?section=${it.key}`));

export default function CorrespondantSettingsHomeScreen() {
  const theme = useTheme();
  const q = useCorrespondantSettings();
  const signOut = useSession((s) => s.signOut);
  const d = q.data;

  const logout = async () => {
    if (await confirmAction('Se déconnecter ?', 'Vous devrez saisir à nouveau votre mot de passe.', 'Se déconnecter', true)) void signOut();
  };

  let body;
  if (q.isPending) {
    body = <ActivityIndicator color={Brand.primary} style={styles.loader} />;
  } else if (!d) {
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
    const pct = completionPct(d);
    const missing = COMPLETION_STEPS.filter((s) => !s.done(d)).map((s) => s.label);
    const verif = VERIFICATION[d.verificationStatus] ?? VERIFICATION.unverified;
    const name = displayName(d);
    body = (
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          onPress={() => router.push('/correspondant/parametres/profil')}
          accessibilityRole="button"
          accessibilityLabel={`Profil et identité : ${name}, profil complété à ${pct}%`}
          style={({ pressed }) => [styles.head, { borderColor: theme.border }, pressed && { backgroundColor: theme.backgroundElement }]}>
          <View style={styles.headTop}>
            <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
              {d.profilePicture ? <Image source={{ uri: d.profilePicture }} style={styles.fill} contentFit="cover" /> : <ThemedText style={styles.emoji}>📍</ThemedText>}
            </View>
            <View style={styles.flex}>
              <ThemedText style={styles.name} numberOfLines={1}>
                {name || 'Mon profil'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Point relais {RELAY_TYPES.find((t) => t.value === d.typeCorrespondant)?.label.toLowerCase() ?? ''} · Profil & identité
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </View>
          <View style={styles.compRow}>
            <ThemedText style={styles.compLabel}>Profil complété à {pct}%</ThemedText>
            <Badge label={verif.label} tone={verif.tone} />
          </View>
          <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
            <View style={[styles.bar, { width: `${pct}%`, backgroundColor: pct === 100 ? Brand.success : Brand.primary }]} />
          </View>
          {missing.length ? (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
              À compléter : {missing.join(', ')}.
            </ThemedText>
          ) : null}
        </Pressable>

        {GROUPS.map((g) => (
          <View key={g.title} style={styles.group}>
            <View style={styles.groupHead}>
              <View style={styles.dash} />
              <ThemedText style={styles.groupTitle}>{g.title.toUpperCase()}</ThemedText>
            </View>
            <View style={[styles.card, { borderColor: theme.border }]}>
              {g.items.map((it, i) => (
                <Row key={it.key} item={it} first={i === 0} right={rightOf(it.key, d)} />
              ))}
            </View>
          </View>
        ))}

        <View style={[styles.card, { borderColor: '#FECACA' }]}>
          <Row item={DANGER} first danger right={d.status === 'disabled' ? { text: 'En pause', tone: 'warning' } : d.status !== 'active' ? { text: 'Compte non actif', tone: 'warning' } : undefined} />
        </View>

        <Pressable onPress={() => void logout()} accessibilityRole="button" style={[styles.logout, { borderColor: theme.border }]}>
          <Ionicons name="log-out-outline" size={20} color={Brand.danger} />
          <ThemedText type="smallBold" style={{ color: Brand.danger }}>
            Se déconnecter
          </ThemedText>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title="Paramètres" />
      {body}
    </SafeAreaView>
  );
}

/** Résumé de l'état réel de la rubrique (à droite de la ligne). */
function rightOf(key: string, d: CorrespondantSettings): { text: string; tone?: Tone } | undefined {
  if (key === 'depot') return d.depotAdresse ? { text: d.depotQuartier || d.depotVille || 'Adresse renseignée' } : { text: 'À renseigner', tone: 'warning' };
  if (key === 'zone') {
    const n = d.zonesActives?.length ?? 0;
    const days = d.horaires.filter((h) => h.actif).length;
    return n ? { text: `${n} zone${n > 1 ? 's' : ''} · ${days} j/7` } : { text: 'Aucune zone', tone: 'warning' };
  }
  if (key === 'colis') return { text: `Délai ${d.colisDelaiMax || 3} j` };
  if (key === 'documents') {
    const v = VERIFICATION[d.verificationStatus] ?? VERIFICATION.unverified;
    return { text: v.label, tone: v.tone === 'success' ? 'success' : v.tone === 'danger' || d.verificationStatus === 'unverified' ? 'warning' : undefined };
  }
  if (key === 'securite') return d.twoFaEnabled ? { text: '2FA activée', tone: 'success' } : { text: '2FA non activée' };
  if (key === 'langue') return { text: 'Français' };
  return undefined;
}

function Row({ item, first, right, danger }: { item: Item; first?: boolean; right?: { text: string; tone?: Tone }; danger?: boolean }) {
  const theme = useTheme();
  const color = danger ? Brand.danger : Brand.primary;
  const rightColor = right?.tone === 'warning' ? '#B45309' : right?.tone === 'success' ? '#047857' : undefined;
  return (
    <Pressable
      onPress={() => open(item)}
      accessibilityRole="button"
      accessibilityLabel={`${item.label}${right ? `, ${right.text}` : ''}${item.href ? '' : ' (sur le site)'}`}
      style={({ pressed }) => [styles.row, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }, pressed && { backgroundColor: theme.backgroundElement }]}>
      <View style={[styles.ico, { backgroundColor: danger ? '#FEF2F2' : theme.backgroundSelected }]}>
        <Ionicons name={item.icon} size={19} color={color} />
      </View>
      <ThemedText style={[styles.label, danger && { color: Brand.danger, fontWeight: '700' }]}>{item.label}</ThemedText>
      {right ? (
        <ThemedText type="small" themeColor="textSecondary" style={[styles.right, rightColor ? { color: rightColor, fontWeight: '700' } : null]} numberOfLines={1}>
          {right.text}
        </ThemedText>
      ) : null}
      <Ionicons name={item.href ? 'chevron-forward' : 'open-outline'} size={item.href ? 17 : 14} color={theme.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loader: { marginTop: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  centerText: { textAlign: 'center' },
  content: { padding: 16, gap: 18, paddingBottom: 40 },
  head: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 },
  headTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  fill: { width: '100%', height: '100%' },
  emoji: { fontSize: 26, lineHeight: 32 },
  name: { fontSize: 17, lineHeight: 22, fontWeight: '900' },
  compRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  compLabel: { fontSize: 13, lineHeight: 17, fontWeight: '800' },
  track: { height: 7, borderRadius: 4, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 4 },
  group: { gap: 10 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dash: { width: 18, height: 3, borderRadius: 2, backgroundColor: Brand.primary },
  groupTitle: { fontSize: 12.5, lineHeight: 17, fontWeight: '800', letterSpacing: 1.5, color: Brand.primary },
  card: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, minHeight: 54 },
  ico: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontSize: 15 },
  right: { maxWidth: 150 },
  logout: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 999, minHeight: 50 },
});
