/* ================================================================
 * FICHIER : pages/parametres/ProfilSection.tsx
 * Section Profil — données réelles via GET/PATCH /dashboard/super-admin/my-profil
 * ================================================================ */

import { useState, useEffect, useRef } from 'react';
import styles from '../../styles/ParametresPage.module.css';
import type { SectionProps } from './types';
import { apiFetch, tokenStorage } from '../../../../shared/services/apiFetch';
import { adminInitials, useAdminProfile, type AdminProfile } from '../../hooks/useAdminProfile';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';

const PHONE_RE = /^\+?[0-9 ().-]{6,20}$/;

export default function ProfilSection({ onToast }: SectionProps) {
  /* Profil partagé avec la sidebar et la topbar : patch() les met à jour
   * immédiatement après chaque enregistrement. */
  const { profile, patch } = useAdminProfile();
  const loading = profile === null;

  const [saving,    setSaving]    = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dirty,     setDirty]     = useState(false);
  const [errors,    setErrors]    = useState<Record<string, string>>({});

  /* champs éditables (initialisés depuis le profil chargé) */
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [phone,     setPhone]     = useState('');
  const [jobTitle,  setJobTitle]  = useState('');
  const [bio,       setBio]       = useState('');

  const fileRef = useRef<HTMLInputElement>(null);

  const fill = (p: AdminProfile) => {
    setFirstName(p.firstName); setLastName(p.lastName); setPhone(p.phone);
    setJobTitle(p.jobTitle);   setBio(p.bio);
    setErrors({}); setDirty(false);
  };

  /* Première arrivée du profil → remplit le formulaire (jamais écrasé ensuite
   * tant que l'admin est en train de modifier) */
  const filled = useRef(false);
  useEffect(() => {
    if (profile && !filled.current) { filled.current = true; fill(profile); }
  }, [profile]);

  const mark = () => setDirty(true);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = 'Le prénom est obligatoire.';
    if (!lastName.trim())  e.lastName  = 'Le nom de famille est obligatoire.';
    if (phone.trim() && !PHONE_RE.test(phone.trim())) e.phone = 'Numéro invalide (ex : +224 620 12 47 85).';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  /* ── Sauvegarde ── */
  async function save() {
    if (!validate()) { onToast('Corrigez les champs en erreur', 'w'); return; }
    setSaving(true);
    try {
      const updated = await apiFetch<AdminProfile>('/dashboard/super-admin/my-profil', {
        method: 'PATCH',
        body: { firstName, lastName, phone, jobTitle, bio },
      });
      patch(updated);      /* sidebar + topbar + cette page */
      fill(updated);
      onToast('Profil enregistré avec succès', 's');
    } catch (err: any) {
      onToast(err.message ?? 'Erreur lors de la sauvegarde', 'w');
    } finally {
      setSaving(false);
    }
  }

  /* ── Upload avatar ── */
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { onToast('Format invalide — choisissez une image (JPG, PNG, WebP)', 'w'); return; }
    if (file.size > 5 * 1024 * 1024)    { onToast('Image trop grande — maximum 5 Mo', 'w'); return; }

    setUploading(true);
    onToast('Upload en cours…', 'i');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await fetch(`${API_URL}/upload/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenStorage.get() ?? ''}` },
        body: formData,
      });
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        throw new Error(err.message ?? "Erreur lors de l'upload");
      }
      const { url } = await uploadRes.json();
      await apiFetch('/dashboard/super-admin/my-profil/avatar', { method: 'PATCH', body: { avatarUrl: url } });
      patch({ profilePicture: url });
      window.dispatchEvent(new CustomEvent('avatar-updated', { detail: url }));
      onToast('Photo de profil mise à jour !', 's');
    } catch (err: any) {
      onToast(err.message ?? "Erreur lors de l'upload", 'w');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function removeAvatar() {
    if (!profile?.profilePicture) return;
    try {
      await apiFetch('/dashboard/super-admin/my-profil/avatar', { method: 'PATCH', body: { avatarUrl: null } });
      patch({ profilePicture: null });
      window.dispatchEvent(new CustomEvent('avatar-updated', { detail: '' }));
      onToast('Photo supprimée', 's');
    } catch {
      onToast('Impossible de supprimer la photo', 'w');
    }
  }

  /* ── Initiales pour le placeholder ── */
  const initiales = adminInitials({ firstName, lastName, fullName: `${firstName} ${lastName}`.trim() });

  const statusBadge = profile?.status === 'active'
    ? { cls: styles.bdgGreen, label: 'Actif' }
    : profile?.status === 'suspended'
      ? { cls: styles.bdgRed,   label: 'Suspendu' }
      : { cls: styles.bdgAmber, label: 'En attente' };

  if (loading) {
    return (
      <div className={styles.secBody}>
        <div className={styles.card}>
          <div className={styles.cardBody} style={{ textAlign: 'center', padding: '2rem', color: 'var(--adm-text-3)' }}>
            <i className="fas fa-spinner fa-spin" /> Chargement du profil…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.secBody}>

      {/* ── Carte identité ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}><i className="fas fa-user-circle" /> Identité</div>
            <div className={styles.cardSub}>Informations personnelles et photo de profil</div>
          </div>
          {dirty && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
                onClick={() => profile && fill(profile)} disabled={saving}>
                Annuler
              </button>
              <button className={`${styles.btn} ${styles.btnBlue} ${styles.btnSm}`}
                onClick={save} disabled={saving}>
                {saving ? <><i className="fas fa-spinner fa-spin" /> Enregistrement…</> : <><i className="fas fa-check" /> Enregistrer</>}
              </button>
            </div>
          )}
        </div>
        <div className={styles.cardBody}>
          {/* Avatar + nom */}
          <div className={styles.avatarRow}>
            <div className={styles.avatarWrap}>
              {profile?.profilePicture
                ? <img src={profil.profilePicture} alt="avatar" className={styles.avatarCircle}
                    style={{ objectFit: 'cover', padding: 0 }} />
                : <div className={styles.avatarCircle}>{initiales}</div>
              }
              <div className={styles.avatarOvl} onClick={() => fileRef.current?.click()}>
                <i className="fas fa-camera" />
              </div>
            </div>
            <div className={styles.avatarInfo}>
              <div className={styles.avatarName}>{`${firstName} ${lastName}`.trim() || 'Administrateur'}</div>
              <div className={styles.avatarRole}>{jobTitle || 'Administrateur'}</div>
              <div className={styles.avatarActs}>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={handleFileChange} />
                <button className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                  onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <><i className="fas fa-spinner fa-spin" /> Upload…</> : <><i className="fas fa-upload" /> Changer la photo</>}
                </button>
                {profile?.profilePicture && (
                  <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
                    onClick={removeAvatar}>
                    <i className="fas fa-trash" /> Supprimer
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Champs identité en grille 2 colonnes */}
          <div className={styles.formGrid}>
            <div className={styles.fld}>
              <label className={styles.fldL}>Prénom</label>
              <input className={styles.fldIn} value={firstName} maxLength={100} autoComplete="given-name"
                onChange={e => { setFirstName(e.target.value); mark(); }} />
              {errors.firstName && <span className={styles.fldHint} style={{ color: '#DC2626' }}>{errors.firstName}</span>}
            </div>
            <div className={styles.fld}>
              <label className={styles.fldL}>Nom de famille</label>
              <input className={styles.fldIn} value={lastName} maxLength={100} autoComplete="family-name"
                onChange={e => { setLastName(e.target.value); mark(); }} />
              {errors.lastName && <span className={styles.fldHint} style={{ color: '#DC2626' }}>{errors.lastName}</span>}
            </div>
            <div className={styles.fld}>
              <label className={styles.fldL}>Téléphone</label>
              <input className={styles.fldIn} value={phone} type="tel" maxLength={20} autoComplete="tel"
                onChange={e => { setPhone(e.target.value); mark(); }} />
              {errors.phone && <span className={styles.fldHint} style={{ color: '#DC2626' }}>{errors.phone}</span>}
            </div>
            <div className={styles.fld}>
              <label className={styles.fldL}>Adresse e-mail</label>
              <input className={styles.fldIn} value={profile?.email ?? ''} type="email" readOnly
                style={{ opacity: 0.6, cursor: 'default' }} />
            </div>
            <div className={styles.fld}>
              <label className={styles.fldL}>Poste / Titre</label>
              <input className={styles.fldIn} value={jobTitle} maxLength={100} placeholder="Ex : Responsable de zone Conakry"
                onChange={e => { setJobTitle(e.target.value); mark(); }} />
            </div>
          </div>

          <div className={styles.divider} />

          {/* Biographie */}
          <div className={styles.fld}>
            <label className={styles.fldL}>Biographie (optionnel)</label>
            <textarea className={styles.fldArea} rows={3} value={bio}
              placeholder="Quelques mots sur vous…" maxLength={200}
              onChange={e => { setBio(e.target.value); mark(); }} />
            <span className={styles.fldHint}>{bio.length}/200 caractères. Visible uniquement en interne.</span>
          </div>
        </div>
      </div>

      {/* ── Carte statut du compte ──
       * BUG CORRIGÉ — affichait "Aujourd'hui" (dernière connexion) et "1"
       * (session active) codés en dur, jamais liés à la moindre donnée
       * réelle — l'endpoint /my-profil ne renvoie même pas ces champs.
       * Ces informations existent réellement dans la section Sécurité
       * (data.lastLoginAt/lastLoginIp, voir SecuriteSection.tsx) : pas de
       * raison de les dupliquer ici en verison fausse. Le bouton
       * "Déconnecter toutes les sessions" ne faisait qu'un toast sans
       * rien déconnecter, alors que Shoneya n'autorise qu'UNE session
       * active à la fois par compte — retiré pour la même raison que
       * son équivalent dans SecuriteSection.tsx. Ne reste que ce qui est
       * réellement disponible ici : le statut du compte. */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}><i className="fas fa-shield-check" /> Statut du compte</div>
            <div className={styles.cardSub}>Niveau d&apos;accès et état du compte administrateur</div>
          </div>
          <span className={`${styles.bdg} ${statusBadge.cls}`}>
            <i className="fas fa-circle" /> {statusBadge.label}
          </span>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.miniKpis}>
            <div className={styles.mkpi}>
              <div className={styles.mkpiStripe} style={{ background: 'var(--emerald)' }} />
              <i className="fas fa-key" style={{ color: 'var(--emerald)', fontSize: 13 }} />
              <div className={styles.mkpiV}>Administrateur</div>
              <div className={styles.mkpiL}>Niveau d&apos;accès</div>
            </div>
            <div className={styles.mkpi}>
              <div className={styles.mkpiStripe} style={{ background: 'var(--violet)' }} />
              <i className="fas fa-shield-halved" style={{ color: 'var(--violet)', fontSize: 13 }} />
              <div className={styles.mkpiV}>{profile?.status === 'active' ? 'Vérifié' : 'En attente'}</div>
              <div className={styles.mkpiL}>Compte vérifié</div>
            </div>
            <div className={styles.mkpi}>
              <div className={styles.mkpiStripe} style={{ background: 'var(--teal)' }} />
              <i className="fas fa-map-location-dot" style={{ color: 'var(--teal)', fontSize: 13 }} />
              <div className={styles.mkpiV}>{profile?.zone || '—'}</div>
              <div className={styles.mkpiL}>Zone</div>
            </div>
            <div className={styles.mkpi}>
              <div className={styles.mkpiStripe} style={{ background: 'var(--blue)' }} />
              <i className="fas fa-calendar-check" style={{ color: 'var(--blue)', fontSize: 13 }} />
              <div className={styles.mkpiV}>
                {profile?.memberSince ? new Date(profile.memberSince).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }) : '—'}
              </div>
              <div className={styles.mkpiL}>Membre depuis</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
