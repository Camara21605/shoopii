/* ================================================================
 * FICHIER : src/modules/home/components/adresses/pages/AdressesPage.tsx
 *
 * RÔLE : Page « Localisation » du client (route /mes-adresses, bouton 📍
 *        de l'en-tête) — deux onglets :
 *          • Carte   : retrouver une entreprise, un livreur ou un
 *                      correspondant ; un point rouge marque son
 *                      emplacement (ActorMapExplorer).
 *          • Adresses: adresses de livraison du client (SectionAddresses).
 *        L'onglet actif est dans l'URL (?onglet=adresses) : lien partageable,
 *        bouton « précédent » cohérent.
 * ================================================================ */

import { lazy, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import Header from '../../layout/Header';
import SectionAddresses from '../../../../../shared/profils/profil-client/sections/SectionAddresses';

/* Leaflet + carte : chargés seulement quand l'onglet Carte est affiché */
const ActorMapExplorer = lazy(() => import('../../../../../shared/location/components/ActorMapExplorer'));

type Onglet = 'carte' | 'adresses';

export default function AdressesPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const onglet: Onglet = params.get('onglet') === 'adresses' ? 'adresses' : 'carte';

  const onToast = (msg: string) => {
    window.dispatchEvent(new CustomEvent('shoneya-toast', { detail: msg }));
  };

  const go = (o: Onglet) => setParams(prev => {
    const next = new URLSearchParams(prev);
    if (o === 'carte') next.delete('onglet'); else next.set('onglet', o);
    return next;
  }, { replace: false });

  const tab = (id: Onglet, icon: string, label: string) => (
    <button
      type="button" role="tab" aria-selected={onglet === id} onClick={() => go(id)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer',
        padding: '9px 18px', borderRadius: 999, fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit',
        border: '1.5px solid ' + (onglet === id ? '#E11D48' : 'var(--bdr, #E4E4E7)'),
        background: onglet === id ? '#E11D48' : 'var(--white, #fff)',
        color: onglet === id ? '#fff' : 'var(--t2, #52525B)',
      }}
    >
      <i className={`fas ${icon}`} aria-hidden="true" /> {label}
    </button>
  );

  return (
    <>
      <Header
        onToast={onToast}
        onLogin={() => navigate('/login')}
        onRegister={() => navigate('/register')}
      />

      <div style={{ maxWidth: onglet === 'carte' ? 1180 : 720, margin: '0 auto', padding: '90px 20px 60px' }}>
        <button
          onClick={() => navigate('/home')}
          style={{ background: 'var(--g100)', border: 'none', borderRadius: 8, color: 'var(--t2)', cursor: 'pointer', padding: '6px 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18 }}
        >
          <i className="fas fa-arrow-left" /> Retour à l'accueil
        </button>

        <h1 style={{ fontFamily: 'var(--fd)', fontSize: 22, fontWeight: 800, color: 'var(--navy,#0B1F3A)', margin: '0 0 4px' }}>
          Localisation
        </h1>
        <p style={{ fontSize: 13, color: 'var(--t3)', margin: '0 0 16px' }}>
          {onglet === 'carte'
            ? 'Trouvez une entreprise, un livreur ou un correspondant : un point rouge indique où il se trouve.'
            : 'Gérez les adresses utilisées pour vos livraisons — épinglez-les directement sur la carte.'}
        </p>

        <div role="tablist" aria-label="Localisation" style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          {tab('carte',    'fa-map-location-dot', 'Carte')}
          {tab('adresses', 'fa-house-flag',       'Mes adresses')}
        </div>

        {onglet === 'carte' ? (
          <Suspense fallback={<div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--t3)' }}><i className="fas fa-circle-notch fa-spin" /> Chargement de la carte…</div>}>
            <ActorMapExplorer onToast={onToast} />
          </Suspense>
        ) : (
          <SectionAddresses onToast={onToast} />
        )}
      </div>
    </>
  );
}
