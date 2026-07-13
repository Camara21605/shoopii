/* ============================================================
 * FICHIER : src/modules/support/services/support-suggest.service.ts
 *
 * RÔLE : Suggérer des articles du Centre d'aide avant qu'un
 *        utilisateur n'ouvre un ticket de support.
 *
 * OBJECTIF BUSINESS :
 *   Réduire le volume de tickets en orientant les utilisateurs
 *   vers des articles existants qui répondent déjà à leur question.
 *   Si la réponse est dans la base de connaissances, l'utilisateur
 *   n'a pas besoin d'ouvrir un ticket → gain de temps pour tous.
 *
 * FONCTIONNEMENT :
 *   1. L'utilisateur tape son sujet dans le formulaire de ticket.
 *   2. Front-end envoie GET /support/suggest?query=mon+problème
 *   3. Ce service interroge la table help_articles via FTS PostgreSQL
 *      (Full Text Search, même système que HelpSearchService).
 *   4. On retourne max 3 articles les plus pertinents.
 *
 * DIFFÉRENCE AVEC HelpSearchService :
 *   - HelpSearchService est complet (pagination, logs, audience…)
 *   - Ce service est léger : pas de log, pas de pagination,
 *     juste 3 résultats rapides pour l'UX du formulaire.
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { DataSource }  from 'typeorm';

/* ─────────────────────────────────────────────────────────────
 * SuggestedArticle — forme des données envoyées au front-end.
 *
 * On ne retourne que le strict nécessaire pour la suggestion :
 * slug (pour construire le lien), titre et extrait.
 * ───────────────────────────────────────────────────────────── */
export interface SuggestedArticle {
  slug:    string; // ex: 'comment-annuler-une-commande'
  title:   string; // ex: 'Comment annuler une commande ?'
  excerpt: string; // ex: 'Vous pouvez annuler…' (1-2 phrases)
}

@Injectable()
export class SupportSuggestService {

  constructor(
    /* DataSource = accès direct à la connexion PostgreSQL,
     * nécessaire pour les requêtes SQL brutes (FTS). */
    private readonly dataSource: DataSource,
  ) {}

  /* ──────────────────────────────────────────────────────────
   * suggestArticles(query)
   *
   * Recherche jusqu'à MAX_RESULTS articles pertinents.
   *
   * PARAMÈTRE :
   *   query — le texte brut tapé par l'utilisateur
   *           (ex: "je ne reçois pas ma commande")
   *
   * RETOURNE :
   *   Un tableau de 0 à 3 SuggestedArticle, trié par pertinence.
   *   Retourne [] si le query est vide ou trop court.
   * ────────────────────────────────────────────────────────── */
  async suggestArticles(query: string): Promise<SuggestedArticle[]> {

    /* ── Validation de base ─────────────────────────────────
     * Un query trop court ne donnera aucun résultat utile
     * et génère des appels inutiles à PostgreSQL.
     * ─────────────────────────────────────────────────────── */
    const cleaned = query?.trim();
    if (!cleaned || cleaned.length < 3) return [];

    /* ── Construction du tsquery PostgreSQL ─────────────────
     *
     * On sépare les mots et on les joint avec " & " (ET logique).
     * Exemple :
     *   "commande livrée" → "commande & livrée"
     *
     * On ignore les mots de moins de 2 caractères (articles…)
     * pour ne pas bruiter les résultats.
     *
     * On limite à 10 mots maximum pour éviter une tsquery trop
     * longue qui pourrait lever une exception PostgreSQL.
     * ─────────────────────────────────────────────────────── */
    const words = cleaned
      .split(/\s+/)
      .filter(w => w.length >= 2)
      .slice(0, 10);

    /* Aucun mot valide → pas de recherche */
    if (words.length === 0) return [];

    /* Formulation finale du tsquery */
    const tsQuery = words.join(' & ');

    /* ── Requête SQL FTS ────────────────────────────────────
     *
     * EXPLICATIONS :
     *
     * to_tsquery('french', $1) :
     *   → Convertit notre tsQuery en objet tsquery PostgreSQL
     *   → La langue 'french' applique le stemming français
     *     (commandes → commande, livrées → livrer…)
     *
     * "searchVector" @@ query :
     *   → Opérateur de correspondance FTS : le searchVector
     *     (colonne pré-calculée) contient-il les mots du query ?
     *
     * ts_rank("searchVector", query) :
     *   → Score de pertinence (0.0 à 1.0) — les articles avec
     *     les mots les plus fréquents ont un score plus élevé.
     *
     * WHERE status = 'published' :
     *   → On ne suggère que les articles publiés (pas les brouillons).
     *
     * LIMIT 3 :
     *   → Maximum 3 suggestions, sinon l'utilisateur se noie.
     * ─────────────────────────────────────────────────────── */
    try {
      const rows: { slug: string; title: string; excerpt: string }[] =
        await this.dataSource.query(
          `SELECT slug, title, excerpt
           FROM help_articles
           WHERE status = 'published'
             AND "searchVector" @@ to_tsquery('french', $1)
           ORDER BY ts_rank("searchVector", to_tsquery('french', $1)) DESC
           LIMIT 3`,
          [tsQuery],
        );

      return rows.map(r => ({
        slug:    r.slug,
        title:   r.title,
        excerpt: r.excerpt ?? '',
      }));

    } catch {
      /* Si le tsquery est invalide (caractères spéciaux rares),
       * on retourne silencieusement un tableau vide.
       * On ne log pas l'erreur car c'est une entrée utilisateur. */
      return [];
    }
  }
}
