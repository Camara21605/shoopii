/**
 * Règles du mot de passe — identiques au serveur (RegisterDto /
 * ResetPasswordDto : ≥ 8 caractères, majuscule, minuscule, chiffre,
 * caractère spécial). Partagées par l'inscription et « mot de passe oublié ».
 */
export const PASSWORD_RULES: { label: string; test: (p: string) => boolean }[] = [
  { label: '8 caractères minimum', test: (p) => p.length >= 8 },
  { label: 'Une majuscule', test: (p) => /[A-Z]/.test(p) },
  { label: 'Une minuscule', test: (p) => /[a-z]/.test(p) },
  { label: 'Un chiffre', test: (p) => /\d/.test(p) },
  { label: 'Un caractère spécial (!@#…)', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export const isStrongPassword = (p: string) => PASSWORD_RULES.every((r) => r.test(p));
