/* SecNotifications.tsx — VERSION CONNECTÉE */
import React, { useState, useEffect } from 'react';
import s from '../../styles/ParamsShared.module.css';
import ToggleRow from './ToggleRow';
import { pop } from '../../components/Toast';
import { NOTIF_COLIS, NOTIF_FINANCES, NOTIF_CANAUX, type ToggleRow as TRow } from '../../data/parametresData';
import type { CorrespondantData } from '../../hooks/useCorrespondantParametres';

interface Props {
  data: CorrespondantData | null; saving: boolean;
  dirty: () => void; markClean: () => void; saveTrigger: number;
  onSave: (notifSettings: Record<string, Record<string, boolean>>) => Promise<any>;
}

/* Clés JSON backend pour chaque toggle */
const COLIS_KEYS    = ['nouveauColis','colisEnAttente48h','transfertLivreur','colisRecupere','saturation80'];
const FINANCES_KEYS = ['commissionEncaissee','virementEffectue','bilanHebdo','seuilWallet'];
const CANAUX_KEYS   = ['push','sms','whatsapp','email'];

/* Interrupteurs réellement branchés sur le moteur de notifications (voir NotificationsService côté API).
 * Les autres n'ont aucune notification correspondante : affichés « bientôt disponible », désactivés,
 * plutôt que de laisser croire qu'ils changent quelque chose. */
const BRANCHES = new Set(['nouveauColis', 'transfertLivreur', 'colisRecupere', 'commissionEncaissee', 'push', 'email']);

export default function SecNotifications({ data, saving, dirty, markClean, saveTrigger, onSave }: Props) {
  const [colis,    setColis]    = useState<TRow[]>(NOTIF_COLIS.map(t    => ({ ...t })));
  const [finances, setFinances] = useState<TRow[]>(NOTIF_FINANCES.map(t => ({ ...t })));
  const [canaux,   setCanaux]   = useState<TRow[]>(NOTIF_CANAUX.map(t   => ({ ...t })));

  /* ── Init depuis API ── */
  useEffect(() => {
    if (!data?.notifSettings) return;
    const ns = data.notifSettings;
    if (ns.colis)    setColis(p    => p.map((t, i) => ({ ...t, checked: ns.colis?.[COLIS_KEYS[i]]    ?? t.checked })));
    if (ns.finances) setFinances(p => p.map((t, i) => ({ ...t, checked: ns.finances?.[FINANCES_KEYS[i]] ?? t.checked })));
    if (ns.canaux)   setCanaux(p   => p.map((t, i) => ({ ...t, checked: ns.canaux?.[CANAUX_KEYS[i]]   ?? t.checked })));
  }, [data]);

  useEffect(() => { if (saveTrigger > 0) handleSave(); }, [saveTrigger]);

  async function handleSave() {
    const notifSettings: Record<string, Record<string, boolean>> = {
      colis:    Object.fromEntries(COLIS_KEYS.map((k,i)    => [k, colis[i].checked])),
      finances: Object.fromEntries(FINANCES_KEYS.map((k,i) => [k, finances[i].checked])),
      canaux:   Object.fromEntries(CANAUX_KEYS.map((k,i)   => [k, canaux[i].checked])),
    };
    try {
      await onSave(notifSettings);
      markClean();
      pop('✅ Notifications sauvegardées', 's');
    } catch (e: any) { pop(`❌ ${e.message}`, 'e'); }
  }

  function upd(setter: React.Dispatch<React.SetStateAction<TRow[]>>, i: number, v: boolean) {
    setter(p => p.map((x, j) => j === i ? { ...x, checked:v } : x)); dirty();
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className={s.psHd}>
        <h1><i className="fas fa-bell" /> Notifications</h1>
        <p>Choisissez quand et comment être alerté de l'activité de votre relais.</p>
      </div>
      {[
        { title:'Colis & Relais', ic:'fa-box', rows:colis, setter:setColis, keys:COLIS_KEYS },
        { title:'Finances & Commissions', ic:'fa-coins', rows:finances, setter:setFinances, keys:FINANCES_KEYS },
        { title:'Canaux de notification', ic:'fa-mobile-screen', rows:canaux, setter:setCanaux, keys:CANAUX_KEYS },
      ].map(g => (
        <div key={g.title} className={s.fc}>
          <div className={s.fcHd}><div className={s.fcTtl}><i className={`fas ${g.ic}`} /> {g.title}</div></div>
          <div className={s.fcBody}>
            {g.rows.map((t, i) => {
              const actif = BRANCHES.has(g.keys[i]);
              return (
                <ToggleRow key={t.label} label={actif ? t.label : `${t.label} (bientôt disponible)`} sub={t.sub}
                  checked={actif ? t.checked : false} badge={actif ? t.badge : ''} disabled={!actif}
                  onChange={v => { if (actif) upd(g.setter, i, v); }} />
              );
            })}
          </div>
        </div>
      ))}
      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <button className={s.saveBtn} onClick={handleSave} disabled={saving}>
          {saving ? <><i className="fas fa-spinner fa-spin" /> Sauvegarde…</> : <><i className="fas fa-cloud-arrow-up" /> Sauvegarder</>}
        </button>
      </div>
    </div>
  );
}