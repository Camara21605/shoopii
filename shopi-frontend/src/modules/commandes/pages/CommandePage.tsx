/* ================================================================
 * FICHIER : src/modules/commande/pages/CommandePage.tsx
 *
 * Page de suivi & validation d'une commande.
 * "Page unique qui s'adapte au rôle" : partagée par les 4 rôles
 * (entreprise, livreur, correspondant, client). Seule la carte de
 * l'acteur courant, à son tour, est éditable.
 *
 * Layout 2 colonnes :
 *   Gauche : bannière succès + progression + chaîne de validation
 *   Droite : récap commande + acteurs + commissions
 *
 * Le rôle courant peut venir :
 *   - d'une prop `role` (ex. depuis le dashboard qui monte la page)
 *   - sinon déduit du token / AppContext (à brancher selon le projet)
 * ================================================================ */

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import styles from '../styles/CommandePage.module.css';

import { useCommande } from '../hooks/useCommande';
import ProgressBar from '../components/ProgressBar';
import Facture from '../components/Facture';
import ValidationChain from '../sections/ValidationChain';
import OrderSummary from '../sections/OrderSummary';
import ActorsList from '../sections/ActorsList';
import CommissionsCard from '../sections/CommissionsCard';
import DoneBanner from '../sections/DoneBanner';
import RatingModal from '../sections/RatingModal';
import IssueModal from '../sections/IssueModal';
import type { ActeurRole, TypeProbleme } from '../data/types';

interface CommandePageProps {
  /* rôle de l'utilisateur qui consulte (sinon 'client' par défaut) */
  role?: ActeurRole;
  /* true = appels réseau ; false = démo locale (codes affichés) */
  useApi?: boolean;
  /* callback toast (le projet a un ToastContext — on reste générique) */
  onToast?: (msg: string, type?: 's' | 'i' | 'w' | 'e') => void;
}

export default function CommandePage({ role = 'client', useApi = false, onToast }: CommandePageProps) {
  const { id } = useParams<{ id: string }>();

  const c = useCommande({ id, currentRole: role, useApi });

  /* Modales */
  const [showInvoice, setShowInvoice] = useState(false);
  const [showRating,  setShowRating]  = useState(false);
  const [showIssue,   setShowIssue]   = useState(false);
  const [invoiceShownOnce, setInvoiceShownOnce] = useState(false);

  const toast = (m: string, t: 's' | 'i' | 'w' | 'e' = 'i') => onToast?.(m, t);

  /* ── Validation d'une étape ── */
  async function handleValidate(idx: number, code: string): Promise<boolean> {
    const ok = await c.valider(idx, code);
    if (!ok) { toast('Code incorrect. Vérifiez le code reçu.', 'e'); return false; }

    const role = c.commande.acteurs[idx].role;
    const labels: Record<ActeurRole, string> = {
      entreprise: 'Entreprise', livreur: 'Livreur',
      correspondant: 'Correspondant', client: 'Client',
    };
    toast(`${labels[role]} a validé sa partie`, 's');

    /* Si c'était la dernière étape (client) → fin de commande */
    if (idx === c.commande.acteurs.length - 1) {
      toast('🎉 Commande complétée — commissions versées', 's');
      /* 1) D'abord la notation */
      setTimeout(() => setShowRating(true), 800);
    }
    return true;
  }

  /* ── Notation envoyée → ouvrir la facture ── */
  function handleRatingSubmit() {
    c.envoyerNotes();
    setShowRating(false);
    toast('⭐ Merci ! Vos évaluations ont été envoyées', 's');
    if (c.pourboire && c.pourboire > 0)
      toast(`💚 Pourboire de ${c.pourboire.toLocaleString('fr-FR')} GNF envoyé`, 's');
    openInvoice();
  }

  /* ── Notation passée → on montre quand même la facture ── */
  function handleRatingSkip() {
    setShowRating(false);
    if (!c.ratingDone && !invoiceShownOnce) openInvoice();
  }

  function openInvoice() { setShowInvoice(true); setInvoiceShownOnce(true); }

  /* ── Litige ── */
  async function handleIssueSubmit(type: TypeProbleme, desc: string) {
    const ok = await c.signaler(type, desc);
    setShowIssue(false);
    toast(ok ? '📨 Signalement envoyé. Le support vous contactera sous 24 h.' : 'Échec de l\'envoi.', ok ? 's' : 'e');
  }

  if (c.loading) return <div className={styles.loading}>Chargement de la commande…</div>;

  if (c.error) return (
    <div className={styles.loading} style={{ flexDirection:'column', gap:12, color:'#DC2626' }}>
      <i className="fas fa-triangle-exclamation" style={{ fontSize:32 }} />
      <div style={{ fontWeight:700 }}>Commande introuvable</div>
      <div style={{ fontSize:13, color:'rgba(255,255,255,.5)', maxWidth:340, textAlign:'center' }}>
        {c.error}
      </div>
      <button onClick={() => window.history.back()}
        style={{ marginTop:8, background:'rgba(255,255,255,.12)', border:'none', borderRadius:8,
          color:'#fff', padding:'8px 20px', fontSize:13, cursor:'pointer' }}>
        ← Retour
      </button>
    </div>
  );

  /* ── Code de validation de l'acteur courant — affiché en haut
   *    uniquement quand c'est SON tour (l'acteur précédent a déjà validé) ── */
  const monCode = c.commande.codes[c.currentRole];
  const monIdx = c.commande.acteurs.findIndex(a => a.role === c.currentRole);
  const monCodeVisible = !!monCode && monIdx !== -1 && c.statuts[monIdx] === 'now';

  return (
    <div className={styles.order}>

      {/* En-tête */}
      <div className={styles.head}>
        <div>
          <div className={styles.title}>
            <i className="fas fa-box-open" /> Commande <span className={styles.id}>#{c.commande.id}</span>
          </div>
          <div className={styles.sub}>Payée le {c.commande.datePaiement} · Livraison à {c.commande.destination}</div>
        </div>
        <div className={`${styles.status} ${c.done ? styles.statusDone : ''}`}>
          <span /> {c.done ? 'Livrée' : 'En cours'}
        </div>
      </div>

      {/* Code de validation de l'acteur courant */}
      {monCodeVisible && (
        <div className={styles.myCode}>
          <i className="fas fa-key" />
          <div>
            <div className={styles.myCodeLabel}>Votre code de validation</div>
            <div className={styles.myCodeValue}>{monCode}</div>
          </div>
          <div className={styles.myCodeHint}>À saisir pour valider votre étape</div>
        </div>
      )}

      <div className={styles.grid}>

        {/* ── Colonne gauche ── */}
        <div>
          {c.done && (
            <DoneBanner onRate={() => setShowRating(true)} onIssue={() => setShowIssue(true)} />
          )}

          <ProgressBar
            acteurs={c.commande.acteurs}
            currentStep={c.currentStep}
            progression={c.progression}
            done={c.done}
          />

          <ValidationChain
            commande={c.commande}
            statuts={c.statuts}
            times={c.times}
            currentRole={c.currentRole}
            showDemoCodes={!useApi}   /* codes visibles seulement en démo */
            onValidate={handleValidate}
          />
        </div>

        {/* ── Colonne droite ── */}
        <div>
          <OrderSummary commande={c.commande} />
          <ActorsList acteurs={c.commande.acteurs} statuts={c.statuts} notations={c.notations} />
          <CommissionsCard commissions={c.commande.commissions} unlocked={c.done} />
        </div>
      </div>

      {/* ── Modales ── */}
      {showInvoice && (
        <Facture commande={c.commande} times={c.times} onClose={() => setShowInvoice(false)} />
      )}
      {showRating && (
        <RatingModal
          acteurs={c.commande.acteurs}
          pourboire={c.pourboire}
          onSetPourboire={c.setPourboire}
          onNoter={c.noter}
          onSubmit={handleRatingSubmit}
          onSkip={handleRatingSkip}
        />
      )}
      {showIssue && (
        <IssueModal onClose={() => setShowIssue(false)} onSubmit={handleIssueSubmit} />
      )}
    </div>
  );
}