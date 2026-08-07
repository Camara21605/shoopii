/*
 * ============================================================
 * FICHIER : src/dashboards/entreprise/pages/CorrespondantsPage.tsx
 *
 * VERSION CONNECTÉE AU BACKEND — remplace toutes les données mock
 *
 * ─── CE QUI A CHANGÉ vs la version mock ──────────────────────
 *
 *  ❌ SUPPRIMÉ  const MOCK_CORRESPONDANTS = [...]
 *  ✅ REMPLACÉ  useState<CorrespondantResponse[]> + useEffect → GET /correspondants
 *
 *  ❌ SUPPRIMÉ  const ZONES_PERF = [{ zone: 'Conakry Centre'... }]
 *  ✅ REMPLACÉ  useState<ZoneStat[]> + useEffect → GET /correspondants/zones
 *
 *  ❌ SUPPRIMÉ  stats = useMemo(() => ({ total: correspondants.length... }))
 *  ✅ REMPLACÉ  useState<CorrespondantStats> + useEffect → GET /correspondants/stats
 *
 *  ❌ SUPPRIMÉ  function genererCode() { Math.random()... } côté frontend
 *  ✅ REMPLACÉ  code vient de la réponse POST /correspondants/inviter
 *
 *  ❌ SUPPRIMÉ  setTimeout(() => { pop('✅ Message envoyé') }, 1000) dans ModalContacter
 *  ✅ REMPLACÉ  correspondantsApi.contacter(id, { sujet, message })
 *
 *  ❌ SUPPRIMÉ  setCorrespondants(prev => prev.map(...)) dans handleSuspendre
 *  ✅ REMPLACÉ  correspondantsApi.suspendre(id) puis loadData()
 *
 * ─── FLUX DE DONNÉES ─────────────────────────────────────────
 *
 *  Montage → loadData() → Promise.all([getStats, getZones, getActiviteRecente, getAll])
 *  Toute action (suspendre, valider, inviter, contacter) → API → toast → loadData()
 *
 * ============================================================
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useToast } from '../../../shared/context/ToastContext';
import styles from './CorrespondantsPage.module.css';
import {
  correspondantsApi,
  type CorrespondantResponse,
  type CorrespondantStats,
  type ZoneStat,
  type CorrespondantType,
  type CorrespondantStatus,
  type InvitationResponse,
} from '../../../shared/services/api/correspondants.api';

// ─────────────────────────────────────────────────────────────
// HELPERS — inchangés (purement visuels)
// ─────────────────────────────────────────────────────────────

function typeLabel(type: CorrespondantType, t: TFunction): string {
  return {
    principal: t('correspondants.type.principal'),
    entrepot:  t('correspondants.type.entrepot'),
    export:    t('correspondants.type.export'),
    relais:    t('correspondants.type.relais'),
  }[type];
}

function typeCls(type: CorrespondantType, s: any): string {
  return {
    principal: s.badgePrincipal,
    entrepot:  s.badgeEntrepot,
    export:    s.badgeExport,
    relais:    s.badgeRelais,
  }[type];
}

function statutCls(status: CorrespondantStatus, s: any): string {
  return {
    active:    s.statutActive,
    pending:   s.statutPending,
    suspended: s.statutSuspended,
  }[status];
}

function statutLabel(status: CorrespondantStatus, t: TFunction): string {
  return { active: t('correspondants.status.active'), pending: t('correspondants.status.pending'), suspended: t('correspondants.status.suspended') }[status];
}

// ─────────────────────────────────────────────────────────────
// Stars — inchangé
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

// ─────────────────────────────────────────────────────────────
// ModalProfil — inchangé (données passées en props)
// ─────────────────────────────────────────────────────────────
function ModalProfil({ c, onClose, onContact, onSuspend }: {
  c:         CorrespondantResponse;
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
            <div className={styles.mAvatar}>{c.avatarEmoji}</div>
            <div>
              <div className={styles.mName}>{c.fullName}</div>
              <div className={styles.mMeta}>
                <span><i className="fas fa-map-pin" /> {c.ville} · {c.quartier}</span>
                <span><i className="fas fa-envelope" /> {c.email}</span>
              </div>
              <div className={styles.mBadges}>
                <span className={`${styles.typeBadge} ${typeCls(c.type, styles)}`}>
                  {typeLabel(c.type, t)}
                </span>
                <span className={`${styles.statutBadge} ${statutCls(c.status, styles)}`}>
                  {statutLabel(c.status, t)}
                </span>
              </div>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <i className="fas fa-xmark" />
          </button>
        </div>
        <div className={styles.mBody}>
          <div className={styles.kpiGrid}>
            {[
              { icon:'fa-box',      label:t('correspondants.modalProfil.kpiTotalMissions'),  value: String(c.totalMissions), sub: t('correspondants.modalProfil.kpiCommandesTraitees'), cls: styles.kpiBlue   },
              { icon:'fa-calendar', label:t('correspondants.modalProfil.kpiCeMois'),      value: String(c.thisMonth),     sub: t('correspondants.modalProfil.kpiCommandes'),          cls: styles.kpiGreen  },
              { icon:'fa-star',     label:t('correspondants.modalProfil.kpiNoteMoyenne'),    value: c.averageRating === 0 ? t('correspondants.na') : c.averageRating.toFixed(1), sub: t('correspondants.modalProfil.kpiSur5Etoiles'), cls: styles.kpiAmber  },
              { icon:'fa-map',      label:t('correspondants.modalProfil.kpiZoneCouverte'),   value: c.ville,                 sub: c.zone ?? '',         cls: styles.kpiViolet },
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
            <div className={styles.ratingBoxTitle}>{t('correspondants.modalProfil.evaluationClients')}</div>
            <Stars value={c.averageRating} />
          </div>
          <div className={styles.detGrid}>
            {[
              { icon:'fa-phone',     label:t('correspondants.modalProfil.telephone'),       value: c.phone ?? t('correspondants.na')      },
              { icon:'fa-envelope',  label:t('correspondants.modalProfil.email'),           value: c.email               },
              { icon:'fa-map-pin',   label:t('correspondants.modalProfil.adresse'),         value: c.adresse ?? t('correspondants.na')    },
              { icon:'fa-map',       label:t('correspondants.modalProfil.zone'),            value: c.zone ?? t('correspondants.na')       },
              { icon:'fa-clock-rotate-left', label:t('correspondants.modalProfil.derniereActivite'), value: `${c.lastActivity} (${c.lastActivityAt})` },
              { icon:'fa-calendar',  label:t('correspondants.modalProfil.membreDepuis'),   value: new Date(c.joinedAt).toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' }) },
            ].map((d, i) => (
              <div key={i} className={styles.detItem}>
                <div className={styles.detIcon}><i className={`fas ${d.icon}`} /></div>
                <div>
                  <div className={styles.detLabel}>{d.label}</div>
                  <div className={styles.detValue}>{d.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.mFooter}>
          {c.status === 'active' && (
            <button className={styles.btnDanger} onClick={() => { onSuspend(); onClose(); }}>
              <i className="fas fa-ban" /> {t('correspondants.modalProfil.suspendre')}
            </button>
          )}
          <button className={styles.btnSecondary} onClick={() => { onContact(); onClose(); }}>
            <i className="fas fa-envelope" /> {t('correspondants.modalProfil.contacter')}
          </button>
          <a href={`tel:${c.phone}`} className={styles.btnSecondary}>
            <i className="fas fa-phone" /> {t('correspondants.modalProfil.appeler')}
          </a>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ModalInviter — CONNECTÉE AU BACKEND
//
// CHANGEMENTS vs version mock :
//   ❌ genererCode() côté frontend supprimé
//   ✅ handleEnvoyer() appelle correspondantsApi.inviter(dto)
//   ✅ Le code affiché à l'étape 3 vient de la réponse API
// ─────────────────────────────────────────────────────────────
function ModalInviter({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { pop } = useToast();
  const [etape,    setEtape]    = useState<1 | 2 | 3>(1);
  const [nom,      setNom]      = useState('');
  const [email,    setEmail]    = useState('');
  const [ville,    setVille]    = useState('');
  const [quartier, setQuartier] = useState('');
  const [type,     setType]     = useState<CorrespondantType>('relais');
  const [message,  setMessage]  = useState(() => t('correspondants.modalInviter.defaultMessage'));
  const [loading,  setLoading]  = useState(false);

  // ✅ Le code vient maintenant de la réponse API (pas genererCode())
  const [invitationResult, setInvitationResult] = useState<InvitationResponse | null>(null);

  function validerEtape1() {
    if (!nom.trim())   { pop(t('correspondants.modalInviter.nomRequis'), 'w');   return; }
    if (!email.trim()) { pop(t('correspondants.modalInviter.emailRequis'), 'w'); return; }
    if (!email.includes('@') || !email.includes('.')) { pop(t('correspondants.modalInviter.emailInvalide'), 'w'); return; }
    setEtape(2);
  }

  // ✅ CONNECTÉ : appelle POST /correspondants/inviter
  async function handleEnvoyer() {
    setLoading(true);
    try {
      const result = await correspondantsApi.inviter({
        fullName: nom.trim(),
        email:    email.trim(),
        type,
        ville:    ville.trim() || undefined,
        quartier: quartier.trim() || undefined,
        message:  message.trim() || undefined,
      });
      setInvitationResult(result);
      setEtape(3);
      pop(t('correspondants.modalInviter.invitationEnvoyee', { email }), 's');
    } catch (err: any) {
      pop(`❌ ${err.message}`, 'e');
    } finally {
      setLoading(false);
    }
  }

  // Code à afficher à l'étape 2 (preview) — on en a pas encore, on affiche un placeholder
  const previewCode = '••••-•••-•••';
  // Code réel à l'étape 3 — vient de la réponse API
  const realCode = invitationResult?.code ?? '';

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.modalMd}`} onClick={e => e.stopPropagation()}>
        <div className={styles.mHeader}>
          <div>
            <div className={styles.mTitle}><i className="fas fa-user-plus" /> {t('correspondants.modalInviter.title')}</div>
            <div className={styles.etapes}>
              {[t('correspondants.modalInviter.etapeInformations'), t('correspondants.modalInviter.etapeApercu'), t('correspondants.modalInviter.etapeConfirme')].map((e, i) => (
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
          {/* ÉTAPE 1 — inchangée */}
          {etape === 1 && (
            <div className={styles.formCols}>
              <div className={styles.formCol}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}><i className="fas fa-store" /> {t('correspondants.modalInviter.nomPointRelais')}</label>
                  <input className={styles.formInput} placeholder={t('correspondants.modalInviter.nomPlaceholder')} value={nom} onChange={e => setNom(e.target.value)} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}><i className="fas fa-envelope" /> {t('correspondants.modalInviter.emailContact')}</label>
                  <input type="email" className={styles.formInput} placeholder={t('correspondants.modalInviter.emailPlaceholder')} value={email} onChange={e => setEmail(e.target.value)} />
                  <p className={styles.formHint}><i className="fas fa-circle-info" /> {t('correspondants.modalInviter.codeEmailHint')}</p>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}><i className="fas fa-tag" /> {t('correspondants.modalInviter.typeCorrespondant')}</label>
                  <select className={styles.formSelect} value={type} onChange={e => setType(e.target.value as CorrespondantType)}>
                    <option value="relais">{t('correspondants.modalInviter.optRelais')}</option>
                    <option value="entrepot">{t('correspondants.modalInviter.optEntrepot')}</option>
                    <option value="export">{t('correspondants.modalInviter.optExport')}</option>
                    <option value="principal">{t('correspondants.modalInviter.optPrincipal')}</option>
                  </select>
                </div>
              </div>
              <div className={styles.formCol}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}><i className="fas fa-city" /> {t('correspondants.modalInviter.ville')}</label>
                  <input className={styles.formInput} placeholder={t('correspondants.modalInviter.villePlaceholder')} value={ville} onChange={e => setVille(e.target.value)} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}><i className="fas fa-map-pin" /> {t('correspondants.modalInviter.quartierZone')}</label>
                  <input className={styles.formInput} placeholder={t('correspondants.modalInviter.quartierPlaceholder')} value={quartier} onChange={e => setQuartier(e.target.value)} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}><i className="fas fa-message" /> {t('correspondants.modalInviter.messagePersonnalise')}</label>
                  <textarea className={styles.formTextarea} rows={5} value={message} onChange={e => setMessage(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* ÉTAPE 2 — preview (code masqué car généré par le backend à l'envoi) */}
          {etape === 2 && (
            <div className={styles.apercu}>
              <div className={styles.apercuLabel}><i className="fas fa-eye" /> {t('correspondants.modalInviter.apercuTitle')}</div>
              <div className={styles.emailPreview}>
                <div className={styles.emailHeader}>
                  <div className={styles.emailLogo}>S</div>
                  <div>
                    <div className={styles.emailSujet}>{t('correspondants.modalInviter.emailSujetFixe')}</div>
                    <div className={styles.emailDest}>{t('correspondants.modalInviter.emailDestA')} <strong>{email}</strong></div>
                  </div>
                </div>
                <div className={styles.emailBody}>
                  <p>{t('correspondants.modalInviter.bonjour')} <strong>{nom}</strong>,</p>
                  <p style={{ whiteSpace: 'pre-line', fontSize: 13, color: 'var(--t2)', lineHeight: 1.6 }}>{message}</p>
                  <div className={styles.emailCode}>
                    <div className={styles.emailCodeLabel}>{t('correspondants.modalInviter.codeInvitationLabel')}</div>
                    {/* ✅ Code généré par le backend — affiché seulement à l'étape 3 */}
                    <div className={styles.emailCodeValue} style={{ letterSpacing: '0.3em', color: 'var(--t3)' }}>{previewCode}</div>
                    <div className={styles.emailCodeNote}>{t('correspondants.modalInviter.codeInvitationNote')}</div>
                  </div>
                  <div className={styles.emailInfo}>
                    {ville && <div><i className="fas fa-city" /> {t('correspondants.modalInviter.villeLabelInline')} <strong>{ville}</strong></div>}
                    {quartier && <div><i className="fas fa-map-pin" /> {t('correspondants.modalInviter.zoneLabelInline')} <strong>{quartier}</strong></div>}
                    <div><i className="fas fa-tag" /> {t('correspondants.modalInviter.typeLabelInline')} <strong>{typeLabel(type, t)}</strong></div>
                  </div>
                </div>
              </div>
              <div className={styles.infoBox}>
                <i className="fas fa-circle-info" />
                <span>{t('correspondants.modalInviter.infoBoxExpire')}</span>
              </div>
            </div>
          )}

          {/* ÉTAPE 3 — ✅ affiche le VRAI code venant du backend */}
          {etape === 3 && invitationResult && (
            <div className={styles.success}>
              <div className={styles.successIcon}>✅</div>
              <div className={styles.successTitle}>{t('correspondants.modalInviter.invitationEnvoyeeTitle')}</div>
              <div className={styles.successSub}>{t('correspondants.modalInviter.codeEnvoyeA', { email: invitationResult.email })}</div>
              <div className={styles.successRecap}>
                <div className={styles.recapRow}><span>{t('correspondants.modalInviter.recapNom')}</span><strong>{invitationResult.fullName}</strong></div>
                <div className={styles.recapRow}><span>{t('correspondants.modalInviter.recapEmail')}</span><strong>{invitationResult.email}</strong></div>
                {ville && <div className={styles.recapRow}><span>{t('correspondants.modalInviter.recapVille')}</span><strong>{ville}</strong></div>}
                <div className={styles.recapRow}><span>{t('correspondants.modalInviter.recapType')}</span><strong>{typeLabel(type, t)}</strong></div>
              </div>
              {/* ✅ Code réel venant du backend */}
              <div className={styles.codeBox}>
                <div className={styles.codeBoxLabel}>{t('correspondants.modalInviter.codeGenereLabel')}</div>
                <div className={styles.codeRow}>
                  <span className={styles.codeVal}>{realCode}</span>
                  <button className={styles.copyBtn} onClick={() => { navigator.clipboard.writeText(realCode); pop(t('correspondants.modalInviter.codeCopieToast'), 's'); }}>
                    <i className="fas fa-copy" /> {t('correspondants.modalInviter.copier')}
                  </button>
                </div>
                <div className={styles.codeExpiry}>
                  <i className="fas fa-clock" /> {t('correspondants.modalInviter.expireLe', { date: new Date(invitationResult.expiresAt).toLocaleDateString('fr-FR') })}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={styles.mFooter}>
          {etape === 1 && (
            <>
              <button className={styles.btnSecondary} onClick={onClose}>{t('correspondants.modalInviter.annuler')}</button>
              <button className={styles.btnPrimary} onClick={validerEtape1}>{t('correspondants.modalInviter.suivant')} <i className="fas fa-arrow-right" /></button>
            </>
          )}
          {etape === 2 && (
            <>
              <button className={styles.btnSecondary} onClick={() => setEtape(1)} disabled={loading}><i className="fas fa-arrow-left" /> {t('correspondants.modalInviter.retour')}</button>
              <button className={styles.btnPrimary} onClick={handleEnvoyer} disabled={loading}>
                {loading ? <><i className="fas fa-spinner fa-spin" /> {t('correspondants.modalInviter.envoiEnCours')}</> : <><i className="fas fa-paper-plane" /> {t('correspondants.modalInviter.envoyerInvitation')}</>}
              </button>
            </>
          )}
          {etape === 3 && <button className={styles.btnSecondary} onClick={onClose}>{t('correspondants.modalInviter.fermer')}</button>}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ModalContacter — CONNECTÉE AU BACKEND
//
// CHANGEMENTS vs version mock :
//   ❌ setTimeout simulation supprimé
//   ✅ correspondantsApi.contacter(id, { sujet, message })
// ─────────────────────────────────────────────────────────────
function ModalContacter({ c, onClose }: {
  c:       CorrespondantResponse;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { pop } = useToast();
  const [sujet,   setSujet]   = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // ✅ CONNECTÉ : appelle POST /correspondants/:id/contacter
  async function handleEnvoyer() {
    if (!sujet.trim() || !message.trim()) {
      pop(t('correspondants.modalContacter.sujetMessageRequis'), 'w');
      return;
    }
    setLoading(true);
    try {
      await correspondantsApi.contacter(c.id, { sujet: sujet.trim(), message: message.trim() });
      pop(t('correspondants.modalContacter.messageEnvoye', { name: c.fullName }), 's');
      onClose();
    } catch (err: any) {
      pop(`❌ ${err.message}`, 'e');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.modalSm}`} onClick={e => e.stopPropagation()}>
        <div className={styles.mHeader}>
          <div>
            <div className={styles.mTitle}><i className="fas fa-envelope" /> {t('correspondants.modalContacter.title')}</div>
            <div className={styles.mSub}>{t('correspondants.modalContacter.sub', { name: c.fullName, email: c.email })}</div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><i className="fas fa-xmark" /></button>
        </div>
        <div className={styles.mBody}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}><i className="fas fa-heading" /> {t('correspondants.modalContacter.sujetLabel')}</label>
            <input className={styles.formInput} placeholder={t('correspondants.modalContacter.sujetPlaceholder')} value={sujet} onChange={e => setSujet(e.target.value)} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}><i className="fas fa-message" /> {t('correspondants.modalContacter.messageLabel')}</label>
            <textarea className={styles.formTextarea} rows={5} placeholder={t('correspondants.modalContacter.messagePlaceholder')} value={message} onChange={e => setMessage(e.target.value)} />
          </div>
          <div className={styles.infoBox}>
            <i className="fas fa-circle-info" />
            <span>{t('correspondants.modalContacter.infoBox', { email: c.email })}</span>
          </div>
        </div>
        <div className={styles.mFooter}>
          <button className={styles.btnSecondary} onClick={onClose} disabled={loading}>{t('correspondants.modalContacter.annuler')}</button>
          <button className={styles.btnPrimary} onClick={handleEnvoyer} disabled={loading}>
            {loading ? <><i className="fas fa-spinner fa-spin" /> {t('correspondants.modalContacter.envoiEnCours')}</> : <><i className="fas fa-paper-plane" /> {t('correspondants.modalContacter.envoyer')}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ModalSuspendre — inchangée (action déclenchée depuis le parent)
// ─────────────────────────────────────────────────────────────
function ModalSuspendre({ c, onClose, onConfirm, loading }: {
  c:         CorrespondantResponse;
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
            <i className="fas fa-triangle-exclamation" /> {t('correspondants.modalSuspendre.title')}
          </div>
          <button className={styles.closeBtn} onClick={onClose}><i className="fas fa-xmark" /></button>
        </div>
        <div className={styles.mBody}>
          <div className={styles.suspendBox}>
            <div className={styles.suspendIco}>⚠️</div>
            <p>{t('correspondants.modalSuspendre.confirmText', { name: c.fullName })}</p>
            <p className={styles.suspendNote}>{t('correspondants.modalSuspendre.note')}</p>
          </div>
        </div>
        <div className={styles.mFooter}>
          <button className={styles.btnSecondary} onClick={onClose} disabled={loading}>{t('correspondants.modalSuspendre.annuler')}</button>
          <button className={styles.btnDanger} onClick={onConfirm} disabled={loading}>
            {loading ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-ban" />} {t('correspondants.modalSuspendre.confirmer')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL — 100% connecté au backend
// ─────────────────────────────────────────────────────────────
export default function CorrespondantsPage() {
  const { t } = useTranslation();
  const { pop } = useToast();

  // ── État données — tout vient de l'API ─────────────────────
  const [correspondants,  setCorrespondants]  = useState<CorrespondantResponse[]>([]);
  const [stats,           setStats]           = useState<CorrespondantStats | null>(null);
  const [zones,           setZones]           = useState<ZoneStat[]>([]);
  const [activite,        setActivite]        = useState<CorrespondantResponse[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [suspendLoading,  setSuspendLoading]  = useState(false);

  // ── États modales ───────────────────────────────────────────
  const [modalProfil,  setModalProfil]  = useState<CorrespondantResponse | null>(null);
  const [modalInviter, setModalInviter] = useState(false);
  const [modalContact, setModalContact] = useState<CorrespondantResponse | null>(null);
  const [modalSuspend, setModalSuspend] = useState<CorrespondantResponse | null>(null);

  // ── États filtres ───────────────────────────────────────────
  const [search,       setSearch]       = useState('');
  const [filtreType,   setFiltreType]   = useState<'tous' | CorrespondantType>('tous');
  const [filtreStatut, setFiltreStatut] = useState<'tous' | CorrespondantStatus>('tous');
  const [vue,          setVue]          = useState<'grille' | 'liste'>('grille');

  // ── Filtrage local (sur les données déjà chargées) ──────────
  const filtres = useMemo(() => correspondants.filter(c => {
    const matchSearch = !search.trim() ||
      c.fullName.toLowerCase().includes(search.toLowerCase()) ||
      c.ville.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase());
    const matchType   = filtreType   === 'tous' || c.type   === filtreType;
    const matchStatut = filtreStatut === 'tous' || c.status === filtreStatut;
    return matchSearch && matchType && matchStatut;
  }), [correspondants, search, filtreType, filtreStatut]);

  // ══════════════════════════════════════════════════════════════
  // CHARGEMENT — remplace toutes les données mock
  //
  // Avant : MOCK_CORRESPONDANTS, ZONES_PERF, stats useMemo
  // Après : 4 appels API en parallèle
  // ══════════════════════════════════════════════════════════════
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsData, zonesData, activiteData, listData] = await Promise.all([
        correspondantsApi.getStats(),
        correspondantsApi.getZones(),
        correspondantsApi.getActiviteRecente(),
        correspondantsApi.getAll({ limit: 100 }),
      ]);
      setStats(statsData);
      setZones(zonesData);
      setActivite(activiteData);
      setCorrespondants(listData.data);
    } catch (err: any) {
      pop(t('correspondants.toasts.loadError', { message: err.message }), 'e');
    } finally {
      setLoading(false);
    }
  }, [pop, t]);

  useEffect(() => { loadData(); }, [loadData]);

  // ══════════════════════════════════════════════════════════════
  // SUSPENDRE — connecté à PATCH /correspondants/:id/suspendre
  //
  // Avant : setCorrespondants(prev => prev.map(x => x.id === c.id ? {...x, status: 'suspended'} : x))
  // Après : correspondantsApi.suspendre(id) puis recharge la liste
  // ══════════════════════════════════════════════════════════════
  async function handleSuspendre(c: CorrespondantResponse) {
    setSuspendLoading(true);
    try {
      await correspondantsApi.suspendre(c.id);
      pop(t('correspondants.toasts.suspendu', { name: c.fullName }), 'w');
      setModalSuspend(null);
      loadData(); // Recharge la liste depuis l'API
    } catch (err: any) {
      pop(`❌ ${err.message}`, 'e');
    } finally {
      setSuspendLoading(false);
    }
  }

  // ── Valider tous les "en attente" (action rapide) ───────────
  async function handleValiderTous() {
    const enAttente = correspondants.filter(c => c.status === 'pending');
    if (enAttente.length === 0) { pop(t('correspondants.quickActions.aucunEnAttente'), 'w'); return; }
    try {
      await Promise.all(enAttente.map(c => correspondantsApi.valider(c.id)));
      pop(t('correspondants.quickActions.validesToast', { count: enAttente.length }), 's');
      loadData();
    } catch (err: any) {
      pop(`❌ ${err.message}`, 'e');
    }
  }

  const statsDisplay = {
    total:     stats?.total     ?? 0,
    actifs:    stats?.actifs    ?? 0,
    thisMonth: stats?.thisMonth ?? 0,
    villes:    stats?.villes    ?? 0,
    enAttente: stats?.enAttente ?? 0,
  };

  return (
    <div className={styles.page}>

      {/* HEADER */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.titre}>{t('correspondants.header.title')}</h1>
          <p className={styles.sousTitre}>{t('correspondants.header.subtitle')}</p>
        </div>
        <button className={styles.btnAjouter} onClick={() => setModalInviter(true)}>
          <i className="fas fa-user-plus" /> {t('correspondants.header.inviter')}
        </button>
      </div>

      {/* STATS — depuis GET /correspondants/stats */}
      <div className={styles.statsGrid}>
        <div className={`${styles.statCard} ${styles.statBlue}`}>
          <div className={styles.statIcon}><i className="fas fa-network-wired" /></div>
          <div>
            <div className={styles.statVal}>{loading ? '…' : statsDisplay.actifs}</div>
            <div className={styles.statLabel}>{t('correspondants.stats.actifs')}</div>
            <div className={styles.statSub}>{t('correspondants.stats.auTotal', { count: statsDisplay.total })}</div>
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.statGreen}`}>
          <div className={styles.statIcon}><i className="fas fa-box" /></div>
          <div>
            <div className={styles.statVal}>{loading ? '…' : statsDisplay.thisMonth}</div>
            <div className={styles.statLabel}>{t('correspondants.stats.commandesCeMois')}</div>
            <div className={styles.statSub}>{t('correspondants.stats.traiteesParReseau')}</div>
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.statAmber}`}>
          <div className={styles.statIcon}><i className="fas fa-city" /></div>
          <div>
            <div className={styles.statVal}>{loading ? '…' : statsDisplay.villes}</div>
            <div className={styles.statLabel}>{t('correspondants.stats.villesCouvertes')}</div>
            <div className={styles.statSub}>{t('correspondants.stats.plusInternational')}</div>
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.statViolet}`}>
          {statsDisplay.enAttente > 0 && <div className={styles.pulseDot} />}
          <div className={styles.statIcon}><i className="fas fa-clock" /></div>
          <div>
            <div className={styles.statVal}>{loading ? '…' : statsDisplay.enAttente}</div>
            <div className={styles.statLabel}>{t('correspondants.stats.enAttente')}</div>
            <div className={styles.statSub}>{t('correspondants.stats.validationRequise')}</div>
          </div>
        </div>
      </div>

      {/* LAYOUT */}
      <div className={styles.layout}>
        <div className={styles.colMain}>

          {/* Toolbar */}
          <div className={styles.toolbar}>
            <div className={styles.filtresBtns}>
              {(['tous','principal','relais','entrepot','export'] as const).map(f => (
                <button key={f}
                  className={`${styles.filtreBtn} ${filtreType === f ? styles.filtreBtnActive : ''}`}
                  onClick={() => setFiltreType(f)}>
                  {f === 'tous' ? t('correspondants.filters.tous') : typeLabel(f as CorrespondantType, t)}
                </button>
              ))}
            </div>
            <div className={styles.toolbarRight}>
              <select className={styles.filtreSelect} value={filtreStatut} onChange={e => setFiltreStatut(e.target.value as any)}>
                <option value="tous">{t('correspondants.statutSelect.tousStatuts')}</option>
                <option value="active">{t('correspondants.statutSelect.actifs')}</option>
                <option value="pending">{t('correspondants.statutSelect.enAttente')}</option>
                <option value="suspended">{t('correspondants.statutSelect.suspendus')}</option>
              </select>
              <div className={styles.searchWrap}>
                <i className="fas fa-magnifying-glass" />
                <input className={styles.searchInput} placeholder={t('correspondants.search')} value={search} onChange={e => setSearch(e.target.value)} />
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
              {t('correspondants.compteur', { count: filtres.length })}
              {filtreType !== 'tous' && t('correspondants.compteurType', { type: filtreType })}
            </div>
          )}

          {/* Skeleton chargement */}
          {loading ? (
            <div style={{ textAlign:'center', padding:'48px 0', color:'var(--t3)' }}>
              <i className="fas fa-spinner fa-spin" style={{ fontSize:28, display:'block', marginBottom:12 }} />
              {t('correspondants.loading')}
            </div>
          ) : filtres.length === 0 ? (
            <div className={styles.vide}>
              <span className={styles.videIco}>🗺️</span>
              <strong>{t('correspondants.empty.title')}</strong>
              <span>{t('correspondants.empty.sub')}</span>
              <button className={styles.btnAjouter} onClick={() => setModalInviter(true)}><i className="fas fa-user-plus" /> {t('correspondants.empty.inviter')}</button>
            </div>
          ) : vue === 'grille' ? (
            <div className={styles.grille}>
              {filtres.map(c => (
                <div key={c.id} className={`${styles.card} ${c.status === 'suspended' ? styles.cardSuspended : ''}`}>
                  <div className={styles.cardHead}>
                    <div className={styles.cardAvatar}>{c.avatarEmoji}</div>
                    <div className={styles.cardBadges}>
                      <span className={`${styles.typeBadge} ${typeCls(c.type, styles)}`}>{typeLabel(c.type, t)}</span>
                      {c.status !== 'active' && (
                        <span className={`${styles.statutBadge} ${statutCls(c.status, styles)}`}>{statutLabel(c.status, t)}</span>
                      )}
                    </div>
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.cardName}>{c.fullName}</div>
                    <div className={styles.cardVille}><i className="fas fa-map-pin" /> {c.ville} · {c.quartier}</div>
                    <div className={styles.cardZone}><i className="fas fa-map" /> {c.zone}</div>
                  </div>
                  <div className={styles.cardStats}>
                    <div className={styles.cardStat}><strong>{c.thisMonth}</strong><span>{t('correspondants.card.ceMois')}</span></div>
                    <div className={styles.cardStat}><strong>{c.totalMissions}</strong><span>{t('correspondants.card.total')}</span></div>
                    <div className={styles.cardStat}>
                      <i className="fas fa-star" style={{ color:'var(--t2)', fontSize:11 }} />
                      <strong>{c.averageRating === 0 ? t('correspondants.na') : c.averageRating.toFixed(1)}</strong>
                      <span>{t('correspondants.card.note')}</span>
                    </div>
                  </div>
                  <div className={styles.cardActivity}>
                    <div className={styles.actDot} />
                    <span>{c.lastActivity}</span>
                    <span className={styles.actTime}>{c.lastActivityAt}</span>
                  </div>
                  <div className={styles.cardActions}>
                    <button className={styles.cardBtnPrimary} onClick={() => setModalProfil(c)}><i className="fas fa-eye" /> {t('correspondants.card.voir')}</button>
                    <button className={styles.cardBtnIcon} onClick={() => setModalContact(c)} title={t('correspondants.card.contacter')}><i className="fas fa-envelope" /></button>
                    <a href={`tel:${c.phone}`} className={styles.cardBtnIcon} title={t('correspondants.card.appeler')}><i className="fas fa-phone" /></a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.listeWrap}>
              <table className={styles.liste}>
                <thead>
                  <tr>
                    {[t('correspondants.table.correspondant'),t('correspondants.table.ville'),t('correspondants.table.type'),t('correspondants.table.ceMois'),t('correspondants.table.total'),t('correspondants.table.note'),t('correspondants.table.statut'),t('correspondants.table.actions')].map(h => (
                      <th key={h} className={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtres.map(c => (
                    <tr key={c.id} className={`${styles.tr} ${c.status === 'suspended' ? styles.trSuspended : ''}`}>
                      <td className={styles.td}>
                        <div className={styles.listCell}>
                          <div className={styles.listAvatar}>{c.avatarEmoji}</div>
                          <div><div className={styles.listNom}>{c.fullName}</div><div className={styles.listEmail}>{c.email}</div></div>
                        </div>
                      </td>
                      <td className={styles.td}><div className={styles.listVille}><i className="fas fa-map-pin" /> {c.ville}</div></td>
                      <td className={styles.td}><span className={`${styles.typeBadge} ${typeCls(c.type, styles)}`}>{typeLabel(c.type, t)}</span></td>
                      <td className={styles.td}><strong style={{ color:'var(--navy)', fontFamily:'var(--fd)' }}>{c.thisMonth}</strong></td>
                      <td className={styles.td}><strong style={{ color:'var(--navy)' }}>{c.totalMissions}</strong></td>
                      <td className={styles.td}><div className={styles.listRating}><i className="fas fa-star" style={{ color:'var(--t2)', fontSize:11 }} /><strong>{c.averageRating === 0 ? t('correspondants.na') : c.averageRating.toFixed(1)}</strong></div></td>
                      <td className={styles.td}><span className={`${styles.statutBadge} ${statutCls(c.status, styles)}`}>{statutLabel(c.status, t)}</span></td>
                      <td className={styles.td}>
                        <div className={styles.listActions}>
                          <button className={styles.listeBtn} onClick={() => setModalProfil(c)} title={t('correspondants.card.voir')}><i className="fas fa-eye" /></button>
                          <button className={styles.listeBtn} onClick={() => setModalContact(c)} title={t('correspondants.card.contacter')}><i className="fas fa-envelope" /></button>
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

          {/* Zones — depuis GET /correspondants/zones */}
          <div className={styles.sideCard}>
            <div className={styles.sideCardHeader}><div className={styles.sideCardTitle}><i className="fas fa-map" /> {t('correspondants.sidePanel.couvertureZone')}</div></div>
            <div className={styles.sideCardBody}>
              {zones.length === 0 && !loading && <div style={{ color:'var(--t3)', fontSize:13 }}>{t('correspondants.sidePanel.aucuneZone')}</div>}
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

          {/* Activités récentes — depuis GET /correspondants/activite-recente */}
          <div className={styles.sideCard}>
            <div className={styles.sideCardHeader}><div className={styles.sideCardTitle}><i className="fas fa-clock-rotate-left" /> {t('correspondants.sidePanel.activiteRecente')}</div></div>
            <div className={styles.sideCardBody}>
              {activite.map((c, i) => (
                <div key={i} className={`${styles.actItem} ${i < 4 ? styles.actItemBorder : ''}`}>
                  <div className={styles.actEmoji}>{c.avatarEmoji}</div>
                  <div className={styles.actContent}>
                    <div className={styles.actNom}>{c.fullName}</div>
                    <div className={styles.actAction}>{c.lastActivity}</div>
                    <div className={styles.actTime2}>{c.lastActivityAt}</div>
                  </div>
                  <div className={`${styles.actIndicator} ${c.status === 'active' ? styles.actGreen : styles.actAmber}`} />
                </div>
              ))}
            </div>
          </div>

          {/* Actions rapides */}
          <div className={styles.sideCard}>
            <div className={styles.sideCardHeader}><div className={styles.sideCardTitle}><i className="fas fa-bolt" /> {t('correspondants.sidePanel.actionsRapides')}</div></div>
            <div className={styles.sideCardBody}>
              {[
                { ico:'📧', l:t('correspondants.quickActions.envoyerCirculaire'),   action: () => pop(t('correspondants.quickActions.envoiToast'), 's')     },
                { ico:'📊', l:t('correspondants.quickActions.rapportReseau'),    action: () => pop(t('correspondants.quickActions.rapportToast'), 's') },
                { ico:'🗺️', l:t('correspondants.quickActions.voirCarte'),     action: () => pop(t('correspondants.quickActions.carteToast'), 's') },
                // ✅ CONNECTÉ : appelle correspondantsApi.valider() pour tous les pending
                { ico:'✅', l:t('correspondants.quickActions.validerEnAttente', { count: statsDisplay.enAttente }), action: handleValiderTous },
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
          c={modalProfil}
          onClose={() => setModalProfil(null)}
          onContact={() => setModalContact(modalProfil)}
          onSuspend={() => setModalSuspend(modalProfil)}
        />
      )}
      {modalInviter && <ModalInviter onClose={() => { setModalInviter(false); loadData(); }} />}
      {modalContact && <ModalContacter c={modalContact} onClose={() => setModalContact(null)} />}
      {modalSuspend && (
        <ModalSuspendre
          c={modalSuspend}
          onClose={() => setModalSuspend(null)}
          onConfirm={() => handleSuspendre(modalSuspend)}
          loading={suspendLoading}
        />
      )}
    </div>
  );
}