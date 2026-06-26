// ─────────────────────────────────────────────────────────────────────────────
// FICHIER : src/modules/auth/roleConfigs.ts
//
// RÔLE GÉNÉRAL DU FICHIER :
//   Centralise toutes les informations "statiques" liées aux rôles
//   utilisateurs (client, entreprise, livreur, etc.) pour les pages
//   d'authentification (Login / Register) :
//     - ROLE_CONFIGS  → configuration complète par rôle (icône, texte,
//                        gestion du code d'invitation, etc.)
//     - ROLE_LABELS   → libellé court d'affichage pour chaque rôle
//     - ROLE_DASHBOARD→ nom du tableau de bord affiché (ex: messages de bienvenue)
// ─────────────────────────────────────────────────────────────────────────────

import type { UserRole, RoleConfig } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// ROLE_CONFIGS
//
// Un objet indexé par UserRole (Record<UserRole, RoleConfig>).
// Chaque entrée décrit comment le rôle doit être présenté dans le
// RoleSelector (étape de choix du rôle) et dans le formulaire d'inscription.
//
// Champs communs à tous les rôles :
//   icon  → emoji affiché dans le sélecteur de rôle
//   label → nom du rôle affiché à l'utilisateur
//   sub   → courte accroche ("Acheter", "Vendre", "Livrer"...)
//   info  → texte descriptif (HTML) affiché quand le rôle est sélectionné
//   code  → true si une "code d'activation/invitation" est obligatoire
//           pour s'inscrire avec ce rôle
//   shop  → true si le formulaire doit demander un nom de boutique
//           (uniquement pour le rôle "company")
//
// Champs liés au code d'invitation (présents seulement si code: true) :
//   codeType        → 'single'  = un seul champ code à 10 caractères
//                      'choice'  = l'utilisateur doit d'abord choisir
//                                  QUI l'a invité (entreprise ou livreur),
//                                  voir CorrespondantCodeBlock.tsx
//   codeLength      → longueur attendue du code (ex: 10)
//   codeLabel       → titre affiché au-dessus du champ code
//   codeNote        → texte explicatif (qui fournit le code, pourquoi...)
//   codePlaceholder → exemple de code affiché en placeholder
//   codeIcon        → emoji représentant la source du code
//   codeFrom        → nom de l'entité qui fournit le code (affiché
//                      dans "Fourni par : ...")
// ─────────────────────────────────────────────────────────────────────────────
export const ROLE_CONFIGS: Record<UserRole, RoleConfig> = {

  // ── CLIENT ────────────────────────────────────────────────────────────────
  // Rôle par défaut, accessible sans code d'invitation et sans boutique.
  client: {
    icon: '🛍️',
    label: 'Client',
    sub: 'Acheter',
    info: '<strong>Client</strong> — Parcourez des milliers de produits, passez commande et suivez vos livraisons en temps réel.',
    code: false, // pas de code d'invitation requis
    shop: false, // pas de nom de boutique demandé
  },

  // ── ENTREPRISE / VENDEUR ──────────────────────────────────────────────────
  // ✅ clé 'company' (et non 'entreprise') — doit rester alignée sur la
  //    valeur du rôle envoyée/attendue par le backend (UserRole).
  company: {
    icon: '🏪',
    label: 'Entreprise',
    sub: 'Vendre',
    info: "<strong>Entreprise / Vendeur</strong> — Gérez votre boutique, catalogue, commandes et livreurs depuis un tableau de bord complet. Un code fourni par un Partenaire ou un Administrateur Shopi est obligatoire.",
    code: true,   // un code d'activation est obligatoire
    shop: true,   // seul rôle qui demande un nom de boutique
    codeType: 'single',                 // un seul champ code (pas de choix)
    codeLength: 10,                     // code attendu sur 10 caractères
    codeLabel: "Code d'activation boutique",   // titre du bloc code
    codeNote: "Ce code vous est remis par le Partenaire ou l'Administrateur Shopi qui vous a enregistré sur la plateforme.",
    codePlaceholder: 'SHOPX9',           // exemple affiché dans le champ
    codeIcon: '🤝',                      // icône de la source du code
    codeFrom: 'Partenaire ou Administrateur', // affiché dans "Fourni par : ..."
  },

  // ── LIVREUR ───────────────────────────────────────────────────────────────
  // ✅ clé 'delivery' (et non 'livreur') — alignée sur le backend.
  delivery: {
    icon: '🛵',
    label: 'Livreur',
    sub: 'Livrer',
    info: "<strong>Livreur</strong> — Consultez vos missions, suivez vos revenus et communiquez avec entreprises et clients. Un code fourni par une Entreprise ou un Partenaire Shopi est obligatoire.",
    code: true,
    shop: false, // pas de boutique pour un livreur
    codeType: 'single',
    codeLength: 10,
    codeLabel: "Code d'invitation livreur",
    codeNote: "Ce code vous est remis par l'Entreprise ou le Partenaire Shopi qui vous recrute comme livreur.",
    codePlaceholder: 'LVR2024',
    codeIcon: '🏪',
    codeFrom: 'Entreprise ou Partenaire',
  },

  // ── PARTENAIRE ────────────────────────────────────────────────────────────
  // ✅ clé 'partner' (et non 'partenaire') — alignée sur le backend.
  // Supervise un réseau d'entreprises/livreurs, code fourni par le Super Admin.
  partner: {
    icon: '🤝',
    label: 'Partenaire',
    sub: 'Superviser',
    info: "<strong>Partenaire</strong> — Supervisez votre réseau d'entreprises et de livreurs. Votre code d'accès est fourni exclusivement par l'Administrateur Shopi.",
    code: true,
    shop: false,
    codeType: 'single',
    codeLength: 10,
    codeLabel: "Code d'accès Administrateur",
    codeNote: "Ce code de 10 caractères est fourni uniquement par l'Administrateur Shopi.",
    codePlaceholder: 'PARTNER8',
    codeIcon: '🔑',
    codeFrom: 'Administrateur Shopi',
  },

  // ── CORRESPONDANT ─────────────────────────────────────────────────────────
  // Cas particulier : codeType: 'choice' → l'utilisateur peut être invité
  // SOIT par une entreprise SOIT par un livreur. Le formulaire d'inscription
  // n'affiche donc pas le bloc CodeBlock "classique" (réservé à codeType
  // === 'single'), mais utilise CorrespondantCodeBlock.tsx, qui permet de
  // choisir le type d'expéditeur avant de saisir le code.
  // → Pas de codeLabel/codeNote/codePlaceholder/codeIcon/codeFrom ici car
  //   ces informations sont gérées dynamiquement par CorrespondantCodeBlock
  //   selon le type choisi ('company' ou 'delivery').
  correspondent: {
    icon: '📍',
    label: 'Correspondant',
    sub: 'Relayer',
    info: "<strong>Correspondant</strong> — Aidez les clients à recevoir leurs commandes et représentez une Entreprise <em>ou</em> un Livreur dans votre ville ou pays.",
    code: true,
    shop: false,
    codeType: 'choice', // → déclenche l'affichage de CorrespondantCodeBlock
    codeLength: 10,
  },

  // ── ADMIN ─────────────────────────────────────────────────────────────────
  // Rôle sensible : nécessite un code fourni par le Super Administrateur,
  // et l'inscription est ensuite soumise à validation manuelle (côté backend).
  admin: {
    icon: '🔑',
    label: 'Admin',
    sub: 'Gérer',
    info: "<strong>Administrateur</strong> — Créez et surveillez les entreprises et livreurs de votre réseau. Ce rôle est soumis à validation par le Super Administrateur.",
    code: true,
    shop: false,
    codeType: 'single',
    codeLength: 10,
    codeLabel: 'Code Super Administrateur',
    codeNote: "Ce code confidentiel de 10 caractères est remis exclusivement par le Super Administrateur Shopi.",
    codePlaceholder: 'SUPERADMIN',
    codeIcon: '🔐',
    codeFrom: 'Super Administrateur Shopi',
  },

  // ── SUPER ADMIN ───────────────────────────────────────────────────────────
  // Accès total à la plateforme. Aucune inscription publique possible :
  // pas de code (code: false) et pas de boutique (shop: false).
  // Ce compte est créé/géré directement côté backend, pas via ce formulaire.
  super_admin: {
    icon: '👑',
    label: 'Super Admin',
    sub: 'Contrôler',
    info: "<strong>Super Administrateur</strong> — Accès total à la plateforme Shopi.",
    code: false,
    shop: false,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ROLE_LABELS
//
// Libellé court (affiché dans des listes, badges, tableaux...) pour chaque
// rôle. Différent de "label" dans ROLE_CONFIGS qui est plus orienté vers le
// sélecteur de rôle à l'inscription (ex: "Entreprise" vs "Entreprise / Vendeur").
// Utilisé notamment dans le dashboard super-admin (UsersSection, UserModal...).
// ─────────────────────────────────────────────────────────────────────────────
export const ROLE_LABELS: Record<UserRole, string> = {
  client:        'Client',
  company:       'Entreprise / Vendeur',   // ← était 'entreprise'
  delivery:      'Livreur',               // ← était 'livreur'
  partner:       'Partenaire',            // ← était 'partenaire'
  correspondent: 'Correspondant',
  admin:         'Administrateur',
  super_admin:   'Super Administrateur',
};

// ─────────────────────────────────────────────────────────────────────────────
// ROLE_DASHBOARD
//
// Nom du tableau de bord / espace personnel propre à chaque rôle, utilisé
// par exemple dans les messages de bienvenue après connexion ou inscription
// (ex: "Bienvenue dans votre espace livreur").
// ─────────────────────────────────────────────────────────────────────────────
export const ROLE_DASHBOARD: Record<UserRole, string> = {
  client:        'votre accueil Shopi',
  company:       'votre tableau de bord boutique',
  delivery:      'votre espace livreur',
  partner:       'votre espace partenaire',
  correspondent: 'votre espace correspondant',
  admin:         'votre dashboard administrateur',
  super_admin:   'votre tableau de bord super administrateur',
};
