/*
 * FICHIER : src/dashboards/entreprise/sections/parametres/PaiementSection.tsx
 * Section 6 — Paiement & Facturation
 */
import React, { useState, useEffect } from 'react';
import FormCard from '../../components/parametres/FormCard';
import type { ParametresData } from '../../hooks/useParametres';
import s from '../../styles/parametres/ParametresPage.module.css';

interface Props {
  data: ParametresData | null; saving: boolean;
  onDirty: () => void; onToast: (m: string, t?: string) => void;
  savePaiement: (b: Partial<ParametresData>) => Promise<void>;
}

export default function PaiementSection({ data, saving, onDirty, onToast, savePaiement }: Props) {
  const [receptionMethod,  setReceptionMethod]  = useState('orange_money');
  const [receptionNumber,  setReceptionNumber]  = useState('');
  const [payoutFrequency,  setPayoutFrequency]  = useState('weekly');
  const [payoutMinAmount,  setPayoutMinAmount]  = useState(100000);
  const [nif,              setNif]              = useState('');
  const [rccm,             setRccm]             = useState('');
  const [raisonSociale,    setRaisonSociale]    = useState('');

  useEffect(() => {
    if (!data) return;
    setReceptionMethod(data.receptionMethod   ?? 'orange_money');
    setReceptionNumber(data.receptionNumber   ?? '');
    setPayoutFrequency(data.payoutFrequency   ?? 'weekly');
    setPayoutMinAmount(data.payoutMinAmount   ?? 100000);
    setNif(data.nif                           ?? '');
    setRccm(data.rccm                         ?? '');
    setRaisonSociale(data.raisonSociale       ?? '');
  }, [data]);

  async function handleSave() {
    try {
      await savePaiement({ receptionMethod, receptionNumber, payoutFrequency, payoutMinAmount, nif, rccm, raisonSociale });
      onToast('✅ Paiement sauvegardé', 's');
    } catch { onToast('❌ Erreur lors de la sauvegarde', 'e'); }
  }

  return (
    <>
      <div className={s.sectionHd}>
        <h1><i className="fas fa-credit-card" /> Paiement & Facturation</h1>
        <p>Configurez vos méthodes de réception des paiements et vos informations fiscales.</p>
      </div>

      <FormCard title="Réception des paiements Shopi" icon="fa-wallet" subtitle="Comment vous recevez vos virements de Shopi">
        <div className={s.grid2}>
          <div className={s.fg}>
            <div className={s.fl}>Canal de réception</div>
            <div className={s.fw}>
              <i className={`fas fa-mobile-screen ${s.fi}`} />
              <select className={`${s.fin} ${s.finSelect}`} value={receptionMethod} onChange={e => { setReceptionMethod(e.target.value); onDirty(); }}>
                <option value="orange_money">Orange Money</option>
                <option value="mtn_momo">MTN Mobile Money</option>
                <option value="wave">Wave</option>
                <option value="virement_bancaire">Virement bancaire</option>
              </select>
            </div>
          </div>
          <div className={s.fg}>
            <div className={s.fl}>Numéro de réception</div>
            <div className={s.fw}>
              <i className={`fas fa-hashtag ${s.fi}`} />
              <input className={s.fin} value={receptionNumber} onChange={e => { setReceptionNumber(e.target.value); onDirty(); }} placeholder="620 00 00 00" />
            </div>
          </div>
        </div>
        <div className={s.grid2}>
          <div className={s.fg}>
            <div className={s.fl}>Fréquence des virements</div>
            <div className={s.fw}>
              <i className={`fas fa-calendar-check ${s.fi}`} />
              <select className={`${s.fin} ${s.finSelect}`} value={payoutFrequency} onChange={e => { setPayoutFrequency(e.target.value); onDirty(); }}>
                <option value="daily">Quotidien</option>
                <option value="weekly">Hebdomadaire</option>
                <option value="bimonthly">Bi-mensuel</option>
                <option value="monthly">Mensuel</option>
              </select>
            </div>
          </div>
          <div className={s.fg}>
            <div className={s.fl}>Montant minimum (GNF)</div>
            <div className={s.fw}>
              <i className={`fas fa-coins ${s.fi}`} />
              <input className={s.fin} type="number" value={payoutMinAmount} onChange={e => { setPayoutMinAmount(Number(e.target.value)); onDirty(); }} min={50000} step={10000} />
            </div>
          </div>
        </div>
      </FormCard>

      <FormCard title="Informations fiscales" icon="fa-building-columns" subtitle="Numéros officiels de votre entreprise">
        <div className={s.grid2}>
          <div className={s.fg}><div className={s.fl}>NIF</div><div className={s.fw}><i className={`fas fa-id-card ${s.fi}`} /><input className={s.fin} value={nif} onChange={e => { setNif(e.target.value); onDirty(); }} placeholder="Numéro d'Identification Fiscale" /></div></div>
          <div className={s.fg}><div className={s.fl}>RCCM</div><div className={s.fw}><i className={`fas fa-registered ${s.fi}`} /><input className={s.fin} value={rccm} onChange={e => { setRccm(e.target.value); onDirty(); }} placeholder="GN-CNK-2024-B-00123" /></div></div>
        </div>
        <div className={s.fg}><div className={s.fl}>Raison sociale</div><div className={s.fw}><i className={`fas fa-briefcase ${s.fi}`} /><input className={s.fin} value={raisonSociale} onChange={e => { setRaisonSociale(e.target.value); onDirty(); }} placeholder="Ex : TechStore Conakry SARL" /></div></div>

        <div className={s.saveRow}>
          <button className={s.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? <><i className="fas fa-spinner fa-spin" /> Sauvegarde…</> : <><i className="fas fa-cloud-arrow-up" /> Sauvegarder le paiement</>}
          </button>
        </div>
      </FormCard>
    </>
  );
}