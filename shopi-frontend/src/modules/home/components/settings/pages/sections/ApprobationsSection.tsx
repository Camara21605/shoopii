/* ================================================================
 * src/modules/home/components/settings/sections/ApprobationsSection.tsx
 * ================================================================ */
import React from 'react';
import s from '../styles/SettingsCard.module.css';
import p from '../styles/SettingsPage.module.css';
interface Props { onToast: (msg: string) => void; }
export function ApprobationsSection({ onToast }: Props) {
  return (
    <div className={s.card}>
      <div className={s.cardHd}>
        <div className={s.cardTitle}>
          <div className={`${s.cardIco} ${s.icoEmerald}`}><i className="fas fa-shield-check" /></div>
          <div><div className={s.cardH}>Appareils de confiance</div><div className={s.cardSub}>Ces appareils peuvent se connecter sans code 2FA supplémentaire</div></div>
        </div>
      </div>
      <div className={s.cardBody} style={{ paddingBottom: 4 }}>
        <div className={s.trustedCard}>
          <div className={`${s.trustedIco} ${s.icoBlue}`}><i className="fas fa-mobile-screen" /></div>
          <div className={s.trustedInfo}>
            <div className={s.trustedName}>iPhone 15 Pro <span className={s.trustedVerified}><i className="fas fa-check" /> Approuvé</span></div>
            <div className={s.trustedMeta}>App Shopi · Conakry, Guinée · Dernière utilisation : aujourd'hui · Ajouté le 14 jan. 2025</div>
          </div>
          <button className={s.sessionRevoke} onClick={() => onToast('🔒 Appareil retiré de la liste de confiance')}>Retirer</button>
        </div>
        <div className={s.trustedCard}>
          <div className={`${s.trustedIco} ${s.icoEmerald}`}><i className="fas fa-laptop" /></div>
          <div className={s.trustedInfo}>
            <div className={s.trustedName}>MacBook Pro M3 <span className={s.trustedVerified}><i className="fas fa-check" /> Approuvé</span></div>
            <div className={s.trustedMeta}>Chrome 124 · Conakry, Guinée · Dernière utilisation : hier · Ajouté le 20 fév. 2025</div>
          </div>
          <button className={s.sessionRevoke} onClick={() => onToast('🔒 MacBook retiré de la liste de confiance')}>Retirer</button>
        </div>
        <div style={{ padding: '16px 24px 20px' }}>
          <div className={p.infoBanner} style={{ margin: 0 }}>
            <i className="fas fa-circle-info" />
            <div><strong>Comment ça fonctionne</strong> — Les appareils de confiance sont mémorisés après une vérification 2FA réussie. Retirez un appareil si vous ne le reconnaissez pas ou si vous l'avez perdu.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
 * NotifsSection
 * ================================================================ */
import { Toggle } from '../components/Toggle';
import { useState } from 'react';
export function NotifsSection({ onToast }: Props) {
  const [notifs, setNotifs] = useState({
    commandes:    { sms: true,  email: true,  push: true  },
    promos:       { sms: false, email: true,  push: true  },
    messages:     { sms: true,  email: true,  push: true  },
    points:       { sms: false, email: true,  push: true  },
  });
  const toggle = (k: keyof typeof notifs, ch: 'sms'|'email'|'push') =>
    setNotifs(prev => ({ ...prev, [k]: { ...prev[k], [ch]: !prev[k][ch] } }));
  const rows: { key: keyof typeof notifs; ico: keyof typeof s; icon: string; title: string; desc: string }[] = [
    { key:'commandes', ico:'icoEmerald', icon:'fa-bag-shopping',   title:'Statut de commande',     desc:'Confirmation, expédition, livraison' },
    { key:'promos',    ico:'icoViolet',  icon:'fa-tag',             title:'Promotions & offres',    desc:'Soldes, codes promo, offres exclusives' },
    { key:'messages',  ico:'icoRose',    icon:'fa-comment-dots',    title:'Messages',               desc:'Nouveaux messages des vendeurs ou du support' },
    { key:'points',    ico:'icoTeal',    icon:'fa-star',            title:'Points & récompenses',   desc:'Gains de points, paliers atteints' },
  ];
  return (
    <div className={s.card}>
      <div className={s.cardHd}>
        <div className={s.cardTitle}>
          <div className={`${s.cardIco} ${s.icoAmber}`}><i className="fas fa-bell" /></div>
          <div><div className={s.cardH}>Notifications</div><div className={s.cardSub}>Choisissez quand et comment être notifié</div></div>
        </div>
      </div>
      <div className={s.cardBody}>
        {rows.map(({ key, ico, icon, title, desc }) => (
          <div key={key} className={s.notifRow}>
            <div className={s.notifLeft}>
              <div className={`${s.notifIco} ${(s as any)[ico]}`}><i className={`fas ${icon}`} /></div>
              <div><div className={s.notifTitle}>{title}</div><div className={s.notifDesc}>{desc}</div></div>
            </div>
            <div className={s.notifChannels}>
              {(['sms','email','push'] as const).map(ch => (
                <div key={ch} className={s.notifCh}>
                  <Toggle checked={notifs[key][ch]} onChange={() => toggle(key, ch)} />
                  <span>{ch === 'sms' ? 'SMS' : ch === 'email' ? 'Email' : 'Push'}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================================================================
 * ConfidentialiteSection
 * ================================================================ */
export function ConfidentialiteSection({ onToast }: Props) {
  const [prefs, setPrefs] = useState({ historique: false, wishlist: true, perso: true, localisation: true, pubs: false });
  return (
    <div className={s.card}>
      <div className={s.cardHd}>
        <div className={s.cardTitle}>
          <div className={`${s.cardIco} ${s.icoViolet}`}><i className="fas fa-eye-slash" /></div>
          <div><div className={s.cardH}>Confidentialité du profil</div><div className={s.cardSub}>Contrôlez qui peut voir vos informations</div></div>
        </div>
      </div>
      <div className={s.cardBody}>
        <div className={s.privRow}>
          <div className={s.privLeft}><div className={`${s.privIco} ${s.icoBlue}`}><i className="fas fa-user" /></div><div><div className={s.privTitle}>Visibilité du profil</div><div className={s.privDesc}>Qui peut voir votre profil public</div></div></div>
          <select className={s.privSelect}><option>Tout le monde</option><option>Membres Shopi</option><option>Personne</option></select>
        </div>
        {[
          { key:'historique' as const, ico:'icoTeal',  icon:'fa-bag-shopping',      title:'Historique des commandes',        desc:'Afficher vos achats récents sur votre profil' },
          { key:'wishlist' as const,   ico:'icoRose',  icon:'fa-heart',             title:'Liste de souhaits',               desc:'Rendre votre liste de souhaits visible aux autres' },
          { key:'perso' as const,      ico:'icoAmber', icon:'fa-chart-simple',      title:'Données de personnalisation',     desc:'Utiliser votre comportement pour améliorer les recommandations' },
          { key:'localisation' as const,ico:'icoEmerald',icon:'fa-map-location-dot',title:'Localisation approximative',      desc:'Partager votre ville pour des offres locales' },
          { key:'pubs' as const,       ico:'icoViolet',icon:'fa-bullhorn',          title:'Publicités personnalisées',       desc:'Recevoir des publicités basées sur vos intérêts' },
        ].map(({ key, ico, icon, title, desc }) => (
          <div key={key} className={s.privRow}>
            <div className={s.privLeft}><div className={`${s.privIco} ${(s as any)[ico]}`}><i className={`fas ${icon}`} /></div><div><div className={s.privTitle}>{title}</div><div className={s.privDesc}>{desc}</div></div></div>
            <Toggle checked={prefs[key]} onChange={v => setPrefs(prev => ({ ...prev, [key]: v }))} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================================================================
 * ApparenceSection
 * ================================================================ */
export function ApparenceSection({ onToast }: Props) {
  return (
    <div className={s.card}>
      <div className={s.cardHd}>
        <div className={s.cardTitle}>
          <div className={`${s.cardIco} ${s.icoViolet}`}><i className="fas fa-palette" /></div>
          <div><div className={s.cardH}>Apparence</div><div className={s.cardSub}>Thème, taille de texte et affichage</div></div>
        </div>
      </div>
      <div className={s.cardBody}>
        <div className={s.privRow}><div className={s.privLeft}><div className={`${s.privIco} ${s.icoNavy}`}><i className="fas fa-moon" /></div><div><div className={s.privTitle}>Thème</div><div className={s.privDesc}>Clair, sombre ou automatique</div></div></div><select className={s.privSelect}><option>Clair</option><option>Sombre</option><option>Automatique</option></select></div>
        <div className={s.privRow}><div className={s.privLeft}><div className={`${s.privIco} ${s.icoBlue}`}><i className="fas fa-text-height" /></div><div><div className={s.privTitle}>Taille du texte</div><div className={s.privDesc}>Ajustez pour une meilleure lisibilité</div></div></div><select className={s.privSelect}><option>Normal</option><option>Grand</option><option>Très grand</option></select></div>
        <div className={s.privRow}><div className={s.privLeft}><div className={`${s.privIco} ${s.icoEmerald}`}><i className="fas fa-images" /></div><div><div className={s.privTitle}>Qualité des images</div><div className={s.privDesc}>Réduire pour économiser les données mobiles</div></div></div><select className={s.privSelect}><option>Haute qualité</option><option>Économique</option></select></div>
      </div>
    </div>
  );
}

/* ================================================================
 * LangueSection
 * ================================================================ */
export function LangueSection({ onToast }: Props) {
  return (
    <div className={s.card}>
      <div className={s.cardHd}>
        <div className={s.cardTitle}>
          <div className={`${s.cardIco} ${s.icoTeal}`}><i className="fas fa-globe" /></div>
          <div><div className={s.cardH}>Langue & région</div><div className={s.cardSub}>Langue, devise et fuseau horaire</div></div>
        </div>
        <button className={s.cardAction} onClick={() => onToast('✅ Préférences régionales enregistrées')}>Enregistrer</button>
      </div>
      <div className={s.cardBody}>
        <div className={s.privRow}><div className={s.privLeft}><div className={`${s.privIco} ${s.icoTeal}`}><i className="fas fa-language" /></div><div><div className={s.privTitle}>Langue d'affichage</div><div className={s.privDesc}>Langue de l'interface Shopi</div></div></div><select className={s.privSelect}><option>🇫🇷 Français</option><option>🇬🇧 English</option><option>🇸🇦 عربي</option><option>🇵🇹 Português</option></select></div>
        <div className={s.privRow}><div className={s.privLeft}><div className={`${s.privIco} ${s.icoEmerald}`}><i className="fas fa-coins" /></div><div><div className={s.privTitle}>Devise d'affichage</div><div className={s.privDesc}>Pour les prix et les transactions</div></div></div><select className={s.privSelect}><option>GNF — Franc Guinéen</option><option>USD — Dollar américain</option><option>EUR — Euro</option><option>XOF — Franc CFA</option></select></div>
        <div className={s.privRow}><div className={s.privLeft}><div className={`${s.privIco} ${s.icoViolet}`}><i className="fas fa-clock" /></div><div><div className={s.privTitle}>Fuseau horaire</div><div className={s.privDesc}>Pour les délais de livraison et les dates</div></div></div><select className={s.privSelect}><option>GMT+0 — Conakry</option><option>GMT+1 — Lagos</option><option>GMT+2 — Le Caire</option></select></div>
      </div>
    </div>
  );
}

/* ================================================================
 * DonneesSection
 * ================================================================ */
export function DonneesSection({ onToast }: Props) {
  return (
    <>
      <div className={s.card}>
        <div className={s.cardHd}>
          <div className={s.cardTitle}>
            <div className={`${s.cardIco} ${s.icoNavy}`}><i className="fas fa-database" /></div>
            <div><div className={s.cardH}>Mes données personnelles</div><div className={s.cardSub}>Accédez, exportez ou supprimez vos données — conformité RGPD</div></div>
          </div>
        </div>
        <div className={s.cardBody}>
          {[
            { ico:'icoBlue',    icon:'fa-file-export',          title:'Exporter toutes mes données',       desc:'Fichier ZIP avec profil, commandes, messages, points',                   btnLabel:'Exporter',  btnIcon:'fa-download',  msg:'📦 Export en préparation — email dans 24h' },
            { ico:'icoTeal',    icon:'fa-clock-rotate-left',    title:'Historique des commandes',          desc:'Toutes vos commandes depuis la création du compte — CSV ou PDF',         btnLabel:'CSV',       btnIcon:'fa-file-csv',  msg:'📋 Historique exporté' },
            { ico:'icoViolet',  icon:'fa-file-invoice',         title:'Mes factures et reçus',             desc:'PDF de toutes vos factures depuis l\'inscription',                       btnLabel:'PDF',       btnIcon:'fa-file-pdf',  msg:'🧾 Factures téléchargées' },
            { ico:'icoEmerald', icon:'fa-user-shield',          title:'Rapport de confidentialité',        desc:'Quelles données sont collectées, comment elles sont utilisées',          btnLabel:'Voir',      btnIcon:'fa-eye',       msg:'📄 Rapport ouvert' },
            { ico:'icoAmber',   icon:'fa-right-from-bracket',   title:'Demande de portabilité (RGPD)',     desc:'Transférer vos données vers une autre plateforme — délai légal 30 jours', btnLabel:'Demander',  btnIcon:'fa-paper-plane',msg:'📨 Demande de portabilité envoyée' },
          ].map(({ ico, icon, title, desc, btnLabel, btnIcon, msg }) => (
            <div key={title} className={s.dexRow}>
              <div className={s.dexLeft}>
                <div className={`${s.dexIco} ${(s as any)[ico]}`}><i className={`fas ${icon}`} /></div>
                <div><div className={s.dexTitle}>{title}</div><div className={s.dexDesc}>{desc}</div></div>
              </div>
              <button className={s.dexBtn} onClick={() => onToast(msg)}><i className={`fas ${btnIcon}`} /> {btnLabel}</button>
            </div>
          ))}
        </div>
      </div>
      <div className={`${p} `} style={{ display:'flex',alignItems:'flex-start',gap:12,background:'var(--sky)',border:'1px solid var(--sky-3)',borderRadius:'var(--r-md)',padding:'14px 16px',fontSize:12,color:'var(--t2)',lineHeight:1.6 }}>
        <i className="fas fa-circle-info" style={{ color:'var(--blue)',flexShrink:0,marginTop:2 }} />
        <div><strong>Vos droits</strong> — Vous avez le droit d'accéder, de corriger, d'exporter et de supprimer vos données à tout moment. Pour toute demande, contactez notre DPO à <strong>privacy@shopi.gn</strong>.</div>
      </div>
    </>
  );
}

/* ================================================================
 * DangerSection
 * ================================================================ */
export function DangerSection({ onToast }: Props) {
  return (
    <div className={`${s.card} ${s.cardDanger}`}>
      <div className={`${s.cardHd} ${s.cardHdDanger}`}>
        <div className={s.cardTitle}>
          <div className={`${s.cardIco} ${s.icoRed}`}><i className="fas fa-triangle-exclamation" /></div>
          <div>
            <div className={`${s.cardH} ${s.cardHRed}`}>Zone de danger</div>
            <div className={s.cardSub}>Ces actions sont irréversibles — réfléchissez avant d'agir</div>
          </div>
        </div>
      </div>
      <div className={s.cardBody}>
        <div className={s.dangerRow}>
          <div><div className={s.dangerTitle}>Désactiver temporairement le compte</div><div className={s.dangerDesc}>Votre profil sera masqué et vos commandes en cours seront traitées. Réactivation possible à tout moment.</div></div>
          <button className={s.dangerBtn} onClick={() => onToast('⚠️ Confirmation requise — vérifiez votre email')}>Désactiver</button>
        </div>
        <div className={s.dangerRow}>
          <div><div className={s.dangerTitle}>Révoquer tous les accès tiers</div><div className={s.dangerDesc}>Déconnecte toutes les applications et services liés à votre compte.</div></div>
          <button className={s.dangerBtn} onClick={() => onToast('🔌 Tous les accès tiers révoqués')}>Révoquer les accès</button>
        </div>
        <div className={s.dangerRow}>
          <div><div className={s.dangerTitle}>Réinitialiser toutes mes préférences</div><div className={s.dangerDesc}>Réinitialise notifications, apparence, langue et confidentialité aux valeurs par défaut Shopi.</div></div>
          <button className={s.dangerBtn} onClick={() => onToast('🔄 Préférences réinitialisées')}>Réinitialiser</button>
        </div>
        <div className={s.dangerRow}>
          <div><div className={`${s.dangerTitle} ${s.dangerTitleRed}`}>Supprimer définitivement le compte</div><div className={s.dangerDesc}>Toutes vos données, commandes, points et historique seront <strong>définitivement supprimés</strong> dans un délai de 30 jours. Cette action est <strong>irréversible</strong>.</div></div>
          <button className={`${s.dangerBtn} ${s.dangerBtnHard}`} onClick={() => onToast('⛔ Demande envoyée — vérifiez votre email')}>Supprimer mon compte</button>
        </div>
      </div>
    </div>
  );
}