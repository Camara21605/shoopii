/* ================================================================
 * FICHIER : src/modules/commande/sections/ReturnRequestModal.tsx
 *
 * Modale de demande de retour — ouverte depuis DoneBanner une fois la
 * commande livrée. Même style que IssueModal.tsx (réutilise son CSS
 * module). Le serveur (ReturnsService.createByClient) revalide tout :
 * cette modale ne fait qu'assembler un choix parmi les VRAIS articles
 * de la commande, jamais une saisie libre de produit/montant.
 * ================================================================ */

import { useState } from 'react';
import styles from '../styles/IssueModal.module.css';
import type { ArticleCommande } from '../data/types';
import { createReturnRequest } from '../../../shared/services/client-returns.api';
import type { ReturnReason } from '../../../shared/services/client-returns.api';

interface Props {
  commandeId: string;
  articles:   ArticleCommande[];
  onClose:    () => void;
  onToast:    (msg: string, type?: 's' | 'i' | 'w' | 'e') => void;
  onSuccess?: () => void;
}

const REASONS: { id: ReturnReason; icon: string; label: string }[] = [
  { id: 'defective',      icon: 'fa-triangle-exclamation', label: 'Article défectueux' },
  { id: 'not_matching',   icon: 'fa-image',                label: 'Ne correspond pas à la description' },
  { id: 'wrong_item',     icon: 'fa-right-left',           label: 'Mauvais article reçu' },
  { id: 'damaged',        icon: 'fa-box-open',             label: 'Article endommagé' },
  { id: 'expired',        icon: 'fa-calendar-xmark',       label: 'Article périmé' },
  { id: 'change_of_mind', icon: 'fa-rotate-left',          label: "Changement d'avis" },
  { id: 'other',          icon: 'fa-ellipsis',             label: 'Autre motif' },
];

const fmt = (n: number) => n.toLocaleString('fr-FR');

export default function ReturnRequestModal({ commandeId, articles, onClose, onToast, onSuccess }: Props) {
  /* Seuls les articles encore reliés à un vrai produit peuvent faire
   * l'objet d'un retour (voir ReturnsService.createByClient — un
   * productId null n'a plus de CommandeItem correspondant). */
  const eligibles = articles.filter(a => !!a.productId);

  const [step, setStep] = useState<1 | 2>(1);
  const [selected, setSelected] = useState<ArticleCommande | null>(eligibles.length === 1 ? eligibles[0] : null);
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState<ReturnReason | null>(null);
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);

  function pickArticle(a: ArticleCommande) {
    setSelected(a);
    setQuantity(1);
    setStep(2);
  }

  const descOk = description.trim().length >= 10;
  const canSend = !!selected && !!reason && descOk && !sending;

  async function handleSend() {
    if (!selected?.productId || !reason) return;
    setSending(true);
    try {
      await createReturnRequest({
        commandeId,
        productId:   selected.productId,
        quantity,
        reason,
        description: description.trim(),
      });
      onToast('↩️ Demande de retour envoyée — la boutique va l\'examiner.', 's');
      onSuccess?.();
      onClose();
    } catch (e: any) {
      onToast(e?.message ?? 'Impossible d\'envoyer la demande de retour.', 'e');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={styles.backdrop} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <div className={styles.bar}>
          <div className={styles.barT}><i className="fas fa-rotate-left" /> Demander un retour</div>
          <button className={styles.x} onClick={onClose}><i className="fas fa-xmark" /></button>
        </div>

        <div className={styles.body}>
          {eligibles.length === 0 ? (
            <p className={styles.intro}>
              Aucun article de cette commande n'est éligible à un retour (produit supprimé de la boutique).
            </p>
          ) : step === 1 ? (
            <>
              <p className={styles.intro}>Quel article souhaitez-vous retourner ?</p>
              <div className={styles.opts}>
                {eligibles.map(a => (
                  <div key={a.productId} className={styles.opt} onClick={() => pickArticle(a)}>
                    <i className="fas fa-box" />
                    <span style={{ flex: 1 }}>{a.nom}{a.qty > 1 ? ` (×${a.qty})` : ''}</span>
                    <span style={{ color: 'var(--t3)', fontWeight: 700, fontSize: 12 }}>{fmt(a.prix)} GNF</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              {eligibles.length > 1 && (
                <button
                  onClick={() => setStep(1)}
                  style={{ background: 'none', border: 'none', color: 'var(--blue)', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginBottom: 10, padding: 0 }}
                >
                  <i className="fas fa-arrow-left" /> Choisir un autre article
                </button>
              )}

              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
                background: 'var(--g50)', border: '1px solid var(--bdr)', borderRadius: 10, padding: '10px 12px',
              }}>
                <i className="fas fa-box" style={{ color: 'var(--t3)' }} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>{selected!.nom}</span>

                {selected!.qty > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                      style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid var(--bdr2)', background: '#fff', cursor: 'pointer' }}
                    >−</button>
                    <span style={{ fontSize: 13, fontWeight: 700, minWidth: 16, textAlign: 'center' }}>{quantity}</span>
                    <button
                      onClick={() => setQuantity(q => Math.min(selected!.qty, q + 1))}
                      disabled={quantity >= selected!.qty}
                      style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid var(--bdr2)', background: '#fff', cursor: 'pointer' }}
                    >+</button>
                  </div>
                )}
              </div>

              <p className={styles.intro} style={{ marginBottom: 8 }}>Motif du retour</p>
              <div className={styles.opts}>
                {REASONS.map(r => (
                  <div key={r.id}
                    className={`${styles.opt} ${reason === r.id ? styles.on : ''}`}
                    onClick={() => setReason(r.id)}>
                    <i className={`fas ${r.icon}`} /> {r.label}
                  </div>
                ))}
              </div>

              <textarea className={styles.cmt} rows={3}
                placeholder="Décrivez le problème en détail (10 caractères minimum)…"
                value={description} onChange={e => setDescription(e.target.value)} />
              {description.length > 0 && !descOk && (
                <div style={{ fontSize: 11, color: '#DC2626', marginTop: -10, marginBottom: 12 }}>
                  Encore {10 - description.trim().length} caractère(s) minimum.
                </div>
              )}

              <button className={styles.send} disabled={!canSend} onClick={handleSend}
                style={!canSend ? { opacity: .55, cursor: 'not-allowed' } : undefined}>
                {sending
                  ? <><i className="fas fa-spinner fa-spin" /> Envoi…</>
                  : <><i className="fas fa-paper-plane" /> Envoyer la demande</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
