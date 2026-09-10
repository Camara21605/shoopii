/* ================================================================
 * FICHIER : sections/params/SecParrainage.tsx
 * Section "Parrainage" — lien d'invitation personnel, stats, partage.
 * Pas de dirty/save : lecture seule (le lien est généré par le backend).
 *
 * BUG CORRIGÉ — WhatsApp/Facebook/QR Code n'étaient que des toasts
 * factices ("Partage WhatsApp"...) sans jamais rien partager ; le lien
 * lui-même (`/rejoindre/:slug`) ne menait nulle part (slug fabriqué ici
 * depuis le prénom, sans garantie d'unicité, aucune route ne le résolvait) ;
 * les stats "Clics"/"Conversion" étaient également factices (aucun suivi
 * n'existait côté backend).
 *
 * Tout est maintenant réel :
 *   - refLink utilise data.referralSlug — slug stable généré une seule
 *     fois par le backend (voir ProfilPartenaireService.ensureReferralSlug),
 *     résolu publiquement par GET /public/rejoindre/:slug (incrémente
 *     referralClicks) puis par AuthService.register() lors de l'inscription
 *     réelle (RegisterDto.referralSlug → rattachement au partenaire, sans
 *     code à saisir — voir son commentaire pour le détail complet).
 *   - "Clics" = data.referralClicks (visites réelles du lien).
 *   - "Inscriptions" = acteurs effectivement recrutés par ce partenaire
 *     (data.totalCompanies/Deliveries/Correspondants, déjà utilisé sur
 *     OverviewPage.tsx pour kpis.totalActeurs) — tous canaux confondus
 *     (codes de création + lien de parrainage), pas seulement via ce lien :
 *     aucune colonne ne distingue encore le canal de recrutement par
 *     acteur, seul le total est disponible.
 * ================================================================ */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import s from '../../styles/ParamsShared.module.css';
import type { PartenaireData } from '../../hooks/usePartenaireParametres';

interface Props {
  data:    PartenaireData | null;
  onToast: (msg: string, type?: 's' | 'i' | 'w') => void;
}

export default function SecParrainage({ data, onToast }: Props) {
  const { t } = useTranslation();
  const [showQr, setShowQr] = useState(false);

  const slug    = data?.referralSlug ?? null;
  const refLink = slug ? `https://shopi.gn/rejoindre/${slug}` : '';

  const clics = data?.referralClicks ?? 0;

  /* Réel : nombre d'acteurs effectivement recrutés (même calcul que
   * OverviewPage.tsx kpis.totalActeurs). */
  const inscriptions = data
    ? (data.totalCompanies ?? 0) + (data.totalDeliveries ?? 0) + (data.totalCorrespondants ?? 0)
    : 0;

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(refLink)}`;

  function copyLink() {
    if (!refLink) return;
    navigator.clipboard?.writeText(refLink);
    onToast(t('partenaireParametres.secParrainage.copiedToast'), 's');
  }

  function shareWhatsapp() {
    if (!refLink) return;
    const msg = t('partenaireParametres.secParrainage.whatsappMessage', { link: refLink });
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
  }

  function shareFacebook() {
    if (!refLink) return;
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(refLink)}`, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className={s.fc}>
      <div className={s.fcHd}>
        <div>
          <div className={s.fcTtl}><i className="fas fa-share-nodes" /> {t('partenaireParametres.secParrainage.title')}</div>
          <div className={s.fcSub}>{t('partenaireParametres.secParrainage.sub')}</div>
        </div>
      </div>
      <div className={s.fcBody}>
        <div className={s.refBox}>
          <div className={s.refGlow} />
          <div className={s.refIn}>
            <h4>{t('partenaireParametres.secParrainage.boxTitle')}</h4>
            <p>{t('partenaireParametres.secParrainage.boxDesc')}</p>
            <div className={s.refLinkRow}>
              <div className={s.refLink}>
                <i className="fas fa-link" />
                <span>{refLink || t('partenaireParametres.secParrainage.linkLoading')}</span>
              </div>
              <button className={s.refCopy} onClick={copyLink} disabled={!refLink}>
                <i className="fas fa-copy" /> {t('partenaireParametres.secParrainage.copierBtn')}
              </button>
            </div>
            <div className={s.refShare}>
              <button className={`${s.refSbtn} ${s.refWa}`} onClick={shareWhatsapp} disabled={!refLink}>
                <i className="fab fa-whatsapp" /> {t('partenaireParametres.secParrainage.whatsapp')}
              </button>
              <button className={`${s.refSbtn} ${s.refFb}`} onClick={shareFacebook} disabled={!refLink}>
                <i className="fab fa-facebook-f" /> {t('partenaireParametres.secParrainage.facebook')}
              </button>
              <button className={`${s.refSbtn} ${s.refQr}`} onClick={() => setShowQr(true)} disabled={!refLink}>
                <i className="fas fa-qrcode" /> {t('partenaireParametres.secParrainage.qrCode')}
              </button>
            </div>
            <div className={s.refStats}>
              <div className={s.refStat}><b>{clics}</b><span>{t('partenaireParametres.secParrainage.statClics')}</span></div>
              <div className={s.refStat}><b>{inscriptions}</b><span>{t('partenaireParametres.secParrainage.statInscriptions')}</span></div>
            </div>
          </div>
        </div>
      </div>

      {showQr && (
        <div className={s.mbg} onClick={e => { if (e.target === e.currentTarget) setShowQr(false); }}>
          <div className={s.cmodal}>
            <h3>{t('partenaireParametres.secParrainage.qrModalTitle')}</h3>
            <img
              src={qrUrl}
              alt={t('partenaireParametres.secParrainage.qrModalTitle')}
              style={{ width: 220, height: 220, margin: '16px auto', display: 'block', borderRadius: 12 }}
            />
            <p style={{ wordBreak: 'break-all', fontSize: 12, color: 'var(--t3)' }}>{refLink}</p>
            <div className={s.cmodalBtns}>
              <button className={s.cmCancel} onClick={() => setShowQr(false)}>
                {t('partenaireParametres.secParrainage.qrCloseBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
