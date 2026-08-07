/* ================================================================
 * src/modules/home/components/settings/components/SettingsSidebar.tsx
 * FIX : utilise POST /upload/avatar (endpoint dédié photo profil)
 * ================================================================ */

import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import s from '../styles/SettingsSidebar.module.css';
import { settingsApi, type ProfilData, type SecuriteData } from '../../api/settings.api';

export type PanelId =
  | 'profil' | 'adresses' | 'paiement' | 'points'
  | 'confidentialiteSecurite'
  | 'securite' | 'sessions' | 'activite' | 'approbations'
  | 'notifs' | 'confidentialite' | 'apparence' | 'langue'
  | 'donnees' | 'danger';

interface Props {
  onToast: (msg: string) => void;
}

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';
const TOKEN_KEY = 'shopi_access_token';

export default function SettingsSidebar({ onToast }: Props) {
  const { t } = useTranslation();
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
      onToast(t('settingsPage.sidebar.invalidFormat'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      onToast(t('settingsPage.sidebar.tropGrande'));
      return;
    }

    setUploading(true);
    onToast(t('settingsPage.sidebar.uploadEnCoursToast'));

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
        throw new Error(err.message ?? t('settingsPage.sidebar.uploadErrorFallback'));
      }

      const { url } = await uploadRes.json();

      /* ✅ Sauvegarde l'URL dans le profil client */
      await settingsApi.updateAvatar(url);
      setAvatarUrl(url);
      setProfil(prev => prev ? { ...prev, profilePicture: url } : prev);
      window.dispatchEvent(new CustomEvent('avatar-updated', { detail: url }));
      onToast(t('settingsPage.sidebar.photoMiseAJour'));

    } catch (err: any) {
      onToast(`❌ ${err.message ?? t('settingsPage.sidebar.uploadErrorFallback')}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const initial = profil
    ? (profil.firstName?.[0] ?? profil.email?.[0] ?? 'U').toUpperCase()
    : '…';

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

      {/* ── Profil header — bandeau horizontal ── */}
      <div className={s.profile}>
        <div className={s.avatarWrap}>

          {/* Avatar */}
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={t('settingsPage.sidebar.photoAlt')}
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
            title={uploading ? t('settingsPage.sidebar.uploadEnCours') : t('settingsPage.sidebar.changerPhoto')}
            style={{ cursor: uploading ? 'wait' : 'pointer', opacity: uploading ? .6 : 1 }}
          >
            {uploading
              ? <i className="fas fa-circle-notch fa-spin" />
              : <i className="fas fa-camera" />
            }
          </button>
        </div>

        <div className={s.profileInfo}>
          <div className={s.profileName}>
            {profil
              ? `${profil.firstName} ${profil.lastName}`
              : <span style={{ opacity:.4 }}>{t('settingsPage.sidebar.chargement')}</span>
            }
          </div>
          <div className={s.profileEmail}>{profil?.email ?? ''}</div>
        </div>

        <div className={s.profileBadges}>
          {profil?.emailVerified && (
            <span className={`${s.badge} ${s.badgeGreen}`}>
              <i className="fas fa-circle-check" /> {t('settingsPage.sidebar.verifie')}
            </span>
          )}
          {securite?.twoFaEnabled && (
            <span className={`${s.badge} ${s.badgeBlue}`}>
              <i className="fas fa-shield-halved" /> 2FA
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}