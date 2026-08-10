/* ================================================================
 * FICHIER : src/modules/home/components/adresses/pages/AdressesPage.tsx
 *
 * RÔLE : Page autonome "Mes adresses" (route /mes-adresses).
 *        Anciennement un onglet du profil client — déplacée dans le
 *        topbar (remplace l'onglet "Paramètres" sur mobile) pour un
 *        accès direct à la gestion des adresses de livraison.
 * ================================================================ */

import { useNavigate } from 'react-router-dom';

import Header from '../../layout/Header';
import SectionAddresses from '../../../../../shared/profils/profil-client/sections/SectionAddresses';

export default function AdressesPage() {
  const navigate = useNavigate();

  const onToast = (msg: string) => {
    window.dispatchEvent(new CustomEvent('shopi-toast', { detail: msg }));
  };

  return (
    <>
      <Header
        onToast={onToast}
        onLogin={() => navigate('/login')}
        onRegister={() => navigate('/register')}
      />

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '90px 20px 60px' }}>
        <button
          onClick={() => navigate('/home')}
          style={{ background: 'var(--g100)', border: 'none', borderRadius: 8, color: 'var(--t2)', cursor: 'pointer', padding: '6px 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18 }}
        >
          <i className="fas fa-arrow-left" /> Retour à l'accueil
        </button>

        <h1 style={{ fontFamily: 'var(--fd)', fontSize: 22, fontWeight: 800, color: 'var(--navy,#0B1F3A)', margin: '0 0 4px' }}>
          Mes adresses de livraison
        </h1>
        <p style={{ fontSize: 13, color: 'var(--t3)', margin: '0 0 20px' }}>
          Gérez les adresses utilisées pour vos livraisons — épinglez-les directement sur la carte.
        </p>

        <SectionAddresses onToast={onToast} />
      </div>
    </>
  );
}
