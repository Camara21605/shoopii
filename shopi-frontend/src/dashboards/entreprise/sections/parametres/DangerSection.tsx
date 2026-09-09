// src/dashboards/entreprise/sections/parametres/DangerSection.tsx
//
// BUG CORRIGÉ — les 4 boutons se contentaient d'un toast générique
// "confirmation requise" sans jamais appeler l'API : mettre en pause,
// désactiver et supprimer étaient de purs mockups alors que les 3
// endpoints backend existent et fonctionnent depuis longtemps (mot de
// passe requis, voir DangerParametresService — PATCH danger/pause,
// PATCH danger/desactiver, DELETE danger/supprimer), simplement jamais
// câblés. "Transférer la gestion" reste désactivé avec un badge honnête
// ("Bientôt disponible") : aucune route backend n'existe pour transférer
// la propriété d'une boutique à un autre compte — ce serait un mockup
// si le bouton faisait semblant de fonctionner.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import FormCard from '../../components/parametres/FormCard';
import s from '../../styles/parametres/ParametresPage.module.css';

type ConfirmAction = 'pause' | 'disable' | 'delete';

interface Props {
  onDirty: () => void;
  onToast: (m: string, t?: string) => void;
  saving:  boolean;
  pauseBoutique:      (password: string) => Promise<{ message: string }>;
  desactiverCompte:   (password: string) => Promise<{ message: string; reactivationAt: string }>;
  supprimerBoutique:  (password: string) => Promise<{ message: string }>;
  /** Appelé après une suppression réussie — la boutique n'existe plus,
   *  l'appelant (ParametresPage) déconnecte l'utilisateur. */
  onDeleted: () => void;
  /** BUG CORRIGÉ (sécurité) — ces 3 actions sont désormais réservées au
   *  propriétaire côté backend (TeamOwnerGuard, voir parametres.controller.
   *  ts : un collaborateur avec la permission "Paramètres > Modifier"
   *  pouvait auparavant mettre en pause/désactiver/SUPPRIMER toute la
   *  boutique). Un collaborateur voyait ces boutons pleinement actifs
   *  (seul settings.edit était vérifié côté UI, via le fieldset de
   *  ParametresPage) pour finir sur un 403 déroutant au clic — on
   *  affiche maintenant honnêtement la restriction. */
  isOwner: boolean;
}

export default function DangerSection({
  onToast, saving, pauseBoutique, desactiverCompte, supprimerBoutique, onDeleted, isOwner,
}: Props) {
  const { t } = useTranslation();
  const actionsDisabled = saving || !isOwner;

  const [confirm,  setConfirm]  = useState<ConfirmAction | null>(null);
  const [password, setPassword] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [busy,     setBusy]     = useState(false);

  function openConfirm(action: ConfirmAction) {
    setConfirm(action);
    setPassword('');
    setPwdError('');
  }
  function closeConfirm() {
    if (busy) return;
    setConfirm(null);
    setPassword('');
    setPwdError('');
  }

  async function handleConfirm() {
    if (!confirm) return;
    if (!password.trim()) {
      setPwdError(t('parametres.danger.modal.passwordRequired'));
      return;
    }
    setPwdError('');
    setBusy(true);
    try {
      if (confirm === 'pause') {
        await pauseBoutique(password);
        onToast(t('parametres.danger.pauseSuccess'), 's');
      } else if (confirm === 'disable') {
        await desactiverCompte(password);
        onToast(t('parametres.danger.disableSuccess'), 's');
      } else {
        await supprimerBoutique(password);
        onToast(t('parametres.danger.deleteSuccess'), 's');
        setConfirm(null);
        onDeleted();
        return;
      }
      setConfirm(null);
    } catch (err: any) {
      /* Le backend renvoie 401 si le mot de passe est incorrect */
      const msg: string = err?.message ?? '';
      if (msg.toLowerCase().includes('incorrect') || msg.toLowerCase().includes('refusée')) {
        setPwdError(t('parametres.danger.modal.passwordIncorrect'));
      } else {
        onToast(t('parametres.danger.modal.genericError'), 'w');
        setConfirm(null);
      }
    } finally {
      setBusy(false);
    }
  }

  const MODAL_COPY: Record<ConfirmAction, { title: string; msg: string; btn: string }> = {
    pause:   { title: t('parametres.danger.modal.pauseTitle'),   msg: t('parametres.danger.modal.pauseMsg'),   btn: t('parametres.danger.actions.pause.btn') },
    disable: { title: t('parametres.danger.modal.disableTitle'), msg: t('parametres.danger.modal.disableMsg'), btn: t('parametres.danger.actions.disable.btn') },
    delete:  { title: t('parametres.danger.modal.deleteTitle'),  msg: t('parametres.danger.modal.deleteMsg'),  btn: t('parametres.danger.actions.delete.btn') },
  };

  return (
    <>
      <div className={s.sectionHd}>
        <h1><i className="fas fa-triangle-exclamation" style={{ color:'var(--red)' }} /> {t('parametres.danger.title')}</h1>
        <p>{t('parametres.danger.subtitle')}</p>
      </div>
      {!isOwner && (
        <div className={s.dangerOwnerBanner}>
          <i className="fas fa-lock" /> {t('parametres.danger.ownerOnly')}
        </div>
      )}

      <FormCard title={t('parametres.danger.irreversiblesTitle')} icon="fa-skull-crossbones" subtitle={t('parametres.danger.irreversiblesSubtitle')} danger>

        <div className={s.dangerRow}>
          <div>
            <div className={s.dangerTtl}>{t('parametres.danger.actions.pause.ttl')}</div>
            <div className={s.dangerSub}>{t('parametres.danger.actions.pause.sub')}</div>
          </div>
          <button className={s.dangerBtn} onClick={() => openConfirm('pause')} disabled={actionsDisabled} title={!isOwner ? t('parametres.danger.ownerOnly') : undefined}>
            {t('parametres.danger.actions.pause.btn')}
          </button>
        </div>

        <div className={s.dangerRow}>
          <div>
            <div className={s.dangerTtl}>{t('parametres.danger.actions.disable.ttl')}</div>
            <div className={s.dangerSub}>{t('parametres.danger.actions.disable.sub')}</div>
          </div>
          <button className={s.dangerBtn} onClick={() => openConfirm('disable')} disabled={actionsDisabled} title={!isOwner ? t('parametres.danger.ownerOnly') : undefined}>
            {t('parametres.danger.actions.disable.btn')}
          </button>
        </div>

        <div className={s.dangerRow}>
          <div>
            <div className={s.dangerTtl}>{t('parametres.danger.actions.transfer.ttl')}</div>
            <div className={s.dangerSub}>{t('parametres.danger.actions.transfer.sub')}</div>
            <span className={s.dangerSoonBadge}>{t('parametres.danger.comingSoon')}</span>
          </div>
          <button className={s.dangerBtn} disabled title={t('parametres.danger.comingSoon')}>
            {t('parametres.danger.actions.transfer.btn')}
          </button>
        </div>

        <div className={s.dangerRow}>
          <div>
            <div className={s.dangerTtl}>{t('parametres.danger.actions.delete.ttl')}</div>
            <div className={s.dangerSub}>{t('parametres.danger.actions.delete.sub')}</div>
          </div>
          <button className={s.dangerBtn} onClick={() => openConfirm('delete')} disabled={actionsDisabled} title={!isOwner ? t('parametres.danger.ownerOnly') : undefined}>
            {t('parametres.danger.actions.delete.btn')}
          </button>
        </div>

      </FormCard>

      {/* ── Modale de confirmation avec mot de passe ── */}
      {confirm && (
        <div className={s.dOverlay} onClick={e => { if (e.target === e.currentTarget) closeConfirm(); }}>
          <div className={s.dModal}>
            <div className={s.dIcon}><i className="fas fa-triangle-exclamation" /></div>
            <h3>{MODAL_COPY[confirm].title}</h3>
            <p>{MODAL_COPY[confirm].msg}</p>

            <div className={s.dField}>
              <label className={s.dLabel}>{t('parametres.danger.modal.passwordLabel')}</label>
              <input
                className={s.dInput}
                type="password"
                placeholder={t('parametres.danger.modal.passwordPlaceholder')}
                value={password}
                onChange={e => { setPassword(e.target.value); setPwdError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); }}
                autoFocus
                style={{ borderColor: pwdError ? 'var(--red)' : undefined }}
              />
              {pwdError && <p className={s.dError}><i className="fas fa-circle-exclamation" style={{ marginRight: 5 }} />{pwdError}</p>}
            </div>

            <div className={s.dBtns}>
              <button className={s.dCancel} onClick={closeConfirm} disabled={busy}>
                {t('parametres.danger.modal.cancel')}
              </button>
              <button className={s.dConfirm} onClick={handleConfirm} disabled={busy || !password.trim()}>
                {busy
                  ? <><i className="fas fa-spinner fa-spin" /> {t('parametres.danger.modal.confirming')}</>
                  : MODAL_COPY[confirm].btn}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
