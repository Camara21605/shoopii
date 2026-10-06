/**
 * Espace livreur › Portefeuille — équivalent mobile de
 * /dashboard/livreur/wallet (qui délègue au portefeuille partagé du site).
 * Contenu : features/wallet, commun à tous les espaces (solde, retrait vers
 * Mobile Money ou banque, transactions, moyens de paiement, virement auto).
 */
import { WalletView } from '@/features/wallet/components';
import { hideOnScroll } from '@/lib/scroll-chrome';

import { LivreurScreen } from '../components';

export default function LivreurWalletScreen() {
  return (
    <LivreurScreen title="Portefeuille" subtitle="Solde, retraits et transactions">
      <WalletView canOperate scrollProps={hideOnScroll} />
    </LivreurScreen>
  );
}
