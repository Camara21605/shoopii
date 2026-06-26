/* SecDanger.tsx — VERSION CONNECTÉE */
import React, { useState } from 'react';
import s from '../../styles/ParamsShared.module.css';
import { pop } from '../../components/Toast';
import type { CorrespondantData } from '../../hooks/useCorrespondantParametres';

interface Props {
  data:         CorrespondantData | null;
  onSuspendre:  () => Promise<any>;
  onDesactiver: () => Promise<any>;
  onSupprimer:  () => Promise<any>;
}

export default function SecDanger({ data, onSuspendre, onDesactiver, onSupprimer }: Props) {
  const [confirm,  setConfirm]  = useState<string | null>(null);
  const [loading,  setLoading]  = useState<string | null>(null);

  /* Compte déjà suspendu/désactivé ? */
  const isActive = data?.status === 'active';

  const ACTIONS = [
    {
      title: 'Suspendre mon activité temporairement',
      sub:   'Mettez votre relais en pause sans perdre vos données. Vos partenaires seront notifiés.',
      btn:   'Suspendre',
      disabled: !isActive,
      fn: async () => { const r = await onSuspendre(); pop(`✅ ${r.message}`, 'w'); },
    },
    {
      title: 'Désactiver mon compte (30 jours)',
      sub:   'Votre profil sera masqué pendant 30 jours. Toutes les données sont conservées.',
      btn:   'Désactiver',
      disabled: false,
      fn: async () => { const r = await onDesactiver(); pop(`✅ ${r.message}`, 'w'); },
    },
    {
      title: 'Transférer mes partenaires',
      sub:   'Transférer vos boutiques et livreurs vers un autre correspondant avant de quitter.',
      btn:   'Transférer',
      disabled: false,
      fn: async () => { pop('🔄 Fonctionnalité de transfert bientôt disponible', 'i'); },
    },
    {
      title: 'Supprimer définitivement le compte',
      sub:   'Action irréversible — toutes vos données, historique et commissions non retirées seront perdus.',
      btn:   'Supprimer',
      disabled: false,
      fn: async () => { const r = await onSupprimer(); pop(`⚠️ ${r.message}`, 'e'); },
    },
  ];

  async function handle(title: string, fn: () => Promise<void>) {
    /* Double confirmation requise */
    if (confirm !== title) {
      setConfirm(title);
      pop('⚠️ Cliquez une 2ème fois pour confirmer', 'w');
      setTimeout(() => setConfirm(null), 4000);
      return;
    }
    setConfirm(null);
    setLoading(title);
    try {
      await fn();
    } catch (e: any) {
      pop(`❌ ${e.message ?? 'Erreur'}`, 'e');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className={s.psHd}>
        <h1>
          <i className="fas fa-triangle-exclamation" style={{ color:'var(--red,#DC2626)' }} />
          <span style={{ color:'var(--red,#DC2626)' }}>Zone sensible</span>
        </h1>
        <p>Actions irréversibles concernant votre compte correspondant Shopi. Procédez avec précaution.</p>
      </div>

      {/* Statut actuel */}
      {data?.status && data.status !== 'active' && (
        <div style={{ background:'rgba(220,38,38,.06)', border:'1.5px solid rgba(220,38,38,.2)', borderRadius:'var(--r-xl)', padding:'14px 18px', display:'flex', alignItems:'center', gap:10 }}>
          <i className="fas fa-circle-exclamation" style={{ color:'var(--red,#DC2626)', fontSize:18 }} />
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--red,#DC2626)' }}>Statut actuel : {data.status}</div>
            <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>Votre compte est dans un état non-actif. Contactez le support pour le réactiver.</div>
          </div>
        </div>
      )}

      <div className={`${s.fc} ${s.fcDanger}`}>
        <div className={`${s.fcHd} ${s.fcHdDanger}`}>
          <div className={`${s.fcTtl} ${s.fcTtlDanger}`}>
            <i className="fas fa-triangle-exclamation" style={{ color:'var(--red,#DC2626)' }} /> Actions sensibles
          </div>
        </div>
        <div className={s.fcBody}>
          {ACTIONS.map(action => (
            <div key={action.title} className={s.dangerRow}>
              <div>
                <div className={s.drTtl}>{action.title}</div>
                <div className={s.drSub}>{action.sub}</div>
              </div>
              <button
                className={s.drBtn}
                disabled={action.disabled || loading === action.title}
                onClick={() => handle(action.title, action.fn)}
                style={{
                  borderColor: confirm === action.title ? 'var(--red,#DC2626)' : undefined,
                  background:  confirm === action.title ? 'rgba(220,38,38,.18)' : undefined,
                  opacity: action.disabled ? .4 : 1,
                }}
              >
                {loading === action.title
                  ? <><i className="fas fa-spinner fa-spin" /> …</>
                  : confirm === action.title
                    ? '⚠️ Confirmer ?'
                    : action.btn
                }
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}