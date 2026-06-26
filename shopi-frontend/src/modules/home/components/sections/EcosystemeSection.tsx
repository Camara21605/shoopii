import React from 'react';
import styles from './EcosystemeSection.module.css';
interface Props { onToast: (m: string) => void; onRegister: () => void; }
export default function EcosystemeSection({ onToast, onRegister }: Props) {
  const UNIVERS = [
    { cls:'ea', emoji:'🛍️', role:'Client',             titre:'Achetez en toute confiance',  desc:'Parcourez des milliers de produits, passez commande et suivez vos livraisons.', feats:['Catalogue & recherche avancée','Suivi commandes temps réel','Abonnements boutiques','Avis, notes & messagerie'], cta:'Créer un compte' },
    { cls:'eb', emoji:'🏪', role:'Entreprise / Vendeur', titre:'Développez vos ventes',       desc:'Dashboard complet pour gérer catalogue, commandes, livreurs et performances.', feats:['Gestion produits, stocks & prix','Tableau de bord ventes','Gestion livreurs primaires','Promotions & messagerie'], cta:'Ouvrir une boutique' },
    { cls:'ec', emoji:'🛵', role:'Livreur',             titre:'Gérez vos missions',           desc:'Consultez vos livraisons, suivez vos revenus et communiquez avec vos clients.', feats:['Missions en attente & en cours','Statistiques & revenus','Abonnement boutiques','Historique performances'], cta:'Devenir livreur' },
    { cls:'ed', emoji:'🤝', role:'Partenaire',          titre:'Supervisez votre réseau',      desc:'Gérez les entreprises et livreurs de votre réseau avec un dashboard dédié.', feats:["Gestion entreprises & livreurs","Codes d'inscription","Mini dashboard réseau","Statistiques & historiques"], cta:'Devenir partenaire' },
    { cls:'ee', emoji:'📍', role:'Correspondant',       titre:'Facilitez la proximité',       desc:'Représentez une entreprise dans votre région et aidez les clients à recevoir.', feats:['Relais local client ↔ entreprise','Représentation régionale','Communication & coordination','Suivi missions'], cta:'Devenir correspondant' },
    { cls:'ef', emoji:'🔑', role:'Administrateur',      titre:'Pilotez & contrôlez',          desc:'Créez et surveillez les entreprises et livreurs. Gérez accès et conformité.', feats:['Création entreprises & livreurs',"Code de création de compte",'Surveillance & modération','Dashboard global'], cta:'Accéder au dashboard' },
  ];
  return (
    <section className={styles.sec}>
      <div className={styles.wrap}>
        <div className={styles.hd}>
          <div className={styles.kick}>L'écosystème Shopi</div>
          <h2 className={styles.title}>Une plateforme, <em>six univers</em></h2>
          <p className={styles.sub}>Chaque acteur dispose d'un espace dédié avec des outils adaptés à son rôle.</p>
        </div>
        <div className={styles.grid}>
          {UNIVERS.map(u => (
            <div key={u.role} className={`${styles.card} ${styles[u.cls]}`} onClick={() => onToast(`${u.emoji} ${u.cta}`)}>
              <div className={styles.ico}>{u.emoji}</div>
              <div className={styles.role}>{u.role}</div>
              <div className={styles.cardTitle}>{u.titre}</div>
              <div className={styles.desc}>{u.desc}</div>
              <div className={styles.feats}>
                {u.feats.map(f => <div key={f} className={styles.feat}><i className="fas fa-check" />{f}</div>)}
              </div>
              <button className={styles.btn} onClick={e => { e.stopPropagation(); onRegister(); }}>
                {u.cta} <i className="fas fa-arrow-right" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
