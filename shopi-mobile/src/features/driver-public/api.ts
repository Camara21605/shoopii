/**
 * Profil public d'un livreur vu par un client — même source que la page /livreurs/:id du site
 * (ProfilLivreurPage) :
 *   GET /client/livreurs/:id   public (connexion facultative → `isSuivi`)
 * Téléphone et WhatsApp ne sont renvoyés qu'aux abonnés du livreur et au livreur lui-même ;
 * un compte suspendu, banni ou en pause répond 404.
 * Le contenu (schéma, vue) est partagé avec le réseau livreur : voir features/livreur-network.
 *
 * « Mon propre profil » : un compte livreur reconnaît le sien grâce à
 *   GET /livreur/parametres → { id }
 */
export { fetchDriverProfile, type DriverProfile } from '@/features/livreur-network/api';
export { fetchSettings as fetchMyDriverSettings } from '@/features/livreur-settings/api';
