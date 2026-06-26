/* ================================================================
 * FICHIER : src/modules/commande/sections/OrderSummary.tsx
 * Récapitulatif du colis (articles + montants). Colonne droite.
 * ================================================================ */

import styles from '../styles/OrderSummary.module.css';
import type { Commande } from '../data/types';

const fmt = (n: number) => n.toLocaleString('fr-FR');

export default function OrderSummary({ commande }: { commande: Commande }) {
  const livreur = commande.acteurs.find(a => a.role === 'livreur');
  return (
    <div className={styles.card}>
      <div className={styles.ch}><div className={styles.chT}><i className="fas fa-bag-shopping" /> Détail de la commande</div></div>
      <div className={styles.cb}>
        {commande.articles.map((a, i) => (
          <div key={i} className={styles.item}>
            <div className={styles.em}>{a.emoji}</div>
            <div className={styles.inf}>
              <div className={styles.nm}>{a.nom}</div>
              <div className={styles.meta}>{a.boutique} · ×{a.qty}</div>
            </div>
            <div className={styles.pr}>{fmt(a.prix * a.qty)}</div>
          </div>
        ))}

        <div style={{ marginTop: 12 }} />
        <div className={styles.row}><span>Sous-total</span><span className={styles.v}>{fmt(commande.montant.sousTotal)} GNF</span></div>
        <div className={styles.row}><span>Livraison{livreur ? ` (${livreur.nom})` : ''}</span><span className={styles.v}>{fmt(commande.montant.livraison)} GNF</span></div>
        <div className={styles.row}><span>Frais correspondant</span><span className={styles.v}>{fmt(commande.montant.fraisCorrespondant)} GNF</span></div>
        <div className={styles.div} />
        <div className={styles.total}><span className={styles.tl}>Total payé</span><span className={styles.tv}>{fmt(commande.montant.total)} GNF</span></div>
      </div>
    </div>
  );
}