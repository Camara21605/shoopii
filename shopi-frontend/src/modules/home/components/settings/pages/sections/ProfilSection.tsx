/* ================================================================
 * src/modules/home/components/settings/sections/ProfilSection.tsx
 * CONNECTÉ AU BACKEND — GET + PATCH /client/parametres/profil
 * ✅ Photo de profil : affichage + upload + sync header
 * ================================================================ */

import { useState, useEffect, useRef } from 'react';
import s from '../styles/SettingsCard.module.css';
import { settingsApi, type ProfilData } from '../../api/settings.api';
import { tokenStorage } from '../../../../../../shared/services/apiFetch';

const API_URL   = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';

interface Props { onToast: (msg: string) => void; }

export default function ProfilSection({ onToast }: Props) {
  const [profil,        setProfil]        = useState<ProfilData | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [editProfil,    setEditProfil]    = useState(false);
  const [editContacts,  setEditContacts]  = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [avatarUrl,     setAvatarUrl]     = useState<string | null>(null);
  const [uploading,     setUploading]     = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /* Formulaires contrôlés */
  const [form, setForm] = useState({ firstName:'', lastName:'', username:'', dateNaissance:'', genre:'', bio:'', langue:'' });
  const [contactForm, setContactForm] = useState({ email:'', phone:'' });

  /* ── Chargement initial ── */
  useEffect(() => {
    settingsApi.getProfil()
      .then(data => {
        setProfil(data);
        setAvatarUrl(data.profilePicture ?? null);
        setForm({
          firstName:     data.firstName     ?? '',
          lastName:      data.lastName      ?? '',
          username:      data.username      ?? '',
          dateNaissance: data.dateNaissance ?? '',
          genre:         data.genre         ?? '',
          bio:           data.bio           ?? '',
          langue:        data.langue        ?? 'fr',
        });
        setContactForm({ email: data.email ?? '', phone: data.phone ?? '' });
      })
      .catch(() => onToast('❌ Impossible de charger le profil'))
      .finally(() => setLoading(false));
  }, []);

  /* ✅ Reste en sync quand la photo change depuis la sidebar ou le header */
  useEffect(() => {
    const fn = (e: Event) => {
      const url = (e as CustomEvent<string>).detail;
      if (url) setAvatarUrl(url);
    };
    window.addEventListener('avatar-updated', fn);
    return () => window.removeEventListener('avatar-updated', fn);
  }, []);

  /* ── Upload photo ── */
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { onToast('❌ Format invalide — choisissez une image (JPG, PNG, WebP)'); return; }
    if (file.size > 5 * 1024 * 1024)    { onToast('❌ Image trop grande — maximum 5 Mo'); return; }

    setUploading(true);
    onToast('📤 Upload en cours…');
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
      await settingsApi.updateAvatar(url);
      setAvatarUrl(url);
      setProfil(prev => prev ? { ...prev, profilePicture: url } : prev);
      window.dispatchEvent(new CustomEvent('avatar-updated', { detail: url }));
      onToast('✅ Photo de profil mise à jour !');
    } catch (err: any) {
      onToast(`❌ ${err.message ?? "Erreur lors de l'upload"}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  /* ── Sauvegarder le profil ── */
  async function saveProfil() {
    setSaving(true);
    try {
      const updated = await settingsApi.updateProfil(form);
      setProfil(updated);
      setEditProfil(false);
      onToast('✅ Modifications enregistrées !');
    } catch (err: any) {
      onToast(`❌ ${err.message}`);
    } finally { setSaving(false); }
  }

  /* ── Sauvegarder les coordonnées ── */
  async function saveContacts() {
    setSaving(true);
    try {
      await settingsApi.updateCoordonnees(contactForm);
      setProfil(prev => prev ? { ...prev, ...contactForm, emailVerified: false, phoneVerified: false } : prev);
      setEditContacts(false);
      onToast('✅ Coordonnées mises à jour — vérification envoyée');
    } catch (err: any) {
      onToast(`❌ ${err.message}`);
    } finally { setSaving(false); }
  }

  const initial = profil
    ? (profil.firstName?.[0] ?? profil.email?.[0] ?? 'U').toUpperCase()
    : '…';

  if (loading) return (
    <div className={s.card}>
      <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--t3)' }}>
        <i className="fas fa-circle-notch fa-spin" style={{ fontSize: 24 }} />
      </div>
    </div>
  );

  return (
    <>
      {/* ── Photo de profil ── */}
      <div className={s.card}>
        <div className={s.cardHd}>
          <div className={s.cardTitle}>
            <div className={`${s.cardIco} ${s.icoViolet}`}><i className="fas fa-camera" /></div>
            <div>
              <div className={s.cardH}>Photo de profil</div>
              <div className={s.cardSub}>Votre photo visible par les autres utilisateurs Shopi</div>
            </div>
          </div>
        </div>

        {/* Input fichier caché */}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        <div className={s.photoWrap}>
          {/* Avatar */}
          <div className={s.photoAva}>
            {avatarUrl
              ? <img src={avatarUrl} alt="Photo de profil" className={s.photoImg} />
              : <div className={s.photoInitial}>{initial}</div>
            }
            <button
              className={s.photoCamBtn}
              onClick={() => !uploading && fileRef.current?.click()}
              disabled={uploading}
              title={uploading ? 'Upload en cours…' : 'Changer la photo'}
            >
              {uploading
                ? <i className="fas fa-circle-notch fa-spin" />
                : <i className="fas fa-camera" />
              }
            </button>
          </div>

          {/* Infos + boutons */}
          <div className={s.photoInfo}>
            <div className={s.photoName}>
              {profil ? `${profil.firstName} ${profil.lastName}` : '…'}
            </div>
            <div className={s.photoSub}>
              {profil?.username ? `@${profil.username}` : 'Aucun nom d\'utilisateur'}
            </div>
            <div className={s.photoBtns}>
              <button
                className={s.photoUploadBtn}
                onClick={() => !uploading && fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading
                  ? <><i className="fas fa-circle-notch fa-spin" /> Upload…</>
                  : <><i className="fas fa-arrow-up-from-bracket" /> Changer la photo</>
                }
              </button>
              {avatarUrl && (
                <button
                  className={s.photoRemoveBtn}
                  onClick={async () => {
                    try {
                      await settingsApi.updateAvatar('');
                      setAvatarUrl(null);
                      setProfil(prev => prev ? { ...prev, profilePicture: null } : prev);
                      window.dispatchEvent(new CustomEvent('avatar-updated', { detail: '' }));
                      onToast('✅ Photo supprimée');
                    } catch { onToast('❌ Impossible de supprimer la photo'); }
                  }}
                >
                  <i className="fas fa-trash" /> Supprimer
                </button>
              )}
            </div>
            <div className={s.photoHint}>JPG, PNG ou WebP · max 5 Mo</div>
          </div>
        </div>
      </div>

      {/* ── Informations personnelles ── */}
      <div className={s.card}>
        <div className={s.cardHd}>
          <div className={s.cardTitle}>
            <div className={`${s.cardIco} ${s.icoBlue}`}><i className="fas fa-user" /></div>
            <div>
              <div className={s.cardH}>Informations personnelles</div>
              <div className={s.cardSub}>Votre identité sur la plateforme Shopi</div>
            </div>
          </div>
          <button className={`${s.cardAction} ${s.cardActionOutline}`} onClick={() => setEditProfil(v => !v)}>
            <i className="fas fa-pen" /> Modifier
          </button>
        </div>
        <div className={s.cardBody}>
          <div className={s.row}><div className={s.rowLeft}><div className={s.rowLabel}>Prénom & Nom</div><div className={s.rowVal}>{profil?.firstName} {profil?.lastName}</div></div></div>
          <div className={s.row}><div className={s.rowLeft}><div className={s.rowLabel}>Nom d'utilisateur</div><div className={s.rowVal}>{profil?.username ? `@${profil.username}` : <span className={s.rowValMuted}>Non défini</span>}</div></div></div>
          <div className={s.row}><div className={s.rowLeft}><div className={s.rowLabel}>Date de naissance</div><div className={profil?.dateNaissance ? s.rowVal : `${s.rowVal} ${s.rowValMuted}`}>{profil?.dateNaissance ?? 'Non renseignée'}</div></div></div>
          <div className={s.row}><div className={s.rowLeft}><div className={s.rowLabel}>Genre</div><div className={profil?.genre ? s.rowVal : `${s.rowVal} ${s.rowValMuted}`}>{profil?.genre ?? 'Non renseigné'}</div></div></div>
          <div className={s.row}><div className={s.rowLeft}><div className={s.rowLabel}>Bio</div><div className={profil?.bio ? s.rowVal : `${s.rowVal} ${s.rowValMuted}`}>{profil?.bio ?? 'Aucune bio renseignée'}</div></div></div>

          <div className={`${s.editForm} ${editProfil ? s.editFormOpen : ''}`}>
            <div className={s.editGrid}>
              <div className={s.field}><label>Prénom</label><input type="text" value={form.firstName} onChange={e => setForm(f=>({...f,firstName:e.target.value}))} /></div>
              <div className={s.field}><label>Nom</label><input type="text" value={form.lastName} onChange={e => setForm(f=>({...f,lastName:e.target.value}))} /></div>
              <div className={s.field}><label>Nom d'utilisateur</label><input type="text" value={form.username} onChange={e => setForm(f=>({...f,username:e.target.value}))} /></div>
              <div className={s.field}><label>Date de naissance</label><input type="date" value={form.dateNaissance} onChange={e => setForm(f=>({...f,dateNaissance:e.target.value}))} /></div>
              <div className={s.field}>
                <label>Genre</label>
                <select value={form.genre} onChange={e => setForm(f=>({...f,genre:e.target.value}))}>
                  <option value="">Non précisé</option>
                  <option value="homme">Homme</option>
                  <option value="femme">Femme</option>
                  <option value="autre">Autre</option>
                </select>
              </div>
              <div className={s.field}>
                <label>Langue préférée</label>
                <select value={form.langue} onChange={e => setForm(f=>({...f,langue:e.target.value}))}>
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                  <option value="ar">عربي</option>
                </select>
              </div>
              <div className={`${s.field} ${s.fieldFull}`}>
                <label>Bio</label>
                <textarea value={form.bio} onChange={e => setForm(f=>({...f,bio:e.target.value}))} placeholder="Présentez-vous en quelques mots…" />
                <span className={s.fieldHint}>{form.bio.length}/200 caractères</span>
              </div>
              <div className={s.fieldActions}>
                <button className={s.btnSave} onClick={saveProfil} disabled={saving}>
                  {saving ? <><i className="fas fa-circle-notch fa-spin" /> Enregistrement…</> : 'Enregistrer'}
                </button>
                <button className={s.btnCancel} onClick={() => setEditProfil(false)} disabled={saving}>Annuler</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Coordonnées ── */}
      <div className={s.card}>
        <div className={s.cardHd}>
          <div className={s.cardTitle}>
            <div className={`${s.cardIco} ${s.icoTeal}`}><i className="fas fa-envelope" /></div>
            <div>
              <div className={s.cardH}>Coordonnées</div>
              <div className={s.cardSub}>Email et téléphone — utilisés pour la connexion et les alertes</div>
            </div>
          </div>
          <button className={`${s.cardAction} ${s.cardActionOutline}`} onClick={() => setEditContacts(v => !v)}>
            <i className="fas fa-pen" /> Modifier
          </button>
        </div>
        <div className={s.cardBody}>
          <div className={s.row}>
            <div className={s.rowLeft}>
              <div className={s.rowLabel}><i className="fas fa-envelope" style={{ color:'var(--blue)',fontSize:11 }} /> Adresse e-mail</div>
              <div className={s.rowVal}>{profil?.email}</div>
            </div>
            {profil?.emailVerified
              ? <span className={s.verified}><i className="fas fa-circle-check" /> Vérifié</span>
              : <span style={{ fontSize:9,fontWeight:700,color:'var(--amber)',background:'rgba(180,83,9,.09)',borderRadius:'var(--pill)',padding:'3px 9px' }}>⚠️ Non vérifié</span>
            }
          </div>
          <div className={s.row}>
            <div className={s.rowLeft}>
              <div className={s.rowLabel}><i className="fas fa-phone" style={{ color:'var(--blue)',fontSize:11 }} /> Téléphone</div>
              <div className={s.rowVal}>{profil?.phone ?? <span className={s.rowValMuted}>Non renseigné</span>}</div>
            </div>
            {profil?.phoneVerified
              ? <span className={s.verified}><i className="fas fa-circle-check" /> Vérifié</span>
              : <span style={{ fontSize:9,fontWeight:700,color:'var(--amber)',background:'rgba(180,83,9,.09)',borderRadius:'var(--pill)',padding:'3px 9px' }}>⚠️ Non vérifié</span>
            }
          </div>
          <div className={`${s.editForm} ${editContacts ? s.editFormOpen : ''}`}>
            <div className={s.editGrid}>
              <div className={`${s.field} ${s.fieldFull}`}>
                <label>Adresse e-mail</label>
                <input type="email" value={contactForm.email} onChange={e => setContactForm(f=>({...f,email:e.target.value}))} />
                <span className={s.fieldHint}>Un e-mail de confirmation sera envoyé à la nouvelle adresse</span>
              </div>
              <div className={`${s.field} ${s.fieldFull}`}>
                <label>Numéro de téléphone</label>
                <input type="tel" value={contactForm.phone} onChange={e => setContactForm(f=>({...f,phone:e.target.value}))} />
                <span className={s.fieldHint}>Un code de vérification SMS sera envoyé</span>
              </div>
              <div className={s.fieldActions}>
                <button className={s.btnSave} onClick={saveContacts} disabled={saving}>
                  {saving ? <><i className="fas fa-circle-notch fa-spin" /> Enregistrement…</> : 'Enregistrer les changements'}
                </button>
                <button className={s.btnCancel} onClick={() => setEditContacts(false)} disabled={saving}>Annuler</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
