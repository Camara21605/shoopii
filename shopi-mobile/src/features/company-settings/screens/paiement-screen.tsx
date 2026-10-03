/**
 * Paramètres › Paiement & Facturation — comme PaiementSection du site :
 *   · données RÉELLES du Portefeuille (GET /wallet) : solde retirable, montant
 *     en délai de règlement, plafond du jour, moyens de retrait ;
 *   · informations fiscales (NIF, RCCM en majuscules, raison sociale).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { SecondaryButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { openSite } from '@/features/catalog/open';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';

import { fetchWalletSummary, type Settings } from '../api';
import { Badge, FormCard, gnf, Hint, Input, SaveButton, SettingsShell, toast, toastError } from '../components/ui';
import { useSectionSave, useSettings } from '../hooks';

const METHOD_ICON: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
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
  const q = useSettings();
  return (
    <SettingsShell title="Paiement & Facturation" icon="card-outline" subtitle="Où arrivent vos ventes, comment les retirer, et vos informations fiscales.">
      {q.data ? <Content d={q.data} /> : null}
    </SettingsShell>
  );
}

function Content({ d }: { d: Settings }) {
  const theme = useTheme();
  const save = useSectionSave();
  const wallet = useQuery({ queryKey: qk.company.settingsWallet, queryFn: fetchWalletSummary });
  const [nif, setNif] = useState(d.nif ?? '');
  const [rccm, setRccm] = useState(d.rccm ?? '');
  const [raison, setRaison] = useState(d.raisonSociale ?? '');
  const [saving, setSaving] = useState(false);
  const dirty = nif.trim() !== (d.nif ?? '') || rccm.trim().toUpperCase() !== (d.rccm ?? '') || raison.trim() !== (d.raisonSociale ?? '');

  const submit = async () => {
    setSaving(true);
    try {
      await save('paiement', { nif: nif.trim(), rccm: rccm.trim().toUpperCase(), raisonSociale: raison.trim() });
      setRccm(rccm.trim().toUpperCase());
      toast('Paiement sauvegardé');
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  const w = wallet.data;
  const left = w ? Math.max(w.dailyWithdrawLimit - w.todayWithdrawAmount, 0) : 0;

  return (
    <>
      <FormCard title="Vos gains" icon="wallet-outline" subtitle="Données réelles de votre Portefeuille">
        {wallet.isPending ? (
          <View style={styles.row}>
            <ActivityIndicator color={Brand.primary} />
            <ThemedText type="small" themeColor="textSecondary">
              Chargement du portefeuille…
            </ThemedText>
          </View>
        ) : !w ? (
          <Hint icon="cloud-offline-outline" tone="warning" text="Portefeuille momentanément indisponible. Réessayez plus tard." />
        ) : (
          <>
            <View style={styles.balance}>
              <ThemedText style={styles.balanceLabel}>Solde retirable maintenant</ThemedText>
              <ThemedText style={styles.balanceV}>{gnf(w.withdrawableBalance)}</ThemedText>
              {w.settlementLocked > 0 ? <ThemedText style={styles.balanceSub}>+ {gnf(w.settlementLocked)} en délai de règlement</ThemedText> : null}
            </View>
            <View style={[styles.limit, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="small" themeColor="textSecondary">
                Encore retirable aujourd’hui
              </ThemedText>
              <ThemedText style={styles.limitV}>{gnf(left)}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                sur un plafond de {gnf(w.dailyWithdrawLimit)} par jour
              </ThemedText>
            </View>
            <ThemedText type="smallBold">Moyens de retrait</ThemedText>
            {w.paymentMethods.length ? (
              w.paymentMethods.map((m) => (
                <View key={m.id} style={[styles.method, { borderColor: theme.border }]}>
                  <View style={styles.methodIco}>
                    <Ionicons name={METHOD_ICON[m.type] ?? 'wallet-outline'} size={18} color={Brand.primary} />
                  </View>
                  <View style={styles.flex}>
                    <ThemedText style={styles.bold}>{m.label}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {mask(m.number)}
                    </ThemedText>
                  </View>
                  {m.isDefault ? <Badge label="Par défaut" tone="success" /> : null}
                </View>
              ))
            ) : (
              <Hint icon="alert-circle-outline" tone="warning" text="Aucun moyen de retrait enregistré : ajoutez un compte Mobile Money ou bancaire pour retirer vos gains." />
            )}
            <Hint tone="neutral" text="Les retraits se font à votre demande depuis le Portefeuille, vers le moyen de retrait choisi." />
          </>
        )}
        <SecondaryButton title="Gérer dans le Portefeuille" onPress={() => openSite('/dashboard/entreprise/portefeuille')} pill />
      </FormCard>

      <FormCard title="Informations fiscales" icon="document-outline" subtitle="Numéros officiels de votre entreprise">
        <Input label="NIF" value={nif} onChangeText={setNif} placeholder="Numéro d’Identification Fiscale" autoCapitalize="characters" maxLength={50} />
        <Input label="RCCM" value={rccm} onChangeText={setRccm} placeholder="GN.TCC.2024.B.12345" autoCapitalize="characters" maxLength={50} />
        <Input label="Raison sociale" value={raison} onChangeText={setRaison} placeholder="Ex : TechStore Conakry SARL" maxLength={255} />
        <Hint tone="neutral" text="Utilisées pour la vérification de votre boutique par l’administration." />
        {dirty ? <SaveButton label="Sauvegarder le paiement" onPress={() => void submit()} loading={saving} /> : null}
      </FormCard>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bold: { fontSize: 14.5, lineHeight: 19, fontWeight: '700' },
  balance: { backgroundColor: '#1F1F1F', borderRadius: 16, padding: 16, gap: 2 },
  balanceLabel: { color: '#F6D3B6', fontSize: 12.5, lineHeight: 16, fontWeight: '700' },
  balanceV: { color: '#fff', fontSize: 26, lineHeight: 33, fontWeight: '900' },
  balanceSub: { color: '#F6D3B6', fontSize: 12.5, lineHeight: 16, fontWeight: '700' },
  limit: { borderRadius: 14, padding: 12, gap: 2 },
  limitV: { fontSize: 18, lineHeight: 24, fontWeight: '900' },
  method: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 10 },
  methodIco: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#FDF0E6', alignItems: 'center', justifyContent: 'center' },
});
