/* ============================================================
 * FICHIER : src/common/utils/socket-cors.util.ts
 *
 * RÔLE : Calcule la liste des origines autorisées pour le CORS d'un
 * namespace Socket.IO, à partir de FRONTEND_URL (comma-separated).
 *
 * ⚠️ FAILLE CORRIGÉE (audit sécurité) — 7 gateways WebSocket utilisaient
 * `origin: true` (reflète n'importe quelle Origin envoyée par le client)
 * au lieu d'une whitelist, contrairement au CORS HTTP strict de main.ts.
 * Le risque réel était limité (l'auth passe par un JWT dans
 * handshake.auth/Authorization, jamais par cookie — donc pas de vecteur
 * CSRF-WebSocket direct), mais c'est une incohérence de posture de
 * sécurité : n'importe quel site tiers peut ouvrir un socket avec
 * credentials:true vers ces namespaces sans restriction. En cas de
 * refactor futur vers une auth par cookie, ou de fuite de JWT (XSS,
 * log), ce serait alors exploitable depuis n'importe quelle origine.
 *
 * NE PAS utiliser ConfigService ici : les décorateurs @WebSocketGateway
 * sont évalués à l'IMPORT du fichier, avant que NestJS ait fini son
 * bootstrap (donc avant que ConfigService soit disponible). On lit
 * process.env directement — ça fonctionne car en production (Render),
 * les variables d'environnement sont injectées par la plateforme dès le
 * démarrage du process, AVANT même l'exécution du premier import Node
 * (contrairement à un fichier .env local, chargé plus tard par dotenv
 * via ConfigModule.forRoot() — limitation acceptée en dev local
 * uniquement, où ce helper retombe sur '*').
 * ============================================================ */

export function getSocketAllowedOrigins(): string[] | string {
  const raw = process.env.FRONTEND_URL;
  if (!raw) return '*';
  const origins = raw.split(',').map(s => s.trim()).filter(Boolean);
  return origins.length > 0 ? origins : '*';
}
