/*
 * FICHIER : src/dashboards/entreprise/sections/parametres/NotifsSection.tsx
 * Section 10 — Notifications (14 toggles)
 */
import React, { useState, useEffect } from 'react';
import FormCard from '../../components/parametres/FormCard';
import type { ParametresData } from '../../hooks/useParametres';
import s from '../../styles/parametres/ParametresPage.module.css';

interface Props {
  data: ParametresData | null; saving: boolean;
  onDirty: () => void; onToast: (m: string, t?: string) => void;
  saveNotifs: (b: Record<string, boolean>) => Promise<void>;
}

const NOTIF_GROUPS = [
  {
    title: '📦 Commandes',
    items: [
      { key:'newOrder',        label:'Nouvelle commande reçue'        },
      { key:'orderCancelled',  label:'Commande annulée par le client'  },
      { key:'orderDelivered',  label:'Commande livrée avec succès'     },
      { key:'paymentReceived', label:'Paiement reçu'                  },
    ],
  },
  {
    title: '📊 Stock & Catalogue',
    items: [
      { key:'outOfStock',       label:'Produit en rupture de stock'         },
      { key:'nearThreshold',    label:'Stock proche du seuil minimum'       },
      { key:'productPublished', label:'Confirmation de publication produit' },
      { key:'catalogRequest',   label:'Demande de mise à jour catalogue'    },
    ],
  },
  {
    title: '⭐ Avis & Réputation',
    items: [
      { key:'newReview',      label:'Nouvel avis client'             },
      { key:'negativeReview', label:'Avis négatif (< 3 étoiles)'    },
      { key:'weeklyReport',   label:'Rapport hebdo réputation'      },
    ],
  },
  {
    title: '📣 Marketing & Rapports',
    items: [
      { key:'promoInvitations', label:'Invitations aux promotions Shopi' },
      { key:'monthlyReport',    label:'Rapport de performance mensuel'  },
      { key:'shopNews',         label:'Nouveautés de la plateforme'     },
    ],
  },
];

const DEFAULTS: Record<string, boolean> = {
  newOrder:true, orderCancelled:true, orderDelivered:true, paymentReceived:true,
  outOfStock:true, nearThreshold:true, productPublished:false, catalogRequest:true,
  newReview:true, negativeReview:true, weeklyReport:false,
  promoInvitations:true, monthlyReport:true, shopNews:false,
};

export default function NotifsSection({ data, saving, onDirty, onToast, saveNotifs }: Props) {
  const [notifs, setNotifs] = useState<Record<string, boolean>>(DEFAULTS);

  useEffect(() => {
    if (data?.notifSettings) setNotifs({ ...DEFAULTS, ...data.notifSettings });
  }, [data]);

  function toggle(key: string) {
    setNotifs(prev => ({ ...prev, [key]: !prev[key] }));
    onDirty();
  }

  async function handleSave() {
    try {
      await saveNotifs(notifs);
      onToast('✅ Notifications sauvegardées', 's');
    } catch { onToast('❌ Erreur lors de la sauvegarde', 'e'); }
  }

  return (
    <>
      <div className={s.sectionHd}>
        <h1><i className="fas fa-bell" /> Notifications</h1>
        <p>Choisissez les événements pour lesquels vous souhaitez recevoir des notifications.</p>
      </div>

      {NOTIF_GROUPS.map(group => (
        <FormCard key={group.title} title={group.title} icon="fa-bell" subtitle="">
          {group.items.map((item, idx) => (
            <div key={item.key} style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'11px 0',
              borderBottom: idx < group.items.length - 1 ? '1px solid var(--bdr)' : 'none',
            }}>
              <span style={{ fontSize:13, color:'var(--t1)' }}>{item.label}</span>
              <div onClick={() => toggle(item.key)}
                style={{ width:44, height:24, borderRadius:12, cursor:'pointer', flexShrink:0,
                  background: notifs[item.key] ? 'var(--teal,#0E7490)' : 'var(--g300)',
                  position:'relative', transition:'background .2s' }}>
                <div style={{ position:'absolute', top:3, width:18, height:18, borderRadius:'50%',
                  background:'#fff', transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.2)',
                  left: notifs[item.key] ? 22 : 3 }} />
              </div>
            </div>
          ))}
        </FormCard>
      ))}

      <div className={s.saveRow}>
        <button className={s.saveBtn} onClick={handleSave} disabled={saving}>
          {saving ? <><i className="fas fa-spinner fa-spin" /> Sauvegarde…</> : <><i className="fas fa-cloud-arrow-up" /> Sauvegarder les notifications</>}
        </button>
      </div>
    </>
  );
}