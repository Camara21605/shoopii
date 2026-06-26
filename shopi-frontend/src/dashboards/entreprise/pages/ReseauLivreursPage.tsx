// src/dashboards/entreprise/pages/ReseauLivreursPage.tsx
// Liste des livreurs à suivre, intégrée dans le dashboard entreprise.
// ⚠️ Distinct de LivreursPage.tsx (gestion du réseau de livraison de l'entreprise).

import React from 'react';
import { useLivreurs } from '../../../modules/home/components/livreurs/hooks/useLivreurs';
import shared from './ReseauShared.module.css';

interface Props {
  onPop:  (m: string, t?: string) => void;
  onView: (id: string) => void;
}

export default function ReseauLivreursPage({ onPop, onView }: Props) {
  const { filtered, loading, error, onFollow } = useLivreurs((msg, type) => onPop(msg, type));

  const handleFollow = (id: string, fullName: string, isSuivi: boolean) => {
    onFollow(id, !isSuivi);
    onPop(isSuivi ? `👋 Désabonné de ${fullName}` : `✅ Abonné à ${fullName}`, isSuivi ? 'i' : 's');
  };

  return (
    <div className={shared.page}>
      <div className={`${shared.card} ${shared.cardLast}`}>
        <div className={shared.ch}>
          <div className={shared.chT}><i className="fas fa-motorcycle" /> Suivre des livreurs</div>
        </div>
        <div className={shared.cb}>
          {loading && (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--t3)', fontSize: 13 }}>
              <i className="fas fa-spinner fa-spin" /> Chargement…
            </div>
          )}

          {error && !loading && (
            <div style={{ marginBottom: 14, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, fontSize: 12.5, color: '#991B1B' }}>
              <i className="fas fa-triangle-exclamation" /> {error} — données de démonstration affichées.
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--t3)', fontSize: 13 }}>
              Aucun livreur disponible.
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {filtered.map(l => (
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px', background: 'var(--g50)', border: '1px solid var(--bdr)', borderRadius: 'var(--r-lg)', cursor: 'pointer', transition: 'all .2s' }}
                  onClick={() => onView(l.id)}
                >
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: l.avatarBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'var(--navy)', flexShrink: 0 }}>
                    {l.initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--fd)', fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>{l.fullName}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 10, color: 'var(--t3)', marginTop: 2, flexWrap: 'wrap' }}>
                      <span>{l.zone}</span>
                      <span><i className="fas fa-star" style={{ color: 'var(--amber)' }} /> {l.averageRating}</span>
                      <span>{l.totalLivraisons} livraisons</span>
                      {l.disponible && <span style={{ background: 'var(--em-bg)', color: 'var(--emerald)', fontWeight: 700, padding: '1px 7px', borderRadius: 'var(--pill)' }}>Disponible</span>}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleFollow(l.id, l.fullName, l.isSuivi); }}
                    style={{
                      background:   l.isSuivi ? 'var(--white)' : 'var(--blue)',
                      color:        l.isSuivi ? 'var(--blue)'  : '#fff',
                      border:       '1px solid var(--blue)',
                      borderRadius: 'var(--pill)',
                      padding:      '6px 14px',
                      fontSize:     11,
                      fontWeight:   700,
                      cursor:       'pointer',
                      flexShrink:   0,
                    }}
                  >
                    {l.isSuivi ? 'Suivi ✓' : 'Suivre'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
