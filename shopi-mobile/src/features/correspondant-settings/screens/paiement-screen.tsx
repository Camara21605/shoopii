/**
 * Paramètres › Paiement — comme SecPaiement du site, mais avec les VRAIES
 * données (le site affiche des moyens de paiement fictifs et des taux codés
 * en dur) :
 *   · résumé du portefeuille (GET /wallet, même cache que l'écran
 *     Portefeuille) : retirable maintenant, montant en délai de règlement,
 *     plafond restant du jour, moyens de retrait (numéros masqués) ;
 *   · commission Shoneya réelle (taux de la plateforme et montant prélevé ce
 *     mois sur vos colis — GET /dashboard/correspondant/revenus).
 * Retraits, historique et ajout d'un moyen se font dans le Portefeuille.
 * (Fréquence et seuil de virement ne sont pas proposés : aucun virement
 * automatique ne les exécute.)
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { fetchWallet } from '@/features/wallet/api';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';

import { fetchRevenus, gnf } from '@/features/correspondant/api';
import { Badge, FormCard, Hint, SettingsShell, type IconName } from '@/features/settings-kit';

import type { CorrespondantSettings } from '../api';
import { useCorrespondantSettings } from '../hooks';

const METHOD_ICON: Record<string, IconName> = {
  orange_money: 'phone-portrait-outline',
  mtn_money: 'phone-portrait-outline',
  kulu: 'phone-portrait-outline',
  paycard: 'card-outline',
  card: 'card-outline',
  bank: 'business-outline',
  cash: 'cash-outline',
};
const mask = (num: string) => {
  const d = num.replace(/\s+/g, '');
  return d.length > 4 ? `•••• ${d.slice(-4)}` : num;
};

export default function PaiementScreen() {
  const q = useCorrespondantSettings();
  return (
    <SettingsShell<CorrespondantSettings>
      query={q}
      title="Paiement"
      icon="wallet-outline"
      subtitle="Votre argent sur Shoneya : solde retirable et moyens de retrait. Retraits et historique se font dans votre portefeuille.">
      {() => <Content />}
    </SettingsShell>
  );
}

function Content() {
  const theme = useTheme();
  const wallet = useQuery({
    queryKey: qk.walletPage.summary,
    queryFn: fetchWallet,
  });
  const revenus = useQuery({ queryKey: qk.correspondant.revenus, queryFn: fetchRevenus });
  const w = wallet.data;
  const r = revenus.data;
  const retirable = w ? (w.withdrawableBalance ?? w.balance) : 0;
  const plafond = w && w.dailyWithdrawLimit > 0 ? Math.max(0, w.dailyWithdrawLimit - w.todayWithdrawAmount) : null;

  return (
    <>
      <FormCard title="Wallet Shoneya" icon="cash-outline">
        {wallet.isPending ? (
          <ActivityIndicator color={Brand.primary} style={styles.loader} />
        ) : !w ? (
          <>
            <Hint icon="cloud-offline-outline" tone="neutral" text="Impossible de charger votre portefeuille." />
            <PrimaryButton title="Réessayer" onPress={() => void wallet.refetch()} pill />
          </>
        ) : (
          <>
            <View style={styles.main}>
              <ThemedText style={styles.mainLabel}>RETIRABLE MAINTENANT</ThemedText>
              <ThemedText style={styles.mainValue}>{gnf(retirable)}</ThemedText>
            </View>
            {w.settlementLocked > 0 || plafond !== null ? (
              <View style={styles.row}>
                {w.settlementLocked > 0 ? <Stat label="En délai de règlement" value={gnf(w.settlementLocked)} /> : null}
                {plafond !== null ? <Stat label="Plafond restant aujourd’hui" value={gnf(plafond)} /> : null}
              </View>
            ) : null}

            <ThemedText type="smallBold">Moyens de retrait</ThemedText>
            {w.paymentMethods.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                Aucun moyen de retrait enregistré : ajoutez-en un depuis votre portefeuille.
              </ThemedText>
            ) : (
              w.paymentMethods.map((m) => (
                <View key={m.id} style={[styles.method, { borderColor: theme.border }]}>
                  <Ionicons name={METHOD_ICON[m.type] ?? 'wallet-outline'} size={18} color={Brand.primary} />
                  <ThemedText style={styles.methodLabel} numberOfLines={1}>
                    {m.label}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {mask(m.number)}
                  </ThemedText>
                  {m.isDefault ? <Badge label="par défaut" tone="success" /> : null}
                </View>
              ))
            )}
          </>
        )}
      </FormCard>
      <FormCard title="Commission Shoneya" icon="receipt-outline">
        {revenus.isPending ? (
          <ActivityIndicator color={Brand.primary} style={styles.loader} />
        ) : !r ? (
          <Hint icon="cloud-offline-outline" tone="neutral" text="Impossible de charger vos revenus." />
        ) : (
          <>
            <View style={styles.row}>
              <Stat label="Taux de la plateforme" value={`${r.tauxCommission} %`} />
              <Stat label="Prélevé ce mois" value={gnf(r.commissionThisMonth)} />
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              Prélevé par Shoneya sur les frais de livraison des colis que vous traitez. Vos revenus du mois : {gnf(r.revenusThisMonth)}.
            </ThemedText>
          </>
        )}
      </FormCard>
      <PrimaryButton title="Ouvrir mon portefeuille" onPress={() => router.push('/correspondant/portefeuille')} pill />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.stat, { borderColor: theme.border }]}>
      <ThemedText style={styles.statLabel} themeColor="textSecondary">
        {label.toUpperCase()}
      </ThemedText>
      <ThemedText style={styles.statValue}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { marginVertical: 18 },
  main: { backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: 16, padding: 16 },
  mainLabel: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: Brand.primary,
  },
  mainValue: { fontSize: 26, lineHeight: 32, fontWeight: '900', marginTop: 4 },
  row: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 12 },
  statLabel: {
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  statValue: { fontSize: 16, lineHeight: 21, fontWeight: '900', marginTop: 4 },
  method: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 46,
  },
  methodLabel: { flex: 1, fontSize: 14, lineHeight: 19, fontWeight: '700' },
});
