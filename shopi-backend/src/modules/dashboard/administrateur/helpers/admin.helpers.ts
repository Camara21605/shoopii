/* ============================================================
 * FICHIER : helpers/admin.helpers.ts
 *
 * Fonctions utilitaires pures (sans effet de bord ni I/O)
 * partagées par tous les services du dashboard administrateur.
 * ============================================================ */

import { User, UserStatus } from '../../../../database/entities/user.entity';
import { parseUserAgent }   from '../../../../common/utils/user-agent.util';

// ── Temps relatif ────────────────────────────────────────────

/**
 * Convertit une date en libellé relatif lisible en français.
 * Exemples : "À l'instant", "Il y a 5min", "Il y a 3h", "Il y a 2j"
 */
export function relTime(date: Date): string {
  const min = Math.floor((Date.now() - new Date(date).getTime()) / 60_000);
  if (min < 1)  return "À l'instant";
  if (min < 60) return `Il y a ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24)  return `Il y a ${h}h`;
  return `Il y a ${Math.floor(h / 24)}j`;
}

// ── Génération de code ───────────────────────────────────────

/**
 * Génère un code alphanumérique aléatoire au format SHOPI-{PREFIX}-{5CHARS}.
 * Le préfixe correspond au rôle cible (PAR, ENT, LVR, COR).
 * Exemple : randCode('PAR') → "SHOPI-PAR-AB3K9"
 */
export function randCode(prefix: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let suffix = '';
  for (let i = 0; i < 5; i++) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `SHOPI-${prefix}-${suffix}`;
}

// ── Catégorisation d'icônes d'audit ─────────────────────────

/**
 * Déduit la catégorie visuelle d'une entrée de journal d'audit
 * à partir de l'icône émoji et/ou du texte de l'action.
 *
 * Retourne l'une des 4 valeurs CSS du frontend :
 *   'code' → action liée aux codes de création
 *   'ok'   → validation ou activation
 *   'warn' → avertissement ou signalement
 *   'ban'  → suspension ou refus
 */
export function iconKind(icon: string, action = ''): 'code' | 'ok' | 'warn' | 'ban' {
  const t = icon + action;
  if (/qrcode|code|clé/i.test(t)              || t.includes('📋') || t.includes('🔑')) return 'code';
  if (/check|valid|activ|réactiv/i.test(t)    || t.includes('✅') || t.includes('🟢')) return 'ok';
  if (/warn|alert|flag|signal|avert/i.test(t) || t.includes('⚠')  || t.includes('🟡')) return 'warn';
  if (/ban|block|suspens|reject|refus/i.test(t)|| t.includes('🚫') || t.includes('❌')) return 'ban';
  return 'ok';
}

/**
 * Convertit un émoji de log en classe Font Awesome correspondante.
 * Utilisé pour les entrées d'AuditLog qui n'ont pas encore
 * de classe FA stockée directement en base.
 */
export function iconFa(icon: string): string {
  if (icon.includes('✅') || icon.includes('🟢')) return 'fa-circle-check';
  if (icon.includes('🚫') || icon.includes('❌')) return 'fa-ban';
  if (icon.includes('⚠')  || icon.includes('🔶')) return 'fa-triangle-exclamation';
  if (icon.includes('📋') || icon.includes('🔑')) return 'fa-qrcode';
  if (icon.includes('👤'))                        return 'fa-user-plus';
  return 'fa-circle-info';
}

// ── Noms et initiales ────────────────────────────────────────

/**
 * Extrait les initiales (2 caractères max) d'un nom complet.
 * Exemple : "Aïssatou Condé" → "AC"
 */
export function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '??';
}

/**
 * Retourne le nom complet d'un utilisateur (prénom + nom),
 * avec l'email comme fallback si les deux champs sont vides.
 */
export function userName(u: User): string {
  return `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email;
}

/**
 * Échappe les caractères HTML spéciaux d'une chaîne.
 *
 * SÉCURITÉ — AuditLog.action est de l'HTML brut (balises <b> pour la mise
 * en forme), rendu tel quel côté frontend via dangerouslySetInnerHTML
 * (AuditPage.tsx). Toute valeur qui y est interpolée et qui n'est pas
 * garantie 100% générée par le système (nom d'utilisateur choisi à
 * l'inscription, titre de signalement saisi librement, etc.) DOIT passer
 * par cette fonction avant interpolation — sinon un attaquant peut y glisser
 * du HTML/JS qui s'exécutera dans la session de l'admin consultant le
 * journal (XSS stockée constatée et corrigée dans admin-acteurs.service.ts
 * et admin-signalements.service.ts).
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Statuts ──────────────────────────────────────────────────

/**
 * Traduit le statut TypeORM UserStatus en code court utilisé par le frontend.
 *   ACTIVE  → 'act'
 *   PENDING → 'pend'
 *   Tout autre (SUSPENDED, BANNED…) → 'susp'
 */
export function mapSt(status: UserStatus): string {
  if (status === UserStatus.ACTIVE)  return 'act';
  if (status === UserStatus.PENDING) return 'pend';
  return 'susp';
}

// ── Contexte de connexion (AuditLog.ip / AuditLog.device) ────

/**
 * Extrait l'IP réelle et un libellé d'appareil lisible ("Chrome / Windows")
 * de la requête HTTP courante, pour horodater les entrées d'AuditLog.
 * Même logique d'extraction IP que company-team.controller.ts (X-Forwarded-For
 * en priorité, sinon req.ip fourni par Express).
 */
export interface AuditMeta {
  ip:     string | null;
  device: string | null;
}

export function auditMeta(req: any): AuditMeta {
  const forwarded = req?.headers?.['x-forwarded-for'] as string | undefined;
  const ip = forwarded?.split(',')[0]?.trim() || req?.ip || null;

  const ua = req?.headers?.['user-agent'] as string | undefined;
  if (!ua) return { ip, device: null };

  const { device, browser } = parseUserAgent(ua);
  return { ip, device: `${browser} / ${device}` };
}

// ── Modèles de communication personnalisés ──────────────────

/**
 * Remplace les variables {{cle}} d'un modèle de message par leur valeur.
 * Variables inconnues laissées telles quelles (pas d'erreur silencieuse
 * qui masquerait une faute de frappe de l'admin dans son propre modèle).
 * Exemple : interpolate('Bonjour {{acteur}}', { acteur: 'Mamadou' })
 *        → 'Bonjour Mamadou'
 */
export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) =>
    key in vars ? vars[key] : match,
  );
}

// ── Formatage de dates ───────────────────────────────────────

/**
 * Formate une date en libellé court français.
 * Exemple : new Date('2025-01-15') → "15 janv. 2025"
 */
export function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}
