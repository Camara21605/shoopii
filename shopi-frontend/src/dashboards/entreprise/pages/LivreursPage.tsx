/*
 * ============================================================
 * FICHIER : src/dashboards/entreprise/pages/LivreursPage.tsx
 *
 * VERSION CONNECTÉE AU BACKEND
 * Design identique à CorrespondantsPage.tsx
 *
 * ─── CE QUI EST CONNECTÉ ─────────────────────────────────────
 *
 *  ✅ GET /livreurs/stats           → 4 KPI cards
 *  ✅ GET /livreurs/zones           → panneau couverture
 *  ✅ GET /livreurs/activite-recente→ panneau activité
 *  ✅ GET /livreurs                 → grille + liste
 *  ✅ POST /livreurs/inviter        → ModalInviter (code réel backend)
 *  ✅ POST /livreurs/:id/contacter  → ModalContacter
 *  ✅ PATCH /livreurs/:id/suspendre → ModalSuspendre
 *  ✅ PATCH /livreurs/:id/valider   → actions rapides
 *
 * ─── FLUX DE DONNÉES ─────────────────────────────────────────
 *
 *  Montage → loadData() → Promise.all([getStats, getZones,
 *                          getActiviteRecente, getAll])
 *  Action  → API → toast → loadData()
 *
 * ============================================================
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useToast } from '../../../shared/context/ToastContext';
import styles from './CorrespondantsPage.module.css';
import {
  livreursApi,
  type LivreurResponse,
  type LivreurStats,
  type ZoneStat,
  type Availability,
  type LivreurStatus,
  type VehicleType,
  type InvitationLivreurResponse,
} from '../../../shared/services/api/livreurs.api';

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function vehicleEmoji(type: VehicleType): string {
  return { moto:'🛵', voiture:'🚗', velo:'🚲', tricycle:'🛺', camion:'🚚', pieton:'🚶' }[type] ?? '🛵';
}
function vehicleLabel(type: VehicleType, t: TFunction): string {
  return {
    moto: t('livreurs.vehicle.moto'), voiture: t('livreurs.vehicle.voiture'), velo: t('livreurs.vehicle.velo'),
    tricycle: t('livreurs.vehicle.tricycle'), camion: t('livreurs.vehicle.camion'), pieton: t('livreurs.vehicle.pieton'),
  }[type] ?? t('livreurs.vehicle.moto');
}
function tauxReussite(total: number, success: number): number {
  return total === 0 ? 0 : Math.round((success / total) * 100);
}
function fmtGnf(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${Math.round(n / 1_000)}K`;
  return n.toLocaleString('fr-FR');
}
function randomChars(n: number): string {
  const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: n }, () => alpha[Math.floor(Math.random() * alpha.length)]).join('');
}

// ─────────────────────────────────────────────────────────────
// CONFIG VISUEL
// ─────────────────────────────────────────────────────────────

const AVAIL_DOT: Record<Availability, string> = {
  available:   'var(--t2)',
  on_delivery: 'var(--t2)',
  offline:     '#9CA3AF',
};

function getAvailLabel(t: TFunction): Record<Availability, string> {
  return {
    available:   t('livreurs.avail.available'),
    on_delivery: t('livreurs.avail.on_delivery'),
    offline:     t('livreurs.avail.offline'),
  };
}

const AVAIL_CLS: Record<Availability, string> = {
  available:   styles.statutActive,
  on_delivery: styles.statutPending,
  offline:     styles.statutSuspended,
};

function getStatusLabel(t: TFunction): Record<LivreurStatus, string> {
  return {
    active:    t('livreurs.status.active'),
    pending:   t('livreurs.status.pending'),
    suspended: t('livreurs.status.suspended'),
    banned:    t('livreurs.status.banned'),
  };
}
const STATUS_CLS: Record<LivreurStatus, string> = {
  active:    styles.statutActive,
  pending:   styles.statutPending,
  suspended: styles.statutSuspended,
  banned:    styles.statutSuspended,
};

// ─────────────────────────────────────────────────────────────
// SOUS-COMPOSANTS
// ─────────────────────────────────────────────────────────────

function Stars({ value }: { value: number }) {
  return (
    <div className={styles.stars}>
      {[1,2,3,4,5].map(i => (
        <i key={i} className={`fas fa-star ${i <= Math.round(value) ? styles.starOn : styles.starOff}`} />
      ))}
      <span className={styles.starVal}>{value === 0 ? 'N/A' : value.toFixed(1)}</span>
    </div>
  );
}

function BadgeAvail({ availability }: { availability: Availability }) {
  const { t } = useTranslation();
  return (
    <span className={`${styles.statutBadge} ${AVAIL_CLS[availability]}`}>
      <span style={{
        display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
        background: AVAIL_DOT[availability], marginRight: 5,
      }} />
      {getAvailLabel(t)[availability]}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// MODALE PROFIL
// ─────────────────────────────────────────────────────────────

function ModalProfil({ l, onClose, onContact, onSuspend }: {
  l:         LivreurResponse;
  onClose:   () => void;
  onContact: () => void;
  onSuspend: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.mHeader}>
          <div className={styles.mHeaderLeft}>
            <div className={styles.mAvatar} style={{ position: 'relative', fontSize: 26 }}>
              {l.avatarEmoji}
              <span style={{
                position: 'absolute', bottom: -2, right: -2,
                width: 14, height: 14, borderRadius: '50%',
                background: AVAIL_DOT[l.availability as Availability],
                border: '2px solid #fff',
              }} />
            </div>
            <div>
              <div className={styles.mName}>{l.fullName}</div>
              <div className={styles.mMeta}>
                <span><i className="fas fa-phone" /> {l.phone ?? t('livreurs.na')}</span>
                <span><i className="fas fa-map-pin" /> {l.zone ?? t('livreurs.na')}</span>
                <span><i className="fas fa-envelope" /> {l.email}</span>
              </div>
              <div className={styles.mBadges}>
                <span className={`${styles.statutBadge} ${STATUS_CLS[l.status as LivreurStatus]}`}>
                  {getStatusLabel(t)[l.status as LivreurStatus]}
                </span>
                <BadgeAvail availability={l.availability as Availability} />
                <span className={`${styles.typeBadge} ${styles.badgeRelais}`}>
                  {l.vehicleEmoji} {vehicleLabel(l.vehicleType as VehicleType, t)}
                  {l.vehiclePlate && ` · ${l.vehiclePlate}`}
                </span>
              </div>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><i className="fas fa-xmark" /></button>
        </div>

        <div className={styles.mBody}>
          <div className={styles.kpiGrid}>
            {[
              { icon:'fa-box',     label:t('livreurs.modalProfil.kpiTotalCourses'),  value: String(l.totalDeliveries),   sub: t('livreurs.modalProfil.kpiReussies', { count: l.successfulDeliveries }),  cls: styles.kpiBlue   },
              { icon:'fa-percent', label:t('livreurs.modalProfil.kpiTauxReussite'),  value: `${tauxReussite(l.totalDeliveries, l.successfulDeliveries)}%`, sub: l.totalDeliveries > 0 ? t('livreurs.modalProfil.kpiTresBon') : t('livreurs.modalProfil.kpiTiret'), cls: styles.kpiGreen  },
              { icon:'fa-star',    label:t('livreurs.modalProfil.kpiNoteMoyenne'),   value: l.averageRating === 0 ? t('livreurs.na') : l.averageRating.toFixed(1), sub: t('livreurs.modalProfil.kpiSur5Etoiles'), cls: styles.kpiAmber  },
              { icon:'fa-wallet',  label:t('livreurs.modalProfil.kpiGainsTotaux'),   value: fmtGnf(l.totalEarnings),      sub: t('livreurs.modalProfil.kpiGnfCumules'),            cls: styles.kpiViolet },
            ].map((k, i) => (
              <div key={i} className={`${styles.kpiCard} ${k.cls}`}>
                <div className={styles.kpiIcon}><i className={`fas ${k.icon}`} /></div>
                <div className={styles.kpiVal}>{k.value}</div>
                <div className={styles.kpiLabel}>{k.label}</div>
                <div className={styles.kpiSub}>{k.sub}</div>
              </div>
            ))}
          </div>

          <div className={styles.ratingBox}>
            <div className={styles.ratingBoxTitle}>{t('livreurs.modalProfil.evaluationClients')}</div>
            <Stars value={l.averageRating} />
          </div>

          <div className={styles.detGrid}>
            {[
              { icon:'fa-phone',           label:t('livreurs.modalProfil.telephone'),         value: l.phone ?? t('livreurs.na')                                              },
              { icon:'fa-envelope',        label:t('livreurs.modalProfil.email'),             value: l.email                                                        },
              { icon:'fa-map-pin',         label:t('livreurs.modalProfil.zone'),              value: l.zone ?? t('livreurs.na')                                               },
              { icon:'fa-car',             label:t('livreurs.modalProfil.vehicule'),          value: `${l.vehicleEmoji} ${vehicleLabel(l.vehicleType as VehicleType, t)}` },
              { icon:'fa-id-card',         label:t('livreurs.modalProfil.plaque'),            value: l.vehiclePlate ?? t('livreurs.modalProfil.nonRenseignee')                             },
              { icon:'fa-calendar-day',    label:t('livreurs.modalProfil.livraisonsAuj'),   value: String(l.todayDeliveries)                                      },
              { icon:'fa-clock-rotate-left', label:t('livreurs.modalProfil.derniereActivite'), value: `${l.lastActivity} (${l.lastActivityAt})`                   },
              { icon:'fa-calendar',        label:t('livreurs.modalProfil.membreDepuis'),     value: new Date(l.joinedAt).toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' }) },
            ].map((d, i) => (
              <div key={i} className={styles.detItem}>
                <div className={styles.detIcon}><i className={`fas ${d.icon}`} /></div>
                <div><div className={styles.detLabel}>{d.label}</div><div className={styles.detValue}>{d.value}</div></div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.mFooter}>
          {l.status === 'active' && (
            <button className={styles.btnDanger} onClick={() => { onSuspend(); onClose(); }}>
              <i className="fas fa-ban" /> {t('livreurs.modalProfil.suspendre')}
            </button>
          )}
          <button className={styles.btnSecondary} onClick={() => { onContact(); onClose(); }}>
            <i className="fas fa-envelope" /> {t('livreurs.modalProfil.contacter')}
          </button>
          <a
            href={`https://wa.me/${(l.phone ?? '').replace(/\s+/g, '')}`}
            target="_blank" rel="noreferrer"
            className={styles.btnSecondary}
            style={{ color: 'var(--t2)', borderColor: 'rgba(128,128,128,.3)' }}
          >
            <i className="fab fa-whatsapp" /> {t('livreurs.modalProfil.whatsapp')}
          </a>
          <a href={`tel:${l.phone}`} className={styles.btnSecondary}>
            <i className="fas fa-phone" /> {t('livreurs.modalProfil.appeler')}
          </a>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODALE CONTACTER — connectée à POST /livreurs/:id/contacter
// ─────────────────────────────────────────────────────────────

function ModalContacter({ l, onClose }: { l: LivreurResponse; onClose: () => void }) {
  const { t } = useTranslation();
  const { pop } = useToast();
  const [sujet,   setSujet]   = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleEnvoyer() {
    if (!sujet.trim() || !message.trim()) { pop(t('livreurs.modalContacter.sujetMessageRequis'), 'w'); return; }
    setLoading(true);
    try {
      await livreursApi.contacter(l.id, { sujet: sujet.trim(), message: message.trim() });
      pop(t('livreurs.modalContacter.messageEnvoye', { name: l.fullName }), 's');
      onClose();
    } catch (err: any) {
      pop(`❌ ${err.message}`, 'e');
    } finally { setLoading(false); }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.modalSm}`} onClick={e => e.stopPropagation()}>
        <div className={styles.mHeader}>
          <div>
            <div className={styles.mTitle}><i className="fas fa-envelope" /> {t('livreurs.modalContacter.title')}</div>
            <div className={styles.mSub}>{t('livreurs.modalContacter.sub', { name: l.fullName, email: l.email })}</div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><i className="fas fa-xmark" /></button>
        </div>
        <div className={styles.mBody}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}><i className="fas fa-heading" /> {t('livreurs.modalContacter.sujetLabel')}</label>
            <input className={styles.formInput} placeholder={t('livreurs.modalContacter.sujetPlaceholder')} value={sujet} onChange={e => setSujet(e.target.value)} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}><i className="fas fa-message" /> {t('livreurs.modalContacter.messageLabel')}</label>
            <textarea className={styles.formTextarea} rows={5} placeholder={t('livreurs.modalContacter.messagePlaceholder')} value={message} onChange={e => setMessage(e.target.value)} />
          </div>
          <div className={styles.infoBox}>
            <i className="fas fa-circle-info" />
            <span>{t('livreurs.modalContacter.infoBox', { email: l.email })}</span>
          </div>
        </div>
        <div className={styles.mFooter}>
          <button className={styles.btnSecondary} onClick={onClose} disabled={loading}>{t('livreurs.modalContacter.annuler')}</button>
          <button className={styles.btnPrimary} onClick={handleEnvoyer} disabled={loading}>
            {loading ? <><i className="fas fa-spinner fa-spin" /> {t('livreurs.modalContacter.envoiEnCours')}</> : <><i className="fas fa-paper-plane" /> {t('livreurs.modalContacter.envoyer')}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODALE INVITER — connectée à POST /livreurs/inviter
// 3 étapes identiques à CorrespondantsPage.ModalInviter
// ─────────────────────────────────────────────────────────────

function ModalInviter({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const { pop } = useToast();
  const [etape,    setEtape]    = useState<1 | 2 | 3>(1);
  const [nom,      setNom]      = useState('');
  const [email,    setEmail]    = useState('');
  const [zone,     setZone]     = useState('');
  const [vehicule, setVehicule] = useState<VehicleType>('moto');
  const [message,  setMessage]  = useState(() => t('livreurs.modalInviter.defaultMessage'));
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState<InvitationLivreurResponse | null>(null);

  function validerEtape1() {
    if (!nom.trim())   { pop(t('livreurs.modalInviter.nomRequis'), 'w');   return; }
    if (!email.trim()) { pop(t('livreurs.modalInviter.emailRequis'), 'w'); return; }
    if (!email.includes('@')) { pop(t('livreurs.modalInviter.emailInvalide'), 'w'); return; }
    setEtape(2);
  }

  // ✅ CONNECTÉ — appelle POST /livreurs/inviter
  async function handleEnvoyer() {
    setLoading(true);
    try {
      const res = await livreursApi.inviter({
        fullName:    nom.trim(),
        email:       email.trim(),
        vehicleType: vehicule,
        zone:        zone.trim() || undefined,
        message:     message.trim() || undefined,
      });
      setResult(res);
      setEtape(3);
      pop(t('livreurs.modalInviter.invitationEnvoyee', { email }), 's');
    } catch (err: any) {
      pop(`❌ ${err.message}`, 'e');
    } finally { setLoading(false); }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.modalMd}`} onClick={e => e.stopPropagation()}>
        <div className={styles.mHeader}>
          <div>
            <div className={styles.mTitle}><i className="fas fa-user-plus" /> {t('livreurs.modalInviter.title')}</div>
            <div className={styles.etapes}>
              {[t('livreurs.modalInviter.etapeInformations'), t('livreurs.modalInviter.etapeApercu'), t('livreurs.modalInviter.etapeConfirme')].map((e, i) => (
                <React.Fragment key={i}>
                  <div className={`${styles.etape} ${etape === i+1 ? styles.etapeActive : etape > i+1 ? styles.etapeDone : ''}`}>
                    <span className={styles.etapeNum}>
                      {etape > i+1 ? <i className="fas fa-check" /> : i+1}
                    </span>
                    <span className={styles.etapeLabel}>{e}</span>
                  </div>
                  {i < 2 && <div className={`${styles.etapeLine} ${etape > i+1 ? styles.etapeLineDone : ''}`} />}
                </React.Fragment>
              ))}
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><i className="fas fa-xmark" /></button>
        </div>

        <div className={styles.mBody}>
          {/* ÉTAPE 1 */}
          {etape === 1 && (
            <div className={styles.formCols}>
              <div className={styles.formCol}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}><i className="fas fa-user" /> {t('livreurs.modalInviter.nomComplet')}</label>
                  <input className={styles.formInput} placeholder={t('livreurs.modalInviter.nomPlaceholder')} value={nom} onChange={e => setNom(e.target.value)} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}><i className="fas fa-envelope" /> {t('livreurs.modalInviter.emailContact')}</label>
                  <input type="email" className={styles.formInput} placeholder={t('livreurs.modalInviter.emailPlaceholder')} value={email} onChange={e => setEmail(e.target.value)} />
                  <p className={styles.formHint}><i className="fas fa-circle-info" /> {t('livreurs.modalInviter.codeEmailHint')}</p>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}><i className="fas fa-car" /> {t('livreurs.modalInviter.typeVehicule')}</label>
                  <select className={styles.formSelect} value={vehicule} onChange={e => setVehicule(e.target.value as VehicleType)}>
                    <option value="moto">🛵 {t('livreurs.vehicle.moto')}</option>
                    <option value="voiture">🚗 {t('livreurs.vehicle.voiture')}</option>
                    <option value="velo">🚲 {t('livreurs.vehicle.velo')}</option>
                    <option value="tricycle">🛺 {t('livreurs.vehicle.tricycle')}</option>
                    <option value="camion">🚚 {t('livreurs.vehicle.camion')}</option>
                    <option value="pieton">🚶 {t('livreurs.vehicle.pieton')}</option>
                  </select>
                </div>
              </div>
              <div className={styles.formCol}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}><i className="fas fa-map-pin" /> {t('livreurs.modalInviter.zoneLivraison')}</label>
                  <input className={styles.formInput} placeholder={t('livreurs.modalInviter.zonePlaceholder')} value={zone} onChange={e => setZone(e.target.value)} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}><i className="fas fa-message" /> {t('livreurs.modalInviter.messagePersonnalise')}</label>
                  <textarea className={styles.formTextarea} rows={7} value={message} onChange={e => setMessage(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* ÉTAPE 2 */}
          {etape === 2 && (
            <div className={styles.apercu}>
              <div className={styles.apercuLabel}><i className="fas fa-eye" /> {t('livreurs.modalInviter.apercuTitle')}</div>
              <div className={styles.emailPreview}>
                <div className={styles.emailHeader}>
                  <div className={styles.emailLogo}>S</div>
                  <div>
                    <div className={styles.emailSujet}>{t('livreurs.modalInviter.emailSujetFixe')}</div>
                    <div className={styles.emailDest}>{t('livreurs.modalInviter.emailDestA')} <strong>{email}</strong></div>
                  </div>
                </div>
                <div className={styles.emailBody}>
                  <p>{t('livreurs.modalInviter.bonjour')} <strong>{nom}</strong>,</p>
                  <p style={{ whiteSpace: 'pre-line', fontSize: 13, color: 'var(--t2)', lineHeight: 1.6 }}>{message}</p>
                  <div className={styles.emailCode}>
                    <div className={styles.emailCodeLabel}>{t('livreurs.modalInviter.codeInvitationLabel')}</div>
                    <div className={styles.emailCodeValue} style={{ letterSpacing: '0.3em', color: 'var(--t3)' }}>••••-••••-••</div>
                    <div className={styles.emailCodeNote}>{t('livreurs.modalInviter.codeInvitationNote')}</div>
                  </div>
                  <div className={styles.emailInfo}>
                    {zone && <div><i className="fas fa-map-pin" /> {t('livreurs.modalInviter.zoneLabelInline')} <strong>{zone}</strong></div>}
                    <div><i className="fas fa-car" /> {t('livreurs.modalInviter.vehiculeLabelInline')} <strong>{vehicleEmoji(vehicule)} {vehicleLabel(vehicule, t)}</strong></div>
                  </div>
                </div>
              </div>
              <div className={styles.infoBox}>
                <i className="fas fa-circle-info" />
                <span>{t('livreurs.modalInviter.infoBoxExpire')}</span>
              </div>
            </div>
          )}

          {/* ÉTAPE 3 — code RÉEL venant du backend */}
          {etape === 3 && result && (
            <div className={styles.success}>
              <div className={styles.successIcon}>✅</div>
              <div className={styles.successTitle}>{t('livreurs.modalInviter.invitationEnvoyeeTitle')}</div>
              <div className={styles.successSub}>{t('livreurs.modalInviter.codeEnvoyeA', { email: result.email })}</div>
              <div className={styles.successRecap}>
                <div className={styles.recapRow}><span>{t('livreurs.modalInviter.recapNom')}</span><strong>{result.fullName}</strong></div>
                <div className={styles.recapRow}><span>{t('livreurs.modalInviter.recapEmail')}</span><strong>{result.email}</strong></div>
                {zone && <div className={styles.recapRow}><span>{t('livreurs.modalInviter.recapZone')}</span><strong>{zone}</strong></div>}
                <div className={styles.recapRow}><span>{t('livreurs.modalInviter.recapVehicule')}</span><strong>{vehicleEmoji(vehicule)} {vehicleLabel(vehicule, t)}</strong></div>
              </div>
              <div className={styles.codeBox}>
                <div className={styles.codeBoxLabel}>{t('livreurs.modalInviter.codeGenereLabel')}</div>
                <div className={styles.codeRow}>
                  <span className={styles.codeVal}>{result.code}</span>
                  <button className={styles.copyBtn} onClick={() => { navigator.clipboard.writeText(result.code); pop(t('livreurs.modalInviter.codeCopieToast'), 's'); }}>
                    <i className="fas fa-copy" /> {t('livreurs.modalInviter.copier')}
                  </button>
                </div>
                <div className={styles.codeExpiry}>
                  <i className="fas fa-clock" /> {t('livreurs.modalInviter.expireLe', { date: new Date(result.expiresAt).toLocaleDateString('fr-FR') })}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={styles.mFooter}>
          {etape === 1 && (
            <>
              <button className={styles.btnSecondary} onClick={onClose}>{t('livreurs.modalInviter.annuler')}</button>
              <button className={styles.btnPrimary} onClick={validerEtape1}>{t('livreurs.modalInviter.suivant')} <i className="fas fa-arrow-right" /></button>
            </>
          )}
          {etape === 2 && (
            <>
              <button className={styles.btnSecondary} onClick={() => setEtape(1)} disabled={loading}><i className="fas fa-arrow-left" /> {t('livreurs.modalInviter.retour')}</button>
              <button className={styles.btnPrimary} onClick={handleEnvoyer} disabled={loading}>
                {loading ? <><i className="fas fa-spinner fa-spin" /> {t('livreurs.modalInviter.envoiEnCours')}</> : <><i className="fas fa-paper-plane" /> {t('livreurs.modalInviter.envoyerInvitation')}</>}
              </button>
            </>
          )}
          {etape === 3 && <button className={styles.btnSecondary} onClick={() => { onDone(); onClose(); }}>{t('livreurs.modalInviter.fermer')}</button>}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODALE SUSPENDRE
// ─────────────────────────────────────────────────────────────

function ModalSuspendre({ l, onClose, onConfirm, loading }: {
  l:         LivreurResponse;
  onClose:   () => void;
  onConfirm: () => void;
  loading:   boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.modalXs}`} onClick={e => e.stopPropagation()}>
        <div className={styles.mHeader}>
          <div className={`${styles.mTitle} ${styles.dangerTitle}`}>
            <i className="fas fa-triangle-exclamation" /> {t('livreurs.modalSuspendre.title')}
          </div>
          <button className={styles.closeBtn} onClick={onClose}><i className="fas fa-xmark" /></button>
        </div>
        <div className={styles.mBody}>
          <div className={styles.suspendBox}>
            <div className={styles.suspendIco}>⚠️</div>
            <p>{t('livreurs.modalSuspendre.confirmText', { name: l.fullName })}</p>
            <p className={styles.suspendNote}>{t('livreurs.modalSuspendre.note')}</p>
          </div>
        </div>
        <div className={styles.mFooter}>
          <button className={styles.btnSecondary} onClick={onClose} disabled={loading}>{t('livreurs.modalSuspendre.annuler')}</button>
          <button className={styles.btnDanger} onClick={onConfirm} disabled={loading}>
            {loading ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-ban" />} {t('livreurs.modalSuspendre.confirmer')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL — 100% connecté au backend
// ─────────────────────────────────────────────────────────────

export default function LivreursPage() {
  const { t } = useTranslation();
  const { pop } = useToast();

  // ── État données ────────────────────────────────────────────
  const [livreurs,       setLivreurs]       = useState<LivreurResponse[]>([]);
  const [stats,          setStats]          = useState<LivreurStats | null>(null);
  const [zones,          setZones]          = useState<ZoneStat[]>([]);
  const [activite,       setActivite]       = useState<LivreurResponse[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [suspendLoading, setSuspendLoading] = useState(false);

  // ── Modales ─────────────────────────────────────────────────
  const [modalProfil,  setModalProfil]  = useState<LivreurResponse | null>(null);
  const [modalInviter, setModalInviter] = useState(false);
  const [modalContact, setModalContact] = useState<LivreurResponse | null>(null);
  const [modalSuspend, setModalSuspend] = useState<LivreurResponse | null>(null);

  // ── Filtres ─────────────────────────────────────────────────
  const [search,       setSearch]       = useState('');
  const [filtreAvail,  setFiltreAvail]  = useState<'tous' | Availability>('tous');
  const [filtreStatut, setFiltreStatut] = useState<'tous' | LivreurStatus>('tous');
  const [vue,          setVue]          = useState<'grille' | 'liste'>('grille');

  // ── Filtrage local ──────────────────────────────────────────
  const filtres = useMemo(() => livreurs.filter(l => {
    const matchSearch  = !search.trim() ||
      l.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (l.zone ?? '').toLowerCase().includes(search.toLowerCase()) ||
      l.email.toLowerCase().includes(search.toLowerCase());
    const matchAvail   = filtreAvail   === 'tous' || l.availability === filtreAvail;
    const matchStatut  = filtreStatut  === 'tous' || l.status === filtreStatut;
    return matchSearch && matchAvail && matchStatut;
  }), [livreurs, search, filtreAvail, filtreStatut]);

  // ══════════════════════════════════════════════════════════
  // CHARGEMENT — 4 appels API en parallèle
  // ══════════════════════════════════════════════════════════

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsData, zonesData, activiteData, listData] = await Promise.all([
        livreursApi.getStats(),
        livreursApi.getZones(),
        livreursApi.getActiviteRecente(),
        livreursApi.getAll({ limit: 100 }),
      ]);
      setStats(statsData);
      setZones(zonesData);
      setActivite(activiteData);
      setLivreurs(listData.data);
    } catch (err: any) {
      pop(t('livreurs.toasts.loadError', { message: err.message }), 'e');
    } finally {
      setLoading(false);
    }
  }, [pop, t]);

  useEffect(() => { loadData(); }, [loadData]);

  // ══════════════════════════════════════════════════════════
  // SUSPENDRE — connecté à PATCH /livreurs/:id/suspendre
  // ══════════════════════════════════════════════════════════

  async function handleSuspendre(l: LivreurResponse) {
    setSuspendLoading(true);
    try {
      await livreursApi.suspendre(l.id);
      pop(t('livreurs.toasts.suspendu', { name: l.fullName }), 'w');
      setModalSuspend(null);
      loadData();
    } catch (err: any) {
      pop(`❌ ${err.message}`, 'e');
    } finally { setSuspendLoading(false); }
  }

  // ══════════════════════════════════════════════════════════
  // VALIDER TOUS — connecté à PATCH /livreurs/:id/valider
  // ══════════════════════════════════════════════════════════

  async function handleValiderTous() {
    const enAttente = livreurs.filter(l => l.status === 'pending');
    if (enAttente.length === 0) { pop(t('livreurs.quickActions.aucunEnAttente'), 'w'); return; }
    try {
      await Promise.all(enAttente.map(l => livreursApi.valider(l.id)));
      pop(t('livreurs.quickActions.validesToast', { count: enAttente.length }), 's');
      loadData();
    } catch (err: any) {
      pop(`❌ ${err.message}`, 'e');
    }
  }

  const s = {
    total:       stats?.total       ?? 0,
    actifs:      stats?.actifs      ?? 0,
    disponibles: stats?.disponibles ?? 0,
    enCourse:    stats?.enCourse    ?? 0,
    horsLigne:   stats?.horsLigne   ?? 0,
    enAttente:   stats?.enAttente   ?? 0,
    livrAuj:     stats?.livrAuj     ?? 0,
  };

  return (
    <div className={styles.page}>

      {/* HEADER */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.titre}>{t('livreurs.header.title')}</h1>
          <p className={styles.sousTitre}>{t('livreurs.header.subtitle')}</p>
        </div>
        <button className={styles.btnAjouter} onClick={() => setModalInviter(true)}>
          <i className="fas fa-user-plus" /> {t('livreurs.header.inviter')}
        </button>
      </div>

      {/* KPI CARDS */}
      <div className={styles.statsGrid}>
        <div className={`${styles.statCard} ${styles.statBlue}`}>
          <div className={styles.statIcon}><i className="fas fa-users" /></div>
          <div>
            <div className={styles.statVal}>{loading ? '…' : s.actifs}</div>
            <div className={styles.statLabel}>{t('livreurs.kpi.actifs')}</div>
            <div className={styles.statSub}>{t('livreurs.kpi.auTotal', { count: s.total })}</div>
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.statGreen}`}>
          {s.disponibles > 0 && <div className={styles.pulseDot} />}
          <div className={styles.statIcon}><i className="fas fa-circle-check" /></div>
          <div>
            <div className={styles.statVal}>{loading ? '…' : s.disponibles}</div>
            <div className={styles.statLabel}>{t('livreurs.kpi.disponibles')}</div>
            <div className={styles.statSub}>{t('livreurs.kpi.pretsALivrer')}</div>
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.statAmber}`}>
          <div className={styles.statIcon}><i className="fas fa-motorcycle" /></div>
          <div>
            <div className={styles.statVal}>{loading ? '…' : s.enCourse}</div>
            <div className={styles.statLabel}>{t('livreurs.kpi.enCourse')}</div>
            <div className={styles.statSub}>{t('livreurs.kpi.actuellement')}</div>
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.statViolet}`}>
          {s.enAttente > 0 && <div className={styles.pulseDot} />}
          <div className={styles.statIcon}><i className="fas fa-box" /></div>
          <div>
            <div className={styles.statVal}>{loading ? '…' : s.livrAuj}</div>
            <div className={styles.statLabel}>{t('livreurs.kpi.livraisonsAuj')}</div>
            <div className={styles.statSub}>{s.enAttente > 0 ? t('livreurs.kpi.enAttenteSub', { count: s.enAttente }) : t('livreurs.kpi.cumulees')}</div>
          </div>
        </div>
      </div>

      {/* LAYOUT */}
      <div className={styles.layout}>
        <div className={styles.colMain}>

          {/* TOOLBAR */}
          <div className={styles.toolbar}>
            <div className={styles.filtresBtns}>
              {([
                { val:'tous',        label:t('livreurs.filters.tous'),        count: s.total       },
                { val:'available',   label:t('livreurs.filters.disponibles'), count: s.disponibles },
                { val:'on_delivery', label:t('livreurs.filters.enCourse'),    count: s.enCourse    },
                { val:'offline',     label:t('livreurs.filters.horsLigne'),   count: s.horsLigne   },
              ] as const).map(f => (
                <button key={f.val}
                  className={`${styles.filtreBtn} ${filtreAvail === f.val ? styles.filtreBtnActive : ''}`}
                  onClick={() => setFiltreAvail(f.val as any)}>
                  {f.label}
                  <span style={{
                    padding: '1px 6px', borderRadius: 10, fontSize: 10.5, fontWeight: 700,
                    background: filtreAvail === f.val ? 'rgba(255,255,255,.2)' : 'var(--g100)',
                    color:      filtreAvail === f.val ? '#fff' : 'var(--t3)',
                  }}>{f.count}</span>
                </button>
              ))}
            </div>
            <div className={styles.toolbarRight}>
              <select className={styles.filtreSelect} value={filtreStatut} onChange={e => setFiltreStatut(e.target.value as any)}>
                <option value="tous">{t('livreurs.statutSelect.tousStatuts')}</option>
                <option value="active">{t('livreurs.statutSelect.actifs')}</option>
                <option value="pending">{t('livreurs.statutSelect.enAttente')}</option>
                <option value="suspended">{t('livreurs.statutSelect.suspendus')}</option>
              </select>
              <div className={styles.searchWrap}>
                <i className="fas fa-magnifying-glass" />
                <input className={styles.searchInput} placeholder={t('livreurs.search')} value={search} onChange={e => setSearch(e.target.value)} />
                {search && <button className={styles.clearBtn} onClick={() => setSearch('')}><i className="fas fa-xmark" /></button>}
              </div>
              <div className={styles.vueBtns}>
                <button className={`${styles.vueBtn} ${vue === 'grille' ? styles.vueBtnActive : ''}`} onClick={() => setVue('grille')}><i className="fas fa-grid-2" /></button>
                <button className={`${styles.vueBtn} ${vue === 'liste'  ? styles.vueBtnActive : ''}`} onClick={() => setVue('liste')}><i className="fas fa-list" /></button>
              </div>
            </div>
          </div>

          {filtres.length > 0 && (
            <div className={styles.compteur}>
              {t('livreurs.compteur', { count: filtres.length })}
              {filtreAvail !== 'tous' && ` · ${t(`livreurs.availLower.${filtreAvail}`)}`}
            </div>
          )}

          {/* CONTENU */}
          {loading ? (
            <div style={{ textAlign:'center', padding:'48px 0', color:'var(--t3)' }}>
              <i className="fas fa-spinner fa-spin" style={{ fontSize:28, display:'block', marginBottom:12 }} />
              {t('livreurs.loading')}
            </div>
          ) : filtres.length === 0 ? (
            <div className={styles.vide}>
              <span className={styles.videIco}>🛵</span>
              <strong>{t('livreurs.empty.title')}</strong>
              <span>{t('livreurs.empty.sub')}</span>
              <button className={styles.btnAjouter} onClick={() => setModalInviter(true)}><i className="fas fa-user-plus" /> {t('livreurs.empty.inviter')}</button>
            </div>
          ) : vue === 'grille' ? (
            <div className={styles.grille}>
              {filtres.map(l => (
                <div key={l.id} className={`${styles.card} ${l.status === 'suspended' ? styles.cardSuspended : ''}`}>
                  <div className={styles.cardHead}>
                    <div className={styles.cardAvatar} style={{ position: 'relative' }}>
                      <span style={{ fontSize: 22 }}>{l.avatarEmoji}</span>
                      <span style={{
                        position: 'absolute', bottom: -2, right: -2,
                        width: 12, height: 12, borderRadius: '50%',
                        background: AVAIL_DOT[l.availability as Availability],
                        border: '2px solid #fff',
                      }} />
                    </div>
                    <div className={styles.cardBadges}>
                      <BadgeAvail availability={l.availability as Availability} />
                      {l.status !== 'active' && (
                        <span className={`${styles.statutBadge} ${STATUS_CLS[l.status as LivreurStatus]}`}>
                          {getStatusLabel(t)[l.status as LivreurStatus]}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className={styles.cardBody}>
                    <div className={styles.cardName}>{l.fullName}</div>
                    <div className={styles.cardVille}><i className="fas fa-map-pin" /> {l.zone ?? t('livreurs.card.zoneNonDefinie')}</div>
                    <div className={styles.cardZone} style={{ color:'var(--t2)', fontWeight:600 }}>
                      {l.vehicleEmoji} {vehicleLabel(l.vehicleType as VehicleType, t)}
                      {l.vehiclePlate && <span style={{ color:'var(--t3)', fontWeight:400 }}> · {l.vehiclePlate}</span>}
                    </div>
                  </div>

                  <div className={styles.cardStats}>
                    <div className={styles.cardStat}>
                      <i className="fas fa-star" style={{ color:'var(--t2)', fontSize:11 }} />
                      <strong>{l.averageRating === 0 ? t('livreurs.na') : l.averageRating.toFixed(1)}</strong>
                      <span>{t('livreurs.card.note')}</span>
                    </div>
                    <div className={styles.cardStat}>
                      <i className="fas fa-box" style={{ color:'var(--t2)', fontSize:11 }} />
                      <strong>{l.totalDeliveries}</strong>
                      <span>{t('livreurs.card.courses')}</span>
                    </div>
                    <div className={styles.cardStat}>
                      <i className="fas fa-calendar-day" style={{ color:'var(--t2)', fontSize:11 }} />
                      <strong>{l.todayDeliveries}</strong>
                      <span>{t('livreurs.card.auj')}</span>
                    </div>
                  </div>

                  <div className={styles.cardActivity}>
                    <div className={styles.actDot} style={{ background: AVAIL_DOT[l.availability as Availability] }} />
                    <span>{l.lastActivity}</span>
                    <span className={styles.actTime}>{l.lastActivityAt}</span>
                  </div>

                  <div className={styles.cardActions}>
                    <button className={styles.cardBtnPrimary} onClick={() => setModalProfil(l)}>
                      <i className="fas fa-eye" /> {t('livreurs.card.voir')}
                    </button>
                    <button className={styles.cardBtnIcon} onClick={() => setModalContact(l)} title={t('livreurs.card.contacter')}>
                      <i className="fas fa-envelope" />
                    </button>
                    <a
                      href={`https://wa.me/${(l.phone ?? '').replace(/\s+/g, '')}`}
                      target="_blank" rel="noreferrer"
                      className={styles.cardBtnIcon} title={t('livreurs.card.whatsapp')}
                    >
                      <i className="fab fa-whatsapp" style={{ color: 'var(--t2)', fontSize: 14 }} />
                    </a>
                    <a href={`tel:${l.phone}`} className={styles.cardBtnIcon} title={t('livreurs.card.appeler')}>
                      <i className="fas fa-phone" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.listeWrap}>
              <table className={styles.liste}>
                <thead>
                  <tr>
                    {[t('livreurs.table.livreur'),t('livreurs.table.zone'),t('livreurs.table.vehicule'),t('livreurs.table.note'),t('livreurs.table.courses'),t('livreurs.table.auj'),t('livreurs.table.disponibilite'),t('livreurs.table.statut'),t('livreurs.table.actions')].map(h => (
                      <th key={h} className={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtres.map(l => (
                    <tr key={l.id} className={`${styles.tr} ${l.status === 'suspended' ? styles.trSuspended : ''}`}>
                      <td className={styles.td}>
                        <div className={styles.listCell}>
                          <div className={styles.listAvatar} style={{ position: 'relative' }}>
                            <span style={{ fontSize: 18 }}>{l.avatarEmoji}</span>
                            <span style={{
                              position: 'absolute', bottom: -1, right: -1,
                              width: 10, height: 10, borderRadius: '50%',
                              background: AVAIL_DOT[l.availability as Availability],
                              border: '2px solid #fff',
                            }} />
                          </div>
                          <div>
                            <div className={styles.listNom}>{l.fullName}</div>
                            <div className={styles.listEmail}>{l.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className={styles.td}><div className={styles.listVille}><i className="fas fa-map-pin" /> {l.zone ?? '–'}</div></td>
                      <td className={styles.td}><span style={{ fontSize:12, color:'var(--t2)', fontWeight:600 }}>{l.vehicleEmoji} {vehicleLabel(l.vehicleType as VehicleType, t)}</span></td>
                      <td className={styles.td}><div className={styles.listRating}><i className="fas fa-star" style={{ color:'var(--t2)', fontSize:11 }} /><strong>{l.averageRating === 0 ? t('livreurs.na') : l.averageRating.toFixed(1)}</strong></div></td>
                      <td className={styles.td}><strong style={{ color:'var(--navy)', fontFamily:'var(--fd)' }}>{l.totalDeliveries}</strong></td>
                      <td className={styles.td}><strong style={{ color:'var(--t2)', fontFamily:'var(--fd)' }}>{l.todayDeliveries}</strong></td>
                      <td className={styles.td}><BadgeAvail availability={l.availability as Availability} /></td>
                      <td className={styles.td}><span className={`${styles.statutBadge} ${STATUS_CLS[l.status as LivreurStatus]}`}>{getStatusLabel(t)[l.status as LivreurStatus]}</span></td>
                      <td className={styles.td}>
                        <div className={styles.listActions}>
                          <button className={styles.listeBtn} onClick={() => setModalProfil(l)} title={t('livreurs.card.voir')}><i className="fas fa-eye" /></button>
                          <button className={styles.listeBtn} onClick={() => setModalContact(l)} title={t('livreurs.card.contacter')}><i className="fas fa-envelope" /></button>
                          <a href={`tel:${l.phone}`} className={styles.listeBtn} title={t('livreurs.card.appeler')}><i className="fas fa-phone" /></a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* PANNEAU LATÉRAL */}
        <div className={styles.colSide}>

          {/* Couverture zones */}
          <div className={styles.sideCard}>
            <div className={styles.sideCardHeader}><div className={styles.sideCardTitle}><i className="fas fa-map" /> {t('livreurs.sidePanel.couvertureZone')}</div></div>
            <div className={styles.sideCardBody}>
              {zones.length === 0 && !loading && <div style={{ color:'var(--t3)', fontSize:13 }}>{t('livreurs.sidePanel.aucuneZone')}</div>}
              {zones.map((z, i) => (
                <div key={i} className={styles.zoneRow}>
                  <div className={styles.zoneTop}>
                    <span className={styles.zoneNom}>{z.zone}</span>
                    <div className={styles.zoneNums}>
                      <span style={{ fontWeight:800, color:z.color }}>{z.orders}</span>
                      <span className={styles.zonePct}>{z.pct}%</span>
                    </div>
                  </div>
                  <div className={styles.zoneBar}><div className={styles.zoneBarFill} style={{ width:`${z.pct}%`, background:z.color }} /></div>
                </div>
              ))}
            </div>
          </div>

          {/* Activité récente */}
          <div className={styles.sideCard}>
            <div className={styles.sideCardHeader}><div className={styles.sideCardTitle}><i className="fas fa-clock-rotate-left" /> {t('livreurs.sidePanel.activiteRecente')}</div></div>
            <div className={styles.sideCardBody}>
              {activite.length === 0 && !loading && <div style={{ color:'var(--t3)', fontSize:13 }}>{t('livreurs.sidePanel.aucuneActivite')}</div>}
              {activite.map((l, i) => (
                <div key={i} className={`${styles.actItem} ${i < 4 ? styles.actItemBorder : ''}`}>
                  <div className={styles.actEmoji}>{l.avatarEmoji}</div>
                  <div className={styles.actContent}>
                    <div className={styles.actNom}>{l.fullName}</div>
                    <div className={styles.actAction}>{l.lastActivity}</div>
                    <div className={styles.actTime2}>{l.lastActivityAt}</div>
                  </div>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50', flexShrink: 0, marginTop: 5,
                    background: AVAIL_DOT[l.availability as Availability],
                  }} />
                </div>
              ))}
            </div>
          </div>

          {/* Actions rapides */}
          <div className={styles.sideCard}>
            <div className={styles.sideCardHeader}><div className={styles.sideCardTitle}><i className="fas fa-bolt" /> {t('livreurs.sidePanel.actionsRapides')}</div></div>
            <div className={styles.sideCardBody}>
              {[
                { ico:'📢', l:t('livreurs.quickActions.diffuserMission'),       action: () => pop(t('livreurs.quickActions.diffusionToast'), 's')        },
                { ico:'📊', l:t('livreurs.quickActions.rapportPerf'),       action: () => pop(t('livreurs.quickActions.rapportToast'), 's')      },
                { ico:'🗺️', l:t('livreurs.quickActions.voirCarte'),    action: () => pop(t('livreurs.quickActions.carteToast'), 's')               },
                { ico:'✅', l:t('livreurs.quickActions.validerEnAttente', { count: s.enAttente }), action: handleValiderTous                   },
              ].map((a, i) => (
                <button key={i} className={styles.quickAction} onClick={a.action}>
                  <span className={styles.quickIco}>{a.ico}</span>
                  <span className={styles.quickLabel}>{a.l}</span>
                  <i className="fas fa-arrow-right" style={{ color:'var(--t4)', fontSize:11 }} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MODALES */}
      {modalProfil && (
        <ModalProfil
          l={modalProfil}
          onClose={() => setModalProfil(null)}
          onContact={() => { setModalProfil(null); setModalContact(modalProfil); }}
          onSuspend={() => { setModalProfil(null); setModalSuspend(modalProfil); }}
        />
      )}
      {modalInviter && (
        <ModalInviter onClose={() => setModalInviter(false)} onDone={loadData} />
      )}
      {modalContact && (
        <ModalContacter l={modalContact} onClose={() => setModalContact(null)} />
      )}
      {modalSuspend && (
        <ModalSuspendre
          l={modalSuspend}
          onClose={() => setModalSuspend(null)}
          onConfirm={() => handleSuspendre(modalSuspend)}
          loading={suspendLoading}
        />
      )}
    </div>
  );
}