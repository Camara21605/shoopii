/* ================================================================
 * FICHIER : pages/parametres/NotificationsSection.tsx
 * Section 4 — Canaux de notification et planification.
 * Connecté à l'API réelle GET/PATCH /notifications/preferences.
 * ================================================================ */

import { useState, useEffect } from 'react';
import styles from '../../styles/ParametresPage.module.css';
import type { SectionProps } from './types';
import { apiFetch } from '../../../../shared/services/apiFetch';

// ─── Types API ──────────────────────────────────────────────────

interface Prefs {
  globalPushEnabled:  boolean;
  globalEmailEnabled: boolean;
  globalSmsEnabled:   boolean;
  dndEnabled:         boolean;
  dndStartTime:       string;
  dndEndTime:         string;
  notificationEmail:  string;
  notificationPhone:  string;
}

const DEFAULT_PREFS: Prefs = {
  globalPushEnabled:  false,
  globalEmailEnabled: true,
  globalSmsEnabled:   false,
  dndEnabled:         false,
  dndStartTime:       '22:00',
  dndEndTime:         '07:00',
  notificationEmail:  '',
  notificationPhone:  '',
};

// ─── Types événements notifiables (côté affichage uniquement) ────

const EVENTS = [
  { id: 'validation', label: 'Nouvelle validation',   icon: 'fa-user-check' },
  { id: 'signalement',label: 'Signalement grave',     icon: 'fa-flag' },
  { id: 'litige',     label: 'Litige ouvert',         icon: 'fa-scale-balanced' },
  { id: 'code',       label: 'Code généré',           icon: 'fa-qrcode' },
  { id: 'systeme',    label: 'Alerte système',        icon: 'fa-server' },
];

// ─── Composant ─────────────────────────────────────────────────

export default function NotificationsSection({ onToast }: SectionProps) {
  const [prefs,    setPrefs]    = useState<Prefs>(DEFAULT_PREFS);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  // ── Chargement initial des préférences ─────────────────────

  useEffect(() => {
    apiFetch<Prefs>('/notifications/preferences')
      .then(d => { if (d) setPrefs(p => ({ ...p, ...d })); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Sauvegarde PATCH ──────────────────────────────────────

  const save = async (patch: Partial<Prefs>) => {
    setSaving(true);
    try {
      await apiFetch('/notifications/preferences', {
        method: 'PATCH',
        body:   patch,
      });
      setPrefs(p => ({ ...p, ...patch }));
      onToast('Préférences enregistrées', 's');
    } catch {
      onToast('Erreur lors de l\'enregistrement', 'w');
    } finally {
      setSaving(false);
    }
  };

  // ── Sauvegarde canaux + silencieux en un PATCH ────────────

  const saveAll = () => save({
    globalPushEnabled:  prefs.globalPushEnabled,
    globalEmailEnabled: prefs.globalEmailEnabled,
    globalSmsEnabled:   prefs.globalSmsEnabled,
    dndEnabled:         prefs.dndEnabled,
    dndStartTime:       prefs.dndStartTime,
    dndEndTime:         prefs.dndEndTime,
    notificationEmail:  prefs.notificationEmail,
    notificationPhone:  prefs.notificationPhone,
  });

  if (loading) {
    return (
      <div className={styles.secBody}>
        <div className={styles.card}>
          <div className={styles.cardBody} style={{ textAlign: 'center', padding: '40px', color: 'var(--t3)' }}>
            Chargement des préférences…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.secBody}>

      {/* ── Canaux globaux ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}><i className="fas fa-satellite-dish" /> Canaux de notification</div>
            <div className={styles.cardSub}>Activez les canaux par lesquels vous souhaitez recevoir les alertes</div>
          </div>
          <button
            className={`${styles.btn} ${styles.btnBlue} ${styles.btnSm}`}
            onClick={saveAll}
            disabled={saving}>
            <i className={saving ? 'fas fa-spinner fa-spin' : 'fas fa-check'} />
            {saving ? 'Enregistrement…' : 'Sauvegarder'}
          </button>
        </div>
        <div className={styles.cardBody}>

          {/* E-mail */}
          <div className={styles.toggleRow}>
            <div className={`${styles.tIc}`} style={{ background: 'rgba(96,165,250,.12)', color: '#60A5FA' }}>
              <i className="fas fa-envelope" />
            </div>
            <div className={styles.tMain}>
              <div className={styles.tTitle}>E-mail</div>
              {prefs.globalEmailEnabled && (
                <input
                  className={styles.fldIn}
                  style={{ marginTop: 6, maxWidth: 280 }}
                  placeholder="Adresse e-mail de notification…"
                  value={prefs.notificationEmail}
                  onChange={e => setPrefs(p => ({ ...p, notificationEmail: e.target.value }))}
                />
              )}
            </div>
            <div
              className={`${styles.sw} ${prefs.globalEmailEnabled ? styles.swOn : ''}`}
              onClick={() => setPrefs(p => ({ ...p, globalEmailEnabled: !p.globalEmailEnabled }))}
            />
          </div>

          {/* SMS */}
          <div className={styles.toggleRow}>
            <div className={`${styles.tIc}`} style={{ background: 'rgba(52,211,153,.12)', color: '#34D399' }}>
              <i className="fas fa-mobile-screen-button" />
            </div>
            <div className={styles.tMain}>
              <div className={styles.tTitle}>SMS</div>
              {prefs.globalSmsEnabled && (
                <input
                  className={styles.fldIn}
                  style={{ marginTop: 6, maxWidth: 280 }}
                  placeholder="Numéro de téléphone (format E.164 : +224…)"
                  value={prefs.notificationPhone}
                  onChange={e => setPrefs(p => ({ ...p, notificationPhone: e.target.value }))}
                />
              )}
            </div>
            <div
              className={`${styles.sw} ${prefs.globalSmsEnabled ? styles.swOn : ''}`}
              onClick={() => setPrefs(p => ({ ...p, globalSmsEnabled: !p.globalSmsEnabled }))}
            />
          </div>

          {/* Push Web */}
          <div className={styles.toggleRow}>
            <div className={`${styles.tIc}`} style={{ background: 'rgba(167,139,250,.12)', color: '#A78BFA' }}>
              <i className="fas fa-bell" />
            </div>
            <div className={styles.tMain}>
              <div className={styles.tTitle}>Push Web</div>
              <div className={styles.tDesc}>Notifications navigateur (nécessite l'autorisation)</div>
            </div>
            <div
              className={`${styles.sw} ${prefs.globalPushEnabled ? styles.swOn : ''}`}
              onClick={() => setPrefs(p => ({ ...p, globalPushEnabled: !p.globalPushEnabled }))}
            />
          </div>

        </div>
      </div>

      {/* ── Événements notifiables (affichage informatif) ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}><i className="fas fa-list-check" /> Événements déclencheurs</div>
            <div className={styles.cardSub}>Ces événements génèrent automatiquement une notification in-app</div>
          </div>
        </div>
        <div className={styles.cardBody}>
          {EVENTS.map(ev => (
            <div key={ev.id} className={styles.toggleRow}>
              <div className={`${styles.tIc} ${styles.tIcBlue}`}><i className={`fas ${ev.icon}`} /></div>
              <div className={styles.tMain}>
                <div className={styles.tTitle}>{ev.label}</div>
                <div className={styles.tDesc}>Notification in-app toujours active</div>
              </div>
              {/* Les notifs in-app ne peuvent pas être désactivées */}
              <div className={`${styles.sw} ${styles.swOn}`} style={{ opacity: .5, cursor: 'not-allowed' }} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Mode silencieux (DND) ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}><i className="fas fa-moon" /> Mode silencieux</div>
            <div className={styles.cardSub}>Suspend les notifications push et SMS pendant une plage horaire</div>
          </div>
          <div
            className={`${styles.sw} ${prefs.dndEnabled ? styles.swOn : ''}`}
            onClick={() => {
              const next = !prefs.dndEnabled;
              setPrefs(p => ({ ...p, dndEnabled: next }));
              save({ dndEnabled: next });
            }}
          />
        </div>
        {prefs.dndEnabled && (
          <div className={styles.cardBody}>
            <div className={styles.formGrid}>
              <div className={styles.fld}>
                <label className={styles.fldL}>Début du silence</label>
                <input
                  type="time"
                  className={styles.fldIn}
                  value={prefs.dndStartTime}
                  onChange={e => setPrefs(p => ({ ...p, dndStartTime: e.target.value }))}
                />
              </div>
              <div className={styles.fld}>
                <label className={styles.fldL}>Fin du silence</label>
                <input
                  type="time"
                  className={styles.fldIn}
                  value={prefs.dndEndTime}
                  onChange={e => setPrefs(p => ({ ...p, dndEndTime: e.target.value }))}
                />
              </div>
            </div>
            <span className={styles.fldHint}>
              Les alertes critiques (signalement urgent) sont toujours envoyées même en mode silencieux.
            </span>
            <button
              className={`${styles.btn} ${styles.btnBlue} ${styles.btnSm}`}
              style={{ marginTop: 12 }}
              onClick={() => save({ dndEnabled: prefs.dndEnabled, dndStartTime: prefs.dndStartTime, dndEndTime: prefs.dndEndTime })}
              disabled={saving}>
              <i className="fas fa-check" /> Enregistrer le créneau
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
