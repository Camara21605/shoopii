/* ================================================================
 * FICHIER : src/dashboards/super-admin/sections/InvitationsSection.tsx
 *
 * CORRECTIONS :
 *   1. Correspondant retiré des rôles invitables par super admin
 *      → Seuls: Administrateur, Partenaire, Entreprise, Livreur
 *   2. Boutons après envoi email :
 *      → Envoyé depuis < WAITING_DAYS jours : masquer tous les boutons
 *      → Envoyé depuis >= WAITING_DAYS jours sans création : Révoquer uniquement
 *   3. Génération = invitation directe avec email obligatoire
 *      → Le modal "Générer codes" envoie directement l'invitation
 * ================================================================ */

import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch, ApiError } from '../../../shared/services/apiFetch';
import type { SuperAdminStore } from '../hooks/useSuperAdminState';

/* ── Constantes ──────────────────────────────────────────────── */

/**
 * Nombre de jours d'attente après envoi avant de ré-afficher les boutons.
 * Si l'acteur n'a pas créé son compte après WAITING_DAYS jours, on peut révoquer.
 */
const WAITING_DAYS = 3;

type CodeStatus = 'valid' | 'expired' | 'revoked' | 'used';

interface InvitationCode {
  id: string; value: string; role: string; status: CodeStatus;
  created: string; expires: string; uses: number; maxUses: number;
  note: string; usedBy?: string; usedAt?: string;
  targetEmail?: string | null; emailSent?: boolean;
}

interface CodeResponse {
  id: string; code: string; role: string; status: CodeStatus;
  createdAt: string; expiresAt: string; uses: number; maxUses: number;
  note: string | null; usedBy?: string; usedAt?: string;
  targetEmail: string | null; emailSent: boolean;
}

interface Props {
  store: SuperAdminStore; toast: (type: string, msg: string) => void; isActive: boolean;
}

/*
 * ✅ RÔLES INVITABLES PAR LE SUPER ADMIN
 * Correspondant retiré — il est invité par entreprise ou livreur.
 */
const INVITABLE_ROLES = [
  { key: 'admin',   label: '🛡 Administrateur' },
  { key: 'partner', label: '🤝 Partenaire'     },
  { key: 'company', label: '🏪 Entreprise'     },
  { key: 'delivery',label: '🛵 Livreur'        },
] as const;

const ROLE_LBL: Record<string, string> = {
  admin: '🛡 Administrateur', partner: '🤝 Partenaire',
  company: '🏪 Entreprise', delivery: '🛵 Livreur',
};

const ROLE_COLOR: Record<string, string> = {
  admin: 'var(--violet)', partner: 'var(--gold)',
  company: 'var(--acid)', delivery: 'var(--sky)',
};

/* ── Helper ──────────────────────────────────────────────────── */

function mapCode(c: CodeResponse): InvitationCode {
  return {
    id: c.id, value: c.code, role: c.role, status: c.status,
    created: c.createdAt, expires: c.expiresAt,
    uses: c.uses, maxUses: c.maxUses, note: c.note ?? '',
    usedBy: c.usedBy, usedAt: c.usedAt,
    targetEmail: c.targetEmail, emailSent: c.emailSent,
  };
}

function statusBadge(status: CodeStatus) {
  const cfg: Record<CodeStatus, { cls: string; label: string }> = {
    valid:   { cls: 'b-acid', label: '✅ Valide'  },
    expired: { cls: 'b-gold', label: '⏰ Expiré'  },
    revoked: { cls: 'b-rose', label: '🚫 Révoqué' },
    used:    { cls: 'b-sky',  label: '✔ Utilisé'  },
  };
  return <span className={`badge ${cfg[status].cls}`}>{cfg[status].label}</span>;
}

/* ── Composant principal ─────────────────────────────────────── */

export default function InvitationsSection({ store, toast, isActive }: Props) {
  const [showModal,       setShowModal]       = useState(false);
  const [codes,           setCodes]           = useState<InvitationCode[]>([]);
  const [loadingCodes,    setLoadingCodes]    = useState(false);
  const [loadingRevoke,   setLoadingRevoke]   = useState<string | null>(null);
  const [loadingInvite,   setLoadingInvite]   = useState(false);
  const [copiedId,        setCopiedId]        = useState<string | null>(null);

  /* Formulaire d'invitation directe */
  const [form, setForm] = useState({
    role:        'company' as string,
    email:       '',
    validity:    30,
    note:        '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const { state } = store;

  /* ── Chargement ── */
  const loadCodes = useCallback(async () => {
    setLoadingCodes(true);
    try {
      const result = await apiFetch<{ data: CodeResponse[]; total: number }>('/codes', {
        params: {
          role:   state.codeRoleFilter   !== 'all' ? state.codeRoleFilter   : undefined,
          status: state.codeStatusFilter !== 'all' ? state.codeStatusFilter : undefined,
          search: state.codeFilter       || undefined,
          limit:  100,
        },
      });
      setCodes(result.data.map(mapCode));
    } catch (err) {
      toast('error', `❌ ${err instanceof ApiError ? err.message : 'Erreur de chargement'}`);
    } finally {
      setLoadingCodes(false);
    }
  }, [state.codeRoleFilter, state.codeStatusFilter, state.codeFilter]);

  useEffect(() => { if (isActive) loadCodes(); }, [isActive, loadCodes]);

  if (!isActive) return null;

  /* ── KPIs ── */
  const valid   = codes.filter(c => c.status === 'valid').length;
  const used    = codes.filter(c => c.status === 'used').length;
  const expired = codes.filter(c => c.status === 'expired').length;
  const revoked = codes.filter(c => c.status === 'revoked').length;

  /* ── Filtrage ── */
  const filtered = codes.filter(c => {
    const matchSearch = !state.codeFilter
      || c.value.toLowerCase().includes(state.codeFilter.toLowerCase())
      || c.note.toLowerCase().includes(state.codeFilter.toLowerCase())
      || (c.usedBy ?? '').toLowerCase().includes(state.codeFilter.toLowerCase());
    const matchStatus = state.codeStatusFilter === 'all' || c.status === state.codeStatusFilter;
    const matchRole   = state.codeRoleFilter   === 'all' || c.role   === state.codeRoleFilter;
    return matchSearch && matchStatus && matchRole;
  });

  /* ── Logique boutons ── */
  function getButtonState(c: InvitationCode) {
    if (c.status !== 'valid') return 'inactive';

    if (!c.emailSent) return 'ready';   // Pas encore envoyé → boutons actifs

    /* Email envoyé : calculer depuis quand */
    const sentDate  = c.created ? new Date(c.created) : null;
    const daysSent  = sentDate
      ? (Date.now() - sentDate.getTime()) / (1000 * 60 * 60 * 24)
      : 0;

    if (daysSent < WAITING_DAYS) return 'waiting';   // < 3 jours → masquer
    return 'overdue';                                // >= 3 jours → révoquer visible
  }

  /* ── Révoquer ── */
  const handleRevoke = async (id: string) => {
    setLoadingRevoke(id);
    try {
      await apiFetch(`/codes/${id}/revoke`, { method: 'PATCH' });
      await loadCodes();
      toast('success', '🚫 Code révoqué');
    } catch (err) {
      toast('error', `❌ ${err instanceof ApiError ? err.message : 'Erreur'}`);
    } finally {
      setLoadingRevoke(null);
    }
  };

  /* ── Invitation directe (génération + envoi immédiat) ── */
  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!form.email.trim()) errors.email = 'Email requis';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Email invalide';
    if (!form.role) errors.role = 'Rôle requis';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInvite = async () => {
    if (!validateForm()) return;
    setLoadingInvite(true);
    try {
      const result = await apiFetch<CodeResponse>('/codes/invite', {
        method: 'POST',
        body: {
          targetEmail:  form.email.trim().toLowerCase(),
          targetRole:   form.role,
          validityDays: form.validity,
          maxUses:      1,
          note:         form.note.trim() || null,
        },
      });

      if (result.emailSent) {
        toast('success', `📧 Invitation envoyée à ${form.email}`);
      } else {
        /* Code créé mais email non envoyé (erreur SMTP) */
        toast('warning', `⚠️ Code créé (${result.code}) mais l'email n'a pas pu être envoyé. Copiez le code manuellement.`);
      }

      setShowModal(false);
      setForm({ role: 'company', email: '', validity: 30, note: '' });
      setFormErrors({});
      await loadCodes();
    } catch (err) {
      toast('error', `❌ ${err instanceof ApiError ? err.message : 'Erreur'}`);
    } finally {
      setLoadingInvite(false);
    }
  };

  /* ── Rendu ── */
  return (
    <div className="section active" style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* En-tête */}
      <div className="page-header">
        <div>
          <div className="ph-title">Codes <mark>d'Invitation</mark></div>
          <div className="ph-sub">
            Le super admin invite : Administrateur, Partenaire, Entreprise, Livreur.<br />
            Les correspondants sont invités par les entreprises ou les livreurs.
          </div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-ghost btn-sm" onClick={loadCodes} disabled={loadingCodes}>
            {loadingCodes ? '⏳' : '🔄'}
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + Inviter un acteur
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:14 }}>
        <div className="fin-card"><div className="fin-label">Valides</div><div className="fin-val" style={{ color:'var(--acid)' }}>{valid}</div></div>
        <div className="fin-card"><div className="fin-label">Utilisés</div><div className="fin-val" style={{ color:'var(--sky)' }}>{used}</div></div>
        <div className="fin-card"><div className="fin-label">Expirés</div><div className="fin-val" style={{ color:'var(--gold)' }}>{expired}</div></div>
        <div className="fin-card"><div className="fin-label">Révoqués</div><div className="fin-val" style={{ color:'var(--rose)' }}>{revoked}</div></div>
      </div>

      {/* Filtres */}
      <div className="card" style={{ overflow:'hidden' }}>
        <div style={{ display:'flex', gap:10, padding:16, borderBottom:'1px solid var(--border)', flexWrap:'wrap', alignItems:'center' }}>
          <div className="search-wrap" style={{ flex:1, minWidth:180 }}>
            <span style={{ color:'var(--txt-3)' }}>🔍</span>
            <input type="text" placeholder="Rechercher…" value={state.codeFilter} onChange={e => store.setCodeFilter(e.target.value)} />
          </div>

          <select className="sel" value={state.codeStatusFilter} onChange={e => store.setCodeStatusFilter(e.target.value)}>
            <option value="all">Tous les statuts</option>
            <option value="valid">✅ Valides</option>
            <option value="used">✔ Utilisés</option>
            <option value="expired">⏰ Expirés</option>
            <option value="revoked">🚫 Révoqués</option>
          </select>

          {/* ✅ Filtres rôles — sans correspondant */}
          <select className="sel" value={state.codeRoleFilter} onChange={e => store.setCodeRoleFilter(e.target.value)}>
            <option value="all">Tous les rôles</option>
            {INVITABLE_ROLES.map(r => (
              <option key={r.key} value={r.key}>{r.label}</option>
            ))}
          </select>
        </div>

        {/* Liste des codes */}
        <div className="codes-grid" style={{ padding:16 }}>
          {loadingCodes ? (
            <div style={{ textAlign:'center', padding:32, color:'var(--txt-3)', gridColumn:'1/-1' }}>⏳ Chargement…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign:'center', padding:32, color:'var(--txt-3)', gridColumn:'1/-1' }}>Aucun code trouvé</div>
          ) : filtered.map(c => {
            const roleColor  = ROLE_COLOR[c.role] || 'var(--acid)';
            const revoking   = loadingRevoke === c.id;
            const btnState   = getButtonState(c);
            const isInactive = c.status === 'used' || c.status === 'expired' || c.status === 'revoked';

            return (
              <div
                key={c.id}
                className={`code-card ${c.status}`}
                style={{ opacity: isInactive ? .72 : 1, borderTop: `2px solid ${roleColor}44` }}
              >
                {/* Statut + rôle */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                  {statusBadge(c.status)}
                  <span className="badge b-sky" style={{ fontSize:9 }}>{ROLE_LBL[c.role] || c.role}</span>
                </div>

                {/* Code */}
                <div className="code-val" style={{ textDecoration: isInactive ? 'line-through' : 'none', opacity: isInactive ? .55 : 1 }}>
                  {c.value}
                </div>

                {/* Meta */}
                <div className="code-meta">
                  <span style={{ fontSize:10, color:'var(--txt-3)' }}>📅 Expire {c.expires}</span>
                  <span style={{ fontSize:10, color:'var(--txt-2)' }}>🔢 {c.uses}/{c.maxUses} util.</span>
                </div>

                {/* Email destinataire */}
                {c.targetEmail && (
                  <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:10.5, marginTop:5 }}>
                    <span>{c.emailSent ? '📧' : '⏳'}</span>
                    <span style={{ color: c.emailSent ? 'var(--acid)' : 'var(--txt-3)', fontWeight:600 }}>{c.targetEmail}</span>
                    <span style={{ color:'var(--txt-3)', fontSize:9 }}>
                      {c.emailSent ? '· Invitation envoyée' : '· En attente'}
                    </span>
                  </div>
                )}

                {/* Compte créé par */}
                {c.usedBy && (
                  <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:10.5, color:'var(--sky)', marginTop:5, fontWeight:600 }}>
                    <span>👤</span><span>{c.usedBy}</span>
                    {c.usedAt && <span style={{ color:'var(--txt-3)', fontWeight:400 }}>· {c.usedAt}</span>}
                  </div>
                )}

                {/* Note */}
                {c.note && (
                  <div style={{ fontSize:10.5, color:'var(--txt-2)', marginTop:6 }}>💬 {c.note}</div>
                )}

                {/* ═══════════════════════════════════════════════════════
                    BOUTONS selon l'état
                    ─────────────────────────────────────────────────────
                    ready    → Copier + Révoquer
                    waiting  → Aucun bouton (masqués pendant WAITING_DAYS)
                    overdue  → Révoquer uniquement (après WAITING_DAYS sans inscription)
                    inactive → Message seul
                ═══════════════════════════════════════════════════════ */}
                <div className="code-actions" style={{ marginTop:10 }}>

                  {btnState === 'ready' && (
                    <>
                      <button
                        className="btn btn-ghost btn-xs"
                        onClick={() => {
                          navigator.clipboard.writeText(c.value).catch(() => {});
                          setCopiedId(c.id);
                          setTimeout(() => setCopiedId(null), 1500);
                          toast('success', '📋 Code copié');
                        }}
                      >
                        {copiedId === c.id ? '✅ Copié' : '📋 Copier'}
                      </button>

                      <button
                        className="btn btn-danger btn-xs"
                        onClick={() => handleRevoke(c.id)}
                        disabled={revoking}
                      >
                        {revoking ? '⏳' : '🚫'} Révoquer
                      </button>
                    </>
                  )}

                  {btnState === 'waiting' && (
                    /*
                     * Email envoyé mais l'acteur n'a pas encore créé son compte.
                     * On attend WAITING_DAYS jours avant de ré-afficher les boutons.
                     */
                    <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:10.5, color:'var(--txt-3)', fontStyle:'italic' }}>
                      <span style={{ width:6, height:6, borderRadius:'50%', background:roleColor, display:'inline-block', animation:'pulse-dot 1.8s ease infinite', flexShrink:0 }} />
                      En attente de l'inscription…
                    </div>
                  )}

                  {btnState === 'overdue' && (
                    /*
                     * L'acteur n'a pas créé son compte après WAITING_DAYS jours.
                     * On peut maintenant révoquer le code.
                     */
                    <>
                      <div style={{ fontSize:10, color:'var(--gold)', flex:1 }}>
                        ⚠️ Pas de réponse après {WAITING_DAYS} jours
                      </div>
                      <button
                        className="btn btn-danger btn-xs"
                        onClick={() => handleRevoke(c.id)}
                        disabled={revoking}
                      >
                        {revoking ? '⏳' : '🚫'} Révoquer
                      </button>
                    </>
                  )}

                  {c.status === 'used' && (
                    <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:10.5, color:'var(--sky)', fontWeight:600 }}>
                      <span>✅</span> Compte créé
                      {c.usedBy && <span style={{ color:'var(--txt-3)', fontWeight:400 }}>· {c.usedBy}</span>}
                    </div>
                  )}

                  {c.status === 'expired' && (
                    <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:10.5, color:'var(--gold)', fontWeight:600 }}>
                      <span>⏰</span> Code expiré le {c.expires}
                    </div>
                  )}

                  {c.status === 'revoked' && (
                    <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:10.5, color:'var(--rose)', fontWeight:600 }}>
                      <span>🚫</span> Code révoqué
                    </div>
                  )}

                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          MODAL — INVITATION DIRECTE
          Génère UN code et l'envoie immédiatement par email.
          Rôles disponibles : Admin, Partenaire, Entreprise, Livreur.
      ═══════════════════════════════════════════════════════════ */}
      {showModal && (
        <div
          className="modal-overlay open"
          onClick={e => { if (e.target === e.currentTarget && !loadingInvite) setShowModal(false); }}
        >
          <div className="modal" style={{ width:480 }}>
            <div className="modal-head">
              <div>
                <div style={{ fontFamily:'var(--font-h)', fontWeight:900, fontSize:17 }}>📧 Inviter un acteur</div>
                <div style={{ fontSize:12, color:'var(--txt-2)', marginTop:3 }}>
                  Génère un code et l'envoie directement par email
                </div>
              </div>
              <button className="modal-close" onClick={() => setShowModal(false)} disabled={loadingInvite}>✕</button>
            </div>

            <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:16 }}>

              {/* Note d'information */}
              <div style={{ background:'rgba(99,102,241,.08)', border:'1px solid rgba(99,102,241,.2)', borderRadius:10, padding:'10px 14px', fontSize:11.5, color:'var(--txt-2)', lineHeight:1.6 }}>
                ℹ️ Un email sera envoyé à l'adresse indiquée avec un lien d'inscription pré-rempli.<br />
                <strong>Les correspondants</strong> ne sont pas invitables ici — ils rejoignent via les entreprises ou livreurs.
              </div>

              {/* Rôle */}
              <div className="mf" style={{ marginBottom:0 }}>
                <label>Rôle cible <span style={{ color:'var(--rose)' }}>*</span></label>
                <select
                  className="input-field"
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  disabled={loadingInvite}
                >
                  {INVITABLE_ROLES.map(r => (
                    <option key={r.key} value={r.key}>{r.label}</option>
                  ))}
                </select>
              </div>

              {/* Email */}
              <div className="mf" style={{ marginBottom:0 }}>
                <label>Email du destinataire <span style={{ color:'var(--rose)' }}>*</span></label>
                <input
                  className="input-field"
                  type="email"
                  placeholder="acteur@exemple.com"
                  value={form.email}
                  onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setFormErrors(err => ({ ...err, email: '' })); }}
                  disabled={loadingInvite}
                  autoFocus
                  style={{ borderColor: formErrors.email ? 'var(--rose)' : undefined }}
                />
                {formErrors.email && (
                  <div style={{ fontSize:11, color:'var(--rose)', marginTop:4 }}>⚠ {formErrors.email}</div>
                )}
              </div>

              {/* Validité */}
              <div className="mf" style={{ marginBottom:0 }}>
                <label>Durée de validité (jours)</label>
                <input
                  className="input-field"
                  type="number" min={1} max={365}
                  value={form.validity}
                  onChange={e => setForm(f => ({ ...f, validity: +e.target.value }))}
                  disabled={loadingInvite}
                />
              </div>

              {/* Note */}
              <div className="mf" style={{ marginBottom:0 }}>
                <label>Note interne (optionnel)</label>
                <input
                  className="input-field"
                  type="text"
                  placeholder="ex: Partenaire recommandé par Moussa"
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  disabled={loadingInvite}
                />
              </div>
            </div>

            <div className="modal-foot">
              <button
                className="btn btn-primary"
                onClick={handleInvite}
                disabled={loadingInvite}
                style={{ minWidth:160, display:'flex', alignItems:'center', gap:8, justifyContent:'center' }}
              >
                {loadingInvite ? (
                  <><span style={{ width:14, height:14, borderRadius:'50%', border:'2px solid rgba(255,255,255,.3)', borderTopColor:'white', display:'inline-block', animation:'spin .7s linear infinite' }} /> Envoi…</>
                ) : (
                  <>📧 Envoyer l'invitation</>
                )}
              </button>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)} disabled={loadingInvite}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.7)} }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}