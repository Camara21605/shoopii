/* ================================================================
 * FICHIER : pages/parametres/ProfilSection.tsx
 * Section Profil — données réelles via GET/PATCH /dashboard/super-admin/my-profil
 * ================================================================ */

import { useState, useEffect, useRef } from 'react';
import styles from '../../styles/ParametresPage.module.css';
import type { SectionProps } from './types';
import { apiFetch, tokenStorage } from '../../../../shared/services/apiFetch';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';

interface Profil {
  firstName:      string;
  lastName:       string;
  email:          string;
  phone:          string;
  zone:           string;
  bio:            string;
  status:         string;
  profilePicture: string | null;
}

export default function ProfilSection({ onToast }: SectionProps) {
  const [profil,    setProfil]    = useState<Profil | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dirty,     setDirty]     = useState(false);

  /* champs éditables (dérivés du profil chargé) */
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [phone,     setPhone]     = useState('');
  const [zone,      setZone]      = useState('');
  const [bio,       setBio]       = useState('');

  const fileRef = useRef<HTMLInputElement>(null);

  /* ── Chargement initial ── */
  useEffect(() => {
    apiFetch<Profil>('/dashboard/super-admin/my-profil')
      .then(data => {
        setProfil(data);
        setFirstName(data.firstName);
        setLastName(data.lastName);
        setPhone(data.phone);
        setZone(data.zone);
        setBio(data.bio);
      })
      .catch(() => onToast('Impossible de charger le profil', 'w'))
      .finally(() => setLoading(false));
  }, []);

  const mark = () => setDirty(true);

  /* ── Sauvegarde ── */
  async function save() {
    setSaving(true);
    try {
      await apiFetch('/dashboard/super-admin/my-profil', {
        method: 'PATCH',
        body: { firstName, lastName, phone, zone, bio },
      });
      setProfil(prev => prev ? { ...prev, firstName, lastName, phone, zone, bio } : prev);
      setDirty(false);
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
      setProfil(prev => prev ? { ...prev, profilePicture: url } : prev);
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
    if (!profil?.profilePicture) return;
    try {
      await apiFetch('/dashboard/super-admin/my-profil/avatar', { method: 'PATCH', body: { avatarUrl: null } });
      setProfil(prev => prev ? { ...prev, profilePicture: null } : prev);
      onToast('Photo supprimée', 's');
    } catch {
      onToast('Impossible de supprimer la photo', 'w');
    }
  }

  /* ── Initiales pour le placeholder ── */
  const initiales = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || 'AD';

  const statusBadge = profil?.status === 'active'
    ? { cls: styles.bdgGreen, label: 'Actif' }
    : profil?.status === 'suspended'
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
            <button className={`${styles.btn} ${styles.btnBlue} ${styles.btnSm}`}
              onClick={save} disabled={saving}>
              {saving ? <><i className="fas fa-spinner fa-spin" /> Enregistrement…</> : <><i className="fas fa-check" /> Enregistrer</>}
            </button>
          )}
        </div>
        <div className={styles.cardBody}>
          {/* Avatar + nom */}
          <div className={styles.avatarRow}>
            <div className={styles.avatarWrap}>
              {profil?.profilePicture
                ? <img src={profil.profilePicture} alt="avatar" className={styles.avatarCircle}
                    style={{ objectFit: 'cover', padding: 0 }} />
                : <div className={styles.avatarCircle}>{initiales}</div>
              }
              <div className={styles.avatarOvl} onClick={() => fileRef.current?.click()}>
                <i className="fas fa-camera" />
              </div>
            </div>
            <div className={styles.avatarInfo}>
              <div className={styles.avatarName}>{firstName} {lastName}</div>
              <div className={styles.avatarRole}>{zone || 'Administrateur'}</div>
              <div className={styles.avatarActs}>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={handleFileChange} />
                <button className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                  onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <><i className="fas fa-spinner fa-spin" /> Upload…</> : <><i className="fas fa-upload" /> Changer la photo</>}
                </button>
                {profil?.profilePicture && (
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
              <input className={styles.fldIn} value={firstName}
                onChange={e => { setFirstName(e.target.value); mark(); }} />
            </div>
            <div className={styles.fld}>
              <label className={styles.fldL}>Nom de famille</label>
              <input className={styles.fldIn} value={lastName}
                onChange={e => { setLastName(e.target.value); mark(); }} />
            </div>
            <div className={styles.fld}>
              <label className={styles.fldL}>Téléphone</label>
              <input className={styles.fldIn} value={phone} type="tel"
                onChange={e => { setPhone(e.target.value); mark(); }} />
            </div>
            <div className={styles.fld}>
              <label className={styles.fldL}>Adresse e-mail</label>
              <input className={styles.fldIn} value={profil?.email ?? ''} type="email" readOnly
                style={{ opacity: 0.6, cursor: 'default' }} />
            </div>
            <div className={styles.fld}>
              <label className={styles.fldL}>Poste / Titre</label>
              <input className={styles.fldIn} value={zone}
                onChange={e => { setZone(e.target.value); mark(); }} />
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
              <div className={styles.mkpiV}>Admin</div>
              <div className={styles.mkpiL}>Niveau d&apos;accès</div>
            </div>
            <div className={styles.mkpi}>
              <div className={styles.mkpiStripe} style={{ background: 'var(--violet)' }} />
              <i className="fas fa-shield-halved" style={{ color: 'var(--violet)', fontSize: 13 }} />
              <div className={styles.mkpiV}>{profil?.status === 'active' ? '100%' : '—'}</div>
              <div className={styles.mkpiL}>Compte vérifié</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
