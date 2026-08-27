/* ============================================================
 * FICHIER : src/common/utils/phone-hash.util.ts
 *
 * RÔLE : Normalise un numéro de téléphone au format E.164 et le
 *        hache en SHA-256 — SOURCE UNIQUE utilisée à la fois pour
 *        remplir User.phoneHash (voir user.entity.ts, @BeforeInsert/
 *        @BeforeUpdate) et pour la migration de backfill.
 *
 * DOIT rester cohérent avec la normalisation cliente équivalente
 * (shopi-frontend/src/shared/messagerie/hooks/useContactSync.ts,
 * fonction normalizeE164) : les deux calculent un SHA-256 sur la
 * MÊME représentation E.164 d'un numéro, sinon aucun match n'est
 * jamais trouvé entre un contact importé et un utilisateur inscrit.
 *
 * ⚠️ Cette fonction sert au numéro DE L'UTILISATEUR LUI-MÊME (saisi
 * via PhoneInput.tsx à l'inscription, donc déjà préfixé d'un
 * indicatif pays explicite) — elle ne devine JAMAIS de pays par
 * défaut, contrairement à normalizeE164() côté carnet de contacts
 * qui doit gérer des numéros locaux à 9 chiffres sans indicatif.
 * ============================================================ */

import { createHash } from 'crypto';

/**
 * Normalise un numéro déjà préfixé d'un indicatif (ex: "+224 620 00 00 00",
 * "00224620000000") vers le format E.164 strict ("+224620000000").
 * Retourne null si le numéro ne contient pas assez de chiffres pour être
 * exploitable (évite de hacher une chaîne vide ou tronquée).
 */
export function normalizeUserPhoneE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return null;

  const normalized = digits.startsWith('00') ? digits.slice(2) : digits;
  return '+' + normalized;
}

/** SHA-256 hex (64 caractères) d'un numéro normalisé — null si numéro absent/invalide. */
export function hashUserPhone(phone: string | null | undefined): string | null {
  const normalized = normalizeUserPhoneE164(phone);
  if (!normalized) return null;
  return createHash('sha256').update(normalized).digest('hex');
}
