/* ============================================================
 * FICHIER : src/modules/help/pages/SuppressionComptePage.tsx
 * MODULE : help (pages légales publiques)
 * ROLE : Page « Supprimer mon compte » servie sur /suppression-compte.
 * RESPONSABILITES :
 *   - page PUBLIQUE exigée par Google Play (« URL de suppression du compte ») :
 *     elle doit expliquer comment demander la suppression, SANS connexion,
 *     et ce qui est supprimé ou conservé ;
 *   - refléter les vraies règles du serveur (services *danger* /
 *     preferences.service.supprimerCompte + jobs/account-purge.cron) :
 *       · mot de passe demandé ; refus tant qu'une commande est en cours ou
 *         en litige, ou que le portefeuille contient des fonds ;
 *       · sessions fermées tout de suite, anonymisation définitive à J+30 ;
 *       · commandes / paiements / écritures comptables gardés anonymisés.
 *   - proposer une demande par e-mail à qui n'a plus accès à son compte.
 * DEPENDANCES : react-router-dom (Link), LegalPage.module.css, ThemeContext
 * AUTEUR : Shopi03
 * DERNIERE MISE A JOUR : 2026-10-15
 * ============================================================ */
import { Link } from 'react-router-dom';
import styles from './LegalPage.module.css';
import { useForceDarkTheme } from '../../../shared/context/ThemeContext';

const CONTACT = 'camara21605@gmail.com';
const MAIL_SUJET = encodeURIComponent('Suppression de mon compte Shoneya');

export default function SuppressionComptePage() {
  /* Même rendu que les autres pages légales */
  useForceDarkTheme();

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <nav className={styles.breadcrumb}>
          <Link to="/aide">Centre d'aide</Link><span>/</span><span>Supprimer mon compte</span>
        </nav>
        <header className={styles.header}>
          <div className={styles.headerIcon}><i className="fas fa-user-xmark" /></div>
          <div>
            <h1 className={styles.title}>Supprimer mon compte Shoneya</h1>
            <p className={styles.sub}>Application Shoneya (Android) et site www.shoneya.com — dernière mise à jour : 15 octobre 2026</p>
          </div>
        </header>
        <div className={styles.content}>

          <section className={styles.section}>
            <h2>1. Depuis l'application ou le site (le plus rapide)</h2>
            <p>Connectez-vous, puis :</p>
            <ul>
              <li><strong>Compte client</strong> : Paramètres → Compte → <strong>Zone de danger</strong> → Supprimer définitivement ;</li>
              <li><strong>Boutique</strong> : Paramètres → <strong>Zone sensible</strong> → Supprimer la boutique et le compte (réservé au propriétaire de la boutique) ;</li>
              <li><strong>Livreur, point relais ou partenaire</strong> : Paramètres → <strong>Zone sensible</strong> → Supprimer le compte.</li>
            </ul>
            <p>Votre mot de passe vous sera demandé pour confirmer.</p>
          </section>

          <section className={styles.section}>
            <h2>2. Avant de supprimer</h2>
            <p>Pour protéger vos achats et votre argent, la suppression est refusée tant que :</p>
            <ul>
              <li>une <strong>commande est en cours ou en litige</strong> : attendez qu'elle soit terminée ;</li>
              <li>votre <strong>portefeuille contient encore de l'argent</strong> : retirez-le d'abord.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>3. Sans accès à votre compte</h2>
            <p>
              Si vous ne pouvez plus vous connecter, écrivez à{' '}
              <a href={`mailto:${CONTACT}?subject=${MAIL_SUJET}`}>{CONTACT}</a> depuis l'adresse e-mail de votre compte,
              en indiquant votre nom et votre numéro de téléphone. Nous vérifions que la demande vient bien de vous,
              puis nous supprimons le compte. Nous répondons sous 30 jours.
            </p>
          </section>

          <section className={styles.section}>
            <h2>4. Ce qui est supprimé</h2>
            <ul>
              <li><strong>Immédiatement</strong> : vous êtes déconnecté de tous vos appareils, vous ne pouvez plus vous connecter et les notifications s'arrêtent ;</li>
              <li><strong>Sous 30 jours</strong> : vos données personnelles sont effacées ou anonymisées : nom, e-mail, téléphone, photo, adresses de livraison, position, réglages, questions de sécurité ; pour les livreurs, les pièces justificatives (carte d'identité, permis, assurance, casier) sont supprimées.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>5. Ce qui est conservé</h2>
            <p>
              Les commandes, paiements, avis et écritures comptables sont conservés <strong>sans votre identité</strong>
              (ils apparaissent au nom de « Compte supprimé »). La loi l'exige, et c'est nécessaire pour traiter les
              litiges et les remboursements des autres utilisateurs.
            </p>
          </section>

          <section className={styles.section}>
            <h2>6. Supprimer seulement certaines données</h2>
            <p>
              Vous pouvez aussi, sans supprimer votre compte, modifier ou effacer vos informations de profil, vos
              adresses, votre photo, et réinitialiser vos préférences depuis les Paramètres. Pour toute autre demande,
              écrivez à <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
            </p>
          </section>

        </div>
        <div className={styles.footer}>
          <Link to="/confidentialite" className={styles.link}><i className="fas fa-user-shield" /> Politique de confidentialité</Link>
          <a href={`mailto:${CONTACT}?subject=${MAIL_SUJET}`} className={styles.ctaLink}><i className="fas fa-envelope" /> Demander la suppression par e-mail</a>
        </div>
      </div>
    </div>
  );
}
