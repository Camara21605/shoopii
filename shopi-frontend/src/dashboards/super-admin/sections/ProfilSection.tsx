/* ================================================================
 * FICHIER : src/dashboards/super-admin/sections/ProfilSection.tsx
 *
 * Page Profil du super-admin (ou admin) connecté.
 * Endpoint : GET/PATCH /dashboard/super-admin/my-profil
 *            PATCH     /dashboard/super-admin/my-profil/avatar
 *            POST      /upload/avatar  (multipart)
 * ================================================================ */

import React, { useState, useEffect, useRef } from 'react';
import { apiFetch, tokenStorage } from '../../../shared/services/apiFetch';

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

interface Props {
  toast: (type: string, msg: string) => void;
}

/* ── Skeleton loader ── */
function Skeleton() {
  return (
    <div className="section active" style={{ padding: '32px 28px', maxWidth: 860 }}>
      {[1, 2].map(i => (
        <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, marginBottom: 20, padding: 24 }}>
          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--border)', flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'center' }}>
              <div style={{ height: 18, width: '40%', background: 'var(--border)', borderRadius: 8 }} />
              <div style={{ height: 13, width: '25%', background: 'var(--border)', borderRadius: 8 }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[1, 2, 3, 4].map(j => (
              <div key={j} style={{ height: 48, background: 'var(--border)', borderRadius: 10 }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ProfilSection({ toast }: Props) {
  const [profil,    setProfil]    = useState<Profil | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dirty,     setDirty]     = useState(false);

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
      .catch(() => toast('error', 'Impossible de charger le profil.'))
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
      window.dispatchEvent(new CustomEvent('profil-updated', {
        detail: { firstName, lastName },
      }));
      toast('success', 'Profil enregistré avec succès.');
    } catch (err: any) {
      toast('error', err.message ?? 'Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  }

  /* ── Upload avatar ── */
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast('warning', 'Format invalide — choisissez une image (JPG, PNG, WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast('warning', 'Image trop grande — maximum 5 Mo.');
      return;
    }

    setUploading(true);
    toast('info', 'Upload en cours…');
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
        throw new Error(err.message ?? "Erreur lors de l'upload.");
      }
      const { url } = await uploadRes.json();
      await apiFetch('/dashboard/super-admin/my-profil/avatar', {
        method: 'PATCH',
        body: { avatarUrl: url },
      });
      setProfil(prev => prev ? { ...prev, profilePicture: url } : prev);
      window.dispatchEvent(new CustomEvent('avatar-updated', { detail: url }));
      toast('success', 'Photo de profil mise à jour !');
    } catch (err: any) {
      toast('error', err.message ?? "Erreur lors de l'upload.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function removeAvatar() {
    if (!profil?.profilePicture) return;
    try {
      await apiFetch('/dashboard/super-admin/my-profil/avatar', {
        method: 'PATCH',
        body: { avatarUrl: null },
      });
      setProfil(prev => prev ? { ...prev, profilePicture: null } : prev);
      window.dispatchEvent(new CustomEvent('avatar-updated', { detail: null }));
      toast('success', 'Photo supprimée.');
    } catch {
      toast('error', 'Impossible de supprimer la photo.');
    }
  }

  if (loading) return <Skeleton />;

  const initiales = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || 'SA';

  const statusBadge =
    profil?.status === 'active'    ? { color: '#16A34A', bg: 'rgba(22,163,74,.10)',  label: 'Actif'       } :
    profil?.status === 'suspended' ? { color: '#DC2626', bg: 'rgba(220,38,38,.10)',  label: 'Suspendu'    } :
                                     { color: '#B45309', bg: 'rgba(180,83,9,.10)',   label: 'En attente'  };

  return (
    <div className="section active" style={{ maxWidth: 860 }}>

      {/* ── Carte identité ── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, marginBottom: 20, overflow: 'hidden' }}>
        {/* En-tête */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'var(--surface-alt, var(--surface))' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display, inherit)', fontSize: 14, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="fas fa-user-circle" style={{ color: 'var(--acid)' }} /> Identité
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
              Informations personnelles et photo de profil
            </div>
          </div>
          {dirty && (
            <button
              onClick={save}
              disabled={saving}
              style={{ background: 'var(--acid)', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 18px', fontSize: 12, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              {saving
                ? <><i className="fas fa-spinner fa-spin" /> Enregistrement…</>
                : <><i className="fas fa-check" /> Enregistrer</>}
            </button>
          )}
        </div>

        <div style={{ padding: 24 }}>
          {/* Avatar + nom */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
            {/* Avatar */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--acid)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800, color: '#0B1F3A', overflow: 'hidden', border: '3px solid var(--border)' }}>
                {profil?.profilePicture
                  ? <img src={profil.profilePicture} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : initiales}
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                style={{ position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: '50%', background: 'var(--acid)', border: '2px solid var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 11 }}>
                <i className="fas fa-camera" style={{ color: '#0B1F3A' }} />
              </button>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
            </div>

            {/* Infos */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>
                {firstName} {lastName}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                {zone || 'Super Administrateur'} · Shopi Africa
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  style={{ background: 'var(--surface-alt, var(--surface))', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  {uploading ? <><i className="fas fa-spinner fa-spin" /> Upload…</> : <><i className="fas fa-upload" /> Changer la photo</>}
                </button>
                {profil?.profilePicture && (
                  <button
                    onClick={removeAvatar}
                    style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <i className="fas fa-trash" /> Supprimer
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Grille champs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
            {[
              { label: 'Prénom',        value: firstName, set: (v: string) => { setFirstName(v); mark(); } },
              { label: 'Nom de famille', value: lastName,  set: (v: string) => { setLastName(v);  mark(); } },
              { label: 'Téléphone',     value: phone,     set: (v: string) => { setPhone(v);     mark(); }, type: 'tel' },
              { label: 'Poste / Titre', value: zone,      set: (v: string) => { setZone(v);      mark(); } },
            ].map(f => (
              <div key={f.label}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>
                  {f.label}
                </label>
                <input
                  type={f.type ?? 'text'}
                  value={f.value}
                  onChange={e => f.set(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', background: 'var(--input-bg, var(--surface))', border: '1.5px solid var(--border)', borderRadius: 10, padding: '10px 13px', fontSize: 13, color: 'var(--text)', outline: 'none' }}
                />
              </div>
            ))}

            {/* Email — lecture seule */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>
                Adresse e-mail
              </label>
              <input
                type="email"
                value={profil?.email ?? ''}
                readOnly
                style={{ width: '100%', boxSizing: 'border-box', background: 'var(--input-bg, var(--surface))', border: '1.5px solid var(--border)', borderRadius: 10, padding: '10px 13px', fontSize: 13, color: 'var(--text-muted)', cursor: 'default', opacity: 0.7 }}
              />
            </div>
          </div>

          {/* Séparateur */}
          <div style={{ height: 1, background: 'var(--border)', margin: '20px 0' }} />

          {/* Bio */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>
              Biographie (optionnel)
            </label>
            <textarea
              rows={3}
              value={bio}
              maxLength={200}
              placeholder="Quelques mots sur vous…"
              onChange={e => { setBio(e.target.value); mark(); }}
              style={{ width: '100%', boxSizing: 'border-box', background: 'var(--input-bg, var(--surface))', border: '1.5px solid var(--border)', borderRadius: 10, padding: '10px 13px', fontSize: 13, color: 'var(--text)', resize: 'vertical', outline: 'none', fontFamily: 'inherit' }}
            />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{bio.length}/200 caractères</span>
          </div>
        </div>
      </div>

      {/* ── Carte statut du compte ── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-alt, var(--surface))' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="fas fa-shield-check" style={{ color: 'var(--acid)' }} /> Statut du compte
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
              Informations de session et état de sécurité
            </div>
          </div>
          <span style={{ background: statusBadge.bg, color: statusBadge.color, borderRadius: 99, padding: '4px 12px', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
            <i className="fas fa-circle" style={{ fontSize: 7 }} /> {statusBadge.label}
          </span>
        </div>

        <div style={{ padding: 24 }}>
          {/* KPI statut */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
            {[
              { icon: 'fa-clock',         color: '#3B82F6', value: "Aujourd'hui",  label: 'Dernière connexion' },
              { icon: 'fa-laptop',        color: 'var(--acid)', value: '1',        label: 'Session active'     },
              { icon: 'fa-key',           color: '#10B981', value: 'Super Admin',  label: "Niveau d'accès"     },
              { icon: 'fa-shield-halved', color: '#8B5CF6', value: profil?.status === 'active' ? '100%' : '—', label: 'Compte vérifié' },
            ].map(k => (
              <div key={k.label} style={{ background: 'var(--surface-alt, rgba(255,255,255,.03))', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: k.color, borderRadius: '12px 12px 0 0' }} />
                <i className={`fas ${k.icon}`} style={{ color: k.color, fontSize: 13, marginBottom: 8, display: 'block' }} />
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', letterSpacing: '-.3px' }}>{k.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{k.label}</div>
              </div>
            ))}
          </div>

          <div style={{ height: 1, background: 'var(--border)', marginBottom: 16 }} />

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => toast('warning', 'Toutes les autres sessions ont été déconnectées.')}
              style={{ background: 'rgba(220,38,38,.10)', color: '#DC2626', border: '1px solid rgba(220,38,38,.20)', borderRadius: 9, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="fas fa-right-from-bracket" /> Déconnecter toutes les sessions
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
