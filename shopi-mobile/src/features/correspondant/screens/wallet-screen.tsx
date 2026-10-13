/**
 * Espace correspondant › Portefeuille — équivalent mobile de
 * /dashboard/correspondant/portefeuille (portefeuille partagé du site), ouvert
 * par « Gérer » sur la carte du solde du menu ☰ et depuis Mes revenus.
 * Contenu : features/wallet, commun à tous les espaces (solde, retrait vers
 * Mobile Money ou banque, transactions, moyens de paiement, virement auto).
 */
import { WalletView } from '@/features/wallet/components';
import { hideOnScroll } from '@/lib/scroll-chrome';

import { CorrespondantScreen } from '../components';

export default function CorrespondantWalletScreen() {
  return (
    <CorrespondantScreen title="Portefeuille" subtitle="Solde, retraits et transactions">
      <WalletView canOperate scrollProps={hideOnScroll} />
    </CorrespondantScreen>
  );
}
