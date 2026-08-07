/*
 * FICHIER : src/dashboards/entreprise/sections/parametres/NotifsSection.tsx
 * Section 10 — Notifications (14 toggles)
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import FormCard from '../../components/parametres/FormCard';
import type { ParametresData } from '../../hooks/useParametres';
import s from '../../styles/parametres/ParametresPage.module.css';

interface Props {
  data: ParametresData | null; saving: boolean;
  onDirty: () => void; onToast: (m: string, t?: string) => void;
  saveNotifs: (b: Record<string, boolean>) => Promise<void>;
}

const DEFAULTS: Record<string, boolean> = {
  newOrder:true, orderCancelled:true, orderDelivered:true, paymentReceived:true,
  outOfStock:true, nearThreshold:true, productPublished:false, catalogRequest:true,
  newReview:true, negativeReview:true, weeklyReport:false,
  promoInvitations:true, monthlyReport:true, shopNews:false,
};

export default function NotifsSection({ data, saving, onDirty, onToast, saveNotifs }: Props) {
  const { t } = useTranslation();
  const NOTIF_GROUPS = [
    {
      title: t('parametres.notifs.groups.commandes'),
      items: [
        { key:'newOrder',        label:t('parametres.notifs.items.newOrder')        },
        { key:'orderCancelled',  label:t('parametres.notifs.items.orderCancelled')  },
        { key:'orderDelivered',  label:t('parametres.notifs.items.orderDelivered')     },
        { key:'paymentReceived', label:t('parametres.notifs.items.paymentReceived')                  },
      ],
    },
    {
      title: t('parametres.notifs.groups.stockCatalogue'),
      items: [
        { key:'outOfStock',       label:t('parametres.notifs.items.outOfStock')         },
        { key:'nearThreshold',    label:t('parametres.notifs.items.nearThreshold')       },
        { key:'productPublished', label:t('parametres.notifs.items.productPublished') },
        { key:'catalogRequest',   label:t('parametres.notifs.items.catalogRequest')    },
      ],
    },
    {
      title: t('parametres.notifs.groups.avisReputation'),
      items: [
        { key:'newReview',      label:t('parametres.notifs.items.newReview')             },
        { key:'negativeReview', label:t('parametres.notifs.items.negativeReview')    },
        { key:'weeklyReport',   label:t('parametres.notifs.items.weeklyReport')      },
      ],
    },
    {
      title: t('parametres.notifs.groups.marketingRapports'),
      items: [
        { key:'promoInvitations', label:t('parametres.notifs.items.promoInvitations') },
        { key:'monthlyReport',    label:t('parametres.notifs.items.monthlyReport')  },
        { key:'shopNews',         label:t('parametres.notifs.items.shopNews')     },
      ],
    },
  ];
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
      onToast(t('parametres.notifs.savedToast'), 's');
    } catch { onToast(t('parametres.notifs.errorToast'), 'e'); }
  }

  return (
    <>
      <div className={s.sectionHd}>
        <h1><i className="fas fa-bell" /> {t('parametres.notifs.title')}</h1>
        <p>{t('parametres.notifs.subtitle')}</p>
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
                  background: notifs[item.key] ? 'var(--t2)' : 'var(--g300)',
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
          {saving ? <><i className="fas fa-spinner fa-spin" /> {t('parametres.notifs.sauvegardeEnCours')}</> : <><i className="fas fa-cloud-arrow-up" /> {t('parametres.notifs.sauvegarderNotifs')}</>}
        </button>
      </div>
    </>
  );
}