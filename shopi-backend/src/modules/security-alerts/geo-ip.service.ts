/* ============================================================
 * FICHIER : src/modules/security-alerts/geo-ip.service.ts
 *
 * RÔLE : Résolution IP → pays, en local (base MaxMind GeoLite2
 *        embarquée dans geoip-lite, aucun appel réseau externe,
 *        aucune clé API). Utilisé pour l'alerte de sécurité
 *        "Accès depuis un pays inhabituel" et pour enrichir
 *        l'alerte "Nouvelle connexion détectée".
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import * as geoip from 'geoip-lite';

@Injectable()
export class GeoIpService {
  private readonly logger = new Logger(GeoIpService.name);

  /** Code pays ISO (ex: 'GN') depuis une IP, ou null si non résolvable
   * (IP locale/privée, adresse malformée, pas de correspondance). */
  lookupCountry(ip: string | null | undefined): string | null {
    if (!ip) return null;
    /* IPv4 mappée en IPv6 (::ffff:1.2.3.4), fréquente derrière un proxy —
     * geoip-lite ne la résout pas correctement sans normalisation. */
    const clean = ip.replace(/^::ffff:/, '');
    if (clean === '127.0.0.1' || clean === '::1' || clean.startsWith('192.168.') || clean.startsWith('10.')) {
      return null; // IP locale (dev) — pas de pays réel à résoudre
    }
    try {
      const result = geoip.lookup(clean);
      return result?.country ?? null;
    } catch (err) {
      this.logger.warn(`[GEO-IP] Résolution échouée pour ${clean}: ${(err as Error).message}`);
      return null;
    }
  }
}
