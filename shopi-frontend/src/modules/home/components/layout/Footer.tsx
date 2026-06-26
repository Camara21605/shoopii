/*
 * FICHIER : src/modules/home/components/layout/Footer.tsx
 * RÔLE    : Footer de la page d'accueil
 */
import React from 'react';
import styles from './Footer.module.css';

interface FooterProps { onToast: (msg: string) => void; }

export default function Footer({ onToast }: FooterProps) {
  const COLS = [
    { titre:'Plateforme', liens:['Explorer les produits','Boutiques','Livreurs','Partenaires','Correspondants','Offres & Promos'] },
    { titre:'Acteurs',    liens:['Espace Client','Espace Entreprise','Espace Livreur','Espace Partenaire','Espace Correspondant','Espace Admin'] },
    { titre:'Aide',       liens:["Centre d'aide",'Contact','FAQ','Signaler un problème','Remboursements','Politique de retour'] },
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

      {/* ── Bande newsletter ── */}
      <div className={styles.newsletter}>
        <div className={styles.nlWrap}>
          <div className={styles.nlLeft}>
            <div className={styles.nlIcon}>📧</div>
            <div>
              <div className={styles.nlTitle}>Restez informé des meilleures offres</div>
              <div className={styles.nlSub}>Recevez les flash sales et nouveautés Shopi</div>
            </div>
          </div>
          <div className={styles.nlForm}>
            <input className={styles.nlInput} placeholder="Votre adresse email…" type="email" />
            <button className={styles.nlBtn} onClick={() => onToast('✅ Inscrit à la newsletter !')}>
              <i className="fas fa-paper-plane" /> S'abonner
            </button>
          </div>
        </div>
      </div>

      {/* ── Corps du footer ── */}
      <div className={styles.body}>
        <div className={styles.wrap}>
          <div className={styles.grid}>

            {/* Brand */}
            <div className={styles.brand}>
              <div className={styles.logo}>
                <div className={styles.lm}>Sh</div>
                <div className={styles.lw}>Sho<b>pi</b></div>
              </div>
              <p className={styles.brandP}>
                La marketplace africaine de référence. Connectons les acteurs économiques
                de l'Afrique de l'Ouest dans un écosystème digital unifié.
              </p>
              {/* Réseaux sociaux */}
              <div className={styles.socials}>
                {SOCIALS.map(s => (
                  <a key={s.label} href="#" className={styles.social}
                    onClick={e => { e.preventDefault(); onToast(`📲 ${s.label}`); }}
                    title={s.label} aria-label={s.label}>
                    <i className={s.icon} />
                  </a>
                ))}
              </div>
              {/* Badges stores */}
              <div className={styles.stores}>
                <button className={styles.storeBtn} onClick={() => onToast('📱 App Store bientôt disponible')}>
                  <i className="fab fa-apple" />
                  <div><span>Disponible sur</span><strong>App Store</strong></div>
                </button>
                <button className={styles.storeBtn} onClick={() => onToast('🤖 Google Play bientôt disponible')}>
                  <i className="fab fa-google-play" />
                  <div><span>Disponible sur</span><strong>Google Play</strong></div>
                </button>
              </div>
            </div>

            {/* Colonnes de liens */}
            {COLS.map(col => (
              <div key={col.titre} className={styles.col}>
                <h4 className={styles.colTitle}>{col.titre}</h4>
                <ul className={styles.colLinks}>
                  {col.liens.map(l => (
                    <li key={l}>
                      <a href="#" onClick={e => { e.preventDefault(); onToast(`📄 ${l}`); }}>
                        {l}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Badges confiance */}
          <div className={styles.trustRow}>
            {[
              { ico:'🔒', label:'Paiement sécurisé SSL' },
              { ico:'⚡', label:'Livraison express 7j/7' },
              { ico:'🛡️', label:'Protection acheteur' },
              { ico:'💬', label:'Support 24/7' },
              { ico:'📦', label:'Retour facile 7 jours' },
            ].map(t => (
              <div key={t.label} className={styles.trustItem}>
                <span>{t.ico}</span>
                <span>{t.label}</span>
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
              © 2025 Shopi Africa. Tous droits réservés. Fait avec ❤️ en Guinée 🇬🇳
            </p>
            <div className={styles.btmLinks}>
              {['Mentions légales','Confidentialité','Cookies','CGU','Accessibilité'].map(l => (
                <a key={l} href="#" onClick={e => e.preventDefault()}>{l}</a>
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