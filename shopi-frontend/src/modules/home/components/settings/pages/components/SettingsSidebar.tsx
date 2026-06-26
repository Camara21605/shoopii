/* ================================================================
 * src/modules/home/components/settings/components/SettingsSidebar.tsx
 * FIX : utilise POST /upload/avatar (endpoint dédié photo profil)
 * ================================================================ */

import React, { useEffect, useState, useRef } from 'react';
import s from '../styles/SettingsSidebar.module.css';
import { settingsApi, type ProfilData, type SecuriteData } from '../../api/settings.api';

export type PanelId =
  | 'profil' | 'adresses' | 'paiement' | 'points'
  | 'confidentialiteSecurite'
  | 'securite' | 'sessions' | 'activite' | 'approbations'
  | 'notifs' | 'confidentialite' | 'apparence' | 'langue'
  | 'donnees' | 'danger';

interface Props {
  active:   PanelId;
  onSwitch: (id: PanelId) => void;
  onToast:  (msg: string) => void;
}

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';
const TOKEN_KEY = 'shopi_access_token';

export default function SettingsSidebar({ active, onSwitch, onToast }: Props) {
  const [profil,    setProfil]    = useState<ProfilData | null>(null);
  const [securite,  setSecurite]  = useState<SecuriteData | null>(null);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    settingsApi.getProfil()
      .then(data => { setProfil(data); setAvatarUrl(data.profilePicture ?? null); })
      .catch(() => {});
    settingsApi.getSecurite().then(setSecurite).catch(() => {});
  }, []);

  /* ── Ouvre le sélecteur de fichier ── */
  function handleCameraClick() {
    if (!uploading) fileInputRef.current?.click();
  }

  /* ── Fichier sélectionné → upload vers /upload/avatar ── */
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onToast('❌ Format invalide — choisissez une image (JPG, PNG, WebP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      onToast('❌ Image trop grande — maximum 5 Mo');
      return;
    }

    setUploading(true);
    onToast('📤 Upload en cours…');

    try {
      /* ✅ Upload vers le bon endpoint /upload/avatar */
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch(`${API_URL}/upload/avatar`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) ?? ''}`,
        },
        body: formData,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        throw new Error(err.message ?? "Erreur lors de l'upload");
      }

      const { url } = await uploadRes.json();

      /* ✅ Sauvegarde l'URL dans le profil client */
      await settingsApi.updateAvatar(url);
      setAvatarUrl(url);
      setProfil(prev => prev ? { ...prev, profilePicture: url } : prev);
      window.dispatchEvent(new CustomEvent('avatar-updated', { detail: url }));
      onToast('✅ Photo de profil mise à jour !');

    } catch (err: any) {
      onToast(`❌ ${err.message ?? "Erreur lors de l'upload"}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  /* Badge sécurité */
  const secBadge = securite
    ? [!securite.twoFaEnabled, securite.questionsConfigurees < 2, securite.codesSecours === 0]
        .filter(Boolean).length
    : 0;

  const initial = profil
    ? (profil.firstName?.[0] ?? profil.email?.[0] ?? 'U').toUpperCase()
    : '…';

  const item = (id: PanelId, icon: string, label: string, badge?: number, danger?: boolean) => (
    <button
      key={id}
      className={[s.item, active === id ? s.active : '', danger ? s.danger : ''].filter(Boolean).join(' ')}
      onClick={() => onSwitch(id)}
    >
      <i className={`fas ${icon}`} />
      {label}
      {badge ? <span className={s.notif}>{badge}</span> : null}
    </button>
  );

  return (
    <aside className={s.nav}>

      {/* ── Input file caché ── */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* ── Profil header ── */}
      <div className={s.profile}>
        <div className={s.avatarWrap}>

          {/* Avatar */}
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Photo de profil"
              className={s.avatar}
              style={{ objectFit:'cover', width:'100%', height:'100%', borderRadius:'50%' }}
            />
          ) : (
            <div className={s.avatar}>{initial}</div>
          )}

          {/* ✅ Bouton caméra fonctionnel */}
          <button
            className={s.avatarEdit}
            onClick={handleCameraClick}
            disabled={uploading}
            title={uploading ? 'Upload en cours…' : 'Changer la photo de profil'}
            style={{ cursor: uploading ? 'wait' : 'pointer', opacity: uploading ? .6 : 1 }}
          >
            {uploading
              ? <i className="fas fa-circle-notch fa-spin" />
              : <i className="fas fa-camera" />
            }
          </button>
        </div>

        <div>
          <div className={s.profileName}>
            {profil
              ? `${profil.firstName} ${profil.lastName}`
              : <span style={{ opacity:.4 }}>Chargement…</span>
            }
          </div>
          <div className={s.profileEmail}>{profil?.email ?? ''}</div>
          <div className={s.profileBadges}>
            {profil?.emailVerified && (
              <span className={`${s.badge} ${s.badgeGreen}`}>
                <i className="fas fa-circle-check" /> Vérifié
              </span>
            )}
            {securite?.twoFaEnabled && (
              <span className={`${s.badge} ${s.badgeBlue}`}>
                <i className="fas fa-shield-halved" /> 2FA
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Nav body ── */}
      <div className={s.body}>
        <div className={s.section}>
          <div className={s.label}>Mon compte</div>
          {item('profil',   'fa-user',         'Profil personnel')}
          {item('adresses', 'fa-location-dot', 'Adresses')}
          {item('paiement', 'fa-credit-card',  'Paiement')}
          {item('points',   'fa-star',         'Points Shopi')}
        </div>
        <div className={s.divider} />
        <div className={s.section}>
          <div className={s.label}>Sécurité</div>
          {item('confidentialiteSecurite', 'fa-shield-halved', 'Confidentialité et sécurité', secBadge || undefined)}
          {item('securite',     'fa-lock',              'Sécurité du compte')}
          {item('sessions',     'fa-desktop',           'Appareils connectés')}
          {item('activite',     'fa-clock-rotate-left', "Journal d'activité")}
          {item('approbations', 'fa-shield-check',      'Appareils de confiance')}
        </div>
        <div className={s.divider} />
        <div className={s.section}>
          <div className={s.label}>Préférences</div>
          {item('notifs',          'fa-bell',          'Notifications')}
          {item('confidentialite', 'fa-shield-halved', 'Confidentialité')}
          {item('apparence',       'fa-palette',       'Apparence')}
          {item('langue',          'fa-globe',         'Langue & région')}
        </div>
        <div className={s.divider} />
        <div className={s.section}>
          <div className={s.label}>Données</div>
          {item('donnees', 'fa-database', 'Mes données')}
        </div>
        <div className={s.divider} />
        {item('danger', 'fa-triangle-exclamation', 'Zone de danger', undefined, true)}
      </div>
    </aside>
  );
}