/* ================================================================
 * FICHIER : profil-client/sections/SectionReturns.tsx
 *
 * Onglet "Retours" du profil client — suivi des demandes de retour
 * envoyées depuis la page commande (voir ReturnRequestModal.tsx).
 * Section auto-suffisante (charge ses propres données), même pattern
 * que ClientSupportWidget dans ClientApp.tsx.
 * ================================================================ */

import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/ProfilClient.module.css';
import { fetchMesRetours } from '../../../services/client-returns.api';
import type { ClientReturnApi, ReturnStatus } from '../../../services/client-returns.api';

const fmtGnf = (n: number) => n.toLocaleString('fr-FR') + ' GNF';

const STATUT_CFG: Record<ReturnStatus, { label: string; icon: string; color: string }> = {
  pending:    { label: 'En attente',    icon: 'fa-hourglass-half', color: '#D97706' },
  accepted:   { label: 'Accepté',       icon: 'fa-check',          color: '#2563EB' },
  refused:    { label: 'Refusé',        icon: 'fa-xmark',          color: '#DC2626' },
  in_transit: { label: 'En transit',    icon: 'fa-truck',          color: '#2563EB' },
  received:   { label: 'Reçu',          icon: 'fa-box-open',       color: '#2563EB' },
  refunded:   { label: 'Remboursé',     icon: 'fa-sack-dollar',    color: '#059669' },
  exchanged:  { label: 'Échangé',       icon: 'fa-right-left',     color: '#059669' },
  closed:     { label: 'Clôturé',       icon: 'fa-circle-check',   color: 'var(--t3)' },
};

const REASON_LABEL: Record<string, string> = {
  defective:      'Article défectueux',
  not_matching:   'Ne correspond pas à la description',
  change_of_mind: 'Changement d\'avis',
  wrong_item:     'Mauvais article reçu',
  damaged:        'Article endommagé',
  expired:        'Article périmé',
  other:          'Autre motif',
};

interface Props {
  onToast?: (msg: string, type?: 's' | 'i' | 'w' | 'e') => void;
}

export default function SectionReturns({ onToast }: Props) {
  const navigate = useNavigate();
  const [retours, setRetours] = useState<ClientReturnApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchMesRetours({ limit: 50 })
      .then(res => setRetours(res.data ?? []))
      .catch(e => setError(e?.message ?? 'Impossible de charger vos retours.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className={styles.card}>
      <div className={styles.ch}>
        <div className={styles.ct}>
          <i className="fas fa-rotate-left" /> Mes retours
          {!loading && (
            <span style={{ marginLeft: 6, fontWeight: 400, color: 'var(--t3)', fontSize: 12 }}>
              ({retours.length})
            </span>
          )}
        </div>
      </div>

      <div className={styles.cb}>
        {loading && (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize: 20, display: 'block', marginBottom: 8 }} />
            Chargement de vos retours…
          </div>
        )}

        {!loading && error && (
          <div style={{ padding: '32px 0', textAlign: 'center', color: '#DC2626', fontSize: 13 }}>
            <i className="fas fa-triangle-exclamation" style={{ fontSize: 24, display: 'block', marginBottom: 8 }} />
            {error}
          </div>
        )}

        {!loading && !error && retours.length === 0 && (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
            <i className="fas fa-box-open" style={{ fontSize: 28, display: 'block', marginBottom: 10, color: 'var(--t4)' }} />
            Vous n'avez fait aucune demande de retour.
            <div style={{ fontSize: 11.5, marginTop: 4 }}>
              Ouvrez une commande livrée pour demander un retour sur un article.
            </div>
          </div>
        )}

        {!loading && !error && retours.map(r => {
          const cfg = STATUT_CFG[r.status];
          const isUrl = typeof r.productImage === 'string' && r.productImage.startsWith('http');

          return (
            <div
              key={r.id}
              className={styles.orderRow}
              onClick={() => navigate(`/commande/${r.commandeId}/suivi`)}
              style={{ cursor: 'pointer' }}
            >
              <div style={{
                width: 52, height: 52, borderRadius: 12, flexShrink: 0,
                overflow: 'hidden', background: 'var(--sky)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid var(--bdr)',
              }}>
                {isUrl
                  ? <img src={r.productImage!} alt={r.productName}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  : <span style={{ fontSize: 22 }}>📦</span>}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 700, fontSize: 13.5, color: 'var(--navy)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {r.productName}{r.quantity > 1 ? ` ×${r.quantity}` : ''}
                </div>
                <div style={{
                  fontSize: 11, color: 'var(--t3)', marginTop: 3,
                  display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
                }}>
                  <span style={{ color: 'var(--t4)' }}>{r.reference}</span>
                  <span>{REASON_LABEL[r.reason] ?? r.reason}</span>
                </div>
                {r.status === 'refused' && r.noteClient && (
                  <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>
                    <i className="fas fa-comment" style={{ marginRight: 4 }} />{r.noteClient}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--navy)' }}>
                  {fmtGnf(r.montantAccorde ?? r.montantDemande)}
                </div>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
                  color: cfg.color, background: cfg.color + '18',
                }}>
                  <i className={`fas ${cfg.icon}`} style={{ fontSize: 9 }} /> {cfg.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
