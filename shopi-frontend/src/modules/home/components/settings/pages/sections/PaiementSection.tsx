/* ================================================================
 * src/modules/home/components/settings/sections/PaiementSection.tsx
 * CONNECTÉ — GET/POST/PATCH/DELETE /client/parametres/paiement
 * ================================================================ */

import React, { useState, useEffect } from 'react';
import s from '../styles/SettingsCard.module.css';
import { settingsApi, type PaymentItem } from '../../api/settings.api';

interface Props { onToast: (msg: string) => void; }

const PAY_ICONS: Record<string, string> = {
  orange: '📱', mtn: '💛', carte: '💳', especes: '💵',
  virement: '🏦', wallet: '👛',
};
const PAY_LABELS: Record<string, string> = {
  orange: 'Orange Money', mtn: 'MTN Mobile Money', carte: 'Carte bancaire',
  especes: 'Espèces', virement: 'Virement bancaire', wallet: 'Portefeuille Shopi',
};

export default function PaiementSection({ onToast }: Props) {
  const [methods,  setMethods]  = useState<PaymentItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    settingsApi.getPaiement()
      .then(setMethods)
      .catch(() => onToast('❌ Impossible de charger les moyens de paiement'))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: string) {
    setActionId(id);
    try {
      const updated = await settingsApi.deletePaiement(id);
      setMethods(updated);
      onToast('🗑️ Moyen de paiement supprimé');
    } catch (err: any) { onToast(`❌ ${err.message}`); }
    finally { setActionId(null); }
  }

  async function handleSetDefault(id: string) {
    setActionId(id);
    try {
      const updated = await settingsApi.setDefaultPay(id);
      setMethods(updated);
      onToast('⭐ Moyen de paiement défini par défaut');
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
            <div className={s.cardH}>Moyens de paiement</div>
            <div className={s.cardSub}>Cartes, Mobile Money et portefeuilles</div>
          </div>
        </div>
        <button className={s.cardAction} onClick={() => onToast('➕ Ajouter un moyen de paiement')}>
          <i className="fas fa-plus" /> Ajouter
        </button>
      </div>
      <div className={s.cardBody} style={{ paddingBottom:4 }}>
        {methods.length === 0 && (
          <div style={{ padding:'24px', textAlign:'center', color:'var(--t3)', fontSize:13 }}>
            Aucun moyen de paiement enregistré
          </div>
        )}
        {methods.map(m => (
          <div key={m.id} className={s.payCard}>
            <div className={s.payLeft}>
              <div className={s.payIco}>{PAY_ICONS[m.type] ?? '💳'}</div>
              <div>
                <div className={s.payInfoTitle}>
                  {PAY_LABELS[m.type] ?? m.type}
                  {m.isDefault && <span className={s.payDefault}><i className="fas fa-check" /> Par défaut</span>}
                </div>
                <div className={s.payInfoSub}>{m.numero} · Ajouté le {m.addedAt}</div>
              </div>
            </div>
            <div style={{ display:'flex', gap:4 }}>
              {!m.isDefault && (
                <button className={s.addrAct} onClick={() => handleSetDefault(m.id)} disabled={actionId === m.id} title="Définir par défaut">
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
          <button className={s.addrAdd} onClick={() => onToast('➕ Ajouter un moyen de paiement')}>
            <i className="fas fa-plus" /> Ajouter un moyen de paiement
          </button>
        </div>
      </div>
    </div>
  );
}
