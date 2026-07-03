/* ================================================================
 * FICHIER : src/modules/commande/components/Facture.tsx
 *
 * Facture imprimable de la commande (modale).
 * Affichée après la validation finale du client.
 *  - bouton "Imprimer / PDF" → window.print()
 *  - le CSS @media print masque tout sauf .facture
 * ================================================================ */

import { useState } from 'react';
import styles from '../styles/Facture.module.css';
import type { Commande } from '../data/types';

function FactureThumb({ src, emoji }: { src?: string | null; emoji: string }) {
  const [errored, setErrored] = useState(false);
  if (src && !errored) {
    return (
      <img
        src={src}
        alt=""
        onError={() => setErrored(true)}
        style={{
          width: 28, height: 28, objectFit: 'cover',
          borderRadius: 6, display: 'inline-block',
          verticalAlign: 'middle', marginRight: 8, flexShrink: 0,
        }}
      />
    );
  }
  return <span style={{ marginRight: 6, fontSize: 16 }}>{emoji}</span>;
}

interface FactureProps {
  commande: Commande;
  times:    string[];      // heures de validation par acteur
  onClose:  () => void;
}

const fmt = (n: number) => n.toLocaleString('fr-FR');

export default function Facture({ commande, times, onClose }: FactureProps) {
  const dateJour = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  const client  = commande.acteurs.find(a => a.role === 'client');
  const vendeur = commande.acteurs.find(a => a.role === 'entreprise');

  return (
    <div className={styles.backdrop} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>

        {/* Barre d'actions (masquée à l'impression) */}
        <div className={styles.bar}>
          <div className={styles.barTitle}><i className="fas fa-file-invoice" /> Facture de la commande</div>
          <div className={styles.barActs}>
            <button className={`${styles.act} ${styles.pri}`} onClick={() => window.print()}>
              <i className="fas fa-print" /> Imprimer / PDF
            </button>
            <button className={styles.act} onClick={onClose}><i className="fas fa-xmark" /></button>
          </div>
        </div>

        {/* ── Contenu imprimable ── */}
        <div className={`${styles.facture} facture-print`}>

          {/* En-tête */}
          <div className={styles.head}>
            <div className={styles.brand}>
              <div className={styles.logo}>Sh</div>
              <div>
                <div className={styles.brandNm}>Sho<b>pi</b></div>
                <div className={styles.brandSub}>Marketplace · Conakry, Guinée</div>
              </div>
            </div>
            <div className={styles.headRight}>
              <div className={styles.invLabel}>FACTURE</div>
              <div className={styles.invNo}>N° {commande.id}</div>
              <div className={styles.invPaid}><i className="fas fa-circle-check" /> Payée &amp; livrée</div>
            </div>
          </div>

          {/* Parties */}
          <div className={styles.parties}>
            <div>
              <div className={styles.partyLbl}>Facturé à (Client)</div>
              <div className={styles.partyNm}>{client?.nom}</div>
              <div className={styles.partyTxt}>{commande.destination}</div>
            </div>
            <div>
              <div className={styles.partyLbl}>Vendeur</div>
              <div className={styles.partyNm}>{vendeur?.nom}</div>
              <div className={styles.partyTxt}>Boutique vérifiée Shopi</div>
              <div className={styles.partyTxt}>Date : {dateJour}</div>
            </div>
          </div>

          {/* Tableau articles */}
          <table className={styles.table}>
            <thead>
              <tr><th>Article</th><th>PU (GNF)</th><th>Qté</th><th>Total (GNF)</th></tr>
            </thead>
            <tbody>
              {commande.articles.map((a, i) => (
                <tr key={i}>
                  <td>
                    <div className={styles.tdNm} style={{ display: 'flex', alignItems: 'center' }}>
                      <FactureThumb src={a.imageUrl} emoji={a.emoji} />
                      {a.nom}
                    </div>
                    <div className={styles.tdSub}>{a.boutique}</div>
                  </td>
                  <td>{fmt(a.prix)}</td>
                  <td>{a.qty}</td>
                  <td>{fmt(a.prix * a.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totaux */}
          <div className={styles.totals}>
            <div className={styles.tRow}><span>Sous-total</span><span>{fmt(commande.montant.sousTotal)} GNF</span></div>
            <div className={styles.tRow}><span>Livraison</span><span>{fmt(commande.montant.livraison)} GNF</span></div>
            <div className={styles.tRow}><span>Frais correspondant</span><span>{fmt(commande.montant.fraisCorrespondant)} GNF</span></div>
            <div className={styles.tTotal}><span>TOTAL PAYÉ</span><span>{fmt(commande.montant.total)} GNF</span></div>
          </div>

          {/* Chaîne de validation (preuve) */}
          <div className={styles.chainTitle}>Chaîne de validation — preuve de livraison</div>
          <div className={styles.chainGrid}>
            {commande.acteurs.map((a, i) => (
              <div key={a.role} className={styles.chainItem}>
                <div className={styles.chainRole}>{a.sousTitre}</div>
                <div className={styles.chainNm}>{a.nom}</div>
                <div className={styles.chainTime}><i className="fas fa-check" /> {times[i] ?? '—'}</div>
              </div>
            ))}
          </div>

          {/* Pied */}
          <div className={styles.foot}>
            <div className={styles.footNote}>
              <strong>Merci de votre confiance.</strong><br />
              Cette facture atteste que la commande {commande.id} a été payée, livrée et
              validée par tous les acteurs via leurs codes de validation sécurisés.
              Document généré automatiquement par Shopi.
            </div>
            <div className={styles.stamp}>
              <div className={styles.stampCircle}>
                <i className="fas fa-shield-check" />
                <span>Validé Shopi</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}