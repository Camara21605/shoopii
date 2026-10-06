/**
 * Espace livreur › Mon profil — équivalent mobile de /dashboard/livreur/profil
 * (MonProfilLivreurPage) : le profil PUBLIC du livreur connecté, exactement tel
 * que les boutiques et les clients le voient (GET /client/livreurs/:id — note ou
 * nombre de livraisons absents s'ils sont masqués en Confidentialité).
 * En plus, réservé au livreur :
 *   · « Modifier mon profil » et « Partager mon profil » (lien public du site) ;
 *   · complétion du profil (mêmes 6 étapes que les Paramètres) + ce qu'il manque
 *     pour un profil attractif (bio, langues, téléphone), chacun avec un raccourci
 *     vers la bonne rubrique des Paramètres ;
 *   · ce que le public ne voit pas : confidentialité (recherche, note, nombre de
 *     livraisons, position précise) et activité en pause / désactivée.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Share, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/form';
import { useSnack } from '@/components/snack';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useActorContact } from '@/features/company-drivers/components';
import { completionPct, COMPLETION_STEPS, fetchDanger, fetchPrivacy, fetchSettings, stepDone, VERIFICATION, type LivreurSettings } from '@/features/livreur-settings/api';
import { fetchDriverProfile } from '@/features/livreur-network/api';
import { DriverProfileView } from '@/features/livreur-network/components';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';
import { hideOnScroll } from '@/lib/scroll-chrome';

import { CARD, LivreurScreen } from '../components';

const SITE = 'https://www.shoneya.com';
type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Rubrique des Paramètres où compléter chaque étape. */
const STEP_LINK: Record<string, Href> = {
  Photo: '/livreur/parametres/profil',
  Identité: '/livreur/parametres/profil',
  Zones: '/livreur/parametres/zone',
  Véhicule: '/livreur/parametres/vehicule',
  Horaires: '/livreur/parametres/zone',
  Documents: '/livreur/parametres/documents',
};

export default function MyProfileScreen() {
  const theme = useTheme();
  const snack = useSnack();
  const settings = useQuery({ queryKey: qk.livreur.settings, queryFn: fetchSettings, staleTime: 60_000 });
  const id = settings.data?.id;
  const profile = useQuery({ queryKey: qk.livreur.driver(id ?? ''), queryFn: () => fetchDriverProfile(id!), enabled: !!id });
  const privacy = useQuery({ queryKey: qk.livreur.privacy, queryFn: fetchPrivacy });
  const danger = useQuery({ queryKey: qk.livreur.danger, queryFn: fetchDanger });
  const contact = useActorContact('delivery');

  const refresh = () => {
    void settings.refetch();
    if (id) void profile.refetch();
    void privacy.refetch();
    void danger.refetch();
  };
  /* Retour depuis les Paramètres : le profil public reflète aussitôt les changements */
  useFocusEffect(
    useCallback(() => {
      /* refetch() ignore « enabled » : jamais sans l'identifiant du livreur */
      if (id) void profile.refetch();
      void privacy.refetch();
      void danger.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]),
  );

  const share = async () => {
    if (!id) return;
    const url = `${SITE}/livreurs/${id}`;
    try {
      await Share.share({ message: `${settings.data?.fullName ?? 'Mon profil'} — livreur sur Shoneya\n${url}`, url });
    } catch {
      await Clipboard.setStringAsync(url);
      snack.show('🔗 Lien du profil copié');
    }
  };

  let body: React.ReactNode;
  if (settings.isPending || (id && profile.isPending)) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator color={Brand.primary} />
        <ThemedText type="small" themeColor="textSecondary">
          Chargement du profil…
        </ThemedText>
      </View>
    );
  } else if (settings.isError || profile.isError || !profile.data || !settings.data) {
    body = (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={36} color={theme.textSecondary} />
        <ThemedText style={styles.bold}>Profil introuvable.</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          {toUserMessage(settings.error ?? profile.error)}
        </ThemedText>
        <PrimaryButton title="Réessayer" onPress={refresh} pill />
      </View>
    );
  } else {
    const d = settings.data;
    body = (
      <ScrollView
        {...hideOnScroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={profile.isRefetching} onRefresh={refresh} colors={[Brand.primary]} tintColor={Brand.primary} />}>
        {/* ── Aperçu public + actions ── */}
        <View style={[styles.preview, { borderColor: theme.border }]}>
          <Ionicons name="eye-outline" size={18} color={Brand.primary} />
          <ThemedText type="small" style={styles.flex}>
            <ThemedText type="smallBold">Votre profil public</ThemedText> — tel que les boutiques et les clients le voient.
          </ThemedText>
        </View>
        <View style={styles.actions}>
          <Pressable onPress={() => router.push('/livreur/parametres/profil')} accessibilityRole="button" accessibilityLabel="Modifier mon profil" style={[styles.action, styles.actionMain]}>
            <Ionicons name="create-outline" size={17} color="#fff" />
            <ThemedText style={styles.actionMainText}>Modifier mon profil</ThemedText>
          </Pressable>
          <Pressable onPress={() => void share()} accessibilityRole="button" accessibilityLabel="Partager mon profil" style={[styles.action, { borderColor: theme.border, borderWidth: 1 }]}>
            <Ionicons name="share-social-outline" size={17} color={Brand.primary} />
            <ThemedText style={styles.actionText}>Partager</ThemedText>
          </Pressable>
        </View>

        <Completion d={d} />
        <Visibility privacy={privacy.data} danger={danger.data} verification={d.verificationStatus} />

        <DriverProfileView p={profile.data} self onCall={() => undefined} calling={false} contact={contact} notify={snack.show} />
      </ScrollView>
    );
  }

  return (
    <LivreurScreen title="Mon profil" subtitle="Votre profil public sur Shoneya" snack={snack.msg}>
      {body}
    </LivreurScreen>
  );
}

/* ── Complétion + conseils ─────────────────────────────────────────── */

function Completion({ d }: { d: LivreurSettings }) {
  const theme = useTheme();
  const pct = completionPct(d);
  const missing: { label: string; why: string; to: Href }[] = COMPLETION_STEPS.filter((s) => !stepDone(d, s.key)).map((s) => ({
    label: s.label,
    why: s.label === 'Documents' ? 'Envoyez votre CNI pour être vérifié' : `${s.label} à renseigner`,
    to: STEP_LINK[s.label] ?? '/livreur/parametres',
  }));
  /* Conseils en plus des 6 étapes : ce que les clients regardent sur un profil */
  if (!d.bio) missing.push({ label: 'Bio', why: 'Présentez-vous en quelques mots (expérience, zones, spécialités)', to: '/livreur/parametres/profil' });
  if (!d.langues) missing.push({ label: 'Langues', why: 'Indiquez les langues que vous parlez', to: '/livreur/parametres/profil' });
  if (!d.phone) missing.push({ label: 'Téléphone', why: 'Un numéro de contact rassure les boutiques', to: '/livreur/parametres/profil' });

  return (
    <View style={[styles.box, { backgroundColor: CARD }]}>
      <View style={styles.row}>
        <ThemedText style={[styles.bold, styles.flex]}>Profil complété à {pct}%</ThemedText>
        {pct === 100 && missing.length === 0 ? <Ionicons name="checkmark-circle" size={20} color="#047857" /> : null}
      </View>
      <View style={[styles.track, { backgroundColor: theme.background }]}>
        <View style={[styles.bar, { width: `${pct}%`, backgroundColor: pct === 100 ? Brand.success : Brand.primary }]} />
      </View>
      {missing.length ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            Un profil complet reçoit 3× plus de missions. À faire :
          </ThemedText>
          {missing.map((m) => (
            <Pressable
              key={m.label}
              onPress={() => router.push(m.to)}
              accessibilityRole="button"
              accessibilityLabel={`${m.label} : ${m.why}`}
              style={({ pressed }) => [styles.todo, { borderColor: theme.border, backgroundColor: theme.background }, pressed && styles.pressed]}>
              <Ionicons name="add-circle-outline" size={18} color={Brand.primary} />
              <View style={styles.flex}>
                <ThemedText type="smallBold">{m.label}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {m.why}
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            </Pressable>
          ))}
        </>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          Bravo, votre profil est complet.
        </ThemedText>
      )}
    </View>
  );
}

/* ── Ce que le public ne voit pas ──────────────────────────────────── */

function Visibility({
  privacy,
  danger,
  verification,
}: {
  privacy?: { showInSearch: boolean; showRating: boolean; showDeliveryCount: boolean; shareLocation: boolean };
  danger?: { etat: string; jusquau: string | null };
  verification: string;
}) {
  const theme = useTheme();
  const items: { icon: IconName; text: string; to: Href; warn?: boolean }[] = [];
  if (danger && (danger.etat === 'pause' || danger.etat === 'desactive'))
    items.push({ icon: 'pause-circle-outline', text: 'Activité en pause : vous êtes masqué et ne recevez plus de nouvelles livraisons.', to: '/livreur/parametres/zone-sensible', warn: true });
  if (danger && (danger.etat === 'suspendu' || danger.etat === 'banni'))
    items.push({ icon: 'ban-outline', text: 'Compte suspendu : contactez votre entreprise ou Shoneya.', to: '/livreur/parametres/zone-sensible', warn: true });
  if (privacy && !privacy.showInSearch)
    items.push({ icon: 'search-outline', text: 'Vous n’apparaissez pas dans les recherches : seules les personnes qui ont le lien voient ce profil.', to: '/livreur/parametres/confidentialite' });
  if (privacy && !privacy.showRating) items.push({ icon: 'star-outline', text: 'Votre note est masquée.', to: '/livreur/parametres/confidentialite' });
  if (privacy && !privacy.showDeliveryCount) items.push({ icon: 'cube-outline', text: 'Votre nombre de livraisons est masqué.', to: '/livreur/parametres/confidentialite' });
  if (privacy && !privacy.shareLocation) items.push({ icon: 'location-outline', text: 'La carte vous place dans votre zone, pas à votre position exacte.', to: '/livreur/parametres/confidentialite' });
  const v = VERIFICATION[verification] ?? VERIFICATION.pending;
  if (verification !== 'verified') items.push({ icon: 'shield-outline', text: `Vérification du dossier : ${v.label.toLowerCase()}.`, to: '/livreur/parametres/documents' });

  if (!items.length) return null;
  return (
    <View style={[styles.box, { backgroundColor: CARD }]}>
      <ThemedText style={styles.bold}>Ce que le public ne voit pas</ThemedText>
      {items.map((it) => (
        <Pressable
          key={it.text}
          onPress={() => router.push(it.to)}
          accessibilityRole="button"
          accessibilityLabel={it.text}
          style={({ pressed }) => [styles.todo, { borderColor: it.warn ? '#FECACA' : theme.border, backgroundColor: theme.background }, pressed && styles.pressed]}>
          <Ionicons name={it.icon} size={18} color={it.warn ? Brand.danger : Brand.primary} />
          <ThemedText type="small" style={styles.flex}>
            {it.text}
          </ThemedText>
          <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pressed: { opacity: 0.8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  centerText: { textAlign: 'center' },
  content: { padding: 16, gap: 14, paddingBottom: 110 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, padding: 12 },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, minHeight: 46, paddingHorizontal: 16 },
  actionMain: { flex: 1, backgroundColor: Brand.primary },
  actionMainText: { color: '#fff', fontSize: 15, lineHeight: 20, fontWeight: '800' },
  actionText: { color: Brand.primary, fontSize: 15, lineHeight: 20, fontWeight: '800' },
  box: { borderRadius: 18, padding: 14, gap: 10 },
  track: { height: 7, borderRadius: 4, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 4 },
  todo: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 10 },
});
