// ─────────────────────────────────────────────────────────────
// FICHIER : src/dashboards/super-admin/sections/PermissionsSection.tsx
// ─────────────────────────────────────────────────────────────

import { useState } from 'react';
import type { SuperAdminStore } from '../hooks/useSuperAdminState';
import { GEO_LEVELS } from './geo/geo.types';
import { apiFetch } from '../../../shared/services/apiFetch';

interface PaysOption { id: string; nom: string; }

interface Props {
  store: SuperAdminStore;
  toast: (type: string, msg: string) => void;
  isActive: boolean;
}

const PERM_COLS: { key: string; label: string }[] = [
  { key: 'partners',   label: 'Partenaires'  },
  { key: 'companies',  label: 'Entreprises'  },
  { key: 'delivery',   label: 'Livreurs'     },
  { key: 'customers',  label: 'Clients'      },
  { key: 'stats',      label: 'Stats'        },
  { key: 'reports',    label: 'Signalements' },
  { key: 'notifs',     label: 'Notifs'       },
  { key: 'support',    label: 'Support'      },
];

/* Configs des 6 niveaux géo (on réutilise GEO_LEVELS de la section géo) */
const GEO_PERM_LEVELS = GEO_LEVELS.map(l => ({
  key:   `geo_${l.level === 'region' ? 'regions' : l.level === 'pays' ? 'pays' : l.level === 'prefecture' ? 'prefectures' : l.level === 'commune' ? 'communes' : l.level === 'quartier' ? 'quartiers' : 'zones'}`,
  label: l.labelPlural,
  icon:  l.icon,
  color: l.color,
}));

export default function PermissionsSection({ store, toast, isActive }: Props) {
  if (!isActive) return null;

  const { admins, adminsLoading, adminsError, reloadAdmins, toggleAdminPerm, setAdminPaysAssigne } = store;
  const [expandedGeo,       setExpandedGeo]       = useState<string | null>(null);
  const [paysList,          setPaysList]           = useState<PaysOption[]>([]);
  const [paysLoaded,        setPaysLoaded]         = useState(false);
  const [paysLoading,       setPaysLoading]        = useState(false);
  const [paysAssigneSaving, setPaysAssigneSaving]  = useState<string | null>(null);

  /* Charge la liste des pays uniquement à la première ouverture d'un panel géo */
  const loadPaysIfNeeded = () => {
    if (paysLoaded || paysLoading) return;
    setPaysLoading(true);
    apiFetch<{ id: string; nom: string }[]>('/geo/pays')
      .then(data => { setPaysList(data ?? []); setPaysLoaded(true); })
      .catch(() => {})
      .finally(() => setPaysLoading(false));
  };

  const handleToggle = async (email: string, perm: string, val: boolean) => {
    const admin = admins.find(a => a.email === email);
    try {
      await toggleAdminPerm(email, perm, val);
      toast('success', `🔐 '${perm}' ${val ? 'accordée' : 'révoquée'} à ${admin?.name || email}`);
    } catch (e: any) {
      toast('error', `❌ ${e?.message ?? 'Erreur'}`);
    }
  };

  const handlePaysAssigne = async (email: string, paysId: string | null) => {
    setPaysAssigneSaving(email);
    try {
      await setAdminPaysAssigne(email, paysId);
      const label = paysId ? (paysList.find(p => p.id === paysId)?.nom ?? paysId) : 'retiré';
      toast('success', `🌍 Pays ${paysId ? `"${label}" assigné` : 'retiré'} pour ${email}`);
    } catch (e: any) {
      toast('error', `❌ ${e?.message ?? 'Erreur'}`);
    } finally {
      setPaysAssigneSaving(null);
    }
  };

  return (
    <div className="section active">
      <div className="page-header">
        <div>
          <div className="ph-title">Permissions <mark>Admins</mark></div>
          <div className="ph-sub">Gestion granulaire des droits administrateurs</div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-ghost btn-sm" onClick={reloadAdmins} disabled={adminsLoading} title="Actualiser">
            {adminsLoading ? '⏳' : '🔄'}
          </button>
        </div>
      </div>

      {adminsError && (
        <div style={{ margin:'0 0 12px', padding:'10px 14px', background:'rgba(220,38,38,.08)', border:'1px solid rgba(220,38,38,.25)', borderRadius:8, fontSize:12, color:'var(--rose,#dc2626)', display:'flex', alignItems:'center', gap:8 }}>
          <span>⚠️</span> {adminsError}
          <button onClick={reloadAdmins} style={{ marginLeft:'auto', background:'none', border:'1px solid currentColor', borderRadius:5, padding:'2px 8px', fontSize:11, cursor:'pointer', color:'inherit' }}>
            Réessayer
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          CARTE 1 — Modules généraux
      ══════════════════════════════════════════════════ */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head">
          <div className="card-title"><i className="fas fa-shield-halved" style={{ color: 'var(--acid)' }} /> Modules généraux</div>
          <span className="badge b-sky">Permissions délégables</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="perm-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Administrateur</th>
                {PERM_COLS.map(p => (
                  <th key={p.key}>{p.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {adminsLoading && (
                <tr>
                  <td colSpan={PERM_COLS.length + 1} style={{ textAlign: 'center', padding: '32px', color: 'var(--txt-3)' }}>
                    ⏳ Chargement des administrateurs…
                  </td>
                </tr>
              )}
              {!adminsLoading && admins.length === 0 && !adminsError && (
                <tr>
                  <td colSpan={PERM_COLS.length + 1} style={{ textAlign: 'center', padding: '32px', color: 'var(--txt-3)' }}>
                    Aucun administrateur secondaire
                  </td>
                </tr>
              )}
              {!adminsLoading && admins.map(admin => {
                const init = admin.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
                return (
                  <tr key={admin.email}>
                    <td>
                      <div className="u-cell">
                        <div className="u-av" style={{ background: 'var(--rose-dim)', color: 'var(--rose)' }}>
                          {init}
                        </div>
                        <div className="u-info">
                          <div className="u-name">{admin.name}</div>
                          <div className="u-email">{admin.email}</div>
                        </div>
                      </div>
                    </td>
                    {PERM_COLS.map(p => (
                      <td key={p.key}>
                        <label className="toggle" style={{ margin: '0 auto' }}>
                          <input
                            type="checkbox"
                            checked={!!(admin.perms as Record<string, boolean>)[p.key]}
                            onChange={e => handleToggle(admin.email, p.key, e.target.checked)}
                          />
                          <div className="toggle-track" />
                          <div className="toggle-thumb" />
                        </label>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          CARTE 2 — Référentiel Géographique
      ══════════════════════════════════════════════════ */}
      <div className="card">
        <div className="card-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="card-title">
              <i className="fas fa-earth-africa" style={{ color: 'var(--acid)' }} /> Référentiel Géographique
            </div>
            <span className="badge b-sky">Gestion des zones de livraison</span>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--txt-3)', maxWidth: 360, lineHeight: 1.5 }}>
            Accordez à chaque admin les niveaux géographiques qu'il peut créer, modifier et supprimer.
          </div>
        </div>

        <div style={{ padding: '0 0 4px' }}>

          {adminsLoading && (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--txt-3)' }}>
              ⏳ Chargement…
            </div>
          )}

          {!adminsLoading && admins.length === 0 && !adminsError && (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--txt-3)', fontSize: 13 }}>
              Aucun administrateur secondaire
            </div>
          )}

          {!adminsLoading && admins.map((admin, idx) => {
            const init   = admin.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
            const perms  = admin.perms as Record<string, boolean>;
            const isOpen = expandedGeo === admin.email;
            const activeCount = GEO_PERM_LEVELS.filter(g => perms[g.key]).length;

            return (
              <div key={admin.email} style={{
                borderTop: idx > 0 ? '1px solid var(--border)' : undefined,
              }}>
                {/* ── En-tête admin (cliquable pour expand) ── */}
                <button
                  onClick={() => { setExpandedGeo(isOpen ? null : admin.email); if (!isOpen) loadPaysIfNeeded(); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 20px', background: 'none', border: 'none',
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'background .12s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--rose-dim)', color: 'var(--rose)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-h)', fontWeight: 800, fontSize: 13,
                  }}>
                    {init}
                  </div>

                  {/* Nom + email */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--txt-1)' }}>{admin.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--txt-3)', marginTop: 1 }}>{admin.email}</div>
                  </div>

                  {/* Badge niveaux actifs */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {activeCount > 0 ? (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '3px 10px', borderRadius: 'var(--pill)',
                        background: 'rgba(132,204,22,.12)', color: 'var(--acid)',
                        fontSize: 11, fontWeight: 700,
                      }}>
                        <i className="fas fa-earth-africa" style={{ fontSize: 9 }} />
                        {activeCount}/6 niveaux
                      </span>
                    ) : (
                      <span style={{
                        padding: '3px 10px', borderRadius: 'var(--pill)',
                        background: 'var(--surface)', color: 'var(--txt-3)',
                        fontSize: 11, fontWeight: 600,
                      }}>
                        Aucun accès géo
                      </span>
                    )}
                    <i
                      className={`fas fa-chevron-${isOpen ? 'up' : 'down'}`}
                      style={{ fontSize: 11, color: 'var(--txt-3)', transition: 'transform .2s' }}
                    />
                  </div>
                </button>

                {/* ── Grille des 6 niveaux géo (expand) ── */}
                {isOpen && (
                  <div style={{ padding: '4px 20px 20px' }}>

                    {/* ── Sélecteur de pays assigné ── */}
                    <div style={{
                      marginBottom: 16, padding: '12px 14px', borderRadius: 10,
                      border: `1.5px solid ${admin.paysAssigne ? 'rgba(37,96,220,.35)' : 'var(--border)'}`,
                      background: admin.paysAssigne ? 'rgba(37,96,220,.05)' : 'var(--surface)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <i className="fas fa-location-dot" style={{ color: 'var(--blue)', fontSize: 13 }} />
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--txt-1)' }}>
                          Pays assigné
                        </span>
                        {!admin.paysAssigne && (
                          <span style={{
                            fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em',
                            padding: '2px 7px', borderRadius: 5,
                            background: 'rgba(220,38,38,.1)', color: 'var(--rose)',
                            textTransform: 'uppercase',
                          }}>Requis</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--txt-3)', marginBottom: 8 }}>
                        L'admin ne peut gérer que les éléments géographiques de son pays assigné.
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <select
                          value={admin.paysAssigne ?? ''}
                          disabled={paysLoading || paysAssigneSaving === admin.email}
                          onChange={e => handlePaysAssigne(admin.email, e.target.value || null)}
                          style={{
                            flex: 1, padding: '7px 10px', borderRadius: 8, fontSize: 13,
                            border: '1.5px solid var(--border)', background: 'var(--bg)',
                            color: 'var(--txt-1)', cursor: 'pointer',
                            opacity: (paysLoading || paysAssigneSaving === admin.email) ? 0.6 : 1,
                          }}
                        >
                          <option value="">— Aucun pays assigné —</option>
                          {paysList.map(p => (
                            <option key={p.id} value={p.id}>{p.nom}</option>
                          ))}
                        </select>
                        {paysAssigneSaving === admin.email && (
                          <i className="fas fa-circle-notch fa-spin" style={{ color: 'var(--txt-3)', fontSize: 14 }} />
                        )}
                      </div>
                    </div>

                    {/* Boutons globaux */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={!admin.paysAssigne}
                        title={!admin.paysAssigne ? 'Assignez d\'abord un pays' : undefined}
                        onClick={async () => {
                          for (const g of GEO_PERM_LEVELS) {
                            if (!perms[g.key]) await handleToggle(admin.email, g.key, true);
                          }
                        }}
                        style={{ fontSize: 11, opacity: admin.paysAssigne ? 1 : 0.45 }}
                      >
                        <i className="fas fa-check-double" /> Tout accorder
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={async () => {
                          for (const g of GEO_PERM_LEVELS) {
                            if (perms[g.key]) await handleToggle(admin.email, g.key, false);
                          }
                        }}
                        style={{ fontSize: 11, color: 'var(--rose)' }}
                      >
                        <i className="fas fa-ban" /> Tout révoquer
                      </button>
                    </div>

                    {/* Grille 3×2 des niveaux */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                      gap: 10,
                      opacity: admin.paysAssigne ? 1 : 0.45,
                      pointerEvents: admin.paysAssigne ? 'auto' : 'none',
                    }}>
                      {GEO_PERM_LEVELS.map(g => {
                        const active = !!perms[g.key];
                        return (
                          <label
                            key={g.key}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '11px 14px', borderRadius: 10, cursor: admin.paysAssigne ? 'pointer' : 'not-allowed',
                              border: `1.5px solid ${active ? `var(${g.color})` : 'var(--border)'}`,
                              background: active ? `color-mix(in srgb, var(${g.color}) 8%, transparent)` : 'var(--surface)',
                              transition: 'all .15s',
                            }}
                          >
                            {/* Icône niveau */}
                            <div style={{
                              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                              background: active ? `color-mix(in srgb, var(${g.color}) 15%, transparent)` : 'var(--raised)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'background .15s',
                            }}>
                              <i className={`fas ${g.icon}`} style={{ color: active ? `var(${g.color})` : 'var(--txt-3)', fontSize: 13 }} />
                            </div>

                            {/* Label */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                fontSize: 12.5, fontWeight: 700,
                                color: active ? `var(${g.color})` : 'var(--txt-1)',
                                transition: 'color .15s',
                              }}>
                                {g.label}
                              </div>
                              <div style={{ fontSize: 10.5, color: active ? `var(${g.color})` : 'var(--txt-3)', marginTop: 1, opacity: active ? 0.8 : 1 }}>
                                {active ? 'Accès accordé' : 'Accès refusé'}
                              </div>
                            </div>

                            {/* Toggle */}
                            <div className="toggle" style={{ pointerEvents: 'none' }}>
                              <input
                                type="checkbox"
                                checked={active}
                                onChange={e => handleToggle(admin.email, g.key, e.target.checked)}
                                onClick={e => e.stopPropagation()}
                                style={{ pointerEvents: 'auto' }}
                              />
                              <div className="toggle-track" />
                              <div className="toggle-thumb" />
                            </div>
                          </label>
                        );
                      })}
                    </div>

                    {/* Note d'info */}
                    <div style={{
                      marginTop: 12, padding: '9px 13px',
                      background: 'rgba(132,204,22,.06)',
                      border: '1px solid rgba(132,204,22,.2)',
                      borderRadius: 8, fontSize: 11.5, color: 'var(--txt-2)',
                      display: 'flex', alignItems: 'flex-start', gap: 7,
                    }}>
                      <i className="fas fa-circle-info" style={{ color: 'var(--acid)', marginTop: 1, flexShrink: 0 }} />
                      <span>
                        L'accès à un niveau inclut la lecture, la création, la modification et la suppression des éléments de ce niveau.
                        Le super-admin conserve toujours l'accès complet au référentiel géographique.
                      </span>
                    </div>

                    {/* ── Permission avancée : modifier les données du super-admin ── */}
                    {(() => {
                      const active = !!perms['geo_modifier_protege'];
                      return (
                        <div style={{
                          marginTop: 14,
                          padding: '14px 16px',
                          borderRadius: 12,
                          border: `1.5px solid ${active ? 'rgba(180,83,9,.45)' : 'var(--border)'}`,
                          background: active ? 'rgba(180,83,9,.06)' : 'var(--surface)',
                          display: 'flex', alignItems: 'center', gap: 14,
                          transition: 'all .15s',
                        }}>
                          {/* Icône */}
                          <div style={{
                            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                            background: active ? 'rgba(180,83,9,.14)' : 'var(--raised)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'background .15s',
                          }}>
                            <i className={`fas fa-shield-${active ? 'halved' : 'halved'}`}
                              style={{ color: active ? 'var(--gold,#B45309)' : 'var(--txt-3)', fontSize: 16 }} />
                          </div>

                          {/* Texte */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: 13, fontWeight: 700,
                              color: active ? 'var(--gold,#B45309)' : 'var(--txt-1)',
                            }}>
                              Modifier les données du super-admin
                            </div>
                            <div style={{ fontSize: 11.5, color: active ? 'rgba(180,83,9,.75)' : 'var(--txt-3)', marginTop: 2 }}>
                              {active
                                ? 'Cet admin peut modifier et supprimer les éléments créés par le super-administrateur.'
                                : 'Accorder uniquement si cet admin est responsable terrain de la zone concernée.'}
                            </div>
                          </div>

                          {/* Avertissement + Toggle */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                            {!active && (
                              <span style={{
                                fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em',
                                padding: '3px 8px', borderRadius: 6,
                                background: 'rgba(180,83,9,.1)', color: 'var(--gold,#B45309)',
                                textTransform: 'uppercase',
                              }}>
                                Sensible
                              </span>
                            )}
                            <label className="toggle">
                              <input
                                type="checkbox"
                                checked={active}
                                onChange={e => handleToggle(admin.email, 'geo_modifier_protege', e.target.checked)}
                              />
                              <div className="toggle-track" />
                              <div className="toggle-thumb" />
                            </label>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
