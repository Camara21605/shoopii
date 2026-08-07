/*
 * FICHIER : src/dashboards/entreprise/sections/parametres/PaiementSection.tsx
 * Section 6 — Paiement & Facturation
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import FormCard from '../../components/parametres/FormCard';
import type { ParametresData } from '../../hooks/useParametres';
import s from '../../styles/parametres/ParametresPage.module.css';

interface Props {
  data: ParametresData | null; saving: boolean;
  onDirty: () => void; onToast: (m: string, t?: string) => void;
  savePaiement: (b: Partial<ParametresData>) => Promise<void>;
}

export default function PaiementSection({ data, saving, onDirty, onToast, savePaiement }: Props) {
  const { t } = useTranslation();
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
      onToast(t('parametres.paiement.savedToast'), 's');
    } catch { onToast(t('parametres.paiement.errorToast'), 'e'); }
  }

  return (
    <>
      <div className={s.sectionHd}>
        <h1><i className="fas fa-credit-card" /> {t('parametres.paiement.title')}</h1>
        <p>{t('parametres.paiement.subtitle')}</p>
      </div>

      <FormCard title={t('parametres.paiement.receptionTitle')} icon="fa-wallet" subtitle={t('parametres.paiement.receptionSubtitle')}>
        <div className={s.grid2}>
          <div className={s.fg}>
            <div className={s.fl}>{t('parametres.paiement.canalReception')}</div>
            <div className={s.fw}>
              <i className={`fas fa-mobile-screen ${s.fi}`} />
              <select className={`${s.fin} ${s.finSelect}`} value={receptionMethod} onChange={e => { setReceptionMethod(e.target.value); onDirty(); }}>
                <option value="orange_money">Orange Money</option>
                <option value="mtn_momo">MTN Mobile Money</option>
                <option value="wave">{t('parametres.paiement.waveOption')}</option>
                <option value="virement_bancaire">{t('parametres.paiement.virementBancaireOption')}</option>
              </select>
            </div>
          </div>
          <div className={s.fg}>
            <div className={s.fl}>{t('parametres.paiement.numeroReception')}</div>
            <div className={s.fw}>
              <i className={`fas fa-hashtag ${s.fi}`} />
              <input className={s.fin} value={receptionNumber} onChange={e => { setReceptionNumber(e.target.value); onDirty(); }} placeholder="620 00 00 00" />
            </div>
          </div>
        </div>
        <div className={s.grid2}>
          <div className={s.fg}>
            <div className={s.fl}>{t('parametres.paiement.frequenceVirements')}</div>
            <div className={s.fw}>
              <i className={`fas fa-calendar-check ${s.fi}`} />
              <select className={`${s.fin} ${s.finSelect}`} value={payoutFrequency} onChange={e => { setPayoutFrequency(e.target.value); onDirty(); }}>
                <option value="daily">{t('parametres.paiement.quotidien')}</option>
                <option value="weekly">{t('parametres.paiement.hebdomadaire')}</option>
                <option value="bimonthly">{t('parametres.paiement.bimensuel')}</option>
                <option value="monthly">{t('parametres.paiement.mensuel')}</option>
              </select>
            </div>
          </div>
          <div className={s.fg}>
            <div className={s.fl}>{t('parametres.paiement.montantMinimum')}</div>
            <div className={s.fw}>
              <i className={`fas fa-coins ${s.fi}`} />
              <input className={s.fin} type="number" value={payoutMinAmount} onChange={e => { setPayoutMinAmount(Number(e.target.value)); onDirty(); }} min={50000} step={10000} />
            </div>
          </div>
        </div>
      </FormCard>

      <FormCard title={t('parametres.paiement.fiscalesTitle')} icon="fa-building-columns" subtitle={t('parametres.paiement.fiscalesSubtitle')}>
        <div className={s.grid2}>
          <div className={s.fg}><div className={s.fl}>{t('parametres.paiement.nifLabel')}</div><div className={s.fw}><i className={`fas fa-id-card ${s.fi}`} /><input className={s.fin} value={nif} onChange={e => { setNif(e.target.value); onDirty(); }} placeholder={t('parametres.paiement.nifPlaceholder')} /></div></div>
          <div className={s.fg}><div className={s.fl}>{t('parametres.paiement.rccmLabel')}</div><div className={s.fw}><i className={`fas fa-registered ${s.fi}`} /><input className={s.fin} value={rccm} onChange={e => { setRccm(e.target.value); onDirty(); }} placeholder="GN-CNK-2024-B-00123" /></div></div>
        </div>
        <div className={s.fg}><div className={s.fl}>{t('parametres.paiement.raisonSocialeLabel')}</div><div className={s.fw}><i className={`fas fa-briefcase ${s.fi}`} /><input className={s.fin} value={raisonSociale} onChange={e => { setRaisonSociale(e.target.value); onDirty(); }} placeholder={t('parametres.paiement.raisonSocialePlaceholder')} /></div></div>

        <div className={s.saveRow}>
          <button className={s.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? <><i className="fas fa-spinner fa-spin" /> {t('parametres.paiement.sauvegardeEnCours')}</> : <><i className="fas fa-cloud-arrow-up" /> {t('parametres.paiement.sauvegarderPaiement')}</>}
          </button>
        </div>
      </FormCard>
    </>
  );
}