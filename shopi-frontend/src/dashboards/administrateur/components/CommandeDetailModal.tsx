/* ================================================================
 * FICHIER : src/dashboards/administrateur/components/CommandeDetailModal.tsx
 *
 * Détail (lecture seule) d'une commande de la zone :
 * GET /dashboard/admin/commandes/:id — montants, livraison, articles,
 * acteurs (badge "Votre zone" sur ceux que l'admin a invités) et chaîne
 * de validation. Les codes secrets ne sont jamais renvoyés par l'API.
 * ================================================================ */

import { useEffect, useState } from 'react';
import styles from '../styles/CommandeDetailModal.module.css';
import cmd from '../styles/CommandesPage.module.css';
import { apiFetch } from '../../../shared/services/apiFetch';
import type { CommandeDetail } from '../data/types';
import { ST_LABEL, fmtGnf } from '../pages/commandes.constants';

interface Props {
  commandeId: string;
  numero:     string;
  onClose:    () => void;
}

const MODE_LABEL: Record<string, string> = {
  livreur: 'Livreur', correspondant: 'Correspondant', partenaire: 'Partenaire',
  pickup: 'Retrait en boutique', mixte: 'Mixte',
};

const CODE_LABEL: Record<string, string> = {
  entreprise: 'Entreprise', livreur: 'Livreur', correspondant: 'Correspondant',
  partenaire: 'Partenaire', client: 'Client',
};

const STEP_LABEL: Record<string, { label: string; cls: string }> = {
  validated:       { label: 'Validé',        cls: 'stepOk' },
  pending:         { label: 'En attente',    cls: 'stepWait' },
  awaiting_unlock: { label: 'Pas encore débloqué', cls: 'stepWait' },
  expired:         { label: 'Expiré',        cls: 'stepKo' },
  cancelled:       { label: 'Annulé',        cls: 'stepKo' },
};

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export default function CommandeDetailModal({ commandeId, numero, onClose }: Props) {
  const [data,  setData]  = useState<CommandeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<CommandeDetail>(`/dashboard/admin/commandes/${commandeId}`)
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setError(e?.message ?? 'Impossible de charger la commande.'); });
    return () => { cancelled = true; };
  }, [commandeId]);

  /* Échap ferme la fenêtre */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const adresse = data && [data.livraison.adresse, data.livraison.commune, data.livraison.ville].filter(Boolean).join(', ');

  return (
    <div className={styles.bg} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label={`Commande ${numero}`}>
        <div className={styles.head}>
          <div>
            <div className={styles.title}>Commande {numero}</div>
            {data && <div className={styles.sub}>Passée le {fmtDate(data.createdAt)}</div>}
          </div>
          {data && <span className={`${cmd.ordSt} ${cmd['ord_' + data.statut]}`}>{ST_LABEL[data.statut] ?? data.statut}</span>}
          <button className={styles.x} onClick={onClose} aria-label="Fermer"><i className="fas fa-xmark" /></button>
        </div>

        <div className={styles.body}>
          {!data && !error && (
            <div className={styles.state}><i className="fas fa-spinner fa-spin" /> Chargement…</div>
          )}
          {error && <div className={styles.state} style={{ color: '#DC2626' }}><i className="fas fa-triangle-exclamation" /> {error}</div>}

          {data && (
            <>
              {/* Montants */}
              <div className={styles.sec}>
                <div className={styles.secT}>Montants</div>
                <div className={styles.rows}>
                  <div><span>Sous-total</span><b>{fmtGnf(data.montants.sousTotal)}</b></div>
                  <div><span>Frais de livraison</span><b>{fmtGnf(data.montants.fraisLivraison)}</b></div>
                  <div><span>Commission Shoneya</span><b>{fmtGnf(data.montants.commissionShopi)}</b></div>
                  <div className={styles.totalRow}><span>Total</span><b>{fmtGnf(data.montants.total)}</b></div>
                </div>
                <div className={styles.meta}>
                  Paiement : {data.methodePaiement ?? '—'}{data.datePaiement ? ` · ${fmtDate(data.datePaiement)}` : ''}
                </div>
              </div>

              {/* Acteurs */}
              <div className={styles.sec}>
                <div className={styles.secT}>Acteurs de la commande</div>
                <div className={styles.actors}>
                  {data.acteurs.length === 0 && <span className={styles.meta}>Aucun acteur renseigné.</span>}
                  {data.acteurs.map(a => (
                    <div key={a.role} className={styles.actor}>
                      <div>
                        <div className={styles.actorRole}>{a.role}</div>
                        <div className={styles.actorNom}>{a.nom}</div>
                      </div>
                      {a.dansZone && <span className={styles.zoneTag}><i className="fas fa-check" /> Votre zone</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Chaîne de validation */}
              <div className={styles.sec}>
                <div className={styles.secT}>Chaîne de validation</div>
                {data.chaine.length === 0
                  ? <div className={styles.meta}>Aucun code de validation généré pour cette commande.</div>
                  : (
                    <ol className={styles.steps}>
                      {data.chaine.map(k => {
                        const st = STEP_LABEL[k.statut] ?? { label: k.statut, cls: 'stepWait' };
                        return (
                          <li key={k.ordre + k.acteurType} className={styles[st.cls]}>
                            <span className={styles.dotStep} />
                            <div>
                              <div className={styles.stepNom}>{CODE_LABEL[k.acteurType] ?? k.acteurType} · {k.acteurNom}</div>
                              <div className={styles.stepSub}>
                                {st.label}{k.validatedAt ? ` le ${fmtDate(k.validatedAt)}` : ''}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  )}
              </div>

              {/* Livraison */}
              <div className={styles.sec}>
                <div className={styles.secT}>Client &amp; livraison</div>
                <div className={styles.rows}>
                  <div><span>Client</span><b>{data.client.nom}</b></div>
                  <div><span>Téléphone</span><b>{data.client.telephone ?? '—'}</b></div>
                  <div><span>Mode</span><b>{MODE_LABEL[data.modeLivraison] ?? data.modeLivraison}</b></div>
                  <div><span>Adresse</span><b>{adresse || '—'}</b></div>
                  <div><span>Livraison estimée</span><b>{fmtDate(data.dateLivraisonEstimee)}</b></div>
                  {data.dateLivraisonEffective && <div><span>Livrée le</span><b>{fmtDate(data.dateLivraisonEffective)}</b></div>}
                </div>
                {data.livraison.notes && <div className={styles.note}>« {data.livraison.notes} »</div>}
              </div>

              {/* Articles */}
              <div className={styles.sec}>
                <div className={styles.secT}>Articles ({data.articles.length})</div>
                <div className={styles.items}>
                  {data.articles.map((a, i) => (
                    <div key={i} className={styles.item}>
                      <div>
                        <div className={styles.itemNom}>{a.nom}</div>
                        {a.variante && <div className={styles.stepSub}>{a.variante}</div>}
                      </div>
                      <div className={styles.itemQ}>{a.quantite} × {fmtGnf(a.prixUnitaire)}</div>
                      <b>{fmtGnf(a.sousTotal)}</b>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
