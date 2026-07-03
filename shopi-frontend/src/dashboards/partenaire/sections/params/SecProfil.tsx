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
  { label: 'Photo', check: (d: PartenaireData) => !!d.profilePicture },
  { label: 'Prénom / Nom', check: (d: PartenaireData) => !!(d.firstName && d.lastName) },
  { label: 'Bio', check: (d: PartenaireData) => !!d.bio },
  { label: 'Téléphone', check: (d: PartenaireData) => !!d.phone },
];

export default function SecProfil({
  data, saving, dirty, markClean, saveTrigger, onSave, onUploadPhoto, onToast
}: Props) {
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

  /* ── Sauvegarde ── */
  async function handleSave() {
    try {
      await onSave({ firstName: prenom, lastName: nom, phone, bio });
      markClean();
      onToast('✅ Profil sauvegardé', 's');
    } catch {
      onToast('❌ Erreur lors de la sauvegarde', 'w');
    }
  }

  /* ── Téléversement photo ── */
  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await onUploadPhoto(file);
      onToast('✅ Photo mise à jour', 's');
    } catch {
      onToast('❌ Échec du téléversement', 'w');
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
              <span>Complété</span>
            </div>
          </div>
          <div className={s.healthTxt}>
            <h2>
              {donePct < 80 ? 'Complétez votre profil' : 'Profil bien rempli'}
            </h2>
            <p>
              {donePct < 80
                ? "Ajoutez vos informations manquantes pour renforcer votre crédibilité auprès des acteurs recrutés."
                : "Votre profil partenaire est complet. Vous pouvez continuer à recruter avec confiance."}
            </p>
          </div>
          <div className={s.healthStats}>
            <div className={s.hs}>
              <div className={s.hsIcOk}><i className="fas fa-circle-check" /></div>
              <div className={s.hsV}>{data?.isVerified ? 'Vérifié' : 'En attente'}</div>
              <div className={s.hsL}>Identité</div>
            </div>
            <div className={s.hs}>
              <div className={data?.twoFaEnabled ? s.hsIcOk : s.hsIcWarn}><i className="fas fa-shield-halved" /></div>
              <div className={s.hsV}>{data?.twoFaEnabled ? 'Activée' : 'Désactivée'}</div>
              <div className={s.hsL}>Double auth.</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Informations personnelles ── */}
      <div className={s.fc}>
        <div className={s.fcHd}>
          <div>
            <div className={s.fcTtl}><i className="fas fa-user" /> Informations personnelles</div>
            <div className={s.fcSub}>Ces informations apparaissent sur votre profil partenaire.</div>
          </div>
        </div>
        <div className={s.fcBody}>
          {/* Photo de profil */}
          <div className={s.avRow}>
            <div className={s.av} onClick={() => fileRef.current?.click()}>
              {data?.profilePicture
                ? <img src={data.profilePicture} alt="Profil" />
                : initiales}
              <div className={s.avCam}>
                {uploading
                  ? <i className="fas fa-spinner fa-spin" />
                  : <i className="fas fa-camera" />
                }
              </div>
            </div>
            <div className={s.avTxt}>
              <h4>Photo de profil</h4>
              <p>JPG, PNG ou WebP. Taille max. 2 Mo.</p>
              <div className={s.avBtns}>
                <button className={s.btnPrimary} onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? 'Téléversement…' : 'Changer la photo'}
                </button>
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
          </div>

          <div className={s.grid2}>
            <div className={s.fg}>
              <label className={s.fl}>Prénom</label>
              <input
                className={s.fin}
                value={prenom}
                onChange={e => { setPrenom(e.target.value); dirty(); }}
                placeholder="Votre prénom"
              />
            </div>
            <div className={s.fg}>
              <label className={s.fl}>Nom</label>
              <input
                className={s.fin}
                value={nom}
                onChange={e => { setNom(e.target.value); dirty(); }}
                placeholder="Votre nom"
              />
            </div>
          </div>

          <div className={s.grid2}>
            <div className={s.fg}>
              <label className={s.fl}>Téléphone</label>
              <input
                className={s.fin}
                value={phone}
                onChange={e => { setPhone(e.target.value); dirty(); }}
                placeholder="+224 6•• •• •• ••"
                inputMode="tel"
              />
            </div>
            <div className={s.fg}>
              <label className={s.fl}>Email <span className={s.flOpt}>— non modifiable</span></label>
              <input className={s.fin} value={email} readOnly style={{ opacity: .6, cursor: 'not-allowed' }} />
            </div>
          </div>

          <div className={s.fg} style={{ marginBottom: 0 }}>
            <label className={s.fl}>Bio / Présentation <span className={s.flOpt}>optionnel</span></label>
            <textarea
              className={s.fin}
              rows={3}
              value={bio}
              onChange={e => { setBio(e.target.value); dirty(); }}
              placeholder="Présentez-vous en quelques mots…"
              style={{ resize: 'none' }}
            />
            <span className={s.hint}>Visible sur votre profil public partenaire.</span>
          </div>
        </div>
      </div>

      {/* ── Statut partenaire ── */}
      <div className={s.fc}>
        <div className={s.fcHd}>
          <div className={s.fcTtl}><i className="fas fa-award" /> Statut partenaire</div>
        </div>
        <div className={s.fcBody}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {data?.isVerified && (
              <span className={s.verifBadge}><i className="fas fa-circle-check" /> Partenaire vérifié</span>
            )}
            {data?.palier && (
              <span className={s.goldBadge}><i className="fas fa-crown" /> Palier {data.palier} · {data.palier === 'gold' ? 'Niveau 3' : data.palier === 'silver' ? 'Niveau 2' : 'Niveau 1'}</span>
            )}
            {data?.memberSince && (
              <span style={{ fontSize: 12, color: 'var(--t3)' }}>
                Membre depuis {new Date(data.memberSince).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
