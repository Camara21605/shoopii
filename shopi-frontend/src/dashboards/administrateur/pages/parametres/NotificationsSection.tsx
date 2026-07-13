/* ================================================================
 * FICHIER : pages/parametres/NotificationsSection.tsx
 * Section 4 — Canaux de notification et planification.
 * SMS, e-mail, push, WhatsApp, Telegram, Slack, Discord.
 * ================================================================ */

import { useState } from 'react';
import styles from '../../styles/ParametresPage.module.css';
import type { SectionProps } from './types';

/* Définition d'un canal de notification */
interface Canal {
  id:     string;
  label:  string;
  icon:   string;
  color:  string;
  actif:  boolean;
  config: string; /* valeur de l'input : numéro, adresse, webhook… */
}

const CANAUX_INIT: Canal[] = [
  { id: 'sms',      label: 'SMS',       icon: 'fa-mobile-screen-button', color: 'var(--emerald)', actif: true,  config: '+224 620 00 00 22' },
  { id: 'email',    label: 'E-mail',    icon: 'fa-envelope',             color: 'var(--blue)',    actif: true,  config: 'a.conde@shopi.gn' },
  { id: 'push',     label: 'Push Web',  icon: 'fa-bell',                 color: 'var(--violet)',  actif: false, config: '' },
  { id: 'whatsapp', label: 'WhatsApp',  icon: 'fab fa-whatsapp',         color: '#25D366',        actif: false, config: '' },
  { id: 'telegram', label: 'Telegram',  icon: 'fab fa-telegram',         color: '#229ED9',        actif: false, config: '' },
  { id: 'slack',    label: 'Slack',     icon: 'fab fa-slack',            color: '#4A154B',        actif: false, config: '' },
  { id: 'discord',  label: 'Discord',   icon: 'fab fa-discord',          color: '#5865F2',        actif: false, config: '' },
];

/* Types d'événements notifiables */
const EVENTS = [
  { id: 'validation', label: 'Nouvelle validation',   icon: 'fa-user-check' },
  { id: 'signalement',label: 'Signalement grave',     icon: 'fa-flag' },
  { id: 'litige',     label: 'Litige ouvert',         icon: 'fa-scale-balanced' },
  { id: 'code',       label: 'Code généré',           icon: 'fa-qrcode' },
  { id: 'systeme',    label: 'Alerte système',        icon: 'fa-server' },
];

export default function NotificationsSection({ onToast }: SectionProps) {
  const [canaux,  setCanaux]  = useState<Canal[]>(CANAUX_INIT);
  const [events,  setEvents]  = useState<Record<string, boolean>>({
    validation: true, signalement: true, litige: true, code: false, systeme: true,
  });
  /* Plages horaires de silence */
  const [silence, setSilence] = useState({ actif: false, debut: '22:00', fin: '07:00' });

  const toggleCanal = (id: string) => {
    setCanaux(cs => cs.map(c => c.id === id ? { ...c, actif: !c.actif } : c));
    onToast('Canal mis à jour', 's');
  };

  const setConfig = (id: string, val: string) =>
    setCanaux(cs => cs.map(c => c.id === id ? { ...c, config: val } : c));

  const toggleEv = (id: string) =>
    setEvents(ev => ({ ...ev, [id]: !ev[id] }));

  return (
    <div className={styles.secBody}>

      {/* ── Canaux ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}><i className="fas fa-satellite-dish" /> Canaux de notification</div>
            <div className={styles.cardSub}>Configurez chaque canal et renseignez le point de contact</div>
          </div>
          <button className={`${styles.btn} ${styles.btnBlue} ${styles.btnSm}`}
            onClick={() => onToast('Canaux enregistrés', 's')}>
            <i className="fas fa-check" /> Sauvegarder
          </button>
        </div>
        <div className={styles.cardBody}>
          {CANAUX_INIT.map(def => {
            const c = canaux.find(x => x.id === def.id)!;
            const isFab = def.icon.startsWith('fab ');
            const iconCls = isFab ? def.icon : `fas ${def.icon}`;
            return (
              <div key={c.id} className={styles.toggleRow}>
                <div className={styles.tIc} style={{ background: `${c.color}18`, color: c.color }}>
                  <i className={iconCls} />
                </div>
                <div className={styles.tMain}>
                  <div className={styles.tTitle}>{c.label}</div>
                  {c.actif && (
                    <input className={styles.fldIn}
                      style={{ marginTop: 6, maxWidth: 280 }}
                      placeholder={`Adresse / numéro / webhook ${c.label}…`}
                      value={c.config}
                      onChange={e => setConfig(c.id, e.target.value)} />
                  )}
                </div>
                <div className={`${styles.sw} ${c.actif ? styles.swOn : ''}`}
                  onClick={() => toggleCanal(c.id)} />
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Événements ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}><i className="fas fa-list-check" /> Événements notifiables</div>
            <div className={styles.cardSub}>Choisissez les événements qui déclenchent une notification</div>
          </div>
        </div>
        <div className={styles.cardBody}>
          {EVENTS.map(ev => (
            <div key={ev.id} className={styles.toggleRow}>
              <div className={`${styles.tIc} ${styles.tIcBlue}`}><i className={`fas ${ev.icon}`} /></div>
              <div className={styles.tMain}>
                <div className={styles.tTitle}>{ev.label}</div>
              </div>
              <div className={`${styles.sw} ${events[ev.id] ? styles.swOn : ''}`}
                onClick={() => toggleEv(ev.id)} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Plage horaire silencieuse ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}><i className="fas fa-moon" /> Mode silencieux</div>
            <div className={styles.cardSub}>Suspend les notifications push et SMS pendant une plage horaire</div>
          </div>
          <div className={`${styles.sw} ${silence.actif ? styles.swOn : ''}`}
            onClick={() => setSilence(s => ({ ...s, actif: !s.actif }))} />
        </div>
        {silence.actif && (
          <div className={styles.cardBody}>
            <div className={styles.formGrid}>
              <div className={styles.fld}>
                <label className={styles.fldL}>Début du silence</label>
                <input type="time" className={styles.fldIn}
                  value={silence.debut}
                  onChange={e => setSilence(s => ({ ...s, debut: e.target.value }))} />
              </div>
              <div className={styles.fld}>
                <label className={styles.fldL}>Fin du silence</label>
                <input type="time" className={styles.fldIn}
                  value={silence.fin}
                  onChange={e => setSilence(s => ({ ...s, fin: e.target.value }))} />
              </div>
            </div>
            <span className={styles.fldHint}>
              Les alertes critiques (signalement grave) sont toujours envoyées même en mode silencieux.
            </span>
          </div>
        )}
      </div>

    </div>
  );
}
