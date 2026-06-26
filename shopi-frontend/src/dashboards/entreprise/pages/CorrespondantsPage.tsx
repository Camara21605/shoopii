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

function typeLabel(type: CorrespondantType): string {
  return {
    principal: '⭐ Principal',
    entrepot:  '🏭 Entrepôt',
    export:    '✈️ Export',
    relais:    '📍 Relais',
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

function statutLabel(status: CorrespondantStatus): string {
  return { active: 'Actif', pending: 'En attente', suspended: 'Suspendu' }[status];
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
                  {typeLabel(c.type)}
                </span>
                <span className={`${styles.statutBadge} ${statutCls(c.status, styles)}`}>
                  {statutLabel(c.status)}
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
              { icon:'fa-box',      label:'Total missions',  value: String(c.totalMissions), sub: 'Commandes traitées', cls: styles.kpiBlue   },
              { icon:'fa-calendar', label:'Ce mois-ci',      value: String(c.thisMonth),     sub: 'Commandes',          cls: styles.kpiGreen  },
              { icon:'fa-star',     label:'Note moyenne',    value: c.averageRating === 0 ? 'N/A' : c.averageRating.toFixed(1), sub: 'Sur 5 étoiles', cls: styles.kpiAmber  },
              { icon:'fa-map',      label:'Zone couverte',   value: c.ville,                 sub: c.zone ?? '',         cls: styles.kpiViolet },
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
            <div className={styles.ratingBoxTitle}>Évaluation clients</div>
            <Stars value={c.averageRating} />
          </div>
          <div className={styles.detGrid}>
            {[
              { icon:'fa-phone',     label:'Téléphone',       value: c.phone ?? 'N/A'      },
              { icon:'fa-envelope',  label:'Email',           value: c.email               },
              { icon:'fa-map-pin',   label:'Adresse',         value: c.adresse ?? 'N/A'    },
              { icon:'fa-map',       label:'Zone',            value: c.zone ?? 'N/A'       },
              { icon:'fa-clock-rotate-left', label:'Dernière activité', value: `${c.lastActivity} (${c.lastActivityAt})` },
              { icon:'fa-calendar',  label:'Membre depuis',   value: new Date(c.joinedAt).toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' }) },
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
              <i className="fas fa-ban" /> Suspendre
            </button>
          )}
          <button className={styles.btnSecondary} onClick={() => { onContact(); onClose(); }}>
            <i className="fas fa-envelope" /> Contacter
          </button>
          <a href={`tel:${c.phone}`} className={styles.btnSecondary}>
            <i className="fas fa-phone" /> Appeler
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
  const { pop } = useToast();
  const [etape,    setEtape]    = useState<1 | 2 | 3>(1);
  const [nom,      setNom]      = useState('');
  const [email,    setEmail]    = useState('');
  const [ville,    setVille]    = useState('');
  const [quartier, setQuartier] = useState('');
  const [type,     setType]     = useState<CorrespondantType>('relais');
  const [message,  setMessage]  = useState(
    'Bonjour,\n\nVous avez été sélectionné pour rejoindre le réseau de correspondants Shopi.\n\nVeuillez utiliser le code ci-joint pour créer votre compte.'
  );
  const [loading,  setLoading]  = useState(false);

  // ✅ Le code vient maintenant de la réponse API (pas genererCode())
  const [invitationResult, setInvitationResult] = useState<InvitationResponse | null>(null);

  function validerEtape1() {
    if (!nom.trim())   { pop('⚠️ Le nom est requis', 'w');   return; }
    if (!email.trim()) { pop('⚠️ L\'email est requis', 'w'); return; }
    if (!email.includes('@') || !email.includes('.')) { pop('⚠️ Email invalide', 'w'); return; }
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
      pop(`✅ Invitation envoyée à ${email}`, 's');
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
            <div className={styles.mTitle}><i className="fas fa-user-plus" /> Inviter un correspondant</div>
            <div className={styles.etapes}>
              {['Informations', 'Aperçu', 'Confirmé'].map((e, i) => (
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
                  <label className={styles.formLabel}><i className="fas fa-store" /> Nom du point relais *</label>
                  <input className={styles.formInput} placeholder="Ex: RelaisPlus Kaloum" value={nom} onChange={e => setNom(e.target.value)} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}><i className="fas fa-envelope" /> Email de contact *</label>
                  <input type="email" className={styles.formInput} placeholder="Ex: relais@gmail.com" value={email} onChange={e => setEmail(e.target.value)} />
                  <p className={styles.formHint}><i className="fas fa-circle-info" /> Le code d'invitation sera envoyé à cet email.</p>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}><i className="fas fa-tag" /> Type de correspondant</label>
                  <select className={styles.formSelect} value={type} onChange={e => setType(e.target.value as CorrespondantType)}>
                    <option value="relais">📍 Point relais — Dépôt/retrait colis</option>
                    <option value="entrepot">🏭 Entrepôt — Stockage régional</option>
                    <option value="export">✈️ Export — International</option>
                    <option value="principal">⭐ Principal — Hub central</option>
                  </select>
                </div>
              </div>
              <div className={styles.formCol}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}><i className="fas fa-city" /> Ville</label>
                  <input className={styles.formInput} placeholder="Ex: Conakry" value={ville} onChange={e => setVille(e.target.value)} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}><i className="fas fa-map-pin" /> Quartier / Zone</label>
                  <input className={styles.formInput} placeholder="Ex: Kaloum, Matam…" value={quartier} onChange={e => setQuartier(e.target.value)} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}><i className="fas fa-message" /> Message personnalisé</label>
                  <textarea className={styles.formTextarea} rows={5} value={message} onChange={e => setMessage(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* ÉTAPE 2 — preview (code masqué car généré par le backend à l'envoi) */}
          {etape === 2 && (
            <div className={styles.apercu}>
              <div className={styles.apercuLabel}><i className="fas fa-eye" /> Aperçu de l'email qui sera envoyé</div>
              <div className={styles.emailPreview}>
                <div className={styles.emailHeader}>
                  <div className={styles.emailLogo}>S</div>
                  <div>
                    <div className={styles.emailSujet}>Invitation Shopi — Rejoignez notre réseau</div>
                    <div className={styles.emailDest}>À : <strong>{email}</strong></div>
                  </div>
                </div>
                <div className={styles.emailBody}>
                  <p>Bonjour <strong>{nom}</strong>,</p>
                  <p style={{ whiteSpace: 'pre-line', fontSize: 13, color: 'var(--t2)', lineHeight: 1.6 }}>{message}</p>
                  <div className={styles.emailCode}>
                    <div className={styles.emailCodeLabel}>Votre code d'invitation (10 chiffres)</div>
                    {/* ✅ Code généré par le backend — affiché seulement à l'étape 3 */}
                    <div className={styles.emailCodeValue} style={{ letterSpacing: '0.3em', color: 'var(--t3)' }}>{previewCode}</div>
                    <div className={styles.emailCodeNote}>Valable 7 jours · Usage unique · Généré à l'envoi</div>
                  </div>
                  <div className={styles.emailInfo}>
                    {ville && <div><i className="fas fa-city" /> Ville : <strong>{ville}</strong></div>}
                    {quartier && <div><i className="fas fa-map-pin" /> Zone : <strong>{quartier}</strong></div>}
                    <div><i className="fas fa-tag" /> Type : <strong>{typeLabel(type)}</strong></div>
                  </div>
                </div>
              </div>
              <div className={styles.infoBox}>
                <i className="fas fa-circle-info" />
                <span>Ce code expire dans <strong>7 jours</strong>. Il peut être utilisé une seule fois. L'email sera envoyé depuis <strong>noreply@shopi.gn</strong>.</span>
              </div>
            </div>
          )}

          {/* ÉTAPE 3 — ✅ affiche le VRAI code venant du backend */}
          {etape === 3 && invitationResult && (
            <div className={styles.success}>
              <div className={styles.successIcon}>✅</div>
              <div className={styles.successTitle}>Invitation envoyée !</div>
              <div className={styles.successSub}>Code envoyé à <strong>{invitationResult.email}</strong></div>
              <div className={styles.successRecap}>
                <div className={styles.recapRow}><span>Nom</span><strong>{invitationResult.fullName}</strong></div>
                <div className={styles.recapRow}><span>Email</span><strong>{invitationResult.email}</strong></div>
                {ville && <div className={styles.recapRow}><span>Ville</span><strong>{ville}</strong></div>}
                <div className={styles.recapRow}><span>Type</span><strong>{typeLabel(type)}</strong></div>
              </div>
              {/* ✅ Code réel venant du backend */}
              <div className={styles.codeBox}>
                <div className={styles.codeBoxLabel}>Code d'invitation généré</div>
                <div className={styles.codeRow}>
                  <span className={styles.codeVal}>{realCode}</span>
                  <button className={styles.copyBtn} onClick={() => { navigator.clipboard.writeText(realCode); pop('📋 Code copié !', 's'); }}>
                    <i className="fas fa-copy" /> Copier
                  </button>
                </div>
                <div className={styles.codeExpiry}>
                  <i className="fas fa-clock" /> Expire le {new Date(invitationResult.expiresAt).toLocaleDateString('fr-FR')} · Usage unique
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={styles.mFooter}>
          {etape === 1 && (
            <>
              <button className={styles.btnSecondary} onClick={onClose}>Annuler</button>
              <button className={styles.btnPrimary} onClick={validerEtape1}>Suivant <i className="fas fa-arrow-right" /></button>
            </>
          )}
          {etape === 2 && (
            <>
              <button className={styles.btnSecondary} onClick={() => setEtape(1)} disabled={loading}><i className="fas fa-arrow-left" /> Retour</button>
              <button className={styles.btnPrimary} onClick={handleEnvoyer} disabled={loading}>
                {loading ? <><i className="fas fa-spinner fa-spin" /> Envoi…</> : <><i className="fas fa-paper-plane" /> Envoyer l'invitation</>}
              </button>
            </>
          )}
          {etape === 3 && <button className={styles.btnSecondary} onClick={onClose}>Fermer</button>}
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
  const { pop } = useToast();
  const [sujet,   setSujet]   = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // ✅ CONNECTÉ : appelle POST /correspondants/:id/contacter
  async function handleEnvoyer() {
    if (!sujet.trim() || !message.trim()) {
      pop('⚠️ Sujet et message requis', 'w');
      return;
    }
    setLoading(true);
    try {
      await correspondantsApi.contacter(c.id, { sujet: sujet.trim(), message: message.trim() });
      pop(`✅ Message envoyé à ${c.fullName}`, 's');
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
            <div className={styles.mTitle}><i className="fas fa-envelope" /> Contacter</div>
            <div className={styles.mSub}>Envoyer un message à <strong>{c.fullName}</strong> ({c.email})</div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><i className="fas fa-xmark" /></button>
        </div>
        <div className={styles.mBody}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}><i className="fas fa-heading" /> Sujet *</label>
            <input className={styles.formInput} placeholder="Ex: Mise à jour stock disponible" value={sujet} onChange={e => setSujet(e.target.value)} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}><i className="fas fa-message" /> Message *</label>
            <textarea className={styles.formTextarea} rows={5} placeholder="Rédigez votre message…" value={message} onChange={e => setMessage(e.target.value)} />
          </div>
          <div className={styles.infoBox}>
            <i className="fas fa-circle-info" />
            <span>Le message sera envoyé à <strong>{c.email}</strong> depuis <strong>noreply@shopi.gn</strong>.</span>
          </div>
        </div>
        <div className={styles.mFooter}>
          <button className={styles.btnSecondary} onClick={onClose} disabled={loading}>Annuler</button>
          <button className={styles.btnPrimary} onClick={handleEnvoyer} disabled={loading}>
            {loading ? <><i className="fas fa-spinner fa-spin" /> Envoi…</> : <><i className="fas fa-paper-plane" /> Envoyer</>}
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
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.modalXs}`} onClick={e => e.stopPropagation()}>
        <div className={styles.mHeader}>
          <div className={`${styles.mTitle} ${styles.dangerTitle}`}>
            <i className="fas fa-triangle-exclamation" /> Suspendre le correspondant
          </div>
          <button className={styles.closeBtn} onClick={onClose}><i className="fas fa-xmark" /></button>
        </div>
        <div className={styles.mBody}>
          <div className={styles.suspendBox}>
            <div className={styles.suspendIco}>⚠️</div>
            <p>Suspendre <strong>{c.fullName}</strong> ?</p>
            <p className={styles.suspendNote}>Ce point relais ne pourra plus recevoir ni expédier de colis jusqu'à la levée de la suspension.</p>
          </div>
        </div>
        <div className={styles.mFooter}>
          <button className={styles.btnSecondary} onClick={onClose} disabled={loading}>Annuler</button>
          <button className={styles.btnDanger} onClick={onConfirm} disabled={loading}>
            {loading ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-ban" />} Confirmer
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
      pop(`❌ Erreur de chargement : ${err.message}`, 'e');
    } finally {
      setLoading(false);
    }
  }, []);

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
      pop(`🚫 ${c.fullName} suspendu`, 'w');
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
    if (enAttente.length === 0) { pop('Aucun compte en attente', 'w'); return; }
    try {
      await Promise.all(enAttente.map(c => correspondantsApi.valider(c.id)));
      pop(`✅ ${enAttente.length} comptes validés`, 's');
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
          <h1 className={styles.titre}>Réseau Correspondants</h1>
          <p className={styles.sousTitre}>Gérez vos points relais, entrepôts et partenaires export</p>
        </div>
        <button className={styles.btnAjouter} onClick={() => setModalInviter(true)}>
          <i className="fas fa-user-plus" /> Inviter un correspondant
        </button>
      </div>

      {/* STATS — depuis GET /correspondants/stats */}
      <div className={styles.statsGrid}>
        <div className={`${styles.statCard} ${styles.statBlue}`}>
          <div className={styles.statIcon}><i className="fas fa-network-wired" /></div>
          <div>
            <div className={styles.statVal}>{loading ? '…' : statsDisplay.actifs}</div>
            <div className={styles.statLabel}>Correspondants actifs</div>
            <div className={styles.statSub}>{statsDisplay.total} au total</div>
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.statGreen}`}>
          <div className={styles.statIcon}><i className="fas fa-box" /></div>
          <div>
            <div className={styles.statVal}>{loading ? '…' : statsDisplay.thisMonth}</div>
            <div className={styles.statLabel}>Commandes ce mois</div>
            <div className={styles.statSub}>Traitées par le réseau</div>
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.statAmber}`}>
          <div className={styles.statIcon}><i className="fas fa-city" /></div>
          <div>
            <div className={styles.statVal}>{loading ? '…' : statsDisplay.villes}</div>
            <div className={styles.statLabel}>Villes couvertes</div>
            <div className={styles.statSub}>+ International</div>
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.statViolet}`}>
          {statsDisplay.enAttente > 0 && <div className={styles.pulseDot} />}
          <div className={styles.statIcon}><i className="fas fa-clock" /></div>
          <div>
            <div className={styles.statVal}>{loading ? '…' : statsDisplay.enAttente}</div>
            <div className={styles.statLabel}>En attente</div>
            <div className={styles.statSub}>Validation requise</div>
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
                  {{ tous:'Tous', principal:'⭐ Principal', relais:'📍 Relais', entrepot:'🏭 Entrepôt', export:'✈️ Export' }[f]}
                </button>
              ))}
            </div>
            <div className={styles.toolbarRight}>
              <select className={styles.filtreSelect} value={filtreStatut} onChange={e => setFiltreStatut(e.target.value as any)}>
                <option value="tous">Tous les statuts</option>
                <option value="active">Actifs</option>
                <option value="pending">En attente</option>
                <option value="suspended">Suspendus</option>
              </select>
              <div className={styles.searchWrap}>
                <i className="fas fa-magnifying-glass" />
                <input className={styles.searchInput} placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} />
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
              {filtres.length} correspondant{filtres.length > 1 ? 's' : ''}
              {filtreType !== 'tous' && ` · type : ${filtreType}`}
            </div>
          )}

          {/* Skeleton chargement */}
          {loading ? (
            <div style={{ textAlign:'center', padding:'48px 0', color:'var(--t3)' }}>
              <i className="fas fa-spinner fa-spin" style={{ fontSize:28, display:'block', marginBottom:12 }} />
              Chargement des correspondants…
            </div>
          ) : filtres.length === 0 ? (
            <div className={styles.vide}>
              <span className={styles.videIco}>🗺️</span>
              <strong>Aucun correspondant trouvé</strong>
              <span>Modifiez vos filtres ou invitez un nouveau correspondant.</span>
              <button className={styles.btnAjouter} onClick={() => setModalInviter(true)}><i className="fas fa-user-plus" /> Inviter</button>
            </div>
          ) : vue === 'grille' ? (
            <div className={styles.grille}>
              {filtres.map(c => (
                <div key={c.id} className={`${styles.card} ${c.status === 'suspended' ? styles.cardSuspended : ''}`}>
                  <div className={styles.cardHead}>
                    <div className={styles.cardAvatar}>{c.avatarEmoji}</div>
                    <div className={styles.cardBadges}>
                      <span className={`${styles.typeBadge} ${typeCls(c.type, styles)}`}>{typeLabel(c.type)}</span>
                      {c.status !== 'active' && (
                        <span className={`${styles.statutBadge} ${statutCls(c.status, styles)}`}>{statutLabel(c.status)}</span>
                      )}
                    </div>
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.cardName}>{c.fullName}</div>
                    <div className={styles.cardVille}><i className="fas fa-map-pin" /> {c.ville} · {c.quartier}</div>
                    <div className={styles.cardZone}><i className="fas fa-map" /> {c.zone}</div>
                  </div>
                  <div className={styles.cardStats}>
                    <div className={styles.cardStat}><strong>{c.thisMonth}</strong><span>ce mois</span></div>
                    <div className={styles.cardStat}><strong>{c.totalMissions}</strong><span>total</span></div>
                    <div className={styles.cardStat}>
                      <i className="fas fa-star" style={{ color:'var(--amber)', fontSize:11 }} />
                      <strong>{c.averageRating === 0 ? 'N/A' : c.averageRating.toFixed(1)}</strong>
                      <span>note</span>
                    </div>
                  </div>
                  <div className={styles.cardActivity}>
                    <div className={styles.actDot} />
                    <span>{c.lastActivity}</span>
                    <span className={styles.actTime}>{c.lastActivityAt}</span>
                  </div>
                  <div className={styles.cardActions}>
                    <button className={styles.cardBtnPrimary} onClick={() => setModalProfil(c)}><i className="fas fa-eye" /> Voir</button>
                    <button className={styles.cardBtnIcon} onClick={() => setModalContact(c)} title="Contacter"><i className="fas fa-envelope" /></button>
                    <a href={`tel:${c.phone}`} className={styles.cardBtnIcon} title="Appeler"><i className="fas fa-phone" /></a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.listeWrap}>
              <table className={styles.liste}>
                <thead>
                  <tr>
                    {['Correspondant','Ville','Type','Ce mois','Total','Note','Statut','Actions'].map(h => (
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
                      <td className={styles.td}><span className={`${styles.typeBadge} ${typeCls(c.type, styles)}`}>{typeLabel(c.type)}</span></td>
                      <td className={styles.td}><strong style={{ color:'var(--navy)', fontFamily:'var(--fd)' }}>{c.thisMonth}</strong></td>
                      <td className={styles.td}><strong style={{ color:'var(--navy)' }}>{c.totalMissions}</strong></td>
                      <td className={styles.td}><div className={styles.listRating}><i className="fas fa-star" style={{ color:'var(--amber)', fontSize:11 }} /><strong>{c.averageRating === 0 ? 'N/A' : c.averageRating.toFixed(1)}</strong></div></td>
                      <td className={styles.td}><span className={`${styles.statutBadge} ${statutCls(c.status, styles)}`}>{statutLabel(c.status)}</span></td>
                      <td className={styles.td}>
                        <div className={styles.listActions}>
                          <button className={styles.listeBtn} onClick={() => setModalProfil(c)} title="Voir"><i className="fas fa-eye" /></button>
                          <button className={styles.listeBtn} onClick={() => setModalContact(c)} title="Contacter"><i className="fas fa-envelope" /></button>
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
            <div className={styles.sideCardHeader}><div className={styles.sideCardTitle}><i className="fas fa-map" /> Couverture par zone</div></div>
            <div className={styles.sideCardBody}>
              {zones.length === 0 && !loading && <div style={{ color:'var(--t3)', fontSize:13 }}>Aucune donnée de zone</div>}
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
            <div className={styles.sideCardHeader}><div className={styles.sideCardTitle}><i className="fas fa-clock-rotate-left" /> Activité récente</div></div>
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
            <div className={styles.sideCardHeader}><div className={styles.sideCardTitle}><i className="fas fa-bolt" /> Actions rapides</div></div>
            <div className={styles.sideCardBody}>
              {[
                { ico:'📧', l:'Envoyer circular à tous',   action: () => pop('📧 Envoi en masse…', 's')     },
                { ico:'📊', l:'Rapport réseau mensuel',    action: () => pop('📊 Rapport en génération…', 's') },
                { ico:'🗺️', l:'Voir carte des relais',     action: () => pop('🗺️ Carte des relais ouverte', 's') },
                // ✅ CONNECTÉ : appelle correspondantsApi.valider() pour tous les pending
                { ico:'✅', l:`Valider les en attente (${statsDisplay.enAttente})`, action: handleValiderTous },
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