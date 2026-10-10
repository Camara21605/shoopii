/* ================================================================
 * SecDanger.tsx — Zone sensible du correspondant (connectée)
 *
 * BUGS CORRIGÉS (audit 2026-09, voir DangerService côté API) :
 *   - aucune confirmation par mot de passe : une session volée suffisait pour
 *     supprimer le compte → le mot de passe actuel est demandé pour la pause et
 *     la suppression ;
 *   - « Vos partenaires seront notifiés » / « désactivé 30 jours » : promesses
 *     fausses (aucune notification, aucune reprise automatique) → une PAUSE
 *     réversible, avec un vrai bouton « Reprendre » ;
 *   - après la suppression, le compte restait ouvert : déconnexion immédiate.
 * ================================================================ */
import { useState } from 'react';
import s from '../../styles/ParamsShared.module.css';
import { pop } from '../../components/Toast';
import type { CorrespondantData } from '../../hooks/useCorrespondantParametres';

type Action = 'pause' | 'supprimer';

interface Props {
  data:         CorrespondantData | null;
  onSuspendre:  (password: string) => Promise<{ message: string }>;
  onReprendre:  () => Promise<{ message: string }>;
  onSupprimer:  (password: string) => Promise<{ message: string }>;
  /** Recharge les paramètres (nouveau statut) */
  onRefresh:    () => void;
  onLogout:     () => void;
}

const STATUT_LABEL: Record<string, string> = {
  disabled:  'Activité en pause',
  suspended: 'Compte suspendu par Shoneya ou votre entreprise',
  deleted:   'Suppression en cours',
  pending:   'En attente de validation',
};

export default function SecDanger({ data, onSuspendre, onReprendre, onSupprimer, onRefresh, onLogout }: Props) {
  const [action,   setAction]   = useState<Action | null>(null);
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [busy,     setBusy]     = useState(false);

  const statut  = data?.status ?? 'active';
  const enPause = statut === 'disabled';

  function ouvrir(a: Action) { setAction(a); setPassword(''); setShowPwd(false); }
  function fermer()          { if (!busy) { setAction(null); setPassword(''); } }

  async function confirmer() {
    if (!action) return;
    if (!password) { pop('⚠️ Saisissez votre mot de passe pour confirmer', 'w'); return; }
    setBusy(true);
    try {
      if (action === 'supprimer') {
        const r = await onSupprimer(password);
        pop(`⚠️ ${r.message}`, 'e');
        setAction(null);
        setTimeout(onLogout, 1500);            // compte fermé : plus aucune session valide
        return;
      }
      const r = await onSuspendre(password);
      pop(`⏸ ${r.message}`, 'w');
      setAction(null);
      onRefresh();
    } catch (e: unknown) {
      pop(`❌ ${(e as Error)?.message ?? 'Erreur'}`, 'e');
    } finally {
      setBusy(false);
      setPassword('');
    }
  }

  async function reprendre() {
    setBusy(true);
    try {
      const r = await onReprendre();
      pop(`✅ ${r.message}`, 's');
      onRefresh();
    } catch (e: unknown) {
      pop(`❌ ${(e as Error)?.message ?? 'Erreur'}`, 'e');
    } finally { setBusy(false); }
  }

  const ACTIONS: { id: Action | 'transfert'; title: string; sub: string; btn: string; disabled: boolean }[] = [
    {
      id: 'pause',
      title: 'Mettre mon activité en pause',
      sub:   'Votre relais n’apparaît plus aux clients ni aux boutiques. Toutes vos données sont conservées ; reprenez quand vous voulez depuis ce menu.',
      btn:   'Mettre en pause',
      disabled: statut !== 'active' && statut !== 'pending',
    },
    {
      id: 'transfert',
      title: 'Transférer mes partenaires',
      sub:   'Transférer vos boutiques et livreurs vers un autre correspondant avant de quitter.',
      btn:   'Bientôt disponible',
      disabled: true,
    },
    {
      id: 'supprimer',
      title: 'Supprimer définitivement le compte',
      sub:   'Impossible tant qu’une commande passe par votre relais ou que votre portefeuille contient des fonds. Vos données personnelles sont effacées après 30 jours.',
      btn:   'Supprimer',
      disabled: statut === 'deleted',
    },
  ];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className={s.psHd}>
        <h1>
          <i className="fas fa-triangle-exclamation" style={{ color:'var(--red)' }} />
          <span style={{ color:'var(--red)' }}>Zone sensible</span>
        </h1>
        <p>Actions importantes concernant votre compte correspondant Shoneya. Votre mot de passe vous sera demandé.</p>
      </div>

      {/* Statut actuel */}
      {statut !== 'active' && (
        <div style={{ background:'var(--rs-bg)', border:'1.5px solid rgba(220,38,38,.25)', borderRadius:'var(--r-xl)', padding:'14px 18px', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          <i className="fas fa-circle-exclamation" style={{ color:'var(--red)', fontSize:18 }} />
          <div style={{ flex:1, minWidth:200 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--red)' }}>{STATUT_LABEL[statut] ?? `Statut : ${statut}`}</div>
            <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>
              {enPause
                ? 'Vous n’apparaissez plus aux clients ni aux boutiques. Reprenez votre activité quand vous voulez.'
                : statut === 'suspended' ? 'Contactez le support pour en savoir plus.' : ''}
            </div>
          </div>
          {enPause && (
            <button type="button" className={s.drBtn} disabled={busy} onClick={() => void reprendre()}
              style={{ borderColor:'var(--emerald)', color:'var(--emerald)' }}>
              {busy ? <><i className="fas fa-spinner fa-spin" /> …</> : <><i className="fas fa-play" /> Reprendre</>}
            </button>
          )}
        </div>
      )}

      <div className={`${s.fc} ${s.fcDanger}`}>
        <div className={`${s.fcHd} ${s.fcHdDanger}`}>
          <div className={`${s.fcTtl} ${s.fcTtlDanger}`}>
            <i className="fas fa-triangle-exclamation" style={{ color:'var(--red)' }} /> Actions sensibles
          </div>
        </div>
        <div className={s.fcBody}>
          {ACTIONS.map(a => (
            <div key={a.id}>
              <div className={s.dangerRow}>
                <div>
                  <div className={s.drTtl}>{a.title}</div>
                  <div className={s.drSub}>{a.sub}</div>
                </div>
                <button className={s.drBtn} disabled={a.disabled || busy}
                  onClick={() => { if (a.id !== 'transfert') ouvrir(a.id); }}
                  style={{ opacity: a.disabled ? .4 : 1 }}>
                  {a.btn}
                </button>
              </div>

              {/* Confirmation par mot de passe, sous l'action choisie */}
              {action === a.id && (
                <div style={{ margin:'4px 0 14px', padding:14, border:'1.5px solid rgba(220,38,38,.3)', borderRadius:'var(--r-lg)', background:'var(--rs-bg)' }}>
                  <label htmlFor="cor-danger-pwd" style={{ fontSize:12, fontWeight:700, color:'var(--t1)', display:'block', marginBottom:6 }}>
                    Mot de passe actuel
                  </label>
                  <div style={{ display:'flex', gap:8 }}>
                    <input id="cor-danger-pwd" type={showPwd ? 'text' : 'password'} value={password} autoFocus autoComplete="current-password"
                      onChange={e => setPassword(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') void confirmer(); if (e.key === 'Escape') fermer(); }}
                      style={{ flex:1, padding:'10px 12px', borderRadius:'var(--r-md)', border:'1px solid var(--bdr2)', fontSize:13, background:'var(--white)', color:'var(--t1)' }} />
                    <button type="button" onClick={() => setShowPwd(v => !v)} aria-label={showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                      style={{ background:'var(--g100)', border:'1px solid var(--bdr2)', borderRadius:'var(--r-md)', padding:'0 12px', cursor:'pointer', color:'var(--t2)' }}>
                      <i className={`fas ${showPwd ? 'fa-eye-slash' : 'fa-eye'}`} />
                    </button>
                  </div>
                  <div style={{ display:'flex', gap:8, marginTop:10 }}>
                    <button type="button" onClick={fermer} disabled={busy}
                      style={{ flex:1, background:'var(--g100)', color:'var(--t1)', border:'1px solid var(--bdr2)', borderRadius:'var(--pill)', padding:'10px 0', fontSize:12.5, fontWeight:700, cursor:'pointer' }}>
                      Annuler
                    </button>
                    <button type="button" onClick={() => void confirmer()} disabled={busy || !password}
                      style={{ flex:1, background: password ? 'var(--red)' : 'var(--g200)', color: password ? '#fff' : 'var(--t3)', border:'none',
                        borderRadius:'var(--pill)', padding:'10px 0', fontSize:12.5, fontWeight:700, cursor: password && !busy ? 'pointer' : 'not-allowed' }}>
                      {busy ? <><i className="fas fa-spinner fa-spin" /> …</> : a.id === 'supprimer' ? 'Supprimer mon compte' : 'Mettre en pause'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
