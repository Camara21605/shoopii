/* ============================================================
 * FICHIER : src/modules/help/pages/ConfidentialitePage.tsx
 * MODULE : help (pages légales publiques)
 * ROLE : Politique de confidentialité de Shoneya (site + application Android),
 *        servie sur /confidentialite.
 * RESPONSABILITES :
 *   - page PUBLIQUE, sans connexion ni restriction géographique : Google Play
 *     exige une URL active et lisible par tous (fiche Play Store + application) ;
 *   - décrire ce que l'application fait RÉELLEMENT des données. Chaque
 *     affirmation correspond au code (ne rien promettre de plus) :
 *       · suppression : Paramètres → Zone de danger, refusée tant qu'une
 *         commande est en cours / en litige ou que le portefeuille n'est pas
 *         vide ; anonymisation définitive à J+30 (jobs/account-purge.cron) ;
 *       · aucune publicité, aucun outil de mesure d'audience tiers ;
 *       · appels audio/vidéo non enregistrés (seule la mise en relation passe
 *         par le serveur) ;
 *       · prestataires : Render, Vercel, Supabase, Redis Cloud, Cloudinary,
 *         Brevo, opérateurs Mobile Money / prestataires de paiement.
 *     Toute évolution de ces traitements doit être reportée ici.
 * DEPENDANCES : react-router-dom (Link), LegalPage.module.css, ThemeContext
 * AUTEUR : Shopi03
 * DERNIERE MISE A JOUR : 2026-10-15
 * ============================================================ */
import { Link } from 'react-router-dom';
import styles from './LegalPage.module.css';
import { useForceDarkTheme } from '../../../shared/context/ThemeContext';

/* Identité du responsable — fournie par le propriétaire de l'application */
const RESPONSABLE = "N'Famoussa Camara";
const LIEU = 'Kindia, Guinée';
const CONTACT = 'camara21605@gmail.com';

export default function ConfidentialitePage() {
  /* Même rendu que les autres pages légales (PolitiqueRetourPage) */
  useForceDarkTheme();

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <nav className={styles.breadcrumb}>
          <Link to="/aide">Centre d'aide</Link><span>/</span><span>Politique de confidentialité</span>
        </nav>
        <header className={styles.header}>
          <div className={styles.headerIcon}><i className="fas fa-user-shield" /></div>
          <div>
            <h1 className={styles.title}>Politique de confidentialité</h1>
            <p className={styles.sub}>Dernière mise à jour : 15 octobre 2026</p>
          </div>
        </header>
        <div className={styles.content}>

          <section className={styles.section}>
            <h2>1. Qui sommes-nous ?</h2>
            <p>
              Shoneya est une place de marché en ligne qui met en relation des <strong>clients</strong>, des
              <strong> boutiques</strong> (entreprises), des <strong>livreurs</strong>, des <strong>points relais</strong> (correspondants)
              et des <strong>partenaires</strong>. Elle est accessible sur le site <strong>www.shoneya.com</strong> et dans
              l'application mobile <strong>Shoneya</strong> pour Android.
            </p>
            <p>
              Le responsable du traitement des données est <strong>{RESPONSABLE}</strong>, {LIEU}.
              Pour toute question : <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
            </p>
            <p>Cette politique explique quelles données nous collectons, pourquoi, avec qui elles sont partagées, combien de temps elles sont conservées et comment exercer vos droits.</p>
          </section>

          <section className={styles.section}>
            <h2>2. Les données que nous collectons</h2>
            <p><strong>Données de compte</strong> (tous les utilisateurs) :</p>
            <ul>
              <li>nom, prénom, nom d'utilisateur, adresse e-mail, numéro de téléphone ;</li>
              <li>mot de passe (conservé uniquement sous forme chiffrée, jamais en clair) ;</li>
              <li>date de naissance et genre (clients) ; photo de profil si vous en ajoutez une ;</li>
              <li>réglages de sécurité : double authentification, codes de secours, questions de sécurité.</li>
            </ul>
            <p><strong>Données professionnelles</strong> (boutiques, livreurs, points relais, partenaires) :</p>
            <ul>
              <li>nom et logo de la boutique, adresse, horaires, catalogue de produits et services ;</li>
              <li>pour les livreurs : véhicule et plaque, zones de livraison, tarifs ;</li>
              <li>pour les points relais : adresse et photos du dépôt, horaires, capacité ;</li>
              <li>pièces justificatives envoyées pour la vérification du compte (carte d'identité, permis, assurance, casier judiciaire…), stockées en accès restreint.</li>
            </ul>
            <p><strong>Localisation</strong> :</p>
            <ul>
              <li>vos adresses de livraison et la ville / le quartier de votre profil ;</li>
              <li>votre position GPS, <strong>uniquement si vous l'autorisez</strong> : pour afficher les boutiques, livreurs et points relais proches et calculer les distances ;</li>
              <li>pour les livreurs : la position pendant une mission, afin que le client et la boutique suivent la livraison.</li>
            </ul>
            <p><strong>Commandes et paiements</strong> :</p>
            <ul>
              <li>historique des commandes, montants, statut de livraison, retours et remboursements ;</li>
              <li>portefeuille Shoneya : solde, transactions, demandes de retrait ;</li>
              <li>numéro Mobile Money ou coordonnées bancaires indiqués pour recevoir un paiement. Nous ne connaissons <strong>jamais</strong> votre code secret Mobile Money ni le code de votre carte.</li>
            </ul>
            <p><strong>Contenus que vous publiez ou échangez</strong> :</p>
            <ul>
              <li>photos de produits, stories, avis et notes ;</li>
              <li>messages (texte, messages vocaux, photos et fichiers) échangés dans la messagerie ;</li>
              <li>demandes adressées au support et leurs pièces jointes.</li>
            </ul>
            <p>
              <strong>Appels audio et vidéo</strong> : ils passent directement entre les appareils ; notre serveur
              sert seulement à les mettre en relation. Le contenu des appels <strong>n'est pas enregistré</strong>.
            </p>
            <p><strong>Données techniques</strong> : identifiant de l'appareil, adresse IP, date des connexions et sessions ouvertes, journaux de sécurité (tentatives de connexion), jetons de notification.</p>
          </section>

          <section className={styles.section}>
            <h2>3. Pourquoi nous utilisons ces données</h2>
            <ul>
              <li>créer et sécuriser votre compte (connexion, double authentification, détection des connexions suspectes) ;</li>
              <li>traiter les commandes : paiement, préparation, livraison, retrait en point relais, retours et remboursements ;</li>
              <li>gérer le portefeuille et verser aux boutiques, livreurs et points relais l'argent qui leur revient ;</li>
              <li>vérifier l'identité des professionnels avant de les rendre visibles ;</li>
              <li>vous permettre de discuter et d'appeler les autres utilisateurs ;</li>
              <li>afficher ce qui est proche de vous et calculer les frais de livraison ;</li>
              <li>vous envoyer des notifications et des e-mails liés à votre compte et à vos commandes (vous pouvez régler les notifications dans les Paramètres) ;</li>
              <li>répondre au support, traiter les litiges et lutter contre la fraude ;</li>
              <li>respecter nos obligations légales et comptables.</li>
            </ul>
            <p>Shoneya <strong>n'affiche pas de publicité</strong>, <strong>ne vend pas vos données</strong> et n'utilise aucun outil de mesure d'audience ou de suivi publicitaire tiers.</p>
          </section>

          <section className={styles.section}>
            <h2>4. Avec qui vos données sont partagées</h2>
            <p><strong>Avec les autres utilisateurs, seulement quand c'est nécessaire</strong> :</p>
            <ul>
              <li>la boutique, le livreur et le point relais concernés par une commande reçoivent votre nom, votre téléphone et l'adresse de livraison ;</li>
              <li>les profils des boutiques, livreurs et points relais sont publics (nom, photo, ville, note, avis). Certains éléments, comme le téléphone ou les statistiques, peuvent être masqués dans les Paramètres → Confidentialité ;</li>
              <li>vos avis publics affichent votre nom.</li>
            </ul>
            <p><strong>Avec nos prestataires techniques</strong>, qui traitent les données pour notre compte :</p>
            <ul>
              <li>hébergement du service et de la base de données : Render, Vercel, Supabase, Redis Cloud ;</li>
              <li>stockage des images et des documents : Cloudinary ;</li>
              <li>envoi des e-mails : Brevo ;</li>
              <li>paiements : opérateurs de Mobile Money et prestataires de paiement agréés (par exemple Orange Money, MTN Mobile Money), uniquement pour exécuter un paiement ou un retrait.</li>
            </ul>
            <p><strong>Avec les autorités</strong>, uniquement si la loi nous y oblige ou pour protéger les utilisateurs en cas de fraude.</p>
          </section>

          <section className={styles.section}>
            <h2>5. Sécurité</h2>
            <ul>
              <li>toutes les communications sont chiffrées (HTTPS) ;</li>
              <li>les mots de passe sont chiffrés de façon irréversible ;</li>
              <li>la double authentification est disponible pour tous les comptes ;</li>
              <li>les pièces justificatives sont stockées en accès restreint ;</li>
              <li>vous pouvez voir et fermer vos sessions ouvertes dans les Paramètres.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>6. Combien de temps nous gardons vos données</h2>
            <ul>
              <li>tant que votre compte est actif ;</li>
              <li>après une demande de suppression, vos données personnelles sont <strong>effacées ou anonymisées sous 30 jours</strong> : nom, e-mail, téléphone, photo, adresses, position, réglages, et pièces justificatives des livreurs ;</li>
              <li>les commandes, paiements et écritures comptables sont conservés de façon anonymisée (« Compte supprimé »), car la loi et la gestion des litiges l'exigent.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>7. Vos droits</h2>
            <p>Vous pouvez à tout moment :</p>
            <ul>
              <li><strong>consulter et corriger</strong> vos informations depuis votre profil et les Paramètres ;</li>
              <li><strong>retirer l'accès à votre position</strong> dans les réglages de votre téléphone ;</li>
              <li><strong>régler vos notifications</strong> et la visibilité de votre profil ;</li>
              <li><strong>supprimer votre compte</strong> : voir <Link to="/suppression-compte">Supprimer mon compte</Link> ;</li>
              <li>nous demander une copie de vos données ou poser toute question à <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. Nous répondons sous 30 jours.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>8. Âge minimum</h2>
            <p>Shoneya est réservée aux personnes de <strong>18 ans et plus</strong>. Nous ne collectons pas sciemment de données concernant des mineurs. Si vous pensez qu'un mineur a créé un compte, écrivez-nous et nous le supprimerons.</p>
          </section>

          <section className={styles.section}>
            <h2>9. Cookies et stockage sur l'appareil</h2>
            <p>Le site et l'application enregistrent sur votre appareil uniquement ce qui est nécessaire au fonctionnement : votre session de connexion, vos préférences (langue, thème) et l'identifiant de l'appareil. Aucun cookie publicitaire n'est utilisé.</p>
          </section>

          <section className={styles.section}>
            <h2>10. Modifications</h2>
            <p>Nous pouvons mettre à jour cette politique, par exemple quand une fonctionnalité évolue. La date de mise à jour figure en haut de la page. En cas de changement important, vous serez prévenu dans l'application.</p>
          </section>

          <section className={styles.section}>
            <h2>11. Contact</h2>
            <p>
              {RESPONSABLE} — {LIEU}<br />
              E-mail : <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
            </p>
          </section>

        </div>
        <div className={styles.footer}>
          <Link to="/suppression-compte" className={styles.link}><i className="fas fa-user-xmark" /> Supprimer mon compte</Link>
          <Link to="/contact" className={styles.ctaLink}><i className="fas fa-headset" /> Contacter le support</Link>
        </div>
      </div>
    </div>
  );
}
