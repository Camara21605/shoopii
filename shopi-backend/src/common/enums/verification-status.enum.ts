/* ── Statut vérification documents ───────────────────────── */
/*
 * Défini dans un fichier sans dépendance pour éviter les imports
 * circulaires entre entités (entreprise-profile → user → … →
 * partenaire-profile → entreprise-profile), qui rendaient l'enum
 * `undefined` selon l'ordre de chargement.
 */
export enum VerificationStatus {
  PENDING   = 'pending',
  REVIEWING = 'reviewing',
  VERIFIED  = 'verified',
  REJECTED  = 'rejected',
}
