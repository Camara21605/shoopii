/*
 * FICHIER : src/dashboards/entreprise/sections/parametres/CatalogueSection.tsx
 * Section 4 — Catalogue & Règles de publication
 * PATCH /dashboard/entreprise/parametres/catalogue
 */
import React, { useState, useEffect } from 'react';
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
          background: value ? 'var(--teal,#0E7490)' : 'var(--g300)',
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
      onToast('✅ Catalogue sauvegardé', 's');
    } catch { onToast('❌ Erreur lors de la sauvegarde', 'e'); }
  }

  return (
    <>
      <div className={s.sectionHd}>
        <h1><i className="fas fa-tags" /> Catalogue & Règles de publication</h1>
        <p>Contrôlez comment vos produits sont affichés et publiés sur Shopi.</p>
      </div>

      <FormCard title="Règles d'affichage" icon="fa-eye" subtitle="Comportement de votre catalogue public">
        <Toggle label="Afficher les produits en rupture de stock" sub="Si désactivé, les produits épuisés sont masqués automatiquement" value={showOutOfStock} onChange={v => mark(() => setShowOutOfStock(v))} />
        <Toggle label="Publication automatique" sub="Les nouveaux produits sont publiés immédiatement sans validation manuelle" value={autoPublish} onChange={v => mark(() => setAutoPublish(v))} />
        <Toggle label="Afficher les prix barrés" sub="Montre l'ancien prix barré lors des promotions" value={showStrikePrice} onChange={v => mark(() => setShowStrikePrice(v))} />
        <Toggle label="Autoriser les avis clients" sub="Seuls les acheteurs confirmés peuvent laisser un avis" value={allowReviews} onChange={v => mark(() => setAllowReviews(v))} />

        <div className={s.fg} style={{ marginTop:16 }}>
          <div className={s.fl}>Devise d'affichage</div>
          <div className={s.fw}>
            <i className={`fas fa-coins ${s.fi}`} />
            <select className={`${s.fin} ${s.finSelect}`} value={devise} onChange={e => { setDevise(e.target.value); onDirty(); }}>
              <option value="GNF">GNF — Franc guinéen</option>
              <option value="EUR">EUR — Euro</option>
              <option value="USD">USD — Dollar américain</option>
            </select>
          </div>
        </div>
      </FormCard>

      <FormCard title="Politique de retour" icon="fa-rotate-left" subtitle="Texte affiché sur chaque fiche produit">
        <div className={s.fg}>
          <div className={s.fw}>
            <textarea
              className={`${s.fin} ${s.finTextarea}`}
              value={returnPolicy}
              onChange={e => { setReturnPolicy(e.target.value); onDirty(); }}
              placeholder="Ex : Retour accepté sous 7 jours après réception, produit non ouvert et dans son emballage d'origine."
              style={{ paddingLeft:14 }}
            />
          </div>
          <div className={s.hint}><i className="fas fa-circle-info" /> Ce texte rassure vos acheteurs et réduit les litiges.</div>
        </div>

        <div className={s.saveRow}>
          <button className={s.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? <><i className="fas fa-spinner fa-spin" /> Sauvegarde…</> : <><i className="fas fa-cloud-arrow-up" /> Sauvegarder le catalogue</>}
          </button>
        </div>
      </FormCard>
    </>
  );
}