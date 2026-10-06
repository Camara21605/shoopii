/**
 * Espace entreprise › Portefeuille — équivalent mobile de
 * /dashboard/entreprise/portefeuille (qui délègue au portefeuille partagé).
 * Contenu : features/wallet (commun à tous les espaces).
 *
 * Réservé au propriétaire : /wallet renvoie le portefeuille du COMPTE
 * connecté ; pour un collaborateur ce serait son portefeuille personnel, pas
 * celui de la boutique (le site ne fait pas la distinction). Le collaborateur
 * voit donc un message et, s'il a payments.view, le lien vers Finances.
 * `?op=withdraw` (depuis Finances) ouvre directement le retrait.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { CompanyBottomNav, CompanyHeader } from '@/features/company/components';
import { usePermissions } from '@/features/company/hooks';
import { WalletView } from '@/features/wallet/components';
import { useTheme } from '@/hooks/use-theme';
import { hideOnScroll } from '@/lib/scroll-chrome';

export default function CompanyWalletScreen() {
  const theme = useTheme();
  const perms = usePermissions();
  const { op } = useLocalSearchParams<{ op?: string }>();

  let body: React.ReactNode;
  if (perms.loading) body = <ActivityIndicator color={Brand.primary} style={styles.loader} />;
  else if (!perms.isOwner)
    body = (
      <View style={styles.center}>
        <Ionicons name="wallet-outline" size={34} color={theme.textSecondary} />
        <ThemedText style={styles.h2}>Portefeuille du propriétaire</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          Le solde, les retraits et les moyens de paiement de la boutique sont gérés par son propriétaire.
        </ThemedText>
        {perms.can('payments', 'view') ? (
          <Pressable onPress={() => router.replace('/entreprise/finances')} accessibilityRole="button" style={styles.btn}>
            <ThemedText type="smallBold">Voir les finances de la boutique</ThemedText>
          </Pressable>
        ) : null}
      </View>
    );
  else body = <WalletView canOperate initialOp={op === 'withdraw' || op === 'transfer' ? op : undefined} scrollProps={hideOnScroll} />;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top']}>
      <CompanyHeader title="Portefeuille" subtitle="Solde, retraits et transactions" />
      <View style={styles.flex}>{body}</View>
      <CompanyBottomNav active="portefeuille" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loader: { marginVertical: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  centerText: { textAlign: 'center' },
  h2: { fontSize: 18, lineHeight: 24, fontWeight: '900', textAlign: 'center' },
  btn: { marginTop: 6, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: Brand.primaryLine },
});
