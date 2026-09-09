/*
 * FICHIER : src/modules/home/components/layout/Footer.tsx
 * RÔLE    : Footer de la page d'accueil
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from './Footer.module.css';

type FooterLink = { label: string; to?: string };

interface FooterProps { onToast: (msg: string) => void; }

export default function Footer({ onToast }: FooterProps) {
  const { t } = useTranslation();
  const COLS: { titre: string; liens: FooterLink[] }[] = [
    { titre:t('publicFooter.cols.plateforme.titre'), liens:[
      { label:t('publicFooter.cols.plateforme.explorerProduits'), to:'/explorer' },
      { label:t('publicFooter.cols.plateforme.boutiques'),     to:'/boutiques' },
      { label:t('publicFooter.cols.plateforme.livreurs'),      to:'/livreurs' },
      /* "Partenaires" reste sans route : pas de page publique de découverte
       * des partenaires (contrairement à /boutiques, /livreurs,
       * /correspondants) — seul /dashboard/partenaire existe, réservé aux
       * partenaires déjà inscrits. Toast honnête "bientôt disponible"
       * plutôt qu'un lien vers une page qui n'existe pas. */
      { label:t('publicFooter.cols.plateforme.partenaires') },
      { label:t('publicFooter.cols.plateforme.correspondants'), to:'/correspondants' },
      { label:t('publicFooter.cols.plateforme.offresPromos'),  to:'/offres' },
    ]},
    /* BUG CORRIGÉ — les 6 liens "Espace X" n'avaient aucune route (juste un
     * toast factice), alors que CE SONT littéralement les dashboards réels
     * de l'appli. RoleRoute (voir router.tsx) gère déjà tous les cas
     * proprement : anonyme → /login, connecté avec le bon rôle → le
     * dashboard, connecté avec un AUTRE rôle → son propre dashboard (pas
     * d'erreur, pas de page cassée) — donc un simple lien suffit ici, sans
     * logique d'auth à dupliquer dans le footer. */
    { titre:t('publicFooter.cols.acteurs.titre'), liens:[
      { label:t('publicFooter.cols.acteurs.espaceClient'),       to:'/home' },
      { label:t('publicFooter.cols.acteurs.espaceEntreprise'),   to:'/dashboard/entreprise' },
      { label:t('publicFooter.cols.acteurs.espaceLivreur'),      to:'/dashboard/livreur' },
      { label:t('publicFooter.cols.acteurs.espacePartenaire'),   to:'/dashboard/partenaire' },
      { label:t('publicFooter.cols.acteurs.espaceCorrespondant'),to:'/dashboard/correspondant' },
      { label:t('publicFooter.cols.acteurs.espaceAdmin'),        to:'/dashboard/admin' },
    ]},
    { titre:t('publicFooter.cols.aide.titre'), liens:[
      { label:t('publicFooter.cols.aide.centreAide'),       to:'/aide' },
      { label:t('publicFooter.cols.aide.contact'),             to:'/contact' },
      { label:t('publicFooter.cols.aide.faq'),                 to:'/aide#faq' },
      { label:t('publicFooter.cols.aide.signalerProbleme'), to:'/contact' },
      { label:t('publicFooter.cols.aide.remboursements'),      to:'/remboursements' },
      { label:t('publicFooter.cols.aide.politiqueRetour'), to:'/politique-retour' },
    ]},
  ];

  const SOCIALS = [
    { icon:'fab fa-facebook-f',  label:'Facebook'  },
    { icon:'fab fa-instagram',   label:'Instagram' },
    { icon:'fab fa-x-twitter',   label:'X'         },
    { icon:'fab fa-whatsapp',    label:'WhatsApp'  },
    { icon:'fab fa-linkedin-in', label:'LinkedIn'  },
    { icon:'fab fa-tiktok',      label:'TikTok'    },
  ];

  return (
    <footer className={styles.footer}>

      {/* ── Corps du footer ── */}
      <div className={styles.body}>
        <div className={styles.wrap}>
          <div className={styles.grid}>

            {/* Brand */}
            <div className={styles.brand}>
              <div className={styles.logo}>
                <div className={styles.lw}>Sho<b>neya</b></div>
              </div>
              <p className={styles.brandP}>
                {t('publicFooter.brandTagline')}
              </p>
              {/* Réseaux sociaux */}
              <div className={styles.socials}>
                {SOCIALS.map(s => (
                  <a key={s.label} href="#" className={styles.social}
                    onClick={e => { e.preventDefault(); onToast(t('publicFooter.socialToast', { label: s.label })); }}
                    title={s.label} aria-label={s.label}>
                    <i className={s.icon} />
                  </a>
                ))}
              </div>
              {/* Badges stores */}
              <div className={styles.stores}>
                <button className={styles.storeBtn} onClick={() => onToast(t('publicFooter.appStoreToast'))}>
                  <i className="fab fa-apple" />
                  <div><span>{t('publicFooter.disponibleSur')}</span><strong>App Store</strong></div>
                </button>
                <button className={styles.storeBtn} onClick={() => onToast(t('publicFooter.googlePlayToast'))}>
                  <i className="fab fa-google-play" />
                  <div><span>{t('publicFooter.disponibleSur')}</span><strong>Google Play</strong></div>
                </button>
              </div>
            </div>

            {/* Colonnes de liens */}
            {COLS.map(col => (
              <div key={col.titre} className={styles.col}>
                <h4 className={styles.colTitle}>{col.titre}</h4>
                <ul className={styles.colLinks}>
                  {col.liens.map(l => (
                    <li key={l.label}>
                      {l.to
                        ? <Link to={l.to}>{l.label}</Link>
                        : <a href="#" onClick={e => { e.preventDefault(); onToast(t('publicFooter.linkToast', { label: l.label })); }}>{l.label}</a>
                      }
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Badges confiance */}
          <div className={styles.trustRow}>
            {[
              { ico:'🔒', label:t('publicFooter.trust.paiementSecurise') },
              { ico:'⚡', label:t('publicFooter.trust.livraisonExpress') },
              { ico:'🛡️', label:t('publicFooter.trust.protectionAcheteur') },
              { ico:'💬', label:t('publicFooter.trust.support247') },
              { ico:'📦', label:t('publicFooter.trust.retourFacile') },
            ].map(trustItem => (
              <div key={trustItem.label} className={styles.trustItem}>
                <span>{trustItem.ico}</span>
                <span>{trustItem.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bas footer ── */}
      <div className={styles.bottom}>
        <div className={styles.wrap}>
          <div className={styles.btmRow}>
            <p className={styles.copyright}>
              {t('publicFooter.copyright')}
            </p>
            <div className={styles.btmLinks}>
              {/* BUG CORRIGÉ — ces 5 liens ne faisaient RIEN (preventDefault
               * seul, aucun toast) : contrairement aux autres liens non
               * développés du footer (colonnes, réseaux sociaux, stores),
               * un clic ici ne donnait aucun retour visuel — l'utilisateur
               * ne pouvait pas savoir si le lien était cassé ou juste pas
               * encore prêt. Aucune de ces pages légales n'existe encore
               * (vérifié dans router.tsx) ; on applique donc le même toast
               * "bientôt disponible" que le reste du footer plutôt que de
               * fabriquer un faux texte légal ou laisser un clic muet. */}
              {[
                t('publicFooter.bottomLinks.mentionsLegales'),
                t('publicFooter.bottomLinks.confidentialite'),
                t('publicFooter.bottomLinks.cookies'),
                t('publicFooter.bottomLinks.cgu'),
                t('publicFooter.bottomLinks.accessibilite'),
              ].map(l => (
                <a key={l} href="#" onClick={e => { e.preventDefault(); onToast(t('publicFooter.linkToast', { label: l })); }}>{l}</a>
              ))}
            </div>
            <div className={styles.payments}>
              {['💳 Visa','💳 Mastercard','📱 Orange Money','📱 MTN Mobile'].map(p => (
                <span key={p} className={styles.payBadge}>{p}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}