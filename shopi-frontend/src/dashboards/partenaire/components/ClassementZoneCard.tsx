/* ================================================================
 * FICHIER : components/ClassementZoneCard.tsx
 * Classement des partenaires de la zone (acteurs recrutés) —
 * GET /dashboard/partenaire/classement.
 *
 * Les noms des autres partenaires n'apparaissent que s'ils ont activé
 * Paramètres > Confidentialité > « Apparaître dans le classement »
 * (sinon « Partenaire anonyme ») ; le partenaire connecté voit toujours
 * sa propre ligne.
 * ================================================================ */

import { useEffect, useState } from 'react';
import styles from '../styles/OverviewPage.module.css';
import { apiFetch } from '@/shared/services/apiFetch';

interface Classement {
  rang:                 number | null;
  total:                number;
  recrues:              number;
  apparaitreClassement: boolean;
  top: { rang: number; nom: string; recrues: number; moi: boolean }[];
}

interface Props {
  onOuvrirConfidentialite: () => void;
}

const MEDAILLE = ['#D4A017', '#9CA3AF', '#B45309'];

export default function ClassementZoneCard({ onOuvrirConfidentialite }: Props) {
  const [c, setC] = useState<Classement | null>(null);

  useEffect(() => {
    let annule = false;
    apiFetch<Classement>('/dashboard/partenaire/classement')
      .then(r => { if (!annule) setC(r); })
      .catch(() => { /* carte simplement masquée */ });
    return () => { annule = true; };
  }, []);

  if (!c || c.total === 0) return null;

  const moiDansTop = c.top.some(l => l.moi);

  return (
    <div className={styles.card}>
      <div className={styles.ch}>
        <div className={styles.chT}><i className="fas fa-ranking-star" /> Classement de votre zone</div>
        <button className={styles.chLink} onClick={onOuvrirConfidentialite}>
          {c.apparaitreClassement ? 'Nom visible des autres' : 'Nom masqué aux autres'} <i className="fas fa-user-shield" />
        </button>
      </div>
      <div className={styles.cb}>
        <div style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 12 }}>
          {c.rang
            ? <>Vous êtes <b>{c.rang}<sup>{c.rang === 1 ? 'er' : 'e'}</sup></b> sur {c.total} partenaire{c.total > 1 ? 's' : ''} actif{c.total > 1 ? 's' : ''} ({c.recrues} acteur{c.recrues > 1 ? 's' : ''} recruté{c.recrues > 1 ? 's' : ''}).</>
            : <>Votre compte apparaîtra au classement une fois actif.</>}
        </div>
        {c.top.map(l => (
          <div key={l.rang} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', borderRadius: 10,
            background: l.moi ? 'var(--g50)' : 'transparent', fontWeight: l.moi ? 700 : 500,
          }}>
            <span style={{ width: 26, textAlign: 'center', fontWeight: 800, color: MEDAILLE[l.rang - 1] ?? 'var(--t3)' }}>
              {l.rang <= 3 ? <i className="fas fa-medal" /> : l.rang}
            </span>
            <span style={{ flex: 1, fontSize: 13, color: 'var(--t1)' }}>{l.nom}{l.moi ? ' (vous)' : ''}</span>
            <span style={{ fontSize: 12, color: 'var(--t3)' }}>{l.recrues} recrue{l.recrues > 1 ? 's' : ''}</span>
          </div>
        ))}
        {!moiDansTop && c.rang && (
          <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 8, textAlign: 'center' }}>
            … vous êtes {c.rang}<sup>e</sup> avec {c.recrues} recrue{c.recrues > 1 ? 's' : ''}.
          </div>
        )}
      </div>
    </div>
  );
}
