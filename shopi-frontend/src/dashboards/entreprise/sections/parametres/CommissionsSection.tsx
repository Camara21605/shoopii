// src/dashboards/entreprise/sections/parametres/CommissionsSection.tsx
import React, { useState } from 'react';
import FormCard from '../../components/parametres/FormCard';
import s from '../../styles/parametres/ParametresPage.module.css';

interface Props { onDirty: () => void; onToast: (m: string, t?: string) => void; }

const ROWS = [
  ['Vente directe via Shopi', '3%', '0', true],
  ['Vente avec livreur Shopi', '3%', '1,5%', true],
  ['Vente via correspondant', '3%', '2%', true],
  ['Promotion flash Shopi', '2%', '0', true],
  ['Abonnement mensuel boutique', '— (inclus)', '—', false],
] as const;

const PLANS = [
  { em:'🟢', ttl:'Standard', sub:'Plan actuel · Inclus dans votre inscription', rate:'3% / vente', sel:true },
  { em:'⭐', ttl:'Pro', sub:'Pour les boutiques à fort volume de ventes', rate:'2% / vente', sel:false },
  { em:'🏆', ttl:'Premium', sub:'Commissions réduites + outils marketing avancés', rate:'1,5% / vente', sel:false },
];

export default function CommissionsSection({ onDirty, onToast }: Props) {
  const [selected, setSelected] = useState(0);
  return (
    <>
      <div className={s.sectionHd}>
        <h1><i className="fas fa-percent" /> Commissions Shopi</h1>
        <p>Détail des commissions appliquées sur vos ventes selon le type de transaction.</p>
      </div>
      <FormCard title="Grille de commissions" icon="fa-table-list" subtitle="Votre plan actuel : Boutique Standard"
        action={<span className={`${s.badge} ${s.blue}`} style={{ fontSize:11, padding:'4px 12px' }}>Standard</span>}
      >
        <table className={s.commTable}>
          <thead><tr><th>Type de transaction</th><th>Commission Shopi</th><th>Frais livreur/corresp.</th><th>Retrait immédiat</th></tr></thead>
          <tbody>
            {ROWS.map(([nom, comm, frais, ok]) => (
              <tr key={nom as string}>
                <td style={{ fontWeight:600 }}>{nom}</td>
                <td><span className={`${s.badge} ${s.green}`}>{comm}</span></td>
                <td><span className={`${s.badge} ${s.blue}`}>{frais}</span></td>
                <td>{ok ? <i className="fas fa-check-circle" style={{ color:'#047857' }} /> : <i className="fas fa-xmark" style={{ color:'var(--t4)' }} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </FormCard>
      <FormCard title="Passer à un plan supérieur" icon="fa-crown" subtitle="Réduisez vos commissions et accédez à des fonctionnalités avancées">
        <div className={s.radioGroup}>
          {PLANS.map((p, i) => (
            <div key={p.ttl} className={`${s.radioOpt} ${selected === i ? s.selected : ''}`} onClick={() => { setSelected(i); onDirty(); }}>
              <div className={s.roDot} />
              <span className={s.roEm}>{p.em}</span>
              <div><div className={s.roTtl}>{p.ttl}</div><div className={s.roSub}>{p.sub}</div></div>
              <div className={s.roBadge}>{p.rate}</div>
            </div>
          ))}
        </div>
      </FormCard>
    </>
  );
}
