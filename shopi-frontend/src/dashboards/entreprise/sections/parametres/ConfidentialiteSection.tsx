// src/dashboards/entreprise/sections/parametres/ConfidentialiteSection.tsx
import React, { useState } from 'react';
import FormCard from '../../components/parametres/FormCard';
import ToggleRow from '../../components/parametres/ToggleRow';
import s from '../../styles/parametres/ParametresPage.module.css';

interface Props { onDirty: () => void; onToast: (m: string, t?: string) => void; }

export default function ConfidentialiteSection({ onDirty, onToast }: Props) {
  const [vis, setVis] = useState({ search:true, stats:true, suivi:true, loc:false });
  const [data, setData] = useState({ algo:true, anon:true, rapports:false });
  const setV = (k: keyof typeof vis) => (v: boolean) => { setVis(p => ({ ...p, [k]: v })); onDirty(); };
  const setD = (k: keyof typeof data) => (v: boolean) => { setData(p => ({ ...p, [k]: v })); onDirty(); };

  return (
    <>
      <div className={s.sectionHd}>
        <h1><i className="fas fa-shield-halved" /> Confidentialité</h1>
        <p>Contrôlez la visibilité de votre boutique et l'utilisation de vos données sur la plateforme.</p>
      </div>
      <FormCard title="Visibilité de la boutique" icon="fa-eye">
        <ToggleRow label="Apparaître dans la recherche Shopi" sub="Votre boutique est trouvable par tous les clients" checked={vis.search} onChange={setV('search')} />
        <ToggleRow label="Afficher les statistiques de vente" sub="Nombre de commandes et avis visibles sur votre profil public" checked={vis.stats} onChange={setV('stats')} />
        <ToggleRow label="Permettre le suivi de boutique" sub="Les clients peuvent s'abonner à votre boutique" checked={vis.suivi} onChange={setV('suivi')} />
        <ToggleRow label="Partager la localisation exacte" sub="Afficher l'adresse précise dans les résultats de recherche" checked={vis.loc} onChange={setV('loc')} />
      </FormCard>
      <FormCard title="Données & Statistiques" icon="fa-chart-pie">
        <ToggleRow label="Améliorer les algorithmes Shopi" sub="Vos données de vente aident à améliorer les recommandations" checked={data.algo} onChange={setD('algo')} />
        <ToggleRow label="Statistiques de marché anonymisées" sub="Vos stats participent aux rapports agrégés de la plateforme" checked={data.anon} onChange={setD('anon')} />
        <ToggleRow label="Rapports personnalisés avancés" sub="Recevoir des analyses de performance adaptées à votre activité" checked={data.rapports} badge="new" onChange={setD('rapports')} />
      </FormCard>
    </>
  );
}
