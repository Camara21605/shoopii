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
import { useParams, useNavigate } from 'react-router-dom';
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
import { useForceDarkTheme } from '../../../shared/context/ThemeContext';
import { assignerLivreurClient } from '../services/commande.api';
import { fetchLivreursSuivis } from '../../home/components/panier/services/livreursSuivis.api';
import ChoisirLivreurModal from '../../../shared/components/ChoisirLivreurModal';
import type { LivreurPickerItem } from '../../../shared/components/ChoisirLivreurModal';
import OrderTrackingMap from '../../../shared/location/components/OrderTrackingMap';

interface CommandePageProps {
  /* rôle de l'utilisateur qui consulte (sinon 'client' par défaut) */
  role?: ActeurRole;
  /* true = appels réseau ; false = démo locale (codes affichés) */
  useApi?: boolean;
  /* callback toast (le projet a un ToastContext — on reste générique) */
  onToast?: (msg: string, type?: 's' | 'i' | 'w' | 'e') => void;
}

export default function CommandePage({ role = 'client', useApi = false, onToast }: CommandePageProps) {
  // ✅ Cette page n'a plus de mode clair — voir useForceDarkTheme.
  // Sûr même si ce composant est monté depuis un dashboard qui a son
  // propre thème (livreur…) : le thème précédent est restauré au
  // démontage, donc aucun effet de bord en la quittant.
  useForceDarkTheme();

  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const c = useCommande({ id, currentRole: role, useApi });

  /* Modales */
  const [showInvoice, setShowInvoice] = useState(false);
  const [showRating,  setShowRating]  = useState(false);
  const [showIssue,   setShowIssue]   = useState(false);
  const [invoiceShownOnce, setInvoiceShownOnce] = useState(false);

  /* Choisir un autre livreur (après refus du précédent) */
  const [showChoisirLivreur, setShowChoisirLivreur] = useState(false);
  const [livreurOptions, setLivreurOptions] = useState<LivreurPickerItem[]>([]);
  const [loadingLivreurs, setLoadingLivreurs] = useState(false);
  const [savingLivreur,   setSavingLivreur]   = useState(false);

  /* Affichage/masquage de la carte "Suivi en direct" — repliée par
   * défaut pour ne pas alourdir la page (chargement carte + itinéraires),
   * l'utilisateur choisit explicitement de la faire apparaître. */
  const [showMap, setShowMap] = useState(false);

  const toast = (m: string, t: 's' | 'i' | 'w' | 'e' = 'i') => onToast?.(m, t);

  function openChoisirLivreur() {
    setShowChoisirLivreur(true);
    setLoadingLivreurs(true);
    fetchLivreursSuivis()
      .then(list => setLivreurOptions(list.map(l => ({ id: l.id, nom: l.nm, sous: l.zn, emoji: l.em, note: l.rt !== '—' ? l.rt : undefined }))))
      .catch(() => setLivreurOptions([]))
      .finally(() => setLoadingLivreurs(false));
  }

  async function handleChoisirLivreur(livreurId: string) {
    if (!id) return;
    setSavingLivreur(true);
    try {
      await assignerLivreurClient(id, livreurId);
      toast('🛵 Nouveau livreur assigné — en attente de sa confirmation', 's');
      setShowChoisirLivreur(false);
      c.refetch();
    } catch (err: any) {
      toast(err?.message ?? 'Impossible d\'assigner ce livreur.', 'e');
    } finally {
      setSavingLivreur(false);
    }
  }

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

  if (c.loading) return (
    <div className={styles.loading} style={{ flexDirection:'column', gap:16 }}>
      <i className="fas fa-circle-notch fa-spin" style={{ fontSize:24, color:'var(--t3)' }} />
      <span>Chargement de la commande…</span>
      <button onClick={() => navigate(-1)}
        style={{ marginTop:4, background:'var(--g100)', border:'none', borderRadius:8,
          color:'var(--t2)', padding:'7px 18px', fontSize:13, cursor:'pointer' }}>
        ← Retour
      </button>
    </div>
  );

  if (c.error) return (
    <div className={styles.loading} style={{ flexDirection:'column', gap:12, color:'#DC2626' }}>
      <i className="fas fa-triangle-exclamation" style={{ fontSize:32 }} />
      <div style={{ fontWeight:700 }}>Commande introuvable</div>
      <div style={{ fontSize:13, color:'var(--t3)', maxWidth:340, textAlign:'center' }}>
        {c.error}
      </div>
      <button onClick={() => window.history.back()}
        style={{ marginTop:8, background:'var(--g100)', border:'none', borderRadius:8,
          color:'var(--t1)', padding:'8px 20px', fontSize:13, cursor:'pointer' }}>
        ← Retour
      </button>
    </div>
  );

  /* ── Code de validation de l'acteur courant — affiché en haut
   *    uniquement quand c'est SON tour (l'acteur précédent a déjà validé) ── */
  const monCode = c.commande.codes[c.currentRole];
  const monIdx = c.commande.acteurs.findIndex(a => a.role === c.currentRole);
  const monCodeVisible = !!monCode && monIdx !== -1 && c.statuts[monIdx] === 'now';

  /* ── Visibilité du "Suivi en direct" ────────────────────────────
   * Le backend (tracking.service.ts) sait déjà construire une carte
   * utile même SANS livreur ni correspondant : il retombe sur la
   * position de la boutique + celle du client (trajet vert de
   * référence). Il ne faut donc PAS conditionner l'affichage côté
   * client/entreprise à l'acceptation d'un livreur — sinon la carte
   * n'apparaît jamais tant qu'aucun livreur n'a encore été assigné/
   * confirmé (cas vécu : commande tout juste payée, encore "Étape 1/2").
   *   - client / entreprise : toujours visible tant que la commande
   *     n'est pas terminée (le backend affiche ce qu'il peut : au
   *     minimum boutique + client, en plus le livreur/correspondant
   *     dès qu'ils sont réellement impliqués).
   *   - livreur : visible seulement une fois SA mission acceptée
   *     (avant ça, il n'a rien à faire sur cette commande).
   *   - correspondant : visible seulement si cette commande passe
   *     réellement par lui (acteurs.some role==='correspondant').
   */
  const hasLivreurActeur       = c.commande.acteurs.some(a => a.role === 'livreur');
  const hasCorrespondantActeur = c.commande.acteurs.some(a => a.role === 'correspondant');
  const livreurEnRoute         = hasLivreurActeur && c.commande.livreurAssignmentStatus === 'accepted';
  const showTrackingMap =
    !!id && !c.done && (
      role === 'client' ||
      role === 'entreprise' ||
      (role === 'livreur' && livreurEnRoute) ||
      (role === 'correspondant' && hasCorrespondantActeur)
    );

  return (
    <div className={styles.order}>

      {/* En-tête */}
      <div className={styles.head}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate(-1)}
            style={{ background: 'var(--g100)', border: 'none', borderRadius: 8, color: 'var(--t2)', cursor: 'pointer', padding: '6px 10px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
            title="Retour"
          >
            <i className="fas fa-arrow-left" />
          </button>
          <div>
            <div className={styles.title}>
              <i className="fas fa-box-open" /> Commande <span className={styles.id}>#{c.commande.id}</span>
            </div>
            <div className={styles.sub}>Payée le {c.commande.datePaiement} · Livraison à {c.commande.destination}</div>
          </div>
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

      {/* Le livreur a refusé la mission — le client doit en choisir un autre */}
      {role === 'client' && c.commande.livreurAssignmentStatus === 'refused' && (
        <div style={{
          display:'flex', alignItems:'center', gap:12, flexWrap:'wrap',
          background:'rgba(239,68,68,.08)', border:'1.5px solid rgba(239,68,68,.3)',
          borderRadius:14, padding:'14px 18px', marginBottom:16,
        }}>
          <i className="fas fa-triangle-exclamation" style={{ color:'#DC2626', fontSize:18 }} />
          <div style={{ flex:1, minWidth:200 }}>
            <div style={{ fontSize:13.5, fontWeight:700, color:'var(--navy,#0B1F3A)' }}>Le livreur a refusé cette mission</div>
            <div style={{ fontSize:12, color:'var(--t2,#475569)' }}>
              {c.commande.livreurRefusalReason ? `Motif : ${c.commande.livreurRefusalReason} — ` : ''}
              Choisissez un autre livreur pour continuer.
            </div>
          </div>
          <button
            onClick={openChoisirLivreur}
            style={{ background:'#DC2626', color:'#fff', border:'none', borderRadius:10, padding:'10px 18px', fontSize:13, fontWeight:700, cursor:'pointer', flexShrink:0 }}
          >
            <i className="fas fa-motorcycle" /> Choisir un livreur
          </button>
        </div>
      )}

      <div className={styles.grid}>

        {/* ── Colonne gauche ── */}
        <div>
          {/* Suivi en direct — voir showTrackingMap ci-dessus pour le détail
           * des conditions de visibilité par rôle. Le bouton bascule
           * showMap : l'en-tête reste visible, la carte elle-même
           * (coûteuse — Leaflet + calcul d'itinéraires) ne se charge
           * que si l'utilisateur choisit explicitement de l'afficher. */}
          {showTrackingMap && (
            <div style={{ marginBottom: 16 }}>
              <button
                onClick={() => setShowMap(v => !v)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: showMap ? 'var(--g100,#F1F5F9)' : '#fff',
                  border: '1.5px solid var(--bdr,#E2E8F0)', borderRadius: 12,
                  padding: '10px 14px', cursor: 'pointer', marginBottom: showMap ? 10 : 0,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--navy,#0B1F3A)', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <i className="fas fa-location-crosshairs" style={{ color: 'var(--blue,#1A4FC4)' }} /> Suivi en direct
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue,#1A4FC4)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  {showMap ? 'Masquer la carte' : 'Voir la carte'}
                  <i className={`fas fa-chevron-${showMap ? 'up' : 'down'}`} />
                </span>
              </button>
              {showMap && (
                <OrderTrackingMap orderId={id!} height="320px" showPanel={false} />
              )}
            </div>
          )}

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
      {showChoisirLivreur && (
        <ChoisirLivreurModal
          title="Choisir un livreur"
          items={livreurOptions}
          loading={loadingLivreurs}
          saving={savingLivreur}
          emptyMessage="Vous ne suivez aucun livreur pour le moment. Suivez-en un depuis la page Livreurs pour pouvoir le choisir ici."
          onClose={() => setShowChoisirLivreur(false)}
          onSelect={handleChoisirLivreur}
        />
      )}
    </div>
  );
}