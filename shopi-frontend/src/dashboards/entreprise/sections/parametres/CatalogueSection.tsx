/*
 * FICHIER : src/dashboards/entreprise/sections/parametres/CatalogueSection.tsx
 * Section 4 — Catalogue & Règles de publication
 * PATCH /dashboard/entreprise/parametres/catalogue
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import FormCard from '../../components/parametres/FormCard';
import type { ParametresData } from '../../hooks/useParametres';
import s from '../../styles/parametres/ParametresPage.module.css';

interface Props {
  data: ParametresData | null; saving: boolean;
  onDirty: () => void; onToast: (m: string, t?: string) => void;
  saveCatalogue: (b: Partial<ParametresData>) => Promise<void>;
}

/* Composant toggle réutilisable */
function Toggle({ label, sub, value, onChange }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0', borderBottom:'1px solid var(--bdr)' }}>
      <div>
        <div style={{ fontSize:13, fontWeight:600, color:'var(--navy)' }}>{label}</div>
        {sub && <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>{sub}</div>}
      </div>
      <div
        onClick={() => onChange(!value)}
        style={{
          width:44, height:24, borderRadius:12, flexShrink:0, cursor:'pointer',
          background: value ? 'var(--t2)' : 'var(--g300)',
          position:'relative', transition:'background .2s',
        }}
      >
        <div style={{
          position:'absolute', top:3, width:18, height:18, borderRadius:'50%',
          background:'#fff', transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.2)',
          left: value ? 22 : 3,
        }} />
      </div>
    </div>
  );
}

export default function CatalogueSection({ data, saving, onDirty, onToast, saveCatalogue }: Props) {
  const { t } = useTranslation();
  const [showOutOfStock,  setShowOutOfStock]  = useState(true);
  const [autoPublish,     setAutoPublish]     = useState(false);
  const [showStrikePrice, setShowStrikePrice] = useState(true);
  const [allowReviews,    setAllowReviews]    = useState(true);
  const [devise,          setDevise]          = useState('GNF');
  const [returnPolicy,    setReturnPolicy]    = useState('');

  useEffect(() => {
    if (!data) return;
    setShowOutOfStock(data.showOutOfStock  ?? true);
    setAutoPublish(data.autoPublish        ?? false);
    setShowStrikePrice(data.showStrikePrice ?? true);
    setAllowReviews(data.allowReviews      ?? true);
    setDevise(data.devise                  ?? 'GNF');
    setReturnPolicy(data.returnPolicy      ?? '');
  }, [data]);

  function mark(fn: () => void) { fn(); onDirty(); }

  async function handleSave() {
    try {
      await saveCatalogue({ showOutOfStock, autoPublish, showStrikePrice, allowReviews, devise, returnPolicy });
      onToast(t('parametres.catalogue.savedToast'), 's');
    } catch { onToast(t('parametres.catalogue.errorToast'), 'e'); }
  }

  return (
    <>
      <div className={s.sectionHd}>
        <h1><i className="fas fa-tags" /> {t('parametres.catalogue.title')}</h1>
        <p>{t('parametres.catalogue.subtitle')}</p>
      </div>

      <FormCard title={t('parametres.catalogue.reglesTitle')} icon="fa-eye" subtitle={t('parametres.catalogue.reglesSubtitle')}>
        <Toggle label={t('parametres.catalogue.afficherRupture')} sub={t('parametres.catalogue.afficherRuptureSub')} value={showOutOfStock} onChange={v => mark(() => setShowOutOfStock(v))} />
        <Toggle label={t('parametres.catalogue.publicationAuto')} sub={t('parametres.catalogue.publicationAutoSub')} value={autoPublish} onChange={v => mark(() => setAutoPublish(v))} />
        <Toggle label={t('parametres.catalogue.afficherPrixBarres')} sub={t('parametres.catalogue.afficherPrixBarresSub')} value={showStrikePrice} onChange={v => mark(() => setShowStrikePrice(v))} />
        <Toggle label={t('parametres.catalogue.autoriserAvis')} sub={t('parametres.catalogue.autoriserAvisSub')} value={allowReviews} onChange={v => mark(() => setAllowReviews(v))} />

        <div className={s.fg} style={{ marginTop:16 }}>
          <div className={s.fl}>{t('parametres.catalogue.deviseAffichage')}</div>
          <div className={s.fw}>
            <i className={`fas fa-coins ${s.fi}`} />
            <select className={`${s.fin} ${s.finSelect}`} value={devise} onChange={e => { setDevise(e.target.value); onDirty(); }}>
              <option value="GNF">{t('parametres.catalogue.deviseGnf')}</option>
              <option value="EUR">{t('parametres.catalogue.deviseEur')}</option>
              <option value="USD">{t('parametres.catalogue.deviseUsd')}</option>
            </select>
          </div>
        </div>
      </FormCard>

      <FormCard title={t('parametres.catalogue.politiqueRetourTitle')} icon="fa-rotate-left" subtitle={t('parametres.catalogue.politiqueRetourSubtitle')}>
        <div className={s.fg}>
          <div className={s.fw}>
            <textarea
              className={`${s.fin} ${s.finTextarea}`}
              value={returnPolicy}
              onChange={e => { setReturnPolicy(e.target.value); onDirty(); }}
              placeholder={t('parametres.catalogue.politiquePlaceholder')}
              style={{ paddingLeft:14 }}
            />
          </div>
          <div className={s.hint}><i className="fas fa-circle-info" /> {t('parametres.catalogue.politiqueHint')}</div>
        </div>

        <div className={s.saveRow}>
          <button className={s.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? <><i className="fas fa-spinner fa-spin" /> {t('parametres.catalogue.sauvegardeEnCours')}</> : <><i className="fas fa-cloud-arrow-up" /> {t('parametres.catalogue.sauvegarderCatalogue')}</>}
          </button>
        </div>
      </FormCard>
    </>
  );
}