/*
 * FICHIER : src/shared/components/portefeuille/PortefeuilleStandalone.tsx
 *
 * RÔLE : Variante du composant Portefeuille pour les dashboards
 *        qui ne possèdent pas leur propre ToastProvider
 *        (livreur, correspondant, super-admin, partenaire, client,
 *        administrateur). Fournit son propre contexte Toast local.
 */

import { ToastProvider } from '../../context/ToastContext';
import ToastContainer from '../ui/ToastContainer';
import Portefeuille from './Portefeuille';

export default function PortefeuilleStandalone() {
  return (
    <ToastProvider>
      <Portefeuille />
      <ToastContainer />
    </ToastProvider>
  );
}
