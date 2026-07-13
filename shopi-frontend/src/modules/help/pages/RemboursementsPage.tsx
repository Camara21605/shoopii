import React from 'react';
import { Link } from 'react-router-dom';
import styles from './LegalPage.module.css';

export default function RemboursementsPage() {
  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <nav className={styles.breadcrumb}>
          <Link to="/aide">Centre d'aide</Link><span>/</span><span>Remboursements</span>
        </nav>
        <header className={styles.header}>
          <div className={styles.headerIcon}><i className="fas fa-rotate-left" /></div>
          <div>
            <h1 className={styles.title}>Politique de remboursement</h1>
            <p className={styles.sub}>Dernière mise à jour : juillet 2025</p>
          </div>
        </header>
        <div className={styles.content}>

          <section className={styles.section}>
            <h2>1. Droit de rétractation</h2>
            <p>Vous disposez d'un délai de <strong>7 jours calendaires</strong> à compter de la réception de votre commande pour exercer votre droit de rétractation, sans avoir à justifier de motifs ni à payer de pénalités.</p>
          </section>

          <section className={styles.section}>
            <h2>2. Conditions de remboursement</h2>
            <p>Pour bénéficier d'un remboursement, les articles doivent être :</p>
            <ul>
              <li>Dans leur état d'origine (non utilisés, non endommagés)</li>
              <li>Dans leur emballage d'origine avec tous les accessoires</li>
              <li>Accompagnés de la facture d'achat</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>3. Articles non remboursables</h2>
            <p>Certains articles ne peuvent pas être remboursés :</p>
            <ul>
              <li>Articles périssables (produits alimentaires, fleurs…)</li>
              <li>Articles personnalisés ou sur mesure</li>
              <li>Logiciels descellés</li>
              <li>Articles d'hygiène une fois descellés</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>4. Délai de remboursement</h2>
            <p>Une fois votre retour reçu et inspecté, nous vous notifierons par email. Si votre retour est approuvé, le remboursement sera effectué dans un délai de <strong>5 à 10 jours ouvrables</strong> via le moyen de paiement initial.</p>
          </section>

          <section className={styles.section}>
            <h2>5. Comment initier un retour</h2>
            <p>Pour initier un retour :</p>
            <ol>
              <li>Connectez-vous à votre espace client Shopi</li>
              <li>Accédez à « Mes commandes » et sélectionnez la commande concernée</li>
              <li>Cliquez sur « Demander un retour » et suivez les instructions</li>
              <li>Vous recevrez une étiquette de retour par email</li>
            </ol>
          </section>

          <section className={styles.section}>
            <h2>6. Frais de retour</h2>
            <p>Les frais de retour sont à la charge du vendeur en cas de produit défectueux ou non conforme. Dans les autres cas, les frais de retour sont à la charge de l'acheteur.</p>
          </section>

        </div>
        <div className={styles.footer}>
          <Link to="/politique-retour" className={styles.link}><i className="fas fa-shield-halved" /> Politique de retour</Link>
          <Link to="/contact" className={styles.ctaLink}><i className="fas fa-headset" /> Contacter le support</Link>
        </div>
      </div>
    </div>
  );
}
