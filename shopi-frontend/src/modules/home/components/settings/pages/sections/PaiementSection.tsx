/* ================================================================
 * src/modules/home/components/settings/sections/PaiementSection.tsx
 * CONNECTÉ — GET/POST/PATCH/DELETE /client/parametres/paiement
 * ================================================================ */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import s from '../styles/SettingsCard.module.css';
import { settingsApi, type PaymentItem } from '../../api/settings.api';

interface Props { onToast: (msg: string) => void; }

const PAY_ICONS: Record<string, string> = {
  orange: '📱', mtn: '💛', carte: '💳', especes: '💵',
  virement: '🏦', wallet: '👛',
};

export default function PaiementSection({ onToast }: Props) {
  const { t } = useTranslation();
  const PAY_LABELS: Record<string, string> = {
    orange: 'Orange Money', mtn: 'MTN Mobile Money',
    carte: t('settingsPage.paiement.labels.carte'),
    especes: t('settingsPage.paiement.labels.especes'),
    virement: t('settingsPage.paiement.labels.virement'),
    wallet: t('settingsPage.paiement.labels.wallet'),
  };
  const [methods,  setMethods]  = useState<PaymentItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    settingsApi.getPaiement()
      .then(setMethods)
      .catch(() => onToast(t('settingsPage.paiement.loadError')))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: string) {
    setActionId(id);
    try {
      const updated = await settingsApi.deletePaiement(id);
      setMethods(updated);
      onToast(t('settingsPage.paiement.toastSupprime'));
    } catch (err: any) { onToast(`❌ ${err.message}`); }
    finally { setActionId(null); }
  }

  async function handleSetDefault(id: string) {
    setActionId(id);
    try {
      const updated = await settingsApi.setDefaultPay(id);
      setMethods(updated);
      onToast(t('settingsPage.paiement.toastDefiniParDefaut'));
    } catch (err: any) { onToast(`❌ ${err.message}`); }
    finally { setActionId(null); }
  }

  if (loading) return (
    <div className={s.card}>
      <div style={{ padding:'48px 24px', textAlign:'center', color:'var(--t3)' }}>
        <i className="fas fa-circle-notch fa-spin" style={{ fontSize:24 }} />
      </div>
    </div>
  );

  return (
    <div className={s.card}>
      <div className={s.cardHd}>
        <div className={s.cardTitle}>
          <div className={`${s.cardIco} ${s.icoViolet}`}><i className="fas fa-credit-card" /></div>
          <div>
            <div className={s.cardH}>{t('settingsPage.paiement.titre')}</div>
            <div className={s.cardSub}>{t('settingsPage.paiement.subtitle')}</div>
          </div>
        </div>
        <button className={s.cardAction} onClick={() => onToast(t('settingsPage.paiement.toastAjouter'))}>
          <i className="fas fa-plus" /> {t('settingsPage.paiement.ajouter')}
        </button>
      </div>
      <div className={s.cardBody} style={{ paddingBottom:4 }}>
        {methods.length === 0 && (
          <div style={{ padding:'24px', textAlign:'center', color:'var(--t3)', fontSize:13 }}>
            {t('settingsPage.paiement.aucunMoyen')}
          </div>
        )}
        {methods.map(m => (
          <div key={m.id} className={s.payCard}>
            <div className={s.payLeft}>
              <div className={s.payIco}>{PAY_ICONS[m.type] ?? '💳'}</div>
              <div>
                <div className={s.payInfoTitle}>
                  {PAY_LABELS[m.type] ?? m.type}
                  {m.isDefault && <span className={s.payDefault}><i className="fas fa-check" /> {t('settingsPage.paiement.parDefaut')}</span>}
                </div>
                <div className={s.payInfoSub}>{m.numero} · {t('settingsPage.paiement.ajouteLe')} {m.addedAt}</div>
              </div>
            </div>
            <div style={{ display:'flex', gap:4 }}>
              {!m.isDefault && (
                <button className={s.addrAct} onClick={() => handleSetDefault(m.id)} disabled={actionId === m.id} title={t('settingsPage.paiement.definirParDefautTitle')}>
                  {actionId === m.id ? <i className="fas fa-circle-notch fa-spin" /> : <i className="fas fa-star" />}
                </button>
              )}
              <button className={`${s.addrAct} ${s.addrActDanger}`} onClick={() => handleDelete(m.id)} disabled={actionId === m.id}>
                {actionId === m.id ? <i className="fas fa-circle-notch fa-spin" /> : <i className="fas fa-trash" />}
              </button>
            </div>
          </div>
        ))}
        <div style={{ margin:'0 24px 20px' }}>
          <button className={s.addrAdd} onClick={() => onToast(t('settingsPage.paiement.toastAjouter'))}>
            <i className="fas fa-plus" /> {t('settingsPage.paiement.ajouterNouveau')}
          </button>
        </div>
      </div>
    </div>
  );
}
