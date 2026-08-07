/*
 * FICHIER : src/dashboards/entreprise/sections/parametres/PrivacySection.tsx
 * Section 11 — Confidentialité (7 toggles)
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import FormCard from '../../components/parametres/FormCard';
import type { ParametresData } from '../../hooks/useParametres';
import s from '../../styles/parametres/ParametresPage.module.css';

interface Props {
  data: ParametresData | null; saving: boolean;
  onDirty: () => void; onToast: (m: string, t?: string) => void;
  savePrivacy: (b: Record<string, boolean>) => Promise<void>;
}

const DEFAULTS: Record<string, boolean> = {
  showInSearch:true, showSalesStats:true, allowFollow:true,
  shareExactLocation:false, improveAlgorithm:true, anonymizedStats:true, advancedReports:false,
};

export default function PrivacySection({ data, saving, onDirty, onToast, savePrivacy }: Props) {
  const { t } = useTranslation();
  const PRIVACY_ITEMS = [
    { key:'showInSearch',       label:t('parametres.privacy.items.showInSearch.label'),           sub:t('parametres.privacy.items.showInSearch.sub') },
    { key:'showSalesStats',     label:t('parametres.privacy.items.showSalesStats.label'),            sub:t('parametres.privacy.items.showSalesStats.sub') },
    { key:'allowFollow',        label:t('parametres.privacy.items.allowFollow.label'),              sub:t('parametres.privacy.items.allowFollow.sub') },
    { key:'shareExactLocation', label:t('parametres.privacy.items.shareExactLocation.label'),             sub:t('parametres.privacy.items.shareExactLocation.sub') },
    { key:'improveAlgorithm',   label:t('parametres.privacy.items.improveAlgorithm.label'),    sub:t('parametres.privacy.items.improveAlgorithm.sub') },
    { key:'anonymizedStats',    label:t('parametres.privacy.items.anonymizedStats.label'),  sub:t('parametres.privacy.items.anonymizedStats.sub') },
    { key:'advancedReports',    label:t('parametres.privacy.items.advancedReports.label'),         sub:t('parametres.privacy.items.advancedReports.sub') },
  ];
  const [privacy, setPrivacy] = useState<Record<string, boolean>>(DEFAULTS);

  useEffect(() => {
    if (data?.privacySettings) setPrivacy({ ...DEFAULTS, ...data.privacySettings });
  }, [data]);

  function toggle(key: string) { setPrivacy(prev => ({ ...prev, [key]: !prev[key] })); onDirty(); }

  async function handleSave() {
    try { await savePrivacy(privacy); onToast(t('parametres.privacy.savedToast'), 's'); }
    catch { onToast(t('parametres.privacy.errorToast'), 'e'); }
  }

  return (
    <>
      <div className={s.sectionHd}>
        <h1><i className="fas fa-eye-slash" /> {t('parametres.privacy.title')}</h1>
        <p>{t('parametres.privacy.subtitle')}</p>
      </div>

      <FormCard title={t('parametres.privacy.prefsTitle')} icon="fa-lock" subtitle={t('parametres.privacy.prefsSubtitle')}>
        {PRIVACY_ITEMS.map((item, idx) => (
          <div key={item.key} style={{
            display:'flex', alignItems:'center', gap:16, padding:'12px 0',
            borderBottom: idx < PRIVACY_ITEMS.length - 1 ? '1px solid var(--bdr)' : 'none',
          }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--navy)' }}>{item.label}</div>
              <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>{item.sub}</div>
            </div>
            <div onClick={() => toggle(item.key)}
              style={{ width:44, height:24, borderRadius:12, cursor:'pointer', flexShrink:0,
                background: privacy[item.key] ? 'var(--t2)' : 'var(--g300)',
                position:'relative', transition:'background .2s' }}>
              <div style={{ position:'absolute', top:3, width:18, height:18, borderRadius:'50%',
                background:'#fff', transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.2)',
                left: privacy[item.key] ? 22 : 3 }} />
            </div>
          </div>
        ))}

        <div className={s.saveRow}>
          <button className={s.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? <><i className="fas fa-spinner fa-spin" /> {t('parametres.privacy.sauvegardeEnCours')}</> : <><i className="fas fa-cloud-arrow-up" /> {t('parametres.privacy.sauvegarderConfidentialite')}</>}
          </button>
        </div>
      </FormCard>
    </>
  );
}