/* ============================================================
 * FICHIER      : src/common/enums/user-role.enum.ts
 * MODULE       : Common / Enums
 * ROLE         : Source de vérité unique pour les rôles utilisateurs de Shopi.
 *
 * RESPONSABILITES :
 *   - Définir les 7 rôles du système.
 *   - Garantir la cohérence entre la DB (colonne `role` de `user`) et le code.
 *
 * DEPENDANCES  : Aucune
 * CONSOMME PAR :
 *   - RolesGuard            (contrôle d'accès)
 *   - @Roles() decorator    (métadonnées de routes)
 *   - JwtStrategy           (peuple req.user.role)
 *   - User entity           (colonne DB)
 *   - Tous les controllers  (@Roles(UserRole.XXX))
 *
 * IMPACT D'UNE MODIFICATION :
 *   - Renommer ou supprimer une valeur → migration DB obligatoire.
 *   - Ajouter une valeur → migration DB + vérifier les @Roles() existants.
 *   - Changer une valeur string → invalide tous les tokens JWT actifs
 *     (le role est embarqué dans le payload JWT).
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

/**
 * Les 7 rôles du système Shopi, dans l'ordre décroissant de privilège.
 * Les valeurs string sont stockées telles quelles en base de données.
 */
export enum UserRole {
  /** Administrateur global — accès total à toutes les fonctionnalités. */
  SUPER_ADMIN   = 'super_admin',

  /** Administrateur modérateur — accès modération et rapports, pas aux finances. */
  ADMIN         = 'admin',

  /** Entreprise / Vendeur — catalogue, commandes, livreurs, correspondants. */
  COMPANY       = 'company',

  /** Livreur — commandes à livrer, groupes de livraison, géolocalisation. */
  DELIVERY      = 'delivery',

  /** Partenaire — intégrations API, rapport partenaire. */
  PARTNER       = 'partner',

  /** Correspondant — dépôts, colis, zone géographique assignée. */
  CORRESPONDENT = 'correspondent',

  /** Client final — achats, wallet, commandes, favoris, SAV. */
  CLIENT        = 'client',
}