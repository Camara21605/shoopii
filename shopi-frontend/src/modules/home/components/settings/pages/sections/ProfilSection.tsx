/* ================================================================
 * src/modules/home/components/settings/sections/ProfilSection.tsx
 * CONNECTÉ AU BACKEND — GET + PATCH /client/parametres/profil
 *
 *  ✅ Photo de profil : affichage + upload + sync header/sidebar
 *  ✅ Informations personnelles : validation en ligne (prénom/nom, nom
 *     d'utilisateur, date réelle, bio), affichage formaté (date locale,
 *     genre lisible), « Annuler » restaure vraiment les valeurs,
 *     « Enregistrer » inactif tant que rien n'a changé
 *  ✅ Coordonnées : mot de passe actuel exigé pour changer e-mail/téléphone,
 *     vérification de l'e-mail par code à 6 chiffres (envoi, renvoi avec
 *     délai, confirmation) ; seule la coordonnée modifiée perd sa vérification
 *  ✅ Tous les textes passent par i18n (settingsPage.profil.*)
 * ================================================================ */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import s from '../styles/SettingsCard.module.css';
import { settingsApi, type ProfilData } from '../../api/settings.api';
import { tokenStorage } from '../../../../../../shared/services/apiFetch';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';

const USERNAME_RE  = /^[a-z0-9._-]{3,30}$/;
const BIO_MAX      = 200;
const RESEND_DELAY = 60;   // secondes avant de pouvoir redemander un code

interface Props { onToast: (msg: string) => void; }

interface FormState {
  firstName: string; lastName: string; username: string;
  dateNaissance: string; genre: string; bio: string; langue: string;
}

const toForm = (d: ProfilData): FormState => ({
  firstName:     d.firstName     ?? '',
  lastName:      d.lastName      ?? '',
  username:      d.username      ?? '',
  dateNaissance: d.dateNaissance ?? '',
  genre:         d.genre         ?? '',
  bio:           d.bio           ?? '',
  langue:        d.langue        ?? 'fr',
});

const todayIso = () => new Date().toISOString().slice(0, 10);

/** Signale au reste de la page (sidebar, score de sécurité) que le profil ou la sécurité a changé. */
const announce = (name: 'profile-updated' | 'security-updated') => window.dispatchEvent(new CustomEvent(name));

export default function ProfilSection({ onToast }: Props) {
  const { t, i18n } = useTranslation();
  const tp = useCallback((key: string, opts?: Record<string, unknown>) => t(`settingsPage.profil.${key}`, opts as any) as string, [t]);

  const [profil,        setProfil]        = useState<ProfilData | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [editProfil,    setEditProfil]    = useState(false);
  const [editContacts,  setEditContacts]  = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [avatarUrl,     setAvatarUrl]     = useState<string | null>(null);
  const [uploading,     setUploading]     = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form,   setForm]   = useState<FormState>({ firstName: '', lastName: '', username: '', dateNaissance: '', genre: '', bio: '', langue: 'fr' });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [contactForm, setContactForm] = useState({ email: '', phone: '', currentPassword: '' });

  /* Vérification de l'e-mail */
  const [verifyOpen,  setVerifyOpen]  = useState(false);
  const [code,        setCode]        = useState('');
  const [sending,     setSending]     = useState(false);
  const [confirming,  setConfirming]  = useState(false);
  const [cooldown,    setCooldown]    = useState(0);

  /* ── Chargement initial ── */
  const load = useCallback(() => settingsApi.getProfil().then(data => {
    setProfil(data);
    setAvatarUrl(data.profilePicture ?? null);
    setForm(toForm(data));
    setContactForm({ email: data.email ?? '', phone: data.phone ?? '', currentPassword: '' });
    return data;
  }), []);

  useEffect(() => {
    load()
      .catch(() => onToast(tp('loadError')))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ✅ Reste en sync quand la photo change depuis la sidebar ou le header */
  useEffect(() => {
    const fn = (e: Event) => {
      const url = (e as CustomEvent<string>).detail;
      setAvatarUrl(url || null);
    };
    window.addEventListener('avatar-updated', fn);
    return () => window.removeEventListener('avatar-updated', fn);
  }, []);

  /* Le score de sécurité (bandeau) demande de vérifier l'e-mail : on amène ici et on envoie le code */
  const contactsRef = useRef<HTMLDivElement>(null);
  const actionsRef  = useRef({ verified: false, request: () => {} });
  useEffect(() => {
    const fn = () => {
      contactsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (!actionsRef.current.verified) actionsRef.current.request();
    };
    window.addEventListener('verify-email-request', fn);
    return () => window.removeEventListener('verify-email-request', fn);
  }, []);

  /* Compte à rebours du renvoi de code */
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  /* ── Upload photo ── */
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { onToast(tp('invalidFormat')); return; }
    if (file.size > 5 * 1024 * 1024)    { onToast(tp('tropGrande')); return; }

    setUploading(true);
    onToast(tp('uploadEnCoursToast'));
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
        throw new Error(err.message ?? tp('uploadErrorFallback'));
      }
      const { url } = await uploadRes.json();
      await settingsApi.updateAvatar(url);
      setAvatarUrl(url);
      setProfil(prev => prev ? { ...prev, profilePicture: url } : prev);
      window.dispatchEvent(new CustomEvent('avatar-updated', { detail: url }));
      onToast(tp('photoMiseAJour'));
    } catch (err: any) {
      onToast(`❌ ${err.message ?? tp('uploadErrorFallback')}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function removeAvatar() {
    try {
      await settingsApi.updateAvatar('');
      setAvatarUrl(null);
      setProfil(prev => prev ? { ...prev, profilePicture: null } : prev);
      window.dispatchEvent(new CustomEvent('avatar-updated', { detail: '' }));
      onToast(tp('photoSupprimee'));
    } catch { onToast(tp('photoSuppressionError')); }
  }

  /* ── Informations personnelles : validation, modifications, enregistrement ── */
  const validate = (f: FormState) => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!f.firstName.trim()) e.firstName = tp('errors.prenomRequis');
    if (!f.lastName.trim())  e.lastName  = tp('errors.nomRequis');
    /* Un ancien nom d'utilisateur atypique n'est contrôlé que s'il est modifié (comme côté serveur) */
    if (f.username.trim().toLowerCase() !== (profil?.username ?? '').toLowerCase() && !USERNAME_RE.test(f.username.trim().toLowerCase())) {
      e.username = tp('errors.usernameFormat');
    }
    if (f.dateNaissance) {
      const d = new Date(`${f.dateNaissance}T00:00:00`);
      if (Number.isNaN(d.getTime()) || f.dateNaissance < '1900-01-01') e.dateNaissance = tp('errors.dateInvalide');
      else if (f.dateNaissance > todayIso()) e.dateNaissance = tp('errors.dateFuture');
    }
    if (f.bio.length > BIO_MAX) e.bio = tp('errors.bioMax', { max: BIO_MAX });
    return e;
  };

  const dirtyProfil = useMemo(() => {
    if (!profil) return false;
    const o = toForm(profil);
    return (Object.keys(o) as (keyof FormState)[]).some(k => o[k].trim() !== form[k].trim());
  }, [profil, form]);

  const setField = (k: keyof FormState, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(e => ({ ...e, [k]: undefined }));
  };

  function closeProfilEdit() {
    if (profil) setForm(toForm(profil));   // « Annuler » restaure réellement les valeurs enregistrées
    setErrors({});
    setEditProfil(false);
  }

  async function saveProfil() {
    const e = validate(form);
    setErrors(e);
    if (Object.values(e).some(Boolean)) return;
    if (!dirtyProfil) { onToast(tp('aucunChangement')); return; }

    setSaving(true);
    try {
      const updated = await settingsApi.updateProfil({ ...form, username: form.username.trim().toLowerCase() });
      setProfil(updated);
      setForm(toForm(updated));
      setEditProfil(false);
      announce('profile-updated');
      onToast(tp('savedToast'));
    } catch (err: any) {
      onToast(`❌ ${err.message}`);
    } finally { setSaving(false); }
  }

  /* ── Coordonnées ── */
  const emailChanged = !!profil && contactForm.email.trim().toLowerCase() !== (profil.email ?? '').toLowerCase();
  const phoneChanged = !!profil && contactForm.phone.replace(/\D/g, '') !== (profil.phone ?? '').replace(/\D/g, '');
  const contactsChanged = emailChanged || phoneChanged;

  function closeContactsEdit() {
    if (profil) setContactForm({ email: profil.email ?? '', phone: profil.phone ?? '', currentPassword: '' });
    setEditContacts(false);
  }

  async function saveContacts() {
    if (!contactsChanged) { onToast(tp('aucunChangement')); return; }
    if (emailChanged && !/^\S+@\S+\.\S+$/.test(contactForm.email.trim())) { onToast(tp('errors.emailInvalide')); return; }
    if (phoneChanged && contactForm.phone.replace(/\D/g, '').length < 8) { onToast(tp('errors.telInvalide')); return; }
    if (!contactForm.currentPassword) { onToast(tp('errors.motDePasseRequis')); return; }

    setSaving(true);
    try {
      const res = await settingsApi.updateCoordonnees({
        ...(emailChanged ? { email: contactForm.email.trim() } : {}),
        ...(phoneChanged ? { phone: contactForm.phone.trim() } : {}),
        currentPassword: contactForm.currentPassword,
      });
      await load();                      // le serveur normalise le numéro : on relit l'état réel
      setEditContacts(false);
      if (res.emailCodeSent) { setVerifyOpen(true); setCode(''); setCooldown(RESEND_DELAY); }
      announce('profile-updated');
      announce('security-updated');
      onToast(`✅ ${res.message}`);
    } catch (err: any) {
      onToast(`❌ ${err.message}`);
    } finally { setSaving(false); }
  }

  /* ── Vérification de l'e-mail ── */
  async function requestCode() {
    if (sending || cooldown > 0) return;
    setSending(true);
    try {
      const res = await settingsApi.sendEmailCode();
      setVerifyOpen(true);
      setCode('');
      if (res.sent) setCooldown(RESEND_DELAY);
      onToast(res.sent ? `✉️ ${res.message}` : res.message);
      if (!res.sent) { await load(); announce('security-updated'); }
    } catch (err: any) {
      onToast(`❌ ${err.message}`);
    } finally { setSending(false); }
  }

  actionsRef.current = { verified: !!profil?.emailVerified, request: () => { void requestCode(); } };

  async function confirmCode() {
    if (!/^\d{6}$/.test(code) || confirming) return;
    setConfirming(true);
    try {
      await settingsApi.confirmEmailCode(code);
      setProfil(prev => prev ? { ...prev, emailVerified: true } : prev);
      setVerifyOpen(false);
      setCode('');
      announce('profile-updated');
      announce('security-updated');   // le score de sécurité gagne les points de l'e-mail vérifié
      onToast(tp('emailVerifieToast'));
    } catch (err: any) {
      onToast(`❌ ${err.message}`);
    } finally { setConfirming(false); }
  }

  const initial = profil
    ? (profil.firstName?.[0] ?? profil.email?.[0] ?? 'U').toUpperCase()
    : '…';

  /* Affichage : date dans la langue de l'interface, genre lisible */
  const dateLabel = useMemo(() => {
    const v = profil?.dateNaissance;
    if (!v) return null;
    const [y, m, d] = v.split('-').map(Number);
    const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
    return Number.isNaN(dt.getTime()) ? v : dt.toLocaleDateString(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' });
  }, [profil?.dateNaissance, i18n.language]);

  const genreLabel = useMemo(() => {
    const g = profil?.genre;
    if (!g) return null;
    const key = g === 'non_precise' ? 'nonPrecise' : g;
    return t(`settingsPage.profil.fields.genreOptions.${key}`, { defaultValue: g }) as string;
  }, [profil?.genre, t]);

  if (loading) return (
    <div className={s.card}>
      <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--t3)' }}>
        <i className="fas fa-circle-notch fa-spin" style={{ fontSize: 24 }} />
      </div>
    </div>
  );

  const fieldErr = (k: keyof FormState) => errors[k]
    ? <span className={s.fieldErr} role="alert"><i className="fas fa-circle-exclamation" /> {errors[k]}</span>
    : null;

  return (
    <>
      {/* ── Photo de profil ── */}
      <div className={s.card}>
        <div className={s.cardHd}>
          <div className={s.cardTitle}>
            <div className={`${s.cardIco} ${s.icoViolet}`}><i className="fas fa-camera" /></div>
            <div>
              <div className={s.cardH}>{tp('photoTitle')}</div>
              <div className={s.cardSub}>{tp('photoSubtitle')}</div>
            </div>
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        <div className={s.photoWrap}>
          <div className={s.photoAva}>
            {avatarUrl
              ? <img src={avatarUrl} alt={tp('photoAlt')} className={s.photoImg} />
              : <div className={s.photoInitial}>{initial}</div>
            }
            <button
              className={s.photoCamBtn}
              onClick={() => !uploading && fileRef.current?.click()}
              disabled={uploading}
              title={uploading ? tp('uploadEnCoursTitle') : tp('changerPhotoTitle')}
              aria-label={tp('changerPhotoTitle')}
            >
              {uploading ? <i className="fas fa-circle-notch fa-spin" /> : <i className="fas fa-camera" />}
            </button>
          </div>

          <div className={s.photoInfo}>
            <div className={s.photoName}>{profil ? `${profil.firstName} ${profil.lastName}` : '…'}</div>
            <div className={s.photoSub}>{profil?.username ? `@${profil.username}` : tp('aucunUsername')}</div>
            <div className={s.photoBtns}>
              <button className={s.photoUploadBtn} onClick={() => !uploading && fileRef.current?.click()} disabled={uploading}>
                {uploading
                  ? <><i className="fas fa-circle-notch fa-spin" /> {tp('uploadEnCoursBtn')}</>
                  : <><i className="fas fa-arrow-up-from-bracket" /> {tp('changerPhotoBtn')}</>}
              </button>
              {avatarUrl && (
                <button className={s.photoRemoveBtn} onClick={removeAvatar}>
                  <i className="fas fa-trash" /> {tp('supprimer')}
                </button>
              )}
            </div>
            <div className={s.photoHint}>{tp('photoHint')}</div>
          </div>
        </div>
      </div>

      {/* ── Informations personnelles ── */}
      <div className={s.card}>
        <div className={s.cardHd}>
          <div className={s.cardTitle}>
            <div className={`${s.cardIco} ${s.icoBlue}`}><i className="fas fa-user" /></div>
            <div>
              <div className={s.cardH}>{tp('infosTitle')}</div>
              <div className={s.cardSub}>{tp('infosSubtitle')}</div>
            </div>
          </div>
          <button
            className={`${s.cardAction} ${s.cardActionOutline}`}
            aria-expanded={editProfil}
            onClick={() => (editProfil ? closeProfilEdit() : setEditProfil(true))}
          >
            <i className={`fas ${editProfil ? 'fa-xmark' : 'fa-pen'}`} /> {editProfil ? tp('fermer') : tp('modifier')}
          </button>
        </div>
        <div className={s.cardBody}>
          <div className={s.row}><div className={s.rowLeft}><div className={s.rowLabel}>{tp('prenomNom')}</div><div className={s.rowVal}>{profil?.firstName} {profil?.lastName}</div></div></div>
          <div className={s.row}><div className={s.rowLeft}><div className={s.rowLabel}>{tp('nomUtilisateur')}</div><div className={s.rowVal}>{profil?.username ? `@${profil.username}` : <span className={s.rowValMuted}>{tp('nonDefini')}</span>}</div></div></div>
          <div className={s.row}><div className={s.rowLeft}><div className={s.rowLabel}>{tp('dateNaissance')}</div><div className={dateLabel ? s.rowVal : `${s.rowVal} ${s.rowValMuted}`}>{dateLabel ?? tp('nonRenseignee')}</div></div></div>
          <div className={s.row}><div className={s.rowLeft}><div className={s.rowLabel}>{tp('genre')}</div><div className={genreLabel ? s.rowVal : `${s.rowVal} ${s.rowValMuted}`}>{genreLabel ?? tp('nonRenseigne')}</div></div></div>
          <div className={s.row}><div className={s.rowLeft}><div className={s.rowLabel}>{tp('bio')}</div><div className={profil?.bio ? s.rowVal : `${s.rowVal} ${s.rowValMuted}`} style={{ whiteSpace: 'pre-wrap' }}>{profil?.bio || tp('aucuneBio')}</div></div></div>

          <div className={`${s.editForm} ${editProfil ? s.editFormOpen : ''}`}>
            <div className={s.editGrid}>
              <div className={`${s.field} ${errors.firstName ? s.hasErr : ''}`}>
                <label htmlFor="pf-first">{tp('fields.prenom')}</label>
                <input id="pf-first" type="text" maxLength={50} autoComplete="given-name" value={form.firstName} onChange={e => setField('firstName', e.target.value)} />
                {fieldErr('firstName')}
              </div>
              <div className={`${s.field} ${errors.lastName ? s.hasErr : ''}`}>
                <label htmlFor="pf-last">{tp('fields.nom')}</label>
                <input id="pf-last" type="text" maxLength={50} autoComplete="family-name" value={form.lastName} onChange={e => setField('lastName', e.target.value)} />
                {fieldErr('lastName')}
              </div>
              <div className={`${s.field} ${errors.username ? s.hasErr : ''}`}>
                <label htmlFor="pf-user">{tp('fields.nomUtilisateur')}</label>
                <input id="pf-user" type="text" maxLength={30} autoComplete="username" autoCapitalize="none" spellCheck={false}
                  value={form.username} onChange={e => setField('username', e.target.value.toLowerCase().replace(/\s+/g, ''))} />
                {errors.username ? fieldErr('username') : <span className={s.fieldHint}>{tp('usernameHint')}</span>}
              </div>
              <div className={`${s.field} ${errors.dateNaissance ? s.hasErr : ''}`}>
                <label htmlFor="pf-birth">{tp('fields.dateNaissance')}</label>
                <input id="pf-birth" type="date" min="1900-01-01" max={todayIso()} autoComplete="bday" value={form.dateNaissance} onChange={e => setField('dateNaissance', e.target.value)} />
                {fieldErr('dateNaissance')}
              </div>
              <div className={s.field}>
                <label htmlFor="pf-genre">{tp('fields.genre')}</label>
                <select id="pf-genre" value={form.genre} onChange={e => setField('genre', e.target.value)}>
                  <option value="">{tp('fields.genreOptions.nonPrecise')}</option>
                  <option value="homme">{tp('fields.genreOptions.homme')}</option>
                  <option value="femme">{tp('fields.genreOptions.femme')}</option>
                  <option value="autre">{tp('fields.genreOptions.autre')}</option>
                </select>
              </div>
              <div className={s.field}>
                <label htmlFor="pf-lang">{tp('fields.languePreferee')}</label>
                <select id="pf-lang" value={form.langue} onChange={e => setField('langue', e.target.value)}>
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                  <option value="ar">العربية</option>
                  <option value="pt">Português</option>
                  <option value="zh">中文</option>
                </select>
              </div>
              <div className={`${s.field} ${s.fieldFull} ${errors.bio ? s.hasErr : ''}`}>
                <label htmlFor="pf-bio">{tp('fields.bio')}</label>
                <textarea id="pf-bio" maxLength={BIO_MAX} value={form.bio} onChange={e => setField('bio', e.target.value)} placeholder={tp('fields.bioPlaceholder')} />
                {errors.bio ? fieldErr('bio') : <span className={s.fieldHint}>{form.bio.length}/{BIO_MAX} {tp('fields.caracteres')}</span>}
              </div>
              <div className={s.fieldActions}>
                <button className={s.btnSave} onClick={saveProfil} disabled={saving || !dirtyProfil}>
                  {saving ? <><i className="fas fa-circle-notch fa-spin" /> {tp('enregistrement')}</> : tp('enregistrer')}
                </button>
                <button className={s.btnCancel} onClick={closeProfilEdit} disabled={saving}>{tp('annuler')}</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Coordonnées ── */}
      <div className={s.card} ref={contactsRef}>
        <div className={s.cardHd}>
          <div className={s.cardTitle}>
            <div className={`${s.cardIco} ${s.icoTeal}`}><i className="fas fa-envelope" /></div>
            <div>
              <div className={s.cardH}>{tp('coordonneesTitle')}</div>
              <div className={s.cardSub}>{tp('coordonneesSubtitle')}</div>
            </div>
          </div>
          <button
            className={`${s.cardAction} ${s.cardActionOutline}`}
            aria-expanded={editContacts}
            onClick={() => (editContacts ? closeContactsEdit() : setEditContacts(true))}
          >
            <i className={`fas ${editContacts ? 'fa-xmark' : 'fa-pen'}`} /> {editContacts ? tp('fermer') : tp('modifier')}
          </button>
        </div>
        <div className={s.cardBody}>
          <div className={s.row}>
            <div className={s.rowLeft}>
              <div className={s.rowLabel}><i className="fas fa-envelope" style={{ color:'var(--blue)',fontSize:11 }} /> {tp('adresseEmail')}</div>
              <div className={s.rowVal}>{profil?.email}</div>
            </div>
            {profil?.emailVerified
              ? <span className={s.verified}><i className="fas fa-circle-check" /> {tp('verifie')}</span>
              : (
                <span className={s.pendingWrap}>
                  <span className={s.unverified}>⚠️ {tp('nonVerifie')}</span>
                  <button type="button" className={s.linkBtn} onClick={requestCode} disabled={sending || cooldown > 0}>
                    {sending ? <i className="fas fa-circle-notch fa-spin" /> : tp('verifierBtn')}
                  </button>
                </span>
              )
            }
          </div>

          {/* Saisie du code reçu par e-mail */}
          {verifyOpen && !profil?.emailVerified && (
            <div className={s.verifyBox} role="group" aria-label={tp('verifierBtn')}>
              <div className={s.verifyTxt}><i className="fas fa-paper-plane" /> {tp('codeEnvoye', { email: profil?.email })}</div>
              <div className={s.verifyRow}>
                <input
                  className={s.codeInput}
                  inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="••••••"
                  aria-label={tp('codeLabel')}
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={e => { if (e.key === 'Enter') confirmCode(); }}
                />
                <button type="button" className={s.btnSave} onClick={confirmCode} disabled={code.length !== 6 || confirming}>
                  {confirming ? <i className="fas fa-circle-notch fa-spin" /> : tp('confirmerBtn')}
                </button>
                <button type="button" className={s.linkBtn} onClick={requestCode} disabled={sending || cooldown > 0}>
                  {cooldown > 0 ? tp('renvoyerDans', { s: cooldown }) : tp('renvoyer')}
                </button>
              </div>
              <div className={s.fieldHint}>{tp('codeHint')}</div>
            </div>
          )}

          <div className={s.row}>
            <div className={s.rowLeft}>
              <div className={s.rowLabel}><i className="fas fa-phone" style={{ color:'var(--blue)',fontSize:11 }} /> {tp('telephone')}</div>
              <div className={s.rowVal}>{profil?.phone ?? <span className={s.rowValMuted}>{tp('nonRenseigneTel')}</span>}</div>
            </div>
            {profil?.phoneVerified
              ? <span className={s.verified}><i className="fas fa-circle-check" /> {tp('verifie')}</span>
              : (
                <span className={s.pendingWrap} title={tp('smsBientot')}>
                  <span className={s.unverified}>⚠️ {tp('nonVerifie')}</span>
                  <span className={s.soon}>{tp('smsBientotCourt')}</span>
                </span>
              )
            }
          </div>

          {/* Un vrai <form> isole ces champs de l'autofill de la barre de recherche du Header */}
          <form
            className={`${s.editForm} ${editContacts ? s.editFormOpen : ''}`}
            onSubmit={e => { e.preventDefault(); saveContacts(); }}
          >
            <div className={s.editGrid}>
              <div className={`${s.field} ${s.fieldFull}`}>
                <label htmlFor="pf-email">{tp('adresseEmail')}</label>
                <input id="pf-email" type="email" autoComplete="email" value={contactForm.email} onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))} />
                <span className={s.fieldHint}>{tp('emailHint')}</span>
              </div>
              <div className={`${s.field} ${s.fieldFull}`}>
                <label htmlFor="pf-phone">{tp('numeroTelephone')}</label>
                <input id="pf-phone" type="tel" autoComplete="tel" placeholder="+224 6XX XX XX XX" value={contactForm.phone} onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))} />
                <span className={s.fieldHint}>{tp('telHint')}</span>
              </div>
              {contactsChanged && (
                <div className={`${s.field} ${s.fieldFull}`}>
                  <label htmlFor="pf-pwd">{tp('motDePasseActuel')}</label>
                  <input id="pf-pwd" type="password" autoComplete="current-password" value={contactForm.currentPassword} onChange={e => setContactForm(f => ({ ...f, currentPassword: e.target.value }))} />
                  <span className={s.fieldHint}>{tp('motDePasseHint')}</span>
                </div>
              )}
              <div className={s.fieldActions}>
                <button type="submit" className={s.btnSave} disabled={saving || !contactsChanged || !contactForm.currentPassword}>
                  {saving ? <><i className="fas fa-circle-notch fa-spin" /> {tp('enregistrement')}</> : tp('enregistrerChangements')}
                </button>
                <button type="button" className={s.btnCancel} onClick={closeContactsEdit} disabled={saving}>{tp('annuler')}</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
