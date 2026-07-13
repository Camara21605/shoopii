/* ================================================================
 * FICHIER : src/dashboards/administrateur/pages/CommandesPage.tsx
 *
 * Commandes de la zone avec mini barre de progression de la
 * chaîne de validation Shopi (4 étapes) et arbitrage des litiges.
 * ================================================================ */

import { useState } from 'react';
import styles from '../styles/CommandesPage.module.css';
import { COMMANDES, fmtGnf } from '../data/adminData';
import type { CommandeStatut } from '../data/types';

interface CommandesPageProps {
  onToast: (msg: string, type?: 's' | 'i' | 'w') => void;
}

const ST_LABEL: Record<CommandeStatut, string> = {
  paid: 'Payée', prep: 'Préparation', ship: 'En livraison',
  relay: 'Au relais', done: 'Livrée', dispute: 'Litige',
};

type Onglet = 'toutes' | 'encours' | 'litiges';

export default function CommandesPage({ onToast }: CommandesPageProps) {
  const [onglet, setOnglet] = useState<Onglet>('toutes');

  const visibles = COMMANDES.filter(c =>
    onglet === 'toutes'  ? true
    : onglet === 'litiges' ? c.statut === 'dispute'
    : c.statut !== 'done' && c.statut !== 'dispute'
  );

  return (
    <div>
      {/* ── Statistiques ── */}
      <div className={styles.stats}>
        <div className={styles.cstat}><div className={styles.cstatV}>1 240</div><div className={styles.cstatL}>Commandes (semaine)</div></div>
        <div className={styles.cstat}><div className={`${styles.cstatV} ${styles.vg}`}>96%</div><div className={styles.cstatL}>Livrées avec succès</div></div>
        <div className={styles.cstat}><div className={`${styles.cstatV} ${styles.va}`}>38</div><div className={styles.cstatL}>En cours de livraison</div></div>
        <div className={styles.cstat}><div className={`${styles.cstatV} ${styles.vr}`}>2</div><div className={styles.cstatL}>Litiges ouverts</div></div>
      </div>

      {/* ── Tableau des commandes ── */}
      <div className={styles.card}>
        <div className={styles.ch}>
          <div className={styles.chT}><i className="fas fa-box" /> Commandes récentes de la zone</div>
          <div className={styles.chRight}>
            <div className={styles.chTabs}>
              <button className={`${styles.chTab} ${onglet === 'toutes' ? styles.chTabOn : ''}`}
                onClick={() => setOnglet('toutes')}>Toutes</button>
              <button className={`${styles.chTab} ${onglet === 'encours' ? styles.chTabOn : ''}`}
                onClick={() => setOnglet('encours')}>En cours</button>
              <button className={`${styles.chTab} ${onglet === 'litiges' ? styles.chTabOn : ''}`}
                onClick={() => setOnglet('litiges')}>Litiges</button>
            </div>
            <button className={styles.exportBtn} onClick={() => onToast('📄 Export CSV des commandes', 'i')}>
              <i className="fas fa-download" />
            </button>
          </div>
        </div>
        <div className={styles.tblWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Commande</th><th>Client</th><th>Entreprise</th><th>Montant</th><th>Chaîne de validation</th><th>Statut</th><th></th></tr>
            </thead>
            <tbody>
              {visibles.map(c => (
                <tr key={c.id}>
                  <td><b>{c.id}</b><div className={styles.uMeta}>{c.quand}</div></td>
                  <td>{c.client}</td>
                  <td>{c.entreprise}</td>
                  <td>{fmtGnf(c.montant)}</td>
                  <td>
                    {/* 4 étapes : entreprise → livreur → correspondant → client */}
                    <div className={styles.miniProg}>
                      {[0, 1, 2, 3].map(i => (
                        <span key={i} className={i < c.progression ? styles.done : ''} />
                      ))}
                    </div>
                  </td>
                  <td><span className={`${styles.ordSt} ${styles['ord_' + c.statut]}`}>{ST_LABEL[c.statut]}</span></td>
                  <td>
                    {c.statut === 'dispute' ? (
                      <button className={styles.arbBtn} onClick={() => onToast('⚖️ Arbitrage du litige ouvert', 'i')}>
                        <i className="fas fa-scale-balanced" /> Arbitrer
                      </button>
                    ) : c.statut === 'done' ? (
                      <button className={styles.raBtn} title="Facture"
                        onClick={() => onToast('🧾 Facture ' + c.id, 'i')}>
                        <i className="fas fa-file-invoice" />
                      </button>
                    ) : (
                      <button className={styles.raBtn} title="Suivre"
                        onClick={() => onToast('📦 Chaîne de validation ' + c.id, 'i')}>
                        <i className="fas fa-eye" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
