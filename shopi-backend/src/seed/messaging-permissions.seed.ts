// À mettre dans un fichier seed/messaging-permissions.seed.ts

const RULES = [
  // CLIENT peut toujours écrire à COMPANY
  { initiatorType: 'client',        targetType: 'company',       alwaysAllowed: true  },
  // CLIENT → DELIVERY : doit suivre le livreur
  { initiatorType: 'client',        targetType: 'delivery',      followRequired: true },
  // CLIENT → CORRESPONDENT : toujours autorisé
  { initiatorType: 'client',        targetType: 'correspondent', alwaysAllowed: true  },
  // COMPANY → CLIENT : le client doit suivre la boutique
  { initiatorType: 'company',       targetType: 'client',        followRequired: true,
    deniedMessage: 'Ce client ne vous suit pas encore.' },
  // COMPANY → DELIVERY : doit suivre le livreur
  { initiatorType: 'company',       targetType: 'delivery',      followRequired: true },
  // COMPANY → CORRESPONDENT : doit suivre
  { initiatorType: 'company',       targetType: 'correspondent', followRequired: true },
  // COMPANY → PARTNER : doit suivre
  { initiatorType: 'company',       targetType: 'partner',       followRequired: true },
  // DELIVERY → COMPANY : doit suivre
  { initiatorType: 'delivery',      targetType: 'company',       followRequired: true },
  // DELIVERY → CLIENT : assigné à une commande uniquement
  { initiatorType: 'delivery',      targetType: 'client',        assignmentRequired: true,
    deniedMessage: 'Vous devez être assigné à une livraison pour écrire à ce client.' },
  // CORRESPONDENT → COMPANY : doit suivre
  { initiatorType: 'correspondent', targetType: 'company',       followRequired: true },
  // CORRESPONDENT → DELIVERY : assigné à une mission
  { initiatorType: 'correspondent', targetType: 'delivery',      assignmentRequired: true },
  // PARTNER → COMPANY : doit suivre
  { initiatorType: 'partner',       targetType: 'company',       followRequired: true },
];