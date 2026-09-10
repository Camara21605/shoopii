/* ================================================================
 * FICHIER : sections/params/SecProfil.tsx
 *
 * Section "Profil" des paramètres partenaire.
 *
 * Connexions API (via props) :
 *   onSave(dto)      → PATCH /partenaire/parametres/profil
 *   onUploadPhoto(f) → POST  /partenaire/parametres/profil/photo
 *
 * Initialisation depuis data (useEffect) pour toujours refléter
 * les valeurs de l'API, même après une sauvegarde.
 * ================================================================ */

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import s from '../../styles/ParamsShared.module.css';
import type { PartenaireData } from '../../hooks/usePartenaireParametres';

interface Props {
  data:          PartenaireData | null;
  saving:        boolean;
  dirty:         () => void;
  markClean:     () => void;
  saveTrigger:   number;
  onSave:        (body: Partial<PartenaireData>) => Promise<void>;
  onUploadPhoto: (file: File) => Promise<void>;
  onToast:       (msg: string, type?: 's' | 'i' | 'w') => void;
}

/* Pourcentage de complétion du profil */
const STEPS = [
  { check: (d: PartenaireData) => !!d.profilePicture },
  { check: (d: PartenaireData) => !!(d.firstName && d.lastName) },
  { check: (d: PartenaireData) => !!d.bio },
  { check: (d: PartenaireData) => !!d.phone },
];

export default function SecProfil({
  data, saving, dirty, markClean, saveTrigger, onSave, onUploadPhoto, onToast
}: Props) {
  const { t } = useTranslation();
  const [prenom, setPrenom] = useState('');
  const [nom,    setNom]    = useState('');
  const [phone,  setPhone]  = useState('');
  const [email,  setEmail]  = useState('');
  const [bio,    setBio]    = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /* Pré-remplit depuis les données API */
  useEffect(() => {
    if (!data) return;
    setPrenom(data.firstName ?? '');
    setNom(data.lastName    ?? '');
    setPhone(data.phone     ?? '');
    setEmail(data.email     ?? '');
    setBio(data.bio         ?? '');
  }, [data]);

  /* Réagit au déclencheur SaveFloat */
  useEffect(() => {
    if (saveTrigger > 0) handleSave();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveTrigger]);

  /* Complétion */
  const donePct = data
    ? Math.round((STEPS.filter(s => s.check(data)).length / STEPS.length) * 100)
    : 0;

  /* ── Sauvegarde ──
   * `phone` volontairement absent du payload : non modifiable, comme
   * l'email. Le backend le rejette de toute façon (DTO sans ce champ +
   * forbidNonWhitelisted) — l'exclure ici évite un 400 sur chaque
   * sauvegarde de bio/nom. */
  async function handleSave() {
    try {
      await onSave({ firstName: prenom, lastName: nom, bio });
      markClean();
      onToast(t('partenaireParametres.secProfil.toasts.profilSaved'), 's');
    } catch (err: any) {
      onToast(err?.message || t('partenaireParametres.secProfil.toasts.profilError'), 'w');
    }
  }

  /* ── Verrou nom/prénom (3 mois entre deux changements) ── */
  const nameLockedUntil = data?.nameChangeAllowedAt ? new Date(data.nameChangeAllowedAt) : null;
  const nameLocked = !!nameLockedUntil && nameLockedUntil > new Date();

  /* ── Téléversement photo ── */
  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await onUploadPhoto(file);
      onToast(t('partenaireParametres.secProfil.toasts.photoSaved'), 's');
    } catch {
      onToast(t('partenaireParametres.secProfil.toasts.photoError'), 'w');
    } finally {
      setUploading(false);
    }
  }

  /* Initiales de secours si pas de photo */
  const initiales = [prenom[0], nom[0]].filter(Boolean).join('').toUpperCase() || 'P';

  return (
    <>
      {/* ── Bandeau santé du compte ── */}
      <div className={s.health} style={{ marginBottom: 18 }}>
        <div className={s.healthGlow} />
        <div className={s.healthIn}>
          <div
            className={s.healthRing}
            style={{ background: `conic-gradient(#34D399 0% ${donePct}%, rgba(255,255,255,.12) ${donePct}% 100%)` }}
          >
            <div className={s.healthRingV}>
              <b>{donePct}%</b>
              <span>{t('partenaireParametres.secProfil.health.completedLabel')}</span>
            </div>
          </div>
          <div className={s.healthTxt}>
            <h2>
              {donePct < 80 ? t('partenaireParametres.secProfil.health.titleLow') : t('partenaireParametres.secProfil.health.titleHigh')}
            </h2>
            <p>
              {donePct < 80
                ? t('partenaireParametres.secProfil.health.paragraphLow')
                : t('partenaireParametres.secProfil.health.paragraphHigh')}
            </p>
          </div>
          <div className={s.healthStats}>
            <div className={s.hs}>
              <div className={s.hsIcOk}><i className="fas fa-circle-check" /></div>
              <div className={s.hsV}>{data?.isVerified ? t('partenaireParametres.secProfil.health.verifie') : t('partenaireParametres.secProfil.health.enAttente')}</div>
              <div className={s.hsL}>{t('partenaireParametres.secProfil.health.identiteLabel')}</div>
            </div>
            <div className={s.hs}>
              <div className={data?.twoFaEnabled ? s.hsIcOk : s.hsIcWarn}><i className="fas fa-shield-halved" /></div>
              <div className={s.hsV}>{data?.twoFaEnabled ? t('partenaireParametres.secProfil.health.activee') : t('partenaireParametres.secProfil.health.desactivee')}</div>
              <div className={s.hsL}>{t('partenaireParametres.secProfil.health.doubleAuthLabel')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Informations personnelles ── */}
      <div className={s.fc}>
        <div className={s.fcHd}>
          <div>
            <div className={s.fcTtl}><i className="fas fa-user" /> {t('partenaireParametres.secProfil.infosCard.title')}</div>
            <div className={s.fcSub}>{t('partenaireParametres.secProfil.infosCard.sub')}</div>
          </div>
        </div>
        <div className={s.fcBody}>
          {/* Photo de profil */}
          <div className={s.avRow}>
            <div className={s.av} onClick={() => fileRef.current?.click()}>
              {data?.profilePicture
                ? <img src={data.profilePicture} alt={t('partenaireParametres.secProfil.infosCard.photoTitle')} />
                : initiales}
              <div className={s.avCam}>
                {uploading
                  ? <i className="fas fa-spinner fa-spin" />
                  : <i className="fas fa-camera" />
                }
              </div>
            </div>
            <div className={s.avTxt}>
              <h4>{t('partenaireParametres.secProfil.infosCard.photoTitle')}</h4>
              <p>{t('partenaireParametres.secProfil.infosCard.photoDesc')}</p>
              <div className={s.avBtns}>
                <button className={s.btnPrimary} onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? t('partenaireParametres.secProfil.infosCard.photoUploading') : t('partenaireParametres.secProfil.infosCard.photoChangeBtn')}
                </button>
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
          </div>

          <div className={s.grid2}>
            <div className={s.fg}>
              <label className={s.fl}>
                {t('partenaireParametres.secProfil.infosCard.prenomLabel')}
                {nameLocked && <span className={s.flOpt}>{t('partenaireParametres.secProfil.infosCard.verrouille')}</span>}
              </label>
              <input
                className={s.fin}
                value={prenom}
                onChange={e => { setPrenom(e.target.value); dirty(); }}
                placeholder={t('partenaireParametres.secProfil.infosCard.prenomPlaceholder')}
                readOnly={nameLocked}
                style={nameLocked ? { opacity: .6, cursor: 'not-allowed' } : undefined}
              />
            </div>
            <div className={s.fg}>
              <label className={s.fl}>
                {t('partenaireParametres.secProfil.infosCard.nomLabel')}
                {nameLocked && <span className={s.flOpt}>{t('partenaireParametres.secProfil.infosCard.verrouille')}</span>}
              </label>
              <input
                className={s.fin}
                value={nom}
                onChange={e => { setNom(e.target.value); dirty(); }}
                placeholder={t('partenaireParametres.secProfil.infosCard.nomPlaceholder')}
                readOnly={nameLocked}
                style={nameLocked ? { opacity: .6, cursor: 'not-allowed' } : undefined}
              />
            </div>
          </div>
          {nameLocked && nameLockedUntil && (
            <span className={s.hint} style={{ display: 'block', marginTop: -8, marginBottom: 16 }}>
              {t('partenaireParametres.secProfil.infosCard.nameLockedHint', { date: nameLockedUntil.toLocaleDateString('fr-FR') })}
            </span>
          )}

          <div className={s.grid2}>
            <div className={s.fg}>
              <label className={s.fl}>{t('partenaireParametres.secProfil.infosCard.telephoneLabel')} <span className={s.flOpt}>{t('partenaireParametres.secProfil.infosCard.nonModifiable')}</span></label>
              <input className={s.fin} value={phone} readOnly style={{ opacity: .6, cursor: 'not-allowed' }} placeholder="+224 6•• •• •• ••" />
            </div>
            <div className={s.fg}>
              <label className={s.fl}>{t('partenaireParametres.secProfil.infosCard.emailLabel')} <span className={s.flOpt}>{t('partenaireParametres.secProfil.infosCard.nonModifiable')}</span></label>
              <input className={s.fin} value={email} readOnly style={{ opacity: .6, cursor: 'not-allowed' }} />
            </div>
          </div>

          <div className={s.fg} style={{ marginBottom: 0 }}>
            <label className={s.fl}>{t('partenaireParametres.secProfil.infosCard.bioLabel')} <span className={s.flOpt}>{t('partenaireParametres.secProfil.infosCard.optionnel')}</span></label>
            <textarea
              className={s.fin}
              rows={3}
              value={bio}
              onChange={e => { setBio(e.target.value); dirty(); }}
              placeholder={t('partenaireParametres.secProfil.infosCard.bioPlaceholder')}
              style={{ resize: 'none' }}
            />
            <span className={s.hint}>{t('partenaireParametres.secProfil.infosCard.bioHint')}</span>
          </div>
        </div>
      </div>

      {/* ── Statut partenaire ── */}
      <div className={s.fc}>
        <div className={s.fcHd}>
          <div className={s.fcTtl}><i className="fas fa-award" /> {t('partenaireParametres.secProfil.statutCard.title')}</div>
        </div>
        <div className={s.fcBody}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {data?.isVerified && (
              <span className={s.verifBadge}><i className="fas fa-circle-check" /> {t('partenaireParametres.secProfil.statutCard.verifieBadge')}</span>
            )}
            {data?.palier && (
              <span className={s.goldBadge}><i className="fas fa-crown" /> {t('partenaireParametres.secProfil.statutCard.palierPrefix')} {data.palier} · {
                t('partenaireParametres.secProfil.statutCard.niveauLabel', { n:
                  data.palier === 'platinum' ? 4
                  : data.palier === 'gold'     ? 3
                  : data.palier === 'silver'   ? 2
                  : 1
                })
              }</span>
            )}
            {data?.memberSince && (
              <span style={{ fontSize: 12, color: 'var(--t3)' }}>
                {t('partenaireParametres.secProfil.statutCard.membreDepuis', { date: new Date(data.memberSince).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) })}
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
