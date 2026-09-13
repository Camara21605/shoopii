/**
 * ============================================================
 * FICHIER : src/common/utils/frontend-url.util.ts
 *
 * BUG CORRIGÉ (prod) : FRONTEND_URL sert à DEUX usages incompatibles :
 *   1. Liste blanche CORS (main.ts) — attend plusieurs origines séparées
 *      par des virgules, ex: "https://www.shoneya.com,https://shoneya.com"
 *   2. Construction de liens dans les emails/tickets (registerUrl,
 *      loginUrl, ticketUrl...) — attend UNE seule URL de base.
 *
 * Une fois FRONTEND_URL configurée avec plusieurs domaines pour le CORS,
 * chaque endroit du code qui la lisait directement comme une URL unique
 * produisait un lien cassé (ex: "https://a.com,https://b.com/login?...",
 * rejeté par Brevo/les clients mail avec "invalid control character in
 * URL" dès qu'un caractère invisible s'y glissait en plus).
 *
 * Cette fonction extrait la PREMIÈRE URL de la liste — le domaine
 * canonique à utiliser pour tout lien destiné à un humain — sans exiger
 * une variable d'environnement séparée ni toucher la config CORS.
 * ============================================================
 */
import type { ConfigService } from '@nestjs/config';

export function getPrimaryFrontendUrl(
  config: ConfigService,
  fallback = 'https://shopi.gn',
): string {
  const raw = config.get<string>('FRONTEND_URL', fallback);
  const first = raw.split(',')[0]?.trim();
  return first || fallback;
}
