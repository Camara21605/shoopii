/**
 * Espace client › Mon portefeuille — ouvert par « Gérer » sous le solde du
 * menu ☰ (comme les espaces entreprise, livreur et point relais) ou en
 * touchant le solde de la page profil. Même contenu que les autres espaces
 * (features/wallet) : solde, retrait, transfert, transactions, moyens de
 * paiement ; « Recharger » ouvre l'écran de recharge.
 */
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { useTheme } from '@/hooks/use-theme';

import { WalletView } from '../components';

export default function ClientWalletScreen() {
  const theme = useTheme();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title="Mon portefeuille" />
      <WalletView canOperate bottomPad={40} onRecharge={() => router.push('/portefeuille/recharger')} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ safe: { flex: 1 } });
