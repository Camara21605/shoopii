/**
 * Fiche finale d'une commande (équivalent de la facture du site) — ouverte
 * par TOUS les acteurs de la commande : client, boutique, livreur, point
 * relais (GET /commandes/:uuid — le serveur refuse quiconque n'y participe pas) :
 *   · numéro, statut, date de paiement et de livraison, boutique, adresse ;
 *   · chaîne de validation avec l'heure de chaque étape ;
 *   · articles, sous-total, livraison, total ;
 *   · répartition des gains (boutique, livreur, plateforme) — pas pour le client ;
 *   · « Partager » : le récapitulatif en texte (WhatsApp, SMS, e-mail…).
 * Paramètre ?vue=client|entreprise|livreur|correspondant.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/catalog';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';

import { fetchOrder, gnf, type OrderDetail } from '../api';

const ROLE_LABEL: Record<string, string> = { entreprise: 'Boutique', livreur: 'Livreur', correspondant: 'Point relais', client: 'Client' };
const COMMISSION_LABEL: Record<string, string> = { entreprise: 'Boutique', livreur: 'Livreur', correspondant: 'Point relais', shopi: 'Shoneya' };

const dateFr = (iso: string | null | undefined, withTime = false) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) });
};

export function statusOf(o: Pick<OrderDetail, 'status' | 'currentStep' | 'acteurs'>): { label: string; color: string; bg: string } {
  const s = o.status ?? '';
  if (s === 'cancelled') return { label: 'Annulée', color: '#B91C1C', bg: '#FEE2E2' };
  if (s === 'refunded') return { label: 'Remboursée', color: '#B91C1C', bg: '#FEE2E2' };
  if (s === 'disputed') return { label: 'Litige en cours', color: '#B45309', bg: '#FEF3C7' };
  if (s === 'delivered' || s === 'auto_delivered' || (o.acteurs.length > 0 && o.currentStep >= o.acteurs.length)) {
    return { label: s === 'auto_delivered' ? 'Livrée (validée automatiquement)' : 'Livrée', color: '#047857', bg: '#ECFDF5' };
  }
  if (s === 'awaiting_client') return { label: 'Colis prêt — à confirmer', color: '#1D4ED8', bg: '#DBEAFE' };
  return { label: 'En cours', color: '#1F1F1F', bg: '#F4F4F5' };
}

export default function OrderReceiptScreen() {
  const theme = useTheme();
  const { id, vue } = useLocalSearchParams<{ id: string; vue?: string }>();
  const uuid = id ?? '';
  const q = useQuery({ queryKey: qk.profile.order(uuid), queryFn: () => fetchOrder(uuid), enabled: !!uuid });
  const o = q.data;

  function share() {
    if (!o) return;
    const st = statusOf(o);
    const lines = [
      `Shoneya — Commande ${o.id}`,
      `Statut : ${st.label}`,
      o.companyName ? `Boutique : ${o.companyName}` : null,
      `Payée le ${dateFr(o.datePaiement)}`,
      o.dateLivraison ? `Livrée le ${dateFr(o.dateLivraison, true)}` : null,
      o.destination ? `Livraison : ${o.destination}` : null,
      '',
      ...o.articles.map((a) => `• ${a.qty} × ${a.nom} — ${gnf(a.prix * a.qty)}`),
      '',
      `Sous-total : ${gnf(o.montant.sousTotal)}`,
      o.montant.livraison ? `Livraison : ${gnf(o.montant.livraison)}` : null,
      `Total : ${gnf(o.montant.total)}`,
    ].filter((l) => l !== null);
    void Share.share({ message: lines.join('\n') });
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title="Fiche de commande" />
      {q.isPending ? (
        <ActivityIndicator color={Brand.primary} style={styles.loader} />
      ) : q.isError || !o ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.paper, { borderColor: theme.border }]}>
            {/* En-tête */}
            <View style={styles.top}>
              <View>
                <ThemedText style={styles.brand}>Shoneya</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">Fiche de commande</ThemedText>
              </View>
              <View style={styles.right}>
                <ThemedText style={styles.num}>N° {o.id}</ThemedText>
                {(() => { const st = statusOf(o); return (
                  <View style={[styles.pill, { backgroundColor: st.bg }]}><ThemedText style={[styles.pillText, { color: st.color }]}>{st.label}</ThemedText></View>
                ); })()}
              </View>
            </View>

            <Sep />
            <Row label="Payée le" value={dateFr(o.datePaiement) ?? '—'} />
            {o.dateLivraison ? <Row label="Livrée le" value={dateFr(o.dateLivraison, true) ?? '—'} /> : null}
            {o.companyName ? <Row label="Boutique" value={o.companyName} /> : null}
            {o.destination ? <Row label="Livraison à" value={o.destination} /> : null}

            {/* Chaîne de validation */}
            <Sep />
            <ThemedText style={styles.section}>Étapes de la livraison</ThemedText>
            {o.acteurs.map((a, i) => {
              const t = o.times?.[i];
              return (
                <View key={`${a.role}${i}`} style={styles.step}>
                  <Ionicons name={t ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={t ? '#059669' : theme.textSecondary} />
                  <View style={styles.flex}>
                    <ThemedText style={styles.stepTitle}>{ROLE_LABEL[a.role] ?? a.role}{a.role !== 'client' && a.nom ? ` · ${a.nom}` : ''}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">{t ? `Validé à ${t}` : 'Non validé'}</ThemedText>
                  </View>
                </View>
              );
            })}

            {/* Articles */}
            <Sep />
            <ThemedText style={styles.section}>Articles</ThemedText>
            {o.articles.map((a, i) => (
              <View key={`${a.nom}${i}`} style={styles.line}>
                <ThemedText style={styles.flex} numberOfLines={2}>{a.qty} × {a.nom}</ThemedText>
                <ThemedText style={styles.amount}>{gnf(a.prix * a.qty)}</ThemedText>
              </View>
            ))}
            <Sep dashed />
            <Row label="Sous-total" value={gnf(o.montant.sousTotal)} />
            {o.montant.livraison ? <Row label="Livraison" value={gnf(o.montant.livraison)} /> : null}
            {o.montant.fraisCorrespondant ? <Row label="Point relais" value={gnf(o.montant.fraisCorrespondant)} /> : null}
            <View style={styles.line}>
              <ThemedText style={styles.total}>Total</ThemedText>
              <ThemedText style={styles.total}>{gnf(o.montant.total)}</ThemedText>
            </View>

            {/* Répartition (acteurs professionnels uniquement) */}
            {vue && vue !== 'client' && o.commissions.length ? (
              <>
                <Sep />
                <ThemedText style={styles.section}>Répartition</ThemedText>
                {o.commissions.map((c, i) => (
                  <Row key={`${c.role}${i}`} label={`${COMMISSION_LABEL[c.role] ?? c.role} · ${c.libelle}`} value={gnf(c.montant)} />
                ))}
              </>
            ) : null}

            <Sep />
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              Merci pour votre confiance — shoneya.com
            </ThemedText>
          </View>

          <Pressable onPress={share} accessibilityRole="button" style={({ pressed }) => [styles.share, pressed && styles.pressed]}>
            <Ionicons name="share-social-outline" size={18} color="#fff" />
            <ThemedText style={styles.shareText}>Partager la fiche</ThemedText>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>{label}</ThemedText>
      <ThemedText style={styles.value}>{value}</ThemedText>
    </View>
  );
}

function Sep({ dashed }: { dashed?: boolean }) {
  const theme = useTheme();
  return <View style={[styles.sep, { borderColor: theme.border }, dashed && styles.dashed]} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  pressed: { opacity: 0.85 },
  center: { textAlign: 'center' },
  loader: { marginTop: 60 },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  paper: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 8 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  right: { alignItems: 'flex-end', gap: 6 },
  brand: { fontSize: 22, lineHeight: 28, fontWeight: '900', color: Brand.primary },
  num: { fontSize: 14, lineHeight: 19, fontWeight: '900' },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  pillText: { fontSize: 12, lineHeight: 16, fontWeight: '800' },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, marginVertical: 4 },
  dashed: { borderStyle: 'dashed', borderTopWidth: 1 },
  section: { fontSize: 14.5, lineHeight: 19, fontWeight: '900' },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
  stepTitle: { fontSize: 14, lineHeight: 19, fontWeight: '700' },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  value: { fontSize: 14, lineHeight: 19, fontWeight: '700', textAlign: 'right', flexShrink: 1 },
  amount: { fontSize: 14, lineHeight: 19, fontWeight: '700' },
  total: { fontSize: 17, lineHeight: 23, fontWeight: '900' },
  share: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1F1F1F', borderRadius: 999, minHeight: 50 },
  shareText: { color: '#fff', fontSize: 15, lineHeight: 20, fontWeight: '900' },
});
