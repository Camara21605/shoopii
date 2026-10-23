/* ============================================================
 * FICHIER  : src/modules/dashboard/entreprise/entreprise-marketing.service.ts
 * RÔLE     : « SEO & Marketing » et trafic de la boutique connectée —
 *            UNIQUEMENT des données réelles de CETTE boutique :
 *              • score de visibilité (profil : logo, couverture,
 *                description, horaires, contact, GPS…) + quoi corriger ;
 *              • qualité des fiches (photo, titre et description Google,
 *                mots-clés, description détaillée) ;
 *              • audience : vues des fiches (products.viewsCount), likes,
 *                favoris, abonnés, stories (vues, clics) ;
 *              • promotions et avis (note, avis sans réponse).
 *
 * SÉCURITÉ : companyId = req.user.actorId (résolu au login, propriétaire
 * ou collaborateur) ; toutes les requêtes SQL sont paramétrées et filtrées
 * sur ce companyId — jamais les données d'une autre boutique. Le contrôleur
 * exige la permission statistics.view (comme Analytics).
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Company } from '../../../database/entities/profiles/entreprise-profile.entity';
import { Follow, TargetActorType } from '../../../database/entities/follow/follow.entity';

/** Une vérification du score de visibilité */
export interface VisibilityCheck {
  key:    string;
  label:  string;
  ok:     boolean;
  /** Conseil affiché quand ce n'est pas fait */
  hint:   string;
  /** Poids dans le score (sur 100 au total) */
  weight: number;
  /** Rubrique à ouvrir pour corriger : 'boutique' | 'horaires' | 'catalogue' | 'avis' */
  fix:    'boutique' | 'horaires' | 'catalogue' | 'avis';
}

export type FicheIssue = 'photo' | 'titreSeo' | 'descriptionSeo' | 'tags' | 'description';

const n = (v: unknown) => Number(v ?? 0) || 0;
const filled = (s: string | null | undefined, min = 1) => (s ?? '').trim().length >= min;

@Injectable()
export class EntrepriseMarketingService {

  constructor(
    @InjectRepository(Company) private readonly companyRepo: Repository<Company>,
    @InjectRepository(Follow)  private readonly followRepo:  Repository<Follow>,
  ) {}

  private q<T = any>(sql: string, params: unknown[]): Promise<T[]> {
    return this.companyRepo.manager.query(sql, params);
  }

  // ══════════════════════════════════════════════════════════════
  // Trafic (bloc d'Analytics) : vues, likes, favoris, conversion
  // ══════════════════════════════════════════════════════════════

  async getTrafic(companyId: string) {
    const company = await this.companyRepo.findOne({ where: { id: companyId } });
    if (!company) return null;
    const services = company.businessModel === 'services';
    const [audience, commandes] = await Promise.all([
      this.audience(company.id, services),
      this.q(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status IN ('delivered','auto_delivered'))::int AS livrees
           FROM commandes WHERE "companyId" = $1`, [company.id],
      ).catch(() => [{ total: 0, livrees: 0 }]),
    ]);
    const total = n(commandes[0]?.total);
    return {
      vues:      audience.vues,
      likes:     audience.likes,
      favoris:   audience.favoris,
      commandes: total,
      /** Commandes pour 100 vues de fiches (null tant qu'il n'y a pas de vues) */
      conversion: audience.vues ? Math.round((total / audience.vues) * 1000) / 10 : null,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // GET /dashboard/entreprise/marketing
  // ══════════════════════════════════════════════════════════════

  async getMarketing(companyId: string) {
    const company = await this.companyRepo.findOne({ where: { id: companyId } });
    if (!company) return null;
    const services = company.businessModel === 'services';
    const cid = company.id;

    const [fiches, audience, topVus, aAmeliorer, stories, promos, avis, horaires, abonnes] = await Promise.all([
      this.fichesStats(cid, services),
      this.audience(cid, services),
      this.topVus(cid, services),
      this.aAmeliorer(cid, services),
      services ? Promise.resolve(null) : this.storiesStats(cid),
      this.promoStats(cid),
      this.avisStats(cid),
      this.q(`SELECT COUNT(*)::int AS c FROM company_horaires WHERE "companyId" = $1 AND ouverture IS NOT NULL`, [cid]).then(r => n(r[0]?.c)).catch(() => 0),
      this.followRepo.count({ where: { targetType: TargetActorType.COMPANY, targetId: cid, isSubscribed: true } }).catch(() => 0),
    ]);

    const item = services ? 'service' : 'produit';
    const checks: VisibilityCheck[] = [
      { key: 'logo', label: 'Logo de la boutique', ok: filled(company.logo), weight: 12, fix: 'boutique',
        hint: 'Un logo rend la boutique reconnaissable dans les recherches et les messages.' },
      { key: 'cover', label: 'Photo de couverture', ok: filled(company.coverImage), weight: 8, fix: 'boutique',
        hint: 'La couverture est la première image vue sur la page de la boutique.' },
      { key: 'description', label: 'Description détaillée (80 caractères ou plus)', ok: filled(company.description, 80), weight: 12, fix: 'boutique',
        hint: 'Décrivez ce que vous vendez, où et comment : c’est ce qui est trouvé par la recherche.' },
      { key: 'slogan', label: 'Slogan', ok: filled(company.slogan), weight: 5, fix: 'boutique',
        hint: 'Une phrase courte qui donne envie, affichée sous le nom.' },
      { key: 'tags', label: 'Mots-clés de la boutique', ok: filled(company.tags), weight: 8, fix: 'boutique',
        hint: 'Les mots que vos clients tapent pour vous trouver (ex. : téléphones, réparation).' },
      { key: 'contact', label: 'Téléphone ou WhatsApp', ok: filled(company.businessPhone) || filled(company.whatsapp), weight: 8, fix: 'boutique',
        hint: 'Les clients font plus confiance à une boutique joignable.' },
      { key: 'adresse', label: 'Adresse et ville', ok: (filled(company.adresse) || filled(company.quartier)) && (filled(company.ville) || !!company.villeId), weight: 8, fix: 'boutique',
        hint: 'L’adresse sert aux recherches « près de moi » et à la livraison.' },
      { key: 'gps', label: 'Position sur la carte', ok: company.latitude != null && company.longitude != null, weight: 6, fix: 'boutique',
        hint: 'Placez la boutique sur la carte pour apparaître autour des clients.' },
      { key: 'horaires', label: 'Horaires d’ouverture', ok: horaires > 0 || (!!company.openTime && !!company.closeTime), weight: 6, fix: 'horaires',
        hint: 'Indiquez quand vous êtes ouvert : les clients savent quand commander.' },
      { key: 'catalogue', label: `Au moins 5 ${item}s publiés`, ok: fiches.publics >= 5, weight: 10, fix: 'catalogue',
        hint: `Plus de ${item}s publiés = plus de chances d’être trouvé.` },
      { key: 'photos', label: `Tous les ${item}s publiés ont une photo`, ok: fiches.publics > 0 && fiches.publicsSansPhoto === 0, weight: 9, fix: 'catalogue',
        hint: 'Une fiche sans photo n’est presque jamais ouverte.' },
      { key: 'seo', label: `Titre Google sur 80 % des ${item}s`, ok: fiches.publics > 0 && (fiches.publics - fiches.publicsSansTitreSeo) / fiches.publics >= 0.8, weight: 8, fix: 'catalogue',
        hint: 'Le titre Google (50 à 70 caractères) est ce qui s’affiche dans les résultats de recherche.' },
    ];
    if (company.allowReviews !== false) {
      checks.push({ key: 'avis', label: 'Répondre aux avis clients', ok: avis.sansReponse === 0, weight: 0, fix: 'avis',
        hint: 'Répondre aux avis montre que la boutique est active et rassure les acheteurs.' });
    }
    const totalWeight = checks.reduce((s, c) => s + c.weight, 0) || 1;
    const score = Math.round((checks.filter(c => c.ok).reduce((s, c) => s + c.weight, 0) / totalWeight) * 100);

    return {
      businessModel: company.businessModel,
      boutique: { id: company.id, nom: company.companyName },
      visibilite: { score, checks },
      fiches,
      audience: { ...audience, abonnes },
      topVus,
      aAmeliorer,
      stories,
      promotions: promos,
      avis,
    };
  }

  // ── Qualité des fiches (produits ou services) ──────────────────

  private async fichesStats(cid: string, services: boolean) {
    const t = services ? 'services' : 'products';
    const media = services ? `service_media m WHERE m."serviceId" = p.id` : `product_media m WHERE m."productId" = p.id`;
    const noPhoto = `NOT EXISTS (SELECT 1 FROM ${media} AND m.type = 'image')`;
    const rows = await this.q(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE p.visibilite = 'public')::int AS publics,
              COUNT(*) FILTER (WHERE p.visibilite = 'draft')::int AS brouillons,
              COUNT(*) FILTER (WHERE p.visibilite = 'public' AND ${noPhoto})::int AS "publicsSansPhoto",
              COUNT(*) FILTER (WHERE p.visibilite = 'public' AND COALESCE(LENGTH(TRIM(p.description)), 0) < 80)::int AS "descriptionCourte",
              COUNT(*) FILTER (WHERE p.visibilite = 'public' AND COALESCE(TRIM(p."titreSeo"), '') = '')::int AS "publicsSansTitreSeo",
              COUNT(*) FILTER (WHERE p.visibilite = 'public' AND COALESCE(TRIM(p."descriptionSeo"), '') = '')::int AS "sansDescriptionSeo",
              COUNT(*) FILTER (WHERE p.visibilite = 'public' AND COALESCE(TRIM(p.tags), '') = '')::int AS "sansTags"
              ${services ? '' : `, COUNT(*) FILTER (WHERE p.visibilite = 'public' AND p.stock <= 0)::int AS ruptures`}
         FROM ${t} p WHERE p."companyId" = $1`, [cid],
    );
    const r = rows[0] ?? {};
    return {
      total: n(r.total), publics: n(r.publics), brouillons: n(r.brouillons),
      publicsSansPhoto: n(r.publicsSansPhoto), descriptionCourte: n(r.descriptionCourte),
      publicsSansTitreSeo: n(r.publicsSansTitreSeo), sansDescriptionSeo: n(r.sansDescriptionSeo),
      sansTags: n(r.sansTags), ruptures: services ? null : n(r.ruptures),
    };
  }

  // ── Audience : vues, likes, favoris ────────────────────────────

  private async audience(cid: string, services: boolean) {
    if (services) {
      const r = (await this.q(`SELECT COALESCE(SUM("likesCount"), 0)::int AS likes FROM services WHERE "companyId" = $1`, [cid]))[0];
      return { vues: null as number | null, likes: n(r?.likes), favoris: null as number | null };
    }
    const [r, f] = await Promise.all([
      this.q(`SELECT COALESCE(SUM("viewsCount"), 0)::int AS vues, COALESCE(SUM("likesCount"), 0)::int AS likes FROM products WHERE "companyId" = $1`, [cid]),
      this.q(`SELECT COUNT(*)::int AS c FROM wishlist_items w JOIN products p ON p.id = w."productId" WHERE p."companyId" = $1`, [cid]).catch(() => [{ c: 0 }]),
    ]);
    return { vues: n(r[0]?.vues) as number | null, likes: n(r[0]?.likes), favoris: n(f[0]?.c) as number | null };
  }

  /** Les fiches les plus consultées (produits) ou les plus aimées (services) */
  private async topVus(cid: string, services: boolean) {
    const rows = services
      ? await this.q(
        `SELECT p.id, p.nom, 0 AS vues, p."likesCount" AS likes,
                (SELECT m.url FROM service_media m WHERE m."serviceId" = p.id AND m.type = 'image' ORDER BY m.ordre LIMIT 1) AS image
           FROM services p WHERE p."companyId" = $1 AND p.visibilite = 'public'
          ORDER BY p."likesCount" DESC, p."createdAt" DESC LIMIT 5`, [cid])
      : await this.q(
        `SELECT p.id, p.nom, p."viewsCount" AS vues, p."likesCount" AS likes,
                (SELECT m.url FROM product_media m WHERE m."productId" = p.id AND m.type = 'image' ORDER BY m.ordre LIMIT 1) AS image
           FROM products p WHERE p."companyId" = $1 AND p.visibilite = 'public'
          ORDER BY p."viewsCount" DESC, p."likesCount" DESC LIMIT 5`, [cid]);
    return rows.map(r => ({ id: r.id as string, nom: r.nom as string, vues: n(r.vues), likes: n(r.likes), image: (r.image as string | null) ?? null }));
  }

  /** Fiches publiées à compléter — les plus vues d'abord (plus d'impact) */
  private async aAmeliorer(cid: string, services: boolean) {
    const t = services ? 'services' : 'products';
    const media = services ? `service_media m WHERE m."serviceId" = p.id` : `product_media m WHERE m."productId" = p.id`;
    const rows = await this.q(
      `SELECT * FROM (
         SELECT p.id, p.nom,
                ${services ? 'p."likesCount"' : 'p."viewsCount"'} AS poids,
                NOT EXISTS (SELECT 1 FROM ${media} AND m.type = 'image') AS "noPhoto",
                COALESCE(TRIM(p."titreSeo"), '') = '' AS "noTitre",
                COALESCE(TRIM(p."descriptionSeo"), '') = '' AS "noDesc",
                COALESCE(TRIM(p.tags), '') = '' AS "noTags",
                COALESCE(LENGTH(TRIM(p.description)), 0) < 80 AS "shortDesc",
                (SELECT m.url FROM ${media} AND m.type = 'image' ORDER BY m.ordre LIMIT 1) AS image
           FROM ${t} p WHERE p."companyId" = $1 AND p.visibilite = 'public'
       ) x
       WHERE x."noPhoto" OR x."noTitre" OR x."noDesc" OR x."noTags" OR x."shortDesc"
       ORDER BY x."noPhoto" DESC, x.poids DESC LIMIT 8`, [cid],
    );
    return rows.map(r => {
      const issues: FicheIssue[] = [];
      if (r.noPhoto) issues.push('photo');
      if (r.noTitre) issues.push('titreSeo');
      if (r.noDesc) issues.push('descriptionSeo');
      if (r.noTags) issues.push('tags');
      if (r.shortDesc) issues.push('description');
      return { id: r.id as string, nom: r.nom as string, image: (r.image as string | null) ?? null, issues };
    });
  }

  // ── Stories (30 derniers jours) ────────────────────────────────

  private async storiesStats(cid: string) {
    const r = (await this.q(
      `SELECT COUNT(*)::int AS publiees,
              COUNT(*) FILTER (WHERE status = 'published' AND "expiresAt" > NOW())::int AS actives,
              COALESCE(SUM("viewsCount"), 0)::int AS vues,
              COALESCE(SUM("ctaClicks"), 0)::int AS clics
         FROM product_stories
        WHERE "companyId" = $1 AND "createdAt" >= NOW() - INTERVAL '30 days'`, [cid],
    ).catch(() => []))[0];
    return { publiees: n(r?.publiees), actives: n(r?.actives), vues: n(r?.vues), clics: n(r?.clics) };
  }

  // ── Promotions ─────────────────────────────────────────────────

  private async promoStats(cid: string) {
    const r = (await this.q(
      `SELECT COUNT(*) FILTER (WHERE status = 'active')::int AS actives,
              COUNT(*) FILTER (WHERE status = 'scheduled')::int AS planifiees,
              COALESCE(SUM("usesCount"), 0)::int AS utilisations,
              COALESCE(SUM("caGenere"), 0)::bigint AS "caGenere"
         FROM promotions WHERE "companyId" = $1`, [cid],
    ).catch(() => []))[0];
    return { actives: n(r?.actives), planifiees: n(r?.planifiees), utilisations: n(r?.utilisations), caGenere: n(r?.caGenere) };
  }

  // ── Avis ───────────────────────────────────────────────────────

  private async avisStats(cid: string) {
    const r = (await this.q(
      `SELECT COUNT(*)::int AS total,
              COALESCE(ROUND(AVG(note)::numeric, 1), 0) AS note,
              COUNT(*) FILTER (WHERE reponse IS NULL OR TRIM(reponse) = '')::int AS "sansReponse"
         FROM company_avis WHERE "companyId" = $1`, [cid],
    ).catch(() => []))[0];
    return { total: n(r?.total), note: n(r?.note), sansReponse: n(r?.sansReponse) };
  }
}
