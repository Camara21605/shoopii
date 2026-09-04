/*
 * ============================================================
 * FICHIER : src/modules/home/components/boutique/sections/BoutiqueIdentity.tsx
 *
 * RÔLE    : Barre d'identité sticky sous le header.
 *           Reste visible en scrollant pour garder
 *           le contexte de la boutique.
 *
 * AFFICHE :
 *   - Nom de la boutique + badge Vérifié Shoneya
 *   - Domaine, ville, date membre
 *   - Stats (note, abonnés, satisfaction, ventes)
 *   - Boutons : S'abonner (toggle) | Message | Partager
 * ============================================================
 */
import React, { useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { BoutiqueInfo } from '../data/boutiqueMockData';
import FollowButton from '../../../../../shared/components/FollowButton';
import styles from '../styles/BoutiqueIdentity.module.css';

interface Props {
  boutiqueId:     string;
  boutique:       BoutiqueInfo;
  suivi:          boolean;
  msgLoading?:    boolean;
  callLoading?:   boolean;
  onToast:        (msg: string, type?: 's' | 'i' | 'w' | 'e') => void;
  onRequireAuth:  () => void;
  onSuiviChange:  (isSuivi: boolean) => void;
  onMessage:      () => void;
  onCall?:        () => void;
  onPartage:      () => void;
  /** true → masque S'abonner/Message/Appeler : une entreprise ne peut pas
   * se suivre, s'appeler ou s'envoyer un message à elle-même. Réservé au
   * mode aperçu propriétaire (voir BoutiquePage.tsx, isPreview). */
  isOwnerPreview?: boolean;
}

export default function BoutiqueIdentity({ boutiqueId, boutique, suivi, msgLoading, callLoading, onToast, onRequireAuth, onSuiviChange, onMessage, onCall, onPartage, isOwnerPreview }: Props) {
  const { t } = useTranslation();
  const barRef = useRef<HTMLDivElement>(null);

  /* BUG CORRIGÉ — BoutiqueNav.module.css calait sa position sticky sur
   * une hauteur DEVINÉE (80px desktop / 68px ≤900px) pour cette barre,
   * alors que sa vraie hauteur varie réellement : `.inner` a
   * `flex-wrap:wrap` + `min-height` (pas une hauteur fixe), les boutons
   * passent sur leur propre ligne ≤900px, et surtout — cas visible
   * depuis le dashboard entreprise ("Voir ma boutique") — isOwnerPreview
   * masque 2 des 3 boutons d'action, ce qui change le retour à la ligne
   * et donc la hauteur réelle par rapport à la fiche publique. Résultat :
   * la barre d'onglets se collait au mauvais endroit en scrollant
   * (chevauchement ou vide selon le cas). On mesure maintenant la
   * vraie hauteur et on l'expose en variable CSS globale, relue par
   * BoutiqueNav.module.css — plus aucune valeur devinée. */
  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const apply = () => document.documentElement.style.setProperty('--boutique-identity-h', `${el.offsetHeight}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isOwnerPreview]);

  return (
    <div className={styles.bar} ref={barRef}>
      <div className={styles.inner}>

        {/* ── Nom + badges ── */}
        <div className={styles.nameBlock}>
          <div className={styles.title}>
            {boutique.nom}
            {boutique.verified && (
              <span className={styles.verifBadge}>
                <i className="fas fa-shield-check" /> {t('boutiqueDetail.identity.verifie')}
              </span>
            )}
          </div>
          <div className={styles.meta}>
            <span className={styles.domainBadge}>
              <i className="fas fa-microchip" /> {boutique.domaine}
            </span>
            <span className={styles.metaItem}>
              <i className="fas fa-location-dot" style={{ color:'var(--blue)' }} /> {boutique.ville}
            </span>
            <span className={styles.metaItem}>
              <i className="fas fa-calendar" style={{ color:'var(--t4)' }} /> {boutique.membre}
            </span>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className={styles.stats}>
          {/* Note avec étoiles dynamiques */}
          <React.Fragment>
            <div className={styles.stat}>
              <div className={styles.statV}>{boutique.note.toFixed(1)}</div>
              <div style={{ display:'flex', gap:1, justifyContent:'center', margin:'2px 0' }}>
                {[1,2,3,4,5].map(v => {
                  const filled = v <= Math.floor(boutique.note);
                  const half   = !filled && v === Math.ceil(boutique.note) && boutique.note % 1 >= 0.3;
                  return (
                    <span key={v} style={{
                      fontSize:11,
                      color: filled ? '#F59E0B' : half ? '#F59E0B' : '#D1D5DB',
                      opacity: half ? 0.6 : 1,
                    }}>★</span>
                  );
                })}
              </div>
              <div className={styles.statL}>{t('boutiqueDetail.identity.note')}</div>
            </div>
            <div className={styles.sep} />
          </React.Fragment>

          {[
            { val: boutique.abonnes, lbl:t('boutiqueDetail.identity.abonnes')      },
            { val: boutique.satisf,  lbl:t('boutiqueDetail.identity.satisfaction') },
            { val: boutique.ventes,  lbl:t('boutiqueDetail.identity.ventes')       },
          ].map((s, i) => (
            <React.Fragment key={i}>
              <div className={styles.stat}>
                <div className={styles.statV}>{s.val}</div>
                <div className={styles.statL}>{s.lbl}</div>
              </div>
              {i < 2 && <div className={styles.sep} />}
            </React.Fragment>
          ))}
        </div>

        {/* ── Boutons d'action ── */}
        <div className={styles.actions}>
          {!isOwnerPreview && (
            <>
              {/* S'abonner / Suivi(e) + menu ⋮ (désabonner/masquer/supprimer) */}
              <FollowButton
                actorType="entreprise"
                id={boutiqueId}
                name={boutique.nom}
                isSuivi={suivi}
                onToast={onToast}
                onRequireAuth={onRequireAuth}
                onChange={next => onSuiviChange(next.isSuivi)}
              />

              {/* Message — le parent gère l'auth/abonnement requis au clic */}
              <button
                className={styles.btnMsg}
                onClick={onMessage}
                disabled={msgLoading}
                title={!suivi ? t('boutiqueDetail.identity.abonnezVousMessage') : t('boutiqueDetail.identity.envoyerMessageTitle')}
                style={{ opacity: !suivi ? 0.65 : msgLoading ? 0.65 : 1, cursor: msgLoading ? 'not-allowed' : 'pointer' }}
              >
                <i className={`fas ${msgLoading ? 'fa-spinner fa-spin' : 'fa-comment-dots'}`} />
                {msgLoading ? '…' : t('boutiqueDetail.identity.messageBtn')}
              </button>

              {/* Appeler — le parent gère l'auth/abonnement requis au clic */}
              {onCall && (
                <button
                  className={styles.btnMsg}
                  onClick={onCall}
                  disabled={callLoading}
                  title={!suivi ? t('boutiqueDetail.identity.abonnezVousAppel') : t('boutiqueDetail.identity.appelerTitle')}
                  style={{ opacity: !suivi ? 0.65 : callLoading ? 0.65 : 1, cursor: callLoading ? 'not-allowed' : 'pointer' }}
                >
                  <i className={`fas ${callLoading ? 'fa-spinner fa-spin' : 'fa-phone'}`} />
                  {callLoading ? '…' : t('boutiqueDetail.identity.appelerBtn')}
                </button>
              )}
            </>
          )}

          {/* Partager */}
          <button className={styles.btnShare} onClick={onPartage} title={t('boutiqueDetail.identity.partagerTitle')}>
            <i className="fas fa-share-nodes" />
          </button>
        </div>
      </div>
    </div>
  );
}
