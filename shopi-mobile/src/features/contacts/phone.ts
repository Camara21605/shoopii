/**
 * Numéros du répertoire → empreinte SHA-256, calculée SUR LE TÉLÉPHONE.
 *
 * Aucun numéro en clair ne quitte l'appareil : le serveur compare ces
 * empreintes à users.phoneHash (shopi-backend/src/common/utils/phone-hash.util.ts).
 * La normalisation DOIT rester identique à celle du site
 * (shopi-frontend/src/shared/messagerie/hooks/useContactSync.ts, normalizeE164),
 * sinon un contact ne serait jamais reconnu :
 *   « 00224 620… » → « +224620… » · « 620 00 00 00 » (9 chiffres) → « +224620000000 »
 *   « +33 6 12… » → « +3361… »
 */
import * as Crypto from 'expo-crypto';

/** Moins de 8 chiffres : numéro court (service, opérateur) — jamais un compte. */
const MIN_DIGITS = 8;

export function normalizeE164(raw: string): string | null {
  const d = raw.replace(/\D/g, '');
  if (d.length < MIN_DIGITS) return null;
  if (d.startsWith('00')) return d.length - 2 >= MIN_DIGITS ? `+${d.slice(2)}` : null;
  if (d.length === 9) return `+224${d}`;
  return `+${d}`;
}

/** SHA-256 hexadécimal (minuscules), comme hashUserPhone côté serveur. */
export function hashE164(e164: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, e164);
}
