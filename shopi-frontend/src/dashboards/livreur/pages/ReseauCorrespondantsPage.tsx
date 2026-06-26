// src/dashboards/livreur/pages/ReseauCorrespondantsPage.tsx
// Liste des correspondants à suivre, intégrée dans le dashboard livreur.

import React from 'react';
import { useCorrespondants } from '../../../modules/home/components/correspondants/hooks/useCorrespondants';
import shared from '../styles/Shared.module.css';

interface Props {
  onPop:  (m: string, t?: string) => void;
  onView: (id: string) => void;
}

export default function ReseauCorrespondantsPage({ onPop, onView }: Props) {
  const { correspondants, loading, error, toggleSuivi } = useCorrespondants();

  const handleToggle = (id: string, nom: string, suivi: boolean) => {
    toggleSuivi(id);
    onPop(suivi ? `👋 Désabonné de ${nom}` : `✅ Abonné à ${nom}`, suivi ? 'i' : 's');
  };

  return (
    <div className={shared.page}>
      <div className={`${shared.card} ${shared.cardLast}`}>
        <div className={shared.ch}>
          <div className={shared.chT}><i className="fas fa-warehouse" /> Correspondants</div>
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

          {!loading && correspondants.length === 0 && (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--t3)', fontSize: 13 }}>
              Aucun correspondant disponible.
            </div>
          )}

          {!loading && correspondants.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {correspondants.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px', background: 'var(--g50)', border: '1px solid var(--bdr)', borderRadius: 'var(--r-lg)', cursor: 'pointer', transition: 'all .2s' }}
                  onClick={() => onView(c.id)}
                >
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#EEF3FD,#D6E4F8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'var(--navy)', flexShrink: 0 }}>
                    {c.initiales}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--fd)', fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>{c.nom}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 10, color: 'var(--t3)', marginTop: 2, flexWrap: 'wrap' }}>
                      <span>{c.zone}</span>
                      <span><i className="fas fa-star" style={{ color: 'var(--amber)' }} /> {c.note}</span>
                      <span>{c.missions} missions</span>
                      {c.enLigne && <span style={{ background: 'var(--em-bg)', color: 'var(--emerald)', fontWeight: 700, padding: '1px 7px', borderRadius: 'var(--pill)' }}>En ligne</span>}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleToggle(c.id, c.nom, c.suivi); }}
                    style={{
                      background:   c.suivi ? 'var(--white)' : 'var(--teal)',
                      color:        c.suivi ? 'var(--teal)'  : '#fff',
                      border:       c.suivi ? '1px solid var(--teal)' : '1px solid var(--teal)',
                      borderRadius: 'var(--pill)',
                      padding:      '6px 14px',
                      fontSize:     11,
                      fontWeight:   700,
                      cursor:       'pointer',
                      flexShrink:   0,
                    }}
                  >
                    {c.suivi ? 'Suivi ✓' : 'Suivre'}
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
