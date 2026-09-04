/* ============================================================
 * FICHIER : src/common/utils/totp-crypto.util.ts
 *
 * RÔLE : Chiffre/déchiffre les secrets TOTP (2FA) au repos.
 *
 * AVANT — twoFaSecret était stocké en clair en base (protégé
 * uniquement par `select: false`, qui n'empêche ni un accès direct à
 * la base, ni un dump/leak). Un secret TOTP en clair permet de générer
 * indéfiniment des codes 2FA valides pour le compte visé — contourne
 * totalement la protection que la 2FA est censée apporter.
 *
 * AES-256-GCM : authentifié (détecte toute altération du texte
 * chiffré), IV aléatoire à chaque appel (jamais deux fois la même
 * sortie pour le même secret). Format stocké : "v1:" + base64(iv(12)
 * + authTag(16) + ciphertext).
 *
 * RÉTROCOMPATIBILITÉ — les secrets déjà en base AVANT ce correctif
 * sont en clair, sans le préfixe "v1:". decryptTotpSecret() les
 * reconnaît et les renvoie tels quels plutôt que d'échouer : aucun
 * utilisateur ayant déjà activé la 2FA n'est bloqué. Tout NOUVEAU
 * secret (TwoFaService.setup) est chiffré dès l'écriture. Voir la
 * migration TotpSecretEncryption qui re-chiffre les valeurs déjà en
 * base au passage.
 * ============================================================ */

import * as crypto from 'crypto';

const ALGO       = 'aes-256-gcm';
const IV_LENGTH  = 12;
const TAG_LENGTH = 16;
const PREFIX     = 'v1:';

function getKey(): Buffer {
  const raw = process.env.TOTP_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      '[TotpCrypto] TOTP_ENCRYPTION_KEY est absent des variables d\'environnement. ' +
      'Générez-en une avec `node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"` ' +
      'et ajoutez-la dans .env (dev) / Render → Environment Variables (production).',
    );
  }
  const key = Buffer.from(raw, 'hex');
  if (key.length !== 32) {
    throw new Error(
      '[TotpCrypto] TOTP_ENCRYPTION_KEY doit faire exactement 64 caractères hexadécimaux (32 octets, AES-256).',
    );
  }
  return key;
}

/** true si `stored` a déjà été chiffré par encryptTotpSecret() ci-dessous. */
export function isTotpSecretEncrypted(stored: string): boolean {
  return stored.startsWith(PREFIX);
}

export function encryptTotpSecret(plain: string): string {
  const iv     = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

/** Déchiffre ; renvoie `stored` tel quel si ce n'est pas un secret chiffré (legacy en clair). */
export function decryptTotpSecret(stored: string): string {
  if (!isTotpSecretEncrypted(stored)) return stored;

  const buf        = Buffer.from(stored.slice(PREFIX.length), 'base64');
  const iv         = buf.subarray(0, IV_LENGTH);
  const authTag    = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(authTag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString('utf8');
}
