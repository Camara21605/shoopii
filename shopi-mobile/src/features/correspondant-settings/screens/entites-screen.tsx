/**
 * Paramètres › Entités partenaires — la version honnête de SecEntites du site.
 *
 * Ce que le site propose ici n'a aucun effet aujourd'hui (vérifié côté
 * serveur) :
 *   · les codes d'invitation « boutique » (COR-…) et « livreur » (LVR-…) ne
 *     sont lus par AUCUN parcours d'inscription — le site affirme pourtant
 *     « La boutique entre ce code lors de son inscription » ;
 *   · les 4 réglages de collaboration (boutiques non vérifiées,
 *     auto-assignation, notifications, partage des statistiques) ne sont
 *     appliqués par aucun traitement.
 * Ils ne sont donc pas proposés. L'écran montre à la place vos VRAIS
 * partenaires (boutiques qui vous ont confié des colis, livreurs à qui vous
 * en avez remis) avec un accès direct à leurs listes.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { fetchBoutiques, fetchLivreurs } from '@/features/correspondant/api';
import { FormCard, Hint, SettingsShell, type IconName } from '@/features/settings-kit';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';

import type { CorrespondantSettings } from '../api';
import { useCorrespondantSettings } from '../hooks';

export default function EntitesScreen() {
  const q = useCorrespondantSettings();
  return (
    <SettingsShell<CorrespondantSettings> query={q} title="Entités partenaires" icon="people-outline" subtitle="Les boutiques et livreurs avec qui votre point relais travaille réellement.">
      {() => <Content />}
    </SettingsShell>
  );
}

function Content() {
  const boutiques = useQuery({ queryKey: qk.correspondant.boutiques, queryFn: fetchBoutiques });
  const livreurs = useQuery({ queryKey: qk.correspondant.livreurs, queryFn: fetchLivreurs });
  const b = boutiques.data?.stats;
  const l = livreurs.data?.stats;

  return (
    <>
      <FormCard title="Vos partenaires" subtitle="Calculé à partir des colis réellement passés par votre point relais." icon="git-network-outline">
        <Partner
          icon="storefront-outline"
          label="Boutiques"
          loading={boutiques.isPending}
          value={b ? `${b.total} boutique${b.total > 1 ? 's' : ''} · ${b.colisActifs} colis actif${b.colisActifs > 1 ? 's' : ''}` : '—'}
          sub={b && b.enAttente ? `${b.enAttente} colis à réceptionner` : 'Celles qui vous ont confié des colis'}
          href="/correspondant/boutiques"
        />
        <Partner
          icon="bicycle-outline"
          label="Livreurs"
          loading={livreurs.isPending}
          value={l ? `${l.total} livreur${l.total > 1 ? 's' : ''} · ${l.enLigne} en ligne` : '—'}
          sub={l ? `${l.missionsCeMois} mission${l.missionsCeMois > 1 ? 's' : ''} ce mois` : 'Ceux à qui vous avez remis des colis'}
          href="/correspondant/livreurs"
          last
        />
      </FormCard>

      <FormCard title="Codes d’invitation" icon="key-outline">
        <Hint
          tone="warning"
          icon="alert-circle-outline"
          text="Les codes « boutique » et « livreur » affichés sur le site ne sont encore acceptés par aucune inscription Shoneya : les partager n’aurait aucun effet. Ils ne sont donc pas proposés ici."
        />
        <ThemedText type="small" themeColor="textSecondary">
          Une boutique vous rejoint quand elle choisit votre point relais pour ses livraisons ; un livreur, quand vous lui remettez un colis.
        </ThemedText>
      </FormCard>

      <Hint
        tone="neutral"
        icon="information-circle-outline"
        text="Les réglages de collaboration du site (accepter les boutiques non vérifiées, auto-assigner les colis, notifier les boutiques, partager vos statistiques) ne sont appliqués par aucun traitement Shoneya pour l’instant : ils ne sont pas proposés."
      />
    </>
  );
}

function Partner({ icon, label, value, sub, href, loading, last }: { icon: IconName; label: string; value: string; sub: string; href: Href; loading?: boolean; last?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => router.push(href)}
      accessibilityRole="button"
      accessibilityLabel={`${label} : ${value}. Voir la liste`}
      style={({ pressed }) => [styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }, pressed && { opacity: 0.8 }]}>
      <View style={[styles.ico, { backgroundColor: theme.backgroundSelected }]}>
        <Ionicons name={icon} size={19} color={Brand.primary} />
      </View>
      <View style={styles.flex}>
        <ThemedText style={styles.bold}>{label}</ThemedText>
        {loading ? <ActivityIndicator size="small" color={Brand.primary} style={styles.left} /> : <ThemedText type="small">{value}</ThemedText>}
        <ThemedText type="small" themeColor="textSecondary">
          {sub}
        </ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={17} color={theme.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  left: { alignSelf: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  ico: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
