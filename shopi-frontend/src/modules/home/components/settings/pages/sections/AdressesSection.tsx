/* ================================================================
 * src/modules/home/components/settings/sections/AdressesSection.tsx
 * CONNECTÉ — GET/POST/PATCH/DELETE /client/parametres/adresses
 * ================================================================ */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import s from '../styles/SettingsCard.module.css';
import { settingsApi, type AdresseItem } from '../../api/settings.api';

interface Props { onToast: (msg: string) => void; }

export default function AdressesSection({ onToast }: Props) {
  const { t } = useTranslation();
  const [adresses,  setAdresses]  = useState<AdresseItem[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [actionId,  setActionId]  = useState<string | null>(null);

  useEffect(() => {
    settingsApi.getAdresses()
      .then(setAdresses)
      .catch(() => onToast(t('settingsPage.adresses.loadError')))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: string) {
    setActionId(id);
    try {
      const updated = await settingsApi.deleteAdresse(id);
      setAdresses(updated);
      onToast(t('settingsPage.adresses.toastSupprimee'));
    } catch (err: any) { onToast(`❌ ${err.message}`); }
    finally { setActionId(null); }
  }

  async function handleSetDefault(id: string) {
    setActionId(id);
    try {
      const updated = await settingsApi.setDefaultAddr(id);
      setAdresses(updated);
      onToast(t('settingsPage.adresses.toastDefiniParDefaut'));
    } catch (err: any) { onToast(`❌ ${err.message}`); }
    finally { setActionId(null); }
  }

  if (loading) return <div className={s.card} style={{ padding:'48px 24px', textAlign:'center', color:'var(--t3)' }}><i className="fas fa-circle-notch fa-spin" style={{ fontSize:24 }} /></div>;

  return (
    <div className={s.card}>
      <div className={s.cardHd}>
        <div className={s.cardTitle}>
          <div className={`${s.cardIco} ${s.icoBlue}`}><i className="fas fa-location-dot" /></div>
          <div>
            <div className={s.cardH}>{t('settingsPage.adresses.titre')}</div>
            <div className={s.cardSub}>{adresses.length} {t('settingsPage.adresses.subtitleSuffix', { count: adresses.length })}</div>
          </div>
        </div>
        <button className={s.cardAction} onClick={() => onToast(t('settingsPage.adresses.toastFormulaireTodo'))}>
          <i className="fas fa-plus" /> {t('settingsPage.adresses.ajouter')}
        </button>
      </div>
      <div className={s.cardBody} style={{ paddingBottom: 4 }}>
        {adresses.length === 0 && (
          <div style={{ padding:'24px', textAlign:'center', color:'var(--t3)', fontSize:13 }}>
            {t('settingsPage.adresses.aucuneAdresse')}
          </div>
        )}
        {adresses.map(a => (
          <div key={a.id} className={`${s.addrCard} ${a.isDefault ? s.addrCardDefault : ''}`}>
            <div className={s.addrCardTop}>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' as const }}>
                <span className={`${s.addrBadge} ${a.isDefault ? s.addrBadgeDef : ''}`}>
                  <i className={`fas ${a.nom === 'Domicile' ? 'fa-house' : 'fa-briefcase'}`} /> {a.nom}
                </span>
                {a.isDefault && <span className={s.addrDefaultBadge}><i className="fas fa-star" /> {t('settingsPage.adresses.parDefaut')}</span>}
              </div>
              <div className={s.addrActions}>
                <button className={s.addrAct} onClick={() => onToast(t('settingsPage.adresses.toastModificationTodo'))}><i className="fas fa-pen" /></button>
                {!a.isDefault && (
                  <button className={s.addrAct} onClick={() => handleSetDefault(a.id)} disabled={actionId === a.id}>
                    {actionId === a.id ? <i className="fas fa-circle-notch fa-spin" /> : <i className="fas fa-star" />}
                  </button>
                )}
                <button className={`${s.addrAct} ${s.addrActDanger}`} onClick={() => handleDelete(a.id)} disabled={actionId === a.id}>
                  {actionId === a.id ? <i className="fas fa-circle-notch fa-spin" /> : <i className="fas fa-trash" />}
                </button>
              </div>
            </div>
            <div className={s.addrName}>{a.fullName}</div>
            <div className={s.addrLine}><i className="fas fa-map-marker-alt" /> {a.adresse}{a.commune ? `, ${a.commune}` : ''}, {a.ville}</div>
            {a.phone && <div className={s.addrLine} style={{ marginTop:3 }}><i className="fas fa-phone" /> {a.phone}</div>}
          </div>
        ))}
        <button className={s.addrAdd} onClick={() => onToast(t('settingsPage.adresses.toastAjouterNouvelle'))}>
          <i className="fas fa-plus" /> {t('settingsPage.adresses.ajouterNouvelle')}
        </button>
      </div>
    </div>
  );
}