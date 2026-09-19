/* ================================================================
 * FICHIER : pages/parametres/NotificationsSection.tsx
 *
 * Préférences de notification de l'administrateur.
 * GET / PATCH /notifications/preferences (même service que les autres rôles).
 *
 * Ce qui est réellement branché côté serveur :
 *   - E-mail : envoyé à l'adresse ci-dessous (sans adresse, AUCUN e-mail
 *     n'est envoyé — l'adresse du compte est proposée par défaut).
 *   - Mode silencieux : suspend l'e-mail pendant la plage horaire, dans le
 *     fuseau choisi ; les alertes urgentes passent toujours.
 * Non branché, donc présenté comme tel (interrupteurs désactivés) :
 *   - SMS : le fournisseur n'est pas encore connecté (les envois sont
 *     seulement journalisés) ;
 *   - Push navigateur : aucun enregistrement d'appareil côté web.
 *
 * La liste « Ce que vous recevez » ne cite que des notifications que le
 * backend crée réellement pour un administrateur (l'ancienne liste annonçait
 * « Code généré » et « Litige ouvert », qui n'en envoient jamais).
 * ================================================================ */

import { useState, useEffect, useCallback, useMemo } from 'react';
import styles from '../../styles/ParametresPage.module.css';
import type { SectionProps } from './types';
import { apiFetch } from '../../../../shared/services/apiFetch';
import { useAdminProfile } from '../../hooks/useAdminProfile';

interface Prefs {
  globalEmailEnabled: boolean;
  dndEnabled:         boolean;
  dndStartTime:       string;
  dndEndTime:         string;
  timezone:           string;
  notificationEmail:  string;
}

const DEFAULTS: Prefs = {
  globalEmailEnabled: true,
  dndEnabled:         false,
  dndStartTime:       '22:00',
  dndEndTime:         '07:00',
  timezone:           'Africa/Conakry',
  notificationEmail:  '',
};

const TIMEZONES = ['Africa/Conakry', 'Africa/Abidjan', 'Africa/Dakar', 'Africa/Casablanca', 'Europe/Paris', 'UTC'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* Notifications que le backend crée réellement pour un administrateur */
const RECEIVED: { icon: string; label: string; desc: string }[] = [
  { icon: 'fa-flag',        label: 'Signalements',                  desc: 'Nouveau signalement (les critiques sont toujours envoyés — voir Zone → Alertes)' },
  { icon: 'fa-server',      label: 'Alertes système & maintenance', desc: 'Incidents plateforme et fenêtres de maintenance' },
  { icon: 'fa-user-shield', label: 'Accès & zone',                  desc: 'Permissions, pays ou zone modifiés par le super-administrateur' },
];

const pick = (p: Partial<Prefs> | null | undefined): Prefs => ({
  globalEmailEnabled: p?.globalEmailEnabled ?? DEFAULTS.globalEmailEnabled,
  dndEnabled:         p?.dndEnabled         ?? DEFAULTS.dndEnabled,
  dndStartTime:       p?.dndStartTime       || DEFAULTS.dndStartTime,
  dndEndTime:         p?.dndEndTime         || DEFAULTS.dndEndTime,
  timezone:           p?.timezone           || DEFAULTS.timezone,
  notificationEmail:  p?.notificationEmail  ?? '',
});

function Switch({ on, onClick, label, disabled }: { on: boolean; onClick?: () => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled}
      className={`${styles.sw} ${on ? styles.swOn : ''}`}
      style={disabled ? { opacity: .45, cursor: 'not-allowed' } : undefined}
      onClick={onClick} />
  );
}

export default function NotificationsSection({ onToast }: SectionProps) {
  const { profile } = useAdminProfile();
  const accountEmail = profile?.email ?? '';

  const [saved,   setSaved]   = useState<Prefs>(DEFAULTS);
  const [draft,   setDraft]   = useState<Prefs>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [failed,  setFailed]  = useState(false);
  const [saving,  setSaving]  = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    apiFetch<Partial<Prefs>>('/notifications/preferences')
      .then(d => { const p = pick(d); setSaved(p); setDraft(p); })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const dirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(draft), [saved, draft]);
  const set = <K extends keyof Prefs>(k: K, v: Prefs[K]) => setDraft(d => ({ ...d, [k]: v }));

  const email      = draft.notificationEmail.trim();
  const emailError = draft.globalEmailEnabled && email && !EMAIL_RE.test(email) ? 'Adresse e-mail invalide.' : '';
  const noAddress  = draft.globalEmailEnabled && !email;
  const dndError   = draft.dndEnabled && draft.dndStartTime === draft.dndEndTime
    ? 'Le début et la fin du silence doivent être différents.' : '';

  async function save() {
    if (emailError || dndError) { onToast('Corrigez les champs en erreur', 'w'); return; }
    setSaving(true);
    try {
      await apiFetch('/notifications/preferences', {
        method: 'PATCH',
        body: {
          globalEmailEnabled: draft.globalEmailEnabled,
          dndEnabled:         draft.dndEnabled,
          dndStartTime:       draft.dndStartTime,
          dndEndTime:         draft.dndEndTime,
          timezone:           draft.timezone,
          notificationEmail:  email,
        },
      });
      const next = { ...draft, notificationEmail: email };
      setSaved(next); setDraft(next);
      onToast('Préférences enregistrées', 's');
    } catch (err: any) {
      onToast(err?.message ?? "Erreur lors de l'enregistrement", 'w');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.secBody}>
        <div className={styles.card}>
          <div className={styles.cardBody} style={{ textAlign: 'center', padding: '40px', color: 'var(--t3)' }}>
            <i className="fas fa-spinner fa-spin" /> Chargement des préférences…
          </div>
        </div>
      </div>
    );
  }
  if (failed) {
    return (
      <div className={styles.secBody}>
        <div className={styles.card}>
          <div className={styles.cardBody} style={{ textAlign: 'center', padding: '2rem' }}>
            <i className="fas fa-triangle-exclamation" style={{ color: '#dc2626', marginRight: 8 }} />
            Impossible de charger vos préférences.
            <div style={{ marginTop: 12 }}>
              <button className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`} onClick={load}>
                <i className="fas fa-rotate" /> Réessayer
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.secBody}>

      {/* ── Canaux ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}><i className="fas fa-satellite-dish" /> Canaux de notification</div>
            <div className={styles.cardSub}>Les notifications dans l&apos;application sont toujours actives ; choisissez les canaux en plus</div>
          </div>
          {dirty && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
                onClick={() => setDraft(saved)} disabled={saving}>Annuler</button>
              <button className={`${styles.btn} ${styles.btnBlue} ${styles.btnSm}`} onClick={save} disabled={saving}>
                <i className={saving ? 'fas fa-spinner fa-spin' : 'fas fa-check'} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          )}
        </div>
        <div className={styles.cardBody}>

          {/* E-mail — seul canal externe réellement branché */}
          <div className={styles.toggleRow}>
            <div className={styles.tIc} style={{ background: 'rgba(96,165,250,.12)', color: '#60A5FA' }}><i className="fas fa-envelope" /></div>
            <div className={styles.tMain}>
              <div className={styles.tTitle}>E-mail</div>
              {draft.globalEmailEnabled ? (
                <>
                  <input className={styles.fldIn} style={{ marginTop: 6, maxWidth: 320 }} type="email" autoComplete="email"
                    maxLength={255} placeholder={accountEmail || 'Adresse e-mail de notification…'}
                    value={draft.notificationEmail} onChange={e => set('notificationEmail', e.target.value)} />
                  {emailError && <div className={styles.fldHint} style={{ color: '#dc2626', marginTop: 4 }}>{emailError}</div>}
                  {noAddress && (
                    <div className={styles.fldHint} style={{ marginTop: 4, color: 'var(--amber)' }}>
                      <i className="fas fa-triangle-exclamation" /> Aucune adresse enregistrée : aucun e-mail ne sera envoyé.
                      {accountEmail && (
                        <> <button type="button" onClick={() => set('notificationEmail', accountEmail)}
                          style={{ background: 'none', border: 'none', padding: 0, color: 'var(--blue)', fontWeight: 700, cursor: 'pointer', fontSize: 'inherit' }}>
                          Utiliser {accountEmail}
                        </button></>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className={styles.tDesc}>Désactivé — vous ne recevrez plus d&apos;e-mail de notification</div>
              )}
            </div>
            <Switch on={draft.globalEmailEnabled} label="E-mail" onClick={() => set('globalEmailEnabled', !draft.globalEmailEnabled)} />
          </div>

          {/* SMS — fournisseur non connecté */}
          <div className={styles.toggleRow}>
            <div className={styles.tIc} style={{ background: 'rgba(52,211,153,.12)', color: '#34D399' }}><i className="fas fa-mobile-screen-button" /></div>
            <div className={styles.tMain}>
              <div className={styles.tTitle}>SMS <span className={`${styles.bdg} ${styles.bdgGray}`} style={{ marginLeft: 6 }}>Bientôt disponible</span></div>
              <div className={styles.tDesc}>L&apos;envoi de SMS sera activé dès la connexion du fournisseur.</div>
            </div>
            <Switch on={false} disabled label="SMS (bientôt disponible)" />
          </div>

          {/* Push web — aucun enregistrement d'appareil */}
          <div className={styles.toggleRow}>
            <div className={styles.tIc} style={{ background: 'rgba(167,139,250,.12)', color: '#A78BFA' }}><i className="fas fa-bell" /></div>
            <div className={styles.tMain}>
              <div className={styles.tTitle}>Push navigateur <span className={`${styles.bdg} ${styles.bdgGray}`} style={{ marginLeft: 6 }}>Bientôt disponible</span></div>
              <div className={styles.tDesc}>Les alertes temps réel s&apos;affichent déjà dans la cloche du tableau de bord.</div>
            </div>
            <Switch on={false} disabled label="Push navigateur (bientôt disponible)" />
          </div>
        </div>
      </div>

      {/* ── Ce que l'admin reçoit ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}><i className="fas fa-list-check" /> Ce que vous recevez</div>
            <div className={styles.cardSub}>Notifications générées pour votre compte administrateur (toujours visibles dans la cloche)</div>
          </div>
        </div>
        <div className={styles.cardBody}>
          {RECEIVED.map(ev => (
            <div key={ev.label} className={styles.toggleRow}>
              <div className={`${styles.tIc} ${styles.tIcBlue}`}><i className={`fas ${ev.icon}`} /></div>
              <div className={styles.tMain}>
                <div className={styles.tTitle}>{ev.label}</div>
                <div className={styles.tDesc}>{ev.desc}</div>
              </div>
              <i className="fas fa-circle-check" style={{ color: 'var(--emerald)' }} title="Toujours actif" />
            </div>
          ))}
        </div>
      </div>

      {/* ── Mode silencieux ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}><i className="fas fa-moon" /> Mode silencieux</div>
            <div className={styles.cardSub}>Suspend les e-mails pendant une plage horaire</div>
          </div>
          <Switch on={draft.dndEnabled} label="Mode silencieux" onClick={() => set('dndEnabled', !draft.dndEnabled)} />
        </div>
        {draft.dndEnabled && (
          <div className={styles.cardBody}>
            <div className={styles.formGrid}>
              <div className={styles.fld}>
                <label className={styles.fldL}>Début du silence</label>
                <input type="time" className={styles.fldIn} value={draft.dndStartTime} onChange={e => set('dndStartTime', e.target.value)} />
              </div>
              <div className={styles.fld}>
                <label className={styles.fldL}>Fin du silence</label>
                <input type="time" className={styles.fldIn} value={draft.dndEndTime} onChange={e => set('dndEndTime', e.target.value)} />
              </div>
              <div className={styles.fld}>
                <label className={styles.fldL}>Fuseau horaire</label>
                <select className={styles.fldIn} value={draft.timezone} onChange={e => set('timezone', e.target.value)}>
                  {(TIMEZONES.includes(draft.timezone) ? TIMEZONES : [draft.timezone, ...TIMEZONES]).map(z => <option key={z} value={z}>{z}</option>)}
                </select>
              </div>
            </div>
            {dndError && <div className={styles.fldHint} style={{ color: '#dc2626' }}>{dndError}</div>}
            <span className={styles.fldHint}>
              Une plage qui passe minuit est gérée (ex. 22:00 → 07:00). Les alertes urgentes (signalement critique) sont toujours envoyées.
            </span>
          </div>
        )}
      </div>

    </div>
  );
}
