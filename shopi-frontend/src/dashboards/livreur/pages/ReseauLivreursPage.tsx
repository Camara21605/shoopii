// src/dashboards/livreur/pages/ReseauLivreursPage.tsx
// Liste des autres livreurs à suivre, intégrée dans le dashboard livreur.

import { useLivreurs } from '../../../modules/home/components/livreurs/hooks/useLivreurs';
import { useAuthGate } from '../../../shared/hooks/useAuthGate';
import FollowButton    from '../../../shared/components/FollowButton';
import shared from '../styles/Shared.module.css';

interface Props {
  onPop:  (m: string, t?: string) => void;
  onView: (id: string) => void;
}

export default function ReseauLivreursPage({ onPop, onView }: Props) {
  const { filtered, loading, error, onChange } = useLivreurs();
  const { openAuthModal, authModal } = useAuthGate();

  return (
    <div className={shared.page}>
      <div className={`${shared.card} ${shared.cardLast}`}>
        <div className={shared.ch}>
          <div className={shared.chT}><i className="fas fa-motorcycle" /> Livreurs</div>
        </div>
        <div className={shared.cb}>
          {loading && (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--t3)', fontSize: 13 }}>
              <i className="fas fa-spinner fa-spin" /> Chargement…
            </div>
          )}

          {error && !loading && (
            <div style={{ marginBottom: 14, padding: '10px 14px', background: '#FAFAFA', border: '1px solid #D4D4D8', borderRadius: 10, fontSize: 12.5, color: '#18181B' }}>
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
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px', background: 'var(--g50)', border: '1px solid var(--bdr)', borderRadius: 'var(--r-lg)', cursor: 'pointer', transition: 'all .2s', position: 'relative' }}
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
                  <div onClick={e => e.stopPropagation()}>
                    <FollowButton
                      actorType="livreur"
                      id={l.id}
                      name={l.fullName}
                      isSuivi={l.isSuivi}
                      onToast={onPop}
                      onRequireAuth={openAuthModal}
                      onChange={next => onChange(l.id, next)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {authModal}
    </div>
  );
}
