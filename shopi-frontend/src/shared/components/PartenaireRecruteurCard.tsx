/* ================================================================
 * FICHIER : shared/components/PartenaireRecruteurCard.tsx
 * Carte « Votre partenaire » — Paramètres > Profil de l'entreprise, du
 * livreur et du correspondant recrutés par un partenaire.
 *
 * GET /partenaire-recruteur : le serveur applique la confidentialité du
 * partenaire (« Profil partenaire public », « Afficher mon téléphone ») ;
 * la carte ne s'affiche pas quand il n'y a rien à montrer.
 * ================================================================ */

import { useEffect, useState } from 'react';
import { apiFetch } from '../services/apiFetch';

interface PartenaireRecruteur {
  nom:       string;
  zone:      string | null;
  telephone: string | null;
}

export default function PartenaireRecruteurCard() {
  const [p, setP] = useState<PartenaireRecruteur | null>(null);

  useEffect(() => {
    let annule = false;
    apiFetch<{ partenaire: PartenaireRecruteur | null }>('/partenaire-recruteur')
      .then(r => { if (!annule) setP(r.partenaire); })
      .catch(() => { /* carte simplement masquée */ });
    return () => { annule = true; };
  }, []);

  if (!p) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, marginTop: 16, padding: '14px 16px',
      border: '1px solid var(--bdr, #E5E7EB)', borderRadius: 14, background: 'var(--white, #fff)',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0,
        background: 'var(--g50, #F3F4F6)', color: 'var(--t2, #374151)',
      }}>
        <i className="fas fa-handshake" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, color: 'var(--t3, #6B7280)' }}>
          Votre partenaire Shoneya
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1, #111827)' }}>{p.nom}</div>
        {p.zone && <div style={{ fontSize: 12, color: 'var(--t3, #6B7280)' }}>{p.zone}</div>}
      </div>
      {p.telephone && (
        <a href={`tel:${p.telephone.replace(/\s+/g, '')}`} style={{
          display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600,
          color: 'var(--t1, #111827)', textDecoration: 'none', whiteSpace: 'nowrap',
        }}>
          <i className="fas fa-phone" /> {p.telephone}
        </a>
      )}
    </div>
  );
}
