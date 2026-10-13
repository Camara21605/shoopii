/**
 * Kit commun des écrans « Paramètres » des espaces pro (livreur, correspondant…) :
 * cadre d'écran, cartes, interrupteurs, champs, messages, feuilles, toasts,
 * confirmation, garde « modifications non enregistrées », choix de photo /
 * document, envoi de fichiers, Ville → Commune → Quartier (Guinée).
 */
export * from './ui';
export * from './pick';
export * from './upload';
export { LocationFields, type Place } from './location-fields';
export { getCommunesByVille, getQuartiersByCommune, VILLES_SORTED } from './geo-guinee';
