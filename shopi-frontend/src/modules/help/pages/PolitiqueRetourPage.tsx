import React from 'react';
import { Link } from 'react-router-dom';
import styles from './LegalPage.module.css';

export default function PolitiqueRetourPage() {
  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <nav className={styles.breadcrumb}>
          <Link to="/aide">Centre d'aide</Link><span>/</span><span>Politique de retour</span>
        </nav>
        <header className={styles.header}>
          <div className={styles.headerIcon}><i className="fas fa-shield-halved" /></div>
          <div>
            <h1 className={styles.title}>Politique de retour</h1>
            <p className={styles.sub}>Dernière mise à jour : juillet 2025</p>
          </div>
        </header>
        <div className={styles.content}>

          <section className={styles.section}>
            <h2>1. Délai de retour</h2>
            <p>Vous pouvez retourner un article dans un délai de <strong>7 jours</strong> après la livraison. Au-delà de ce délai, les retours ne seront plus acceptés sauf dans les cas prévus par la garantie légale de conformité.</p>
          </section>

          <section className={styles.section}>
            <h2>2. État des articles retournés</h2>
            <p>Tout article retourné doit être :</p>
            <ul>
              <li>Non utilisé et en parfait état</li>
              <li>Dans son emballage d'origine intacte</li>
              <li>Accompagné de tous ses accessoires, notices et cadeaux éventuels</li>
            </ul>
            <p>Tout article incomplet, abîmé, endommagé ou sali ne sera ni repris ni remboursé.</p>
          </section>

          <section className={styles.section}>
            <h2>3. Processus de retour</h2>
            <p>Pour effectuer un retour, suivez ces étapes :</p>
            <ol>
              <li><strong>Initiez le retour</strong> depuis votre espace client dans les 7 jours</li>
              <li><strong>Attendez la validation</strong> du vendeur (sous 48h ouvrables)</li>
              <li><strong>Emballez soigneusement</strong> l'article et joignez la facture</li>
              <li><strong>Expédiez</strong> l'article avec le bordereau fourni</li>
              <li><strong>Suivez</strong> votre retour depuis l'application</li>
            </ol>
          </section>

          <section className={styles.section}>
            <h2>4. Garantie légale de conformité</h2>
            <p>Conformément à la réglementation en vigueur, vous bénéficiez d'une <strong>garantie légale de conformité de 2 ans</strong> à compter de la délivrance du bien. En cas de défaut de conformité, vous pouvez exiger la réparation ou le remplacement du bien.</p>
          </section>

          <section className={styles.section}>
            <h2>5. Litiges et SAV</h2>
            <p>En cas de litige avec un vendeur, notre équipe SAV intervient comme médiateur. Contactez-nous via votre espace client ou à travers notre formulaire de contact. Nous traitons toutes les réclamations sous <strong>72 heures ouvrables</strong>.</p>
          </section>

        </div>
        <div className={styles.footer}>
          <Link to="/remboursements" className={styles.link}><i className="fas fa-rotate-left" /> Politique de remboursement</Link>
          <Link to="/contact" className={styles.ctaLink}><i className="fas fa-headset" /> Contacter le support</Link>
        </div>
      </div>
    </div>
  );
}
