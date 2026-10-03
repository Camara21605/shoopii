/**
 * Paramètres › Commissions Shoneya — comme CommissionsSection du site :
 *   · grille réellement appliquée (commission par type de vente, frais de
 *     livraison payés par le client, délai avant retrait) ;
 *   · plans : un plan supérieur se demande à l'équipe Shoneya (ticket du
 *     centre d'aide) ; seul « Revenir au plan Standard » se fait ici.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { openSite } from '@/features/catalog/open';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';

import { fetchCommissions, type Commissions } from '../api';
import { Badge, confirmAction, FormCard, Hint, SettingsShell, toast, toastError, useEditable } from '../components/ui';
import { useSectionSave } from '../hooks';

const PLAN_EM: Record<string, string> = { standard: '🟢', pro: '⭐', premium: '🏆' };
const RANG: Record<string, number> = { standard: 0, pro: 1, premium: 2 };
const PLAN_SUB: Record<string, string> = {
  standard: 'Plan de base · Inclus dans votre inscription',
  pro: 'Pour les boutiques à fort volume de ventes',
  premium: 'Commissions réduites + outils marketing avancés',
};
const nomPlan = (p: string) => p.charAt(0).toUpperCase() + p.slice(1);

export default function CommissionsScreen() {
  return (
    <SettingsShell title="Commissions Shoneya" icon="stats-chart-outline" subtitle="Commissions appliquées sur vos ventes selon le type de transaction.">
      <Content />
    </SettingsShell>
  );
}

function Content() {
  const q = useQuery({ queryKey: qk.company.settingsCommissions, queryFn: fetchCommissions });
  if (q.isPending) return <ActivityIndicator color={Brand.primary} style={styles.loader} />;
  if (!q.data) return <Hint icon="cloud-offline-outline" tone="warning" text="Erreur de chargement des commissions. Réessayez plus tard." />;
  return <Grid data={q.data} />;
}

function Grid({ data }: { data: Commissions }) {
  const theme = useTheme();
  const editable = useEditable();
  const qc = useQueryClient();
  const save = useSectionSave();
  const [saving, setSaving] = useState(false);
  const current = data.planActuel;
  const taux = data.tauxActuel.taux;
  const delai = data.settlementDelayDays ?? 0;
  const retrait = delai > 0 ? `Après ${delai} jour${delai > 1 ? 's' : ''}` : 'Immédiat';

  const rows = [
    { label: 'Vente directe via Shoneya', icon: 'bag-handle-outline' as const, frais: 'Aucun' },
    { label: 'Vente avec livreur Shoneya', icon: 'bicycle-outline' as const, frais: 'Tarif de la zone' },
    { label: 'Vente via correspondant', icon: 'location-outline' as const, frais: 'Tarif de la zone' },
  ];

  const demander = (plan: string) => openSite(`/support/nouveau?sujet=${encodeURIComponent(`Demande de passage au plan ${nomPlan(plan)}`)}`);

  const backToStandard = async () => {
    const ok = await confirmAction(
      'Revenir au plan Standard ?',
      'La commission de Shoneya reviendra au taux de base. Pour repasser ensuite à un plan supérieur, il faudra refaire une demande.',
      'Revenir au Standard',
      true,
    );
    if (!ok) return;
    setSaving(true);
    try {
      await save('commissions', { plan: 'standard' }, { plan: 'standard' });
      qc.setQueryData<Commissions>(qk.company.settingsCommissions, (p) => (p ? { ...p, planActuel: 'standard', tauxActuel: p.grille.standard ?? p.tauxActuel } : p));
      toast('Plan changé pour Standard');
    } catch (e) {
      toastError(e, 'Erreur lors du changement de plan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <FormCard title="Grille de commissions" icon="grid-outline" subtitle={`Votre plan actuel : ${nomPlan(current)}`} right={<Badge label={nomPlan(current)} tone="info" />}>
        {rows.map((r, i) => (
          <View key={r.label} style={[styles.rowCard, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
            <View style={styles.rowHead}>
              <Ionicons name={r.icon} size={17} color={Brand.primary} />
              <ThemedText style={styles.rowTitle}>{r.label}</ThemedText>
            </View>
            <View style={styles.cells}>
              <Cell label="Commission Shoneya" value={`${taux}%`} tone="success" />
              <Cell label="Frais de livraison (client)" value={r.frais} tone="info" />
              <Cell label="Disponible au retrait" value={retrait} />
            </View>
          </View>
        ))}
        <Hint tone="neutral" text="Taux réellement appliqués à chaque vente. Le délai de retrait est fixé par Shoneya (protection en cas de litige)." />
      </FormCard>

      <FormCard title="Passer à un plan supérieur" icon="trophy-outline" subtitle="Un plan supérieur réduit la commission prélevée sur vos ventes. Le changement se fait avec l’équipe Shoneya.">
        {data.plans.map((plan) => {
          const entry = data.grille[plan];
          const actuel = plan === current;
          const superieur = (RANG[plan] ?? 0) > (RANG[current] ?? 0);
          return (
            <View key={plan} style={[styles.plan, { borderColor: actuel ? Brand.primary : theme.border, backgroundColor: actuel ? 'rgba(0,0,0,0.05)' : theme.background }]}>
              <View style={styles.planTop}>
                <ThemedText style={styles.planEm}>{PLAN_EM[plan] ?? '📦'}</ThemedText>
                <View style={styles.flex}>
                  <View style={styles.planName}>
                    <ThemedText style={styles.planTitle}>{nomPlan(plan)}</ThemedText>
                    {actuel ? <Badge label="Votre plan" tone="success" /> : null}
                  </View>
                  <ThemedText type="small" themeColor="textSecondary">
                    {PLAN_SUB[plan] ?? plan}
                  </ThemedText>
                </View>
                <ThemedText style={styles.rate}>{entry ? `${entry.taux}%` : '—'}</ThemedText>
              </View>
              {superieur && editable ? (
                <Pressable onPress={() => demander(plan)} accessibilityRole="button" style={styles.ask}>
                  <Ionicons name="paper-plane-outline" size={15} color={Brand.primary} />
                  <ThemedText style={styles.askText}>Demander ce plan</ThemedText>
                </Pressable>
              ) : null}
              {!actuel && plan === 'standard' && editable ? <PrimaryButton title="Revenir au plan Standard" onPress={() => void backToStandard()} loading={saving} pill /> : null}
            </View>
          );
        })}
      </FormCard>
    </>
  );
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'info' }) {
  return (
    <View style={styles.cell}>
      <ThemedText style={styles.cellLabel}>{label}</ThemedText>
      {tone ? <Badge label={value} tone={tone} /> : <ThemedText style={styles.cellV}>{value}</ThemedText>}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loader: { marginTop: 32 },
  rowCard: { paddingVertical: 10, gap: 8 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { fontSize: 14.5, lineHeight: 19, fontWeight: '800' },
  cells: { flexDirection: 'row', gap: 8 },
  cell: { flex: 1, gap: 4 },
  cellLabel: { fontSize: 11, lineHeight: 14, fontWeight: '700', color: '#6B6B6B' },
  cellV: { fontSize: 12.5, lineHeight: 16, fontWeight: '800' },
  plan: { borderWidth: 1.5, borderRadius: 16, padding: 12, gap: 10 },
  planTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  planEm: { fontSize: 24, lineHeight: 30 },
  planName: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  planTitle: { fontSize: 16, lineHeight: 21, fontWeight: '900' },
  rate: { fontSize: 17, lineHeight: 22, fontWeight: '900', color: Brand.primary },
  ask: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: Brand.primary, borderRadius: 999, minHeight: 42 },
  askText: { color: Brand.primary, fontSize: 14, lineHeight: 18, fontWeight: '800' },
});
