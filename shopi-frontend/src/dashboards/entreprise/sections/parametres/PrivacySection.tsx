/*
 * FICHIER : src/dashboards/entreprise/sections/parametres/PrivacySection.tsx
 * Section 11 — Confidentialité (7 toggles)
 */
import React, { useState, useEffect } from 'react';
import FormCard from '../../components/parametres/FormCard';
import type { ParametresData } from '../../hooks/useParametres';
import s from '../../styles/parametres/ParametresPage.module.css';

interface Props {
  data: ParametresData | null; saving: boolean;
  onDirty: () => void; onToast: (m: string, t?: string) => void;
  savePrivacy: (b: Record<string, boolean>) => Promise<void>;
}

const PRIVACY_ITEMS = [
  { key:'showInSearch',       label:'Apparaître dans la recherche',           sub:'Votre boutique est visible dans les résultats de recherche Shopi' },
  { key:'showSalesStats',     label:'Afficher les stats de vente',            sub:'Les clients voient le nombre de commandes et la note' },
  { key:'allowFollow',        label:'Permettre les abonnements',              sub:'Les utilisateurs peuvent suivre votre boutique' },
  { key:'shareExactLocation', label:'Partager l\'adresse exacte',             sub:'Sinon, seule la commune est affichée' },
  { key:'improveAlgorithm',   label:'Améliorer les recommandations Shopi',    sub:'Vos données aident à personnaliser les résultats' },
  { key:'anonymizedStats',    label:'Partager des statistiques anonymisées',  sub:'Contribue à l\'amélioration de la plateforme' },
  { key:'advancedReports',    label:'Rapports avancés personnalisés',         sub:'Accédez à des analyses détaillées de votre boutique' },
];

const DEFAULTS: Record<string, boolean> = {
  showInSearch:true, showSalesStats:true, allowFollow:true,
  shareExactLocation:false, improveAlgorithm:true, anonymizedStats:true, advancedReports:false,
};

export default function PrivacySection({ data, saving, onDirty, onToast, savePrivacy }: Props) {
  const [privacy, setPrivacy] = useState<Record<string, boolean>>(DEFAULTS);

  useEffect(() => {
    if (data?.privacySettings) setPrivacy({ ...DEFAULTS, ...data.privacySettings });
  }, [data]);

  function toggle(key: string) { setPrivacy(prev => ({ ...prev, [key]: !prev[key] })); onDirty(); }

  async function handleSave() {
    try { await savePrivacy(privacy); onToast('✅ Confidentialité sauvegardée', 's'); }
    catch { onToast('❌ Erreur lors de la sauvegarde', 'e'); }
  }

  return (
    <>
      <div className={s.sectionHd}>
        <h1><i className="fas fa-eye-slash" /> Confidentialité</h1>
        <p>Contrôlez quelles informations de votre boutique sont visibles et partagées.</p>
      </div>

      <FormCard title="Préférences de confidentialité" icon="fa-lock" subtitle="Ces paramètres s'appliquent à votre page boutique publique">
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
                background: privacy[item.key] ? 'var(--teal,#0E7490)' : 'var(--g300)',
                position:'relative', transition:'background .2s' }}>
              <div style={{ position:'absolute', top:3, width:18, height:18, borderRadius:'50%',
                background:'#fff', transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.2)',
                left: privacy[item.key] ? 22 : 3 }} />
            </div>
          </div>
        ))}

        <div className={s.saveRow}>
          <button className={s.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? <><i className="fas fa-spinner fa-spin" /> Sauvegarde…</> : <><i className="fas fa-cloud-arrow-up" /> Sauvegarder la confidentialité</>}
          </button>
        </div>
      </FormCard>
    </>
  );
}