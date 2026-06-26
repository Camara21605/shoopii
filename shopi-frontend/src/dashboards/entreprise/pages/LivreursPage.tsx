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
function vehicleLabel(type: VehicleType): string {
  return { moto:'Moto', voiture:'Voiture', velo:'Vélo', tricycle:'Tricycle', camion:'Camion', pieton:'À pied' }[type] ?? 'Moto';
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
  available:   '#10B981',
  on_delivery: '#1A4FC4',
  offline:     '#9CA3AF',
};

const AVAIL_LABEL: Record<Availability, string> = {
  available:   'Disponible',
  on_delivery: 'En course',
  offline:     'Hors ligne',
};

const AVAIL_CLS: Record<Availability, string> = {
  available:   styles.statutActive,
  on_delivery: styles.statutPending,
  offline:     styles.statutSuspended,
};

const STATUS_LABEL: Record<LivreurStatus, string> = {
  active:    'Actif',
  pending:   'En attente',
  suspended: 'Suspendu',
  banned:    'Banni',
};
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
  return (
    <span className={`${styles.statutBadge} ${AVAIL_CLS[availability]}`}>
      <span style={{
        display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
        background: AVAIL_DOT[availability], marginRight: 5,
      }} />
      {AVAIL_LABEL[availability]}
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
                <span><i className="fas fa-phone" /> {l.phone ?? 'N/A'}</span>
                <span><i className="fas fa-map-pin" /> {l.zone ?? 'N/A'}</span>
                <span><i className="fas fa-envelope" /> {l.email}</span>
              </div>
              <div className={styles.mBadges}>
                <span className={`${styles.statutBadge} ${STATUS_CLS[l.status as LivreurStatus]}`}>
                  {STATUS_LABEL[l.status as LivreurStatus]}
                </span>
                <BadgeAvail availability={l.availability as Availability} />
                <span className={`${styles.typeBadge} ${styles.badgeRelais}`}>
                  {l.vehicleEmoji} {vehicleLabel(l.vehicleType as VehicleType)}
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
              { icon:'fa-box',     label:'Total courses',  value: String(l.totalDeliveries),   sub: `${l.successfulDeliveries} réussies`,  cls: styles.kpiBlue   },
              { icon:'fa-percent', label:'Taux réussite',  value: `${tauxReussite(l.totalDeliveries, l.successfulDeliveries)}%`, sub: l.totalDeliveries > 0 ? 'Très bon' : '–', cls: styles.kpiGreen  },
              { icon:'fa-star',    label:'Note moyenne',   value: l.averageRating === 0 ? 'N/A' : l.averageRating.toFixed(1), sub: 'Sur 5 étoiles', cls: styles.kpiAmber  },
              { icon:'fa-wallet',  label:'Gains totaux',   value: fmtGnf(l.totalEarnings),      sub: 'GNF cumulés',            cls: styles.kpiViolet },
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
            <Stars value={l.averageRating} />
          </div>

          <div className={styles.detGrid}>
            {[
              { icon:'fa-phone',           label:'Téléphone',         value: l.phone ?? 'N/A'                                              },
              { icon:'fa-envelope',        label:'Email',             value: l.email                                                        },
              { icon:'fa-map-pin',         label:'Zone',              value: l.zone ?? 'N/A'                                               },
              { icon:'fa-car',             label:'Véhicule',          value: `${l.vehicleEmoji} ${vehicleLabel(l.vehicleType as VehicleType)}` },
              { icon:'fa-id-card',         label:'Plaque',            value: l.vehiclePlate ?? 'Non renseignée'                             },
              { icon:'fa-calendar-day',    label:'Livraisons auj.',   value: String(l.todayDeliveries)                                      },
              { icon:'fa-clock-rotate-left', label:'Dernière activité', value: `${l.lastActivity} (${l.lastActivityAt})`                   },
              { icon:'fa-calendar',        label:'Membre depuis',     value: new Date(l.joinedAt).toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' }) },
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
              <i className="fas fa-ban" /> Suspendre
            </button>
          )}
          <button className={styles.btnSecondary} onClick={() => { onContact(); onClose(); }}>
            <i className="fas fa-envelope" /> Contacter
          </button>
          <a
            href={`https://wa.me/${(l.phone ?? '').replace(/\s+/g, '')}`}
            target="_blank" rel="noreferrer"
            className={styles.btnSecondary}
            style={{ color: '#25D366', borderColor: 'rgba(37,211,102,.3)' }}
          >
            <i className="fab fa-whatsapp" /> WhatsApp
          </a>
          <a href={`tel:${l.phone}`} className={styles.btnSecondary}>
            <i className="fas fa-phone" /> Appeler
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
  const { pop } = useToast();
  const [sujet,   setSujet]   = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleEnvoyer() {
    if (!sujet.trim() || !message.trim()) { pop('⚠️ Sujet et message requis', 'w'); return; }
    setLoading(true);
    try {
      await livreursApi.contacter(l.id, { sujet: sujet.trim(), message: message.trim() });
      pop(`✅ Message envoyé à ${l.fullName}`, 's');
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
            <div className={styles.mTitle}><i className="fas fa-envelope" /> Contacter</div>
            <div className={styles.mSub}>Envoyer un message à <strong>{l.fullName}</strong> ({l.email})</div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><i className="fas fa-xmark" /></button>
        </div>
        <div className={styles.mBody}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}><i className="fas fa-heading" /> Sujet *</label>
            <input className={styles.formInput} placeholder="Ex: Nouvelle mission disponible" value={sujet} onChange={e => setSujet(e.target.value)} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}><i className="fas fa-message" /> Message *</label>
            <textarea className={styles.formTextarea} rows={5} placeholder="Rédigez votre message…" value={message} onChange={e => setMessage(e.target.value)} />
          </div>
          <div className={styles.infoBox}>
            <i className="fas fa-circle-info" />
            <span>Le message sera envoyé à <strong>{l.email}</strong> depuis <strong>noreply@shopi.gn</strong>.</span>
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
// MODALE INVITER — connectée à POST /livreurs/inviter
// 3 étapes identiques à CorrespondantsPage.ModalInviter
// ─────────────────────────────────────────────────────────────

function ModalInviter({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { pop } = useToast();
  const [etape,    setEtape]    = useState<1 | 2 | 3>(1);
  const [nom,      setNom]      = useState('');
  const [email,    setEmail]    = useState('');
  const [zone,     setZone]     = useState('');
  const [vehicule, setVehicule] = useState<VehicleType>('moto');
  const [message,  setMessage]  = useState(
    "Bonjour,\n\nVous avez été sélectionné pour rejoindre l'équipe de livreurs Shopi.\n\nVeuillez utiliser le code ci-joint pour créer votre compte.",
  );
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState<InvitationLivreurResponse | null>(null);

  function validerEtape1() {
    if (!nom.trim())   { pop('⚠️ Le nom est requis', 'w');   return; }
    if (!email.trim()) { pop('⚠️ L\'email est requis', 'w'); return; }
    if (!email.includes('@')) { pop('⚠️ Email invalide', 'w'); return; }
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
      pop(`✅ Invitation envoyée à ${email}`, 's');
    } catch (err: any) {
      pop(`❌ ${err.message}`, 'e');
    } finally { setLoading(false); }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.modalMd}`} onClick={e => e.stopPropagation()}>
        <div className={styles.mHeader}>
          <div>
            <div className={styles.mTitle}><i className="fas fa-user-plus" /> Inviter un livreur</div>
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
          {/* ÉTAPE 1 */}
          {etape === 1 && (
            <div className={styles.formCols}>
              <div className={styles.formCol}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}><i className="fas fa-user" /> Nom complet *</label>
                  <input className={styles.formInput} placeholder="Ex: Mamadou Diallo" value={nom} onChange={e => setNom(e.target.value)} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}><i className="fas fa-envelope" /> Email de contact *</label>
                  <input type="email" className={styles.formInput} placeholder="Ex: livreur@gmail.com" value={email} onChange={e => setEmail(e.target.value)} />
                  <p className={styles.formHint}><i className="fas fa-circle-info" /> Le code d'invitation sera envoyé à cet email.</p>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}><i className="fas fa-car" /> Type de véhicule</label>
                  <select className={styles.formSelect} value={vehicule} onChange={e => setVehicule(e.target.value as VehicleType)}>
                    <option value="moto">🛵 Moto</option>
                    <option value="voiture">🚗 Voiture</option>
                    <option value="velo">🚲 Vélo</option>
                    <option value="tricycle">🛺 Tricycle</option>
                    <option value="camion">🚚 Camion</option>
                    <option value="pieton">🚶 À pied</option>
                  </select>
                </div>
              </div>
              <div className={styles.formCol}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}><i className="fas fa-map-pin" /> Zone de livraison</label>
                  <input className={styles.formInput} placeholder="Ex: Kaloum, Matam, Dixinn" value={zone} onChange={e => setZone(e.target.value)} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}><i className="fas fa-message" /> Message personnalisé</label>
                  <textarea className={styles.formTextarea} rows={7} value={message} onChange={e => setMessage(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* ÉTAPE 2 */}
          {etape === 2 && (
            <div className={styles.apercu}>
              <div className={styles.apercuLabel}><i className="fas fa-eye" /> Aperçu de l'email qui sera envoyé</div>
              <div className={styles.emailPreview}>
                <div className={styles.emailHeader}>
                  <div className={styles.emailLogo}>S</div>
                  <div>
                    <div className={styles.emailSujet}>Invitation Shopi — Rejoignez notre équipe de livraison</div>
                    <div className={styles.emailDest}>À : <strong>{email}</strong></div>
                  </div>
                </div>
                <div className={styles.emailBody}>
                  <p>Bonjour <strong>{nom}</strong>,</p>
                  <p style={{ whiteSpace: 'pre-line', fontSize: 13, color: 'var(--t2)', lineHeight: 1.6 }}>{message}</p>
                  <div className={styles.emailCode}>
                    <div className={styles.emailCodeLabel}>Votre code d'invitation (livreur)</div>
                    <div className={styles.emailCodeValue} style={{ letterSpacing: '0.3em', color: 'var(--t3)' }}>••••-••••-••</div>
                    <div className={styles.emailCodeNote}>Valable 7 jours · Usage unique · Généré à l'envoi</div>
                  </div>
                  <div className={styles.emailInfo}>
                    {zone && <div><i className="fas fa-map-pin" /> Zone : <strong>{zone}</strong></div>}
                    <div><i className="fas fa-car" /> Véhicule : <strong>{vehicleEmoji(vehicule)} {vehicleLabel(vehicule)}</strong></div>
                  </div>
                </div>
              </div>
              <div className={styles.infoBox}>
                <i className="fas fa-circle-info" />
                <span>Code expire dans <strong>7 jours</strong>. Usage unique. Envoyé depuis <strong>noreply@shopi.gn</strong>.</span>
              </div>
            </div>
          )}

          {/* ÉTAPE 3 — code RÉEL venant du backend */}
          {etape === 3 && result && (
            <div className={styles.success}>
              <div className={styles.successIcon}>✅</div>
              <div className={styles.successTitle}>Invitation envoyée !</div>
              <div className={styles.successSub}>Code envoyé à <strong>{result.email}</strong></div>
              <div className={styles.successRecap}>
                <div className={styles.recapRow}><span>Nom</span><strong>{result.fullName}</strong></div>
                <div className={styles.recapRow}><span>Email</span><strong>{result.email}</strong></div>
                {zone && <div className={styles.recapRow}><span>Zone</span><strong>{zone}</strong></div>}
                <div className={styles.recapRow}><span>Véhicule</span><strong>{vehicleEmoji(vehicule)} {vehicleLabel(vehicule)}</strong></div>
              </div>
              <div className={styles.codeBox}>
                <div className={styles.codeBoxLabel}>Code d'invitation généré</div>
                <div className={styles.codeRow}>
                  <span className={styles.codeVal}>{result.code}</span>
                  <button className={styles.copyBtn} onClick={() => { navigator.clipboard.writeText(result.code); pop('📋 Code copié !', 's'); }}>
                    <i className="fas fa-copy" /> Copier
                  </button>
                </div>
                <div className={styles.codeExpiry}>
                  <i className="fas fa-clock" /> Expire le {new Date(result.expiresAt).toLocaleDateString('fr-FR')} · Usage unique
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
          {etape === 3 && <button className={styles.btnSecondary} onClick={() => { onDone(); onClose(); }}>Fermer</button>}
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
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.modalXs}`} onClick={e => e.stopPropagation()}>
        <div className={styles.mHeader}>
          <div className={`${styles.mTitle} ${styles.dangerTitle}`}>
            <i className="fas fa-triangle-exclamation" /> Suspendre le livreur
          </div>
          <button className={styles.closeBtn} onClick={onClose}><i className="fas fa-xmark" /></button>
        </div>
        <div className={styles.mBody}>
          <div className={styles.suspendBox}>
            <div className={styles.suspendIco}>⚠️</div>
            <p>Suspendre <strong>{l.fullName}</strong> ?</p>
            <p className={styles.suspendNote}>Ce livreur ne pourra plus accepter de commandes jusqu'à la levée de la suspension.</p>
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

export default function LivreursPage() {
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
      pop(`❌ Erreur de chargement : ${err.message}`, 'e');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ══════════════════════════════════════════════════════════
  // SUSPENDRE — connecté à PATCH /livreurs/:id/suspendre
  // ══════════════════════════════════════════════════════════

  async function handleSuspendre(l: LivreurResponse) {
    setSuspendLoading(true);
    try {
      await livreursApi.suspendre(l.id);
      pop(`🚫 ${l.fullName} suspendu`, 'w');
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
    if (enAttente.length === 0) { pop('Aucun livreur en attente', 'w'); return; }
    try {
      await Promise.all(enAttente.map(l => livreursApi.valider(l.id)));
      pop(`✅ ${enAttente.length} livreur${enAttente.length > 1 ? 's' : ''} validé${enAttente.length > 1 ? 's' : ''}`, 's');
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
          <h1 className={styles.titre}>Réseau de Livreurs</h1>
          <p className={styles.sousTitre}>Gérez votre équipe de livraison en temps réel</p>
        </div>
        <button className={styles.btnAjouter} onClick={() => setModalInviter(true)}>
          <i className="fas fa-user-plus" /> Inviter un livreur
        </button>
      </div>

      {/* KPI CARDS */}
      <div className={styles.statsGrid}>
        <div className={`${styles.statCard} ${styles.statBlue}`}>
          <div className={styles.statIcon}><i className="fas fa-users" /></div>
          <div>
            <div className={styles.statVal}>{loading ? '…' : s.actifs}</div>
            <div className={styles.statLabel}>Livreurs actifs</div>
            <div className={styles.statSub}>{s.total} au total</div>
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.statGreen}`}>
          {s.disponibles > 0 && <div className={styles.pulseDot} />}
          <div className={styles.statIcon}><i className="fas fa-circle-check" /></div>
          <div>
            <div className={styles.statVal}>{loading ? '…' : s.disponibles}</div>
            <div className={styles.statLabel}>Disponibles</div>
            <div className={styles.statSub}>Prêts à livrer</div>
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.statAmber}`}>
          <div className={styles.statIcon}><i className="fas fa-motorcycle" /></div>
          <div>
            <div className={styles.statVal}>{loading ? '…' : s.enCourse}</div>
            <div className={styles.statLabel}>En course</div>
            <div className={styles.statSub}>Actuellement</div>
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.statViolet}`}>
          {s.enAttente > 0 && <div className={styles.pulseDot} />}
          <div className={styles.statIcon}><i className="fas fa-box" /></div>
          <div>
            <div className={styles.statVal}>{loading ? '…' : s.livrAuj}</div>
            <div className={styles.statLabel}>Livraisons auj.</div>
            <div className={styles.statSub}>{s.enAttente > 0 ? `${s.enAttente} en attente` : 'Cumulées'}</div>
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
                { val:'tous',        label:'Tous',           count: s.total       },
                { val:'available',   label:'🟢 Disponibles', count: s.disponibles },
                { val:'on_delivery', label:'🔵 En course',   count: s.enCourse    },
                { val:'offline',     label:'⚫ Hors ligne',  count: s.horsLigne   },
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
                <option value="tous">Tous les statuts</option>
                <option value="active">Actifs</option>
                <option value="pending">En attente</option>
                <option value="suspended">Suspendus</option>
              </select>
              <div className={styles.searchWrap}>
                <i className="fas fa-magnifying-glass" />
                <input className={styles.searchInput} placeholder="Rechercher un livreur…" value={search} onChange={e => setSearch(e.target.value)} />
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
              {filtres.length} livreur{filtres.length > 1 ? 's' : ''}
              {filtreAvail !== 'tous' && ` · ${{ available:'disponible', on_delivery:'en course', offline:'hors ligne' }[filtreAvail]}`}
            </div>
          )}

          {/* CONTENU */}
          {loading ? (
            <div style={{ textAlign:'center', padding:'48px 0', color:'var(--t3)' }}>
              <i className="fas fa-spinner fa-spin" style={{ fontSize:28, display:'block', marginBottom:12 }} />
              Chargement des livreurs…
            </div>
          ) : filtres.length === 0 ? (
            <div className={styles.vide}>
              <span className={styles.videIco}>🛵</span>
              <strong>Aucun livreur trouvé</strong>
              <span>Modifiez vos filtres ou invitez un nouveau livreur.</span>
              <button className={styles.btnAjouter} onClick={() => setModalInviter(true)}><i className="fas fa-user-plus" /> Inviter</button>
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
                          {STATUS_LABEL[l.status as LivreurStatus]}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className={styles.cardBody}>
                    <div className={styles.cardName}>{l.fullName}</div>
                    <div className={styles.cardVille}><i className="fas fa-map-pin" /> {l.zone ?? 'Zone non définie'}</div>
                    <div className={styles.cardZone} style={{ color:'var(--t2)', fontWeight:600 }}>
                      {l.vehicleEmoji} {vehicleLabel(l.vehicleType as VehicleType)}
                      {l.vehiclePlate && <span style={{ color:'var(--t3)', fontWeight:400 }}> · {l.vehiclePlate}</span>}
                    </div>
                  </div>

                  <div className={styles.cardStats}>
                    <div className={styles.cardStat}>
                      <i className="fas fa-star" style={{ color:'var(--amber)', fontSize:11 }} />
                      <strong>{l.averageRating === 0 ? 'N/A' : l.averageRating.toFixed(1)}</strong>
                      <span>note</span>
                    </div>
                    <div className={styles.cardStat}>
                      <i className="fas fa-box" style={{ color:'var(--blue)', fontSize:11 }} />
                      <strong>{l.totalDeliveries}</strong>
                      <span>courses</span>
                    </div>
                    <div className={styles.cardStat}>
                      <i className="fas fa-calendar-day" style={{ color:'var(--emerald)', fontSize:11 }} />
                      <strong>{l.todayDeliveries}</strong>
                      <span>auj.</span>
                    </div>
                  </div>

                  <div className={styles.cardActivity}>
                    <div className={styles.actDot} style={{ background: AVAIL_DOT[l.availability as Availability] }} />
                    <span>{l.lastActivity}</span>
                    <span className={styles.actTime}>{l.lastActivityAt}</span>
                  </div>

                  <div className={styles.cardActions}>
                    <button className={styles.cardBtnPrimary} onClick={() => setModalProfil(l)}>
                      <i className="fas fa-eye" /> Voir
                    </button>
                    <button className={styles.cardBtnIcon} onClick={() => setModalContact(l)} title="Contacter">
                      <i className="fas fa-envelope" />
                    </button>
                    <a
                      href={`https://wa.me/${(l.phone ?? '').replace(/\s+/g, '')}`}
                      target="_blank" rel="noreferrer"
                      className={styles.cardBtnIcon} title="WhatsApp"
                    >
                      <i className="fab fa-whatsapp" style={{ color: '#25D366', fontSize: 14 }} />
                    </a>
                    <a href={`tel:${l.phone}`} className={styles.cardBtnIcon} title="Appeler">
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
                    {['Livreur','Zone','Véhicule','Note','Courses','Auj.','Disponibilité','Statut','Actions'].map(h => (
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
                      <td className={styles.td}><span style={{ fontSize:12, color:'var(--t2)', fontWeight:600 }}>{l.vehicleEmoji} {vehicleLabel(l.vehicleType as VehicleType)}</span></td>
                      <td className={styles.td}><div className={styles.listRating}><i className="fas fa-star" style={{ color:'var(--amber)', fontSize:11 }} /><strong>{l.averageRating === 0 ? 'N/A' : l.averageRating.toFixed(1)}</strong></div></td>
                      <td className={styles.td}><strong style={{ color:'var(--navy)', fontFamily:'var(--fd)' }}>{l.totalDeliveries}</strong></td>
                      <td className={styles.td}><strong style={{ color:'var(--emerald)', fontFamily:'var(--fd)' }}>{l.todayDeliveries}</strong></td>
                      <td className={styles.td}><BadgeAvail availability={l.availability as Availability} /></td>
                      <td className={styles.td}><span className={`${styles.statutBadge} ${STATUS_CLS[l.status as LivreurStatus]}`}>{STATUS_LABEL[l.status as LivreurStatus]}</span></td>
                      <td className={styles.td}>
                        <div className={styles.listActions}>
                          <button className={styles.listeBtn} onClick={() => setModalProfil(l)} title="Voir"><i className="fas fa-eye" /></button>
                          <button className={styles.listeBtn} onClick={() => setModalContact(l)} title="Contacter"><i className="fas fa-envelope" /></button>
                          <a href={`tel:${l.phone}`} className={styles.listeBtn} title="Appeler"><i className="fas fa-phone" /></a>
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

          {/* Activité récente */}
          <div className={styles.sideCard}>
            <div className={styles.sideCardHeader}><div className={styles.sideCardTitle}><i className="fas fa-clock-rotate-left" /> Activité récente</div></div>
            <div className={styles.sideCardBody}>
              {activite.length === 0 && !loading && <div style={{ color:'var(--t3)', fontSize:13 }}>Aucune activité</div>}
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
            <div className={styles.sideCardHeader}><div className={styles.sideCardTitle}><i className="fas fa-bolt" /> Actions rapides</div></div>
            <div className={styles.sideCardBody}>
              {[
                { ico:'📢', l:'Diffuser une mission',       action: () => pop('📢 Diffusion en cours…', 's')        },
                { ico:'📊', l:'Rapport performances',       action: () => pop('📊 Rapport en génération…', 's')      },
                { ico:'🗺️', l:'Voir carte des livreurs',    action: () => pop('🗺️ Carte ouverte', 's')               },
                { ico:'✅', l:`Valider les en attente (${s.enAttente})`, action: handleValiderTous                   },
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