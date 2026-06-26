// src/dashboards/entreprise/sections/parametres/DangerSection.tsx
import React from 'react';
import FormCard from '../../components/parametres/FormCard';
import s from '../../styles/parametres/ParametresPage.module.css';

interface Props { onDirty: () => void; onToast: (m: string, t?: string) => void; }

const ACTIONS = [
  { ttl:'Mettre la boutique en pause', sub:'Masquez votre boutique temporairement. Vos données et commandes en cours sont conservés.', btn:'Mettre en pause' },
  { ttl:'Désactiver le compte (30 jours)', sub:'Votre profil sera masqué pendant 30 jours. Toutes les données sont conservées.', btn:'Désactiver' },
  { ttl:'Transférer la gestion', sub:'Transférez la gestion de la boutique à un autre responsable avant de partir.', btn:'Transférer' },
  { ttl:'Supprimer définitivement la boutique', sub:'Action irréversible — tous vos produits, commandes et historique de ventes seront supprimés.', btn:'Supprimer la boutique' },
];

export default function DangerSection({ onDirty, onToast }: Props) {
  return (
    <>
      <div className={s.sectionHd}>
        <h1><i className="fas fa-triangle-exclamation" style={{ color:'#DC2626' }} /> Zone sensible</h1>
        <p>Ces actions sont irréversibles ou ont un impact majeur sur votre boutique. Procédez avec précaution.</p>
      </div>
      <FormCard title="Actions irréversibles" icon="fa-skull-crossbones" subtitle="Ces opérations ne peuvent pas être annulées" danger>
        {ACTIONS.map(a => (
          <div key={a.ttl} className={s.dangerRow}>
            <div>
              <div className={s.dangerTtl}>{a.ttl}</div>
              <div className={s.dangerSub}>{a.sub}</div>
            </div>
            <button className={s.dangerBtn} onClick={() => onToast(`⚠️ Confirmation requise : ${a.btn}`, 'w')}>{a.btn}</button>
          </div>
        ))}
      </FormCard>
    </>
  );
}
