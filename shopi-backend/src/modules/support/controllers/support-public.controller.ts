/* ============================================================
 * FICHIER : src/modules/support/controllers/support-public.controller.ts
 *
 * RÔLE : Endpoints publics du module support (sans authentification).
 *
 * ROUTES :
 *   GET /support/suggest?query=... → suggestions d'articles Help Center
 *
 * UTILISATION :
 *   Appelé en temps réel depuis le formulaire de nouveau ticket
 *   (NewTicketPage.tsx) pendant que l'utilisateur tape son sujet.
 *
 * POURQUOI PUBLIC ?
 *   La suggestion doit fonctionner même pour les utilisateurs non
 *   connectés qui accèdent au formulaire depuis la page /aide.
 *   Un utilisateur connecté bénéficie de la même expérience.
 *
 * RATE LIMITING :
 *   Throttle à 30 requêtes / minute pour éviter les abus.
 *   (Le debounce côté front-end limite déjà les appels à ~300ms.)
 * ============================================================ */

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard }          from '@nestjs/throttler';
import { SupportSuggestService }             from '../services/support-suggest.service';

@Controller('support')
export class SupportPublicController {

  constructor(
    /* SupportSuggestService fait la recherche FTS dans les articles */
    private readonly suggestSvc: SupportSuggestService,
  ) {}

  /* ──────────────────────────────────────────────────────────
   * GET /support/suggest
   *
   * Retourne jusqu'à 3 articles du Centre d'aide qui correspondent
   * à la requête de l'utilisateur.
   *
   * QUERY PARAM :
   *   query — texte brut (ex: "ma commande n'est pas arrivée")
   *           min: 3 caractères (vérifié dans le service)
   *
   * RÉPONSE :
   *   [
   *     { slug: "...", title: "...", excerpt: "..." },
   *     ...
   *   ]
   *
   * Retourne [] si aucun article ne correspond ou si query est trop court.
   * ────────────────────────────────────────────────────────── */
  @Get('suggest')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  suggest(@Query('query') query: string) {
    return this.suggestSvc.suggestArticles(query ?? '');
  }
}
