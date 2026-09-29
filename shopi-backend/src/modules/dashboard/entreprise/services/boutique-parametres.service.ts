/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/services/boutique-parametres.service.ts
 *
 * RÔLE : Gère les sections Boutique & Identité + Contact & Localisation
 *   GET  /parametres                → charger toutes les données de la boutique
 *   PATCH /parametres/boutique      → mettre à jour les infos boutique
 *   PATCH /parametres/contact       → mettre à jour le contact et l'adresse
 *   POST  /parametres/logo          → uploader le logo (Cloudinary)
 *   POST  /parametres/cover         → uploader l'image de couverture
 *   DELETE /parametres/logo         → supprimer le logo
 * ============================================================ */

import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Company, CompanyStatus } from 'src/database/entities/profiles/entreprise-profile.entity';
import { User, UserStatus } from 'src/database/entities/user.entity';
import { CompanyType, CompanyTypeNature } from 'src/database/entities/entreprise.table/company-type.entity';
import { Product } from 'src/database/entities/entreprise.table/product.entity';
import { UploadService, UPLOAD_FOLDERS } from 'src/modules/upload/upload.service';
import { SessionService } from 'src/modules/session/session.service';
import { parseUserAgent } from 'src/common/utils/user-agent.util';

import { UpdateBoutiqueDto, UpdateContactDto, UpdateLocalisationDto } from '../dto/update-boutique.dto';
import { GeoResolutionService } from 'src/modules/geo/geo-resolution.service';
import { Category } from 'src/database/entities/entreprise.table/category.entity';
import {
  countActiveCategoriesOfType, getSelectedCategoryIds, replaceSelectedCategories,
  validateCategoryIdsForType,
} from 'src/common/utils/company-categories.util';

export interface CurrentSessionInfo {
  device:         string;
  browser:        string;
  ipAddress:      string | null;
  connectedSince: string;
}

@Injectable()
export class BoutiqueParametresService {

  private readonly logger = new Logger(BoutiqueParametresService.name);

  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(CompanyType)
    private readonly companyTypeRepo: Repository<CompanyType>,

    private readonly uploadService: UploadService,
    private readonly sessionService: SessionService,
    private readonly geoResolution: GeoResolutionService,
  ) {}

  /* ──────────────────────────────────────────────────────────
   * GET — Charger toutes les données paramètres de la boutique
   * ────────────────────────────────────────────────────────── */

  async getParametres(userId: string, currentSessionId?: string | null): Promise<Company> {
    /* BUG CORRIGÉ — le contrôleur passe `req.user.actorId ?? req.user.id` ;
     * pour un compte COMPANY, actorId est le Company.id (propriétaire OU
     * collaborateur, voir AuthService.findProfileId), jamais un User.id.
     * `where:{userId}` seul ne matchait donc quasiment jamais et déclenchait
     * la création d'une entreprise fantôme à chaque appel. On matche
     * désormais sur `id` (cas normal, actorId) OU `userId` (cas de repli,
     * si actorId était absent et que le param est un vrai User.id). */
    /* BUG CORRIGÉ (suite, 2026-09-02) — le `where:[{id},{userId}]` ci-dessus
     * restait un OR SQL en une seule requête, sans ordre garanti. Ça s'est
     * avéré loin d'être théorique : une entreprise fantôme (créée par CE
     * `if (!company)` ci-dessous, très probablement pendant une exécution
     * d'un ancien build compilé — voir la confusion dist/main.js/start:dev
     * récurrente sur ce projet) a fini avec un `userId` identique à l'`id`
     * d'une vraie entreprise. Résultat : chaque appel `where:[{id},{userId}]`
     * matchait alors LES DEUX fiches, et Postgres pouvait retourner l'une ou
     * l'autre selon le plan de requête — des réglages (ex: "Afficher les
     * prix barrés") ont ainsi pu être enregistrés sur la fiche fantôme,
     * jamais lue par aucune page publique, au lieu de la vraie. On tente
     * maintenant `id` en priorité, `userId` seulement en repli, dans deux
     * requêtes séquentielles déterministes plutôt qu'un OR ambigu. */
    let company = await this.companyRepo.findOne({
      where: { id: userId },
      relations: ['companyType', 'horaires'],
    });
    if (!company) {
      company = await this.companyRepo.findOne({
        where: { userId },
        relations: ['companyType', 'horaires'],
      });
    }

    if (!company) {
      // Compte company sans profil (ex : insertion manuelle en BDD).
      // On crée un profil vide pour éviter le 404 répété côté client.
      const user = await this.userRepo.findOne({ where: { id: userId } });
      const defaultName = user
        ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email.split('@')[0]
        : 'Ma Boutique';

      const stub = this.companyRepo.create({ userId, companyName: defaultName });
      await this.companyRepo.save(stub);
      this.logger.warn(`[PARAMETRES] Profil auto-créé pour userId=${userId}`);

      company = await this.companyRepo.findOne({
        where: { id: stub.id },
        relations: ['companyType', 'horaires'],
      });

      if (!company) throw new NotFoundException('Profil entreprise introuvable.');
    }

    const withOwner = await this.attachOwnerName(this.redactSensitiveDocuments(company));
    return this.attachCurrentSession(withOwner, currentSessionId);
  }

  /* SÉCURITÉ — GET /parametres renvoie l'entité Company quasi brute (elle
   * alimente les 12 sections d'un coup, y compris DocumentsSection.tsx qui
   * ne lit que la présence/absence d'un document, jamais sa valeur, voir
   * DocumentsParametresService.getDocuments() pour le même correctif côté
   * route dédiée). Sans ce filtre, le public_id Cloudinary des 4 pièces
   * sensibles (CNI, RCCM, relevé bancaire, NIF — voir SENSITIVE_DOC_TYPES
   * dans DocumentsParametresService) partait tel quel dans la réponse
   * JSON, visible depuis les DevTools, pour une valeur que le frontend
   * n'utilise que comme booléen. On la remplace par un marqueur opaque —
   * toujours "truthy" pour `isPresent = !!url`, jamais exploitable. */
  private redactSensitiveDocuments(company: Company): Company {
    const REDACTED = '••••••';
    if (company.ownerIdDocument)   company.ownerIdDocument   = REDACTED;
    if (company.documentRccm)      company.documentRccm      = REDACTED;
    if (company.documentBancaire)  company.documentBancaire  = REDACTED;
    if (company.documentNif)       company.documentNif       = REDACTED;
    // documentPhoto (vitrine boutique) n'est pas sensible — inchangé.
    return company;
  }

  /**
   * BUG CORRIGÉ — la carte "Responsable & Propriétaire" (BoutiqueSection.tsx)
   * affiche prénom/nom en lecture seule, mais GET /parametres ne les a
   * jamais exposés (ni relation `user` chargée, ni champ dédié) : les deux
   * champs étaient donc TOUJOURS vides, quel que soit le compte, sans
   * qu'aucune erreur ne le signale. On charge ici uniquement firstName/
   * lastName depuis User (jamais toute la relation `user` — voir
   * redactSensitiveDocuments ci-dessus pour la même logique de ne jamais
   * exposer plus que nécessaire dans cette réponse déjà volumineuse).
   */
  private async attachOwnerName(company: Company): Promise<Company> {
    const [owner, productCount] = await Promise.all([
      this.userRepo.findOne({
        where: { id: company.userId },
        select: ['firstName', 'lastName', 'status'],
      }),
      this.companyRepo.manager.count(Product, { where: { companyId: company.id } }),
    ]);
    (company as any).ownerFirstName = owner?.firstName ?? null;
    (company as any).ownerLastName  = owner?.lastName  ?? null;
    /* Statut du COMPTE (validation / suspension par l'administration) : c'est
     * lui qui décide si le propriétaire peut régler lui-même la visibilité de
     * sa boutique (voir updateBoutique). */
    (company as any).ownerStatus    = owner?.status ?? null;
    /* Nombre réel de produits — l'étape « Produits » de la barre de complétion
     * comptait jusqu'ici les COMMANDES (totalOrders). */
    (company as any).productCount   = productCount;
    return company;
  }

  /**
   * BUG CORRIGÉ — la carte "Sessions actives" (SecuriteSection.tsx)
   * affichait 3 appareils ("Chrome Windows", "Safari iPhone", "Chrome
   * Android") ENTIÈREMENT codés en dur, identiques pour tout le monde,
   * avec des boutons "Révoquer"/"Déconnecter tout" qui ne faisaient
   * qu'un toast sans jamais rien déconnecter. Shoneya n'autorise qu'UNE
   * session active à la fois par compte (voir SessionService) : il n'y a
   * donc jamais eu plusieurs appareils à lister. Remplacé par la session
   * RÉELLE actuellement active (device/navigateur/IP/date), même
   * mécanisme que ProfilPartenaireService.toResponse() côté dashboard
   * partenaire.
   */
  private async attachCurrentSession(company: Company, currentSessionId?: string | null): Promise<Company> {
    const meta = await this.sessionService.getSessionMeta(currentSessionId);
    (company as any).currentSession = meta ? {
      ...parseUserAgent(meta.userAgent),
      ipAddress:      meta.ipAddress,
      connectedSince: meta.createdAt,
    } : null;
    return company;
  }

  /* ──────────────────────────────────────────────────────────
   * PATCH — Mettre à jour Boutique & Identité (section 1)
   * ────────────────────────────────────────────────────────── */

  async updateBoutique(userId: string, dto: UpdateBoutiqueDto, currentSessionId?: string | null): Promise<Company> {
    const company = await this.findCompanyOrFail(userId);

    /* BUG CORRIGÉ — le DTO ne validait que le FORMAT UUID de companyTypeId
     * (@IsUUID), jamais son EXISTENCE réelle dans company_types : un id
     * syntaxiquement valide mais inexistant (type supprimé depuis,
     * faute de frappe côté appelant, etc.) était accepté et enregistré
     * tel quel — silencieusement invisible ensuite sur toute page qui
     * filtre par type (ex. /types/:id), sans jamais remonter d'erreur. */
    /* Type d'entreprise : choisi à l'inscription, il est DÉFINITIF (il détermine
     * les catégories, les pages /types/:id où la boutique apparaît, etc.).
     * Seule une entreprise qui n'en a encore aucun peut le définir, une fois. */
    if (dto.companyTypeId !== undefined && company.companyTypeId && dto.companyTypeId !== company.companyTypeId) {
      throw new ForbiddenException(
        "Le type d'entreprise choisi à l'inscription ne peut pas être modifié. Contactez le support si c'est une erreur.",
      );
    }
    if (dto.companyTypeId) {
      const type = await this.companyTypeRepo.findOne({ where: { id: dto.companyTypeId } });
      if (!type) throw new BadRequestException("Type d'entreprise introuvable.");
      if (!type.actif) throw new BadRequestException("Ce type d'entreprise n'est plus disponible.");
      /* Même règle qu'à l'inscription : type compatible avec le modèle (produits / services) */
      if (company.businessModel && type.nature && type.nature !== CompanyTypeNature.NEUTRAL
          && (type.nature as string) !== (company.businessModel as string)) {
        throw new BadRequestException("Ce type d'entreprise ne correspond pas à votre activité (produits / services).");
      }
    }

    /* Visibilité de la boutique.
     * FAILLE CORRIGÉE — `status` était appliqué tel quel : une entreprise en
     * attente de validation (pending) pouvait se passer elle-même en « active »
     * et apparaître aux clients sans validation, et une entreprise suspendue par
     * l'administration pouvait se réactiver. Désormais :
     *   - seules les valeurs « visible » (active) et « en pause » (suspended) ;
     *   - seulement si le COMPTE est validé et non suspendu (user.status ACTIVE) —
     *     la validation / suspension reste l'affaire de l'administration
     *     (voir CompanyStatusSyncSubscriber). */
    const { status: wantedStatus, ...rest } = dto;
    if (wantedStatus !== undefined && wantedStatus !== company.status) {
      if (wantedStatus !== CompanyStatus.ACTIVE && wantedStatus !== CompanyStatus.SUSPENDED) {
        throw new BadRequestException('Statut invalide.');
      }
      const owner = await this.userRepo.findOne({ where: { id: company.userId }, select: ['id', 'status'] });
      if (owner?.status !== UserStatus.ACTIVE) {
        throw new ForbiddenException(
          owner?.status === UserStatus.PENDING
            ? "Votre boutique est en attente de validation par l'administration."
            : "Votre boutique a été suspendue par l'administration. Contactez le support.",
        );
      }
      company.status = wantedStatus;
      if (wantedStatus === CompanyStatus.ACTIVE) company.suspendedUntil = null;   // fin d'une désactivation 30 j
    }

    /* Changer de type d'entreprise rend caduque la sélection de catégories
     * (elles appartenaient à l'ancien type) : elle est réinitialisée, et
     * l'entreprise doit re-choisir ses catégories parmi celles du nouveau
     * type (Paramètres > Boutique > Catégories de mon activité). */
    const typeChanged = !!dto.companyTypeId && dto.companyTypeId !== company.companyTypeId;

    // On applique uniquement les champs fournis dans le DTO (statut traité ci-dessus)
    Object.assign(company, rest);

    const updated = await this.companyRepo.save(company);
    if (typeChanged) {
      await replaceSelectedCategories(this.companyRepo.manager, company.id, []);
      this.logger.log(`[BOUTIQUE] Type changé — sélection de catégories réinitialisée — companyId=${company.id}`);
    }
    this.logger.log(`[BOUTIQUE] Mis à jour — userId=${userId}`);

    /* La réponse remplace tout `data` côté frontend (patch() dans
     * useParametres.ts) — sans ça, ownerFirstName/ownerLastName/
     * currentSession disparaîtraient de l'écran jusqu'au prochain GET
     * complet. */
    const withOwner = await this.attachOwnerName(updated);
    return this.attachCurrentSession(withOwner, currentSessionId);
  }

  /* ──────────────────────────────────────────────────────────
   * PATCH — Mettre à jour Contact & Localisation (section 2)
   * ────────────────────────────────────────────────────────── */

  async updateContact(userId: string, dto: UpdateContactDto, currentSessionId?: string | null): Promise<Company> {
    const company = await this.findCompanyOrFail(userId);

    Object.assign(company, dto);

    /* Ville / pays changés : références géographiques (villeId / paysId —
     * filtres par préfecture de l'administration, support…) recalculées, comme
     * lors d'un enregistrement depuis « Voir ma boutique » (updateLocalisation). */
    if (dto.ville !== undefined || dto.pays !== undefined) {
      try {
        const { paysId, villeId } = await this.geoResolution.resolveGeoIds(company.ville, company.pays);
        company.paysId  = paysId;
        company.villeId = villeId;
      } catch (err) {
        this.logger.warn(`[CONTACT] Résolution géo impossible — ${(err as Error).message}`);
      }
    }

    const updated = await this.companyRepo.save(company);
    this.logger.log(`[CONTACT] Mis à jour — userId=${userId}`);

    const withOwner = await this.attachOwnerName(updated);
    return this.attachCurrentSession(withOwner, currentSessionId);
  }

  /* ──────────────────────────────────────────────────────────
   * PATCH — Localisation de la boutique (onglet "Localisation" de
   * "Voir ma boutique", BoutiquePreviewPage.tsx)
   *
   * BUG CORRIGÉ — la page enregistrait en DEUX appels successifs :
   * PATCH /parametres/contact (adresse) puis PATCH /location/company/:id
   * (coordonnées). Conséquences :
   *   - enregistrement partiel : si le 2ᵉ échouait, l'adresse était
   *     changée mais le repère 🏪 restait à l'ancienne position ;
   *   - un collaborateur avec boutique.edit (permission qui donne accès à
   *     l'onglet) recevait 403 : /contact exige settings.edit, et
   *     /location/company/:id compare company.userId au User.id — jamais
   *     celui d'un collaborateur ;
   *   - `quartier` et `repere` n'étaient pas envoyés au 2ᵉ appel, et
   *     paysId/villeId (filtres par préfecture, voir
   *     GeoResolutionService) n'étaient jamais recalculés.
   * Un seul appel, une seule écriture, tous les champs.
   * ────────────────────────────────────────────────────────── */

  async updateLocalisation(userId: string, dto: UpdateLocalisationDto, currentSessionId?: string | null): Promise<Company> {
    const company = await this.findCompanyOrFail(userId);

    company.pays      = dto.pays;
    company.ville     = dto.ville;
    company.commune   = dto.commune  ?? null;
    company.quartier  = dto.quartier ?? null;
    company.adresse   = dto.adresse  ?? null;
    company.repere    = dto.repere   ?? null;
    company.latitude  = Math.round(dto.latitude  * 1e6) / 1e6;
    company.longitude = Math.round(dto.longitude * 1e6) / 1e6;

    try {
      const { paysId, villeId } = await this.geoResolution.resolveGeoIds(dto.ville, dto.pays);
      company.paysId  = paysId;
      company.villeId = villeId;
    } catch (err) {
      /* Non bloquant : les colonnes structurées se recalculent aussi via
       * POST /geo/resolve-actors — l'adresse doit s'enregistrer quoi qu'il arrive. */
      this.logger.warn(`[LOCALISATION] Résolution géo impossible — ${(err as Error).message}`);
    }

    const updated = await this.companyRepo.save(company);
    this.logger.log(`[LOCALISATION] Mise à jour — companyId=${company.id}`);

    const withOwner = await this.attachOwnerName(updated);
    return this.attachCurrentSession(withOwner, currentSessionId);
  }

  /* ──────────────────────────────────────────────────────────
   * POST — Uploader le logo (Cloudinary)
   * ────────────────────────────────────────────────────────── */

  async uploadLogo(
    userId: string,
    file: Express.Multer.File,
  ): Promise<{ logo: string }> {
    const company = await this.findCompanyOrFail(userId);

    // Supprimer l'ancien logo s'il existe
    if (company.logo) {
      await this.deleteCloudinaryFile(company.logo);
    }

    const result = await this.uploadService.uploadImage(
      file,
      UPLOAD_FOLDERS.COMPANY,
      { width: 400, height: 400 },
    );

    company.logo = result.url;
    await this.companyRepo.save(company);

    this.logger.log(`[LOGO] Uploadé — userId=${userId} → ${result.url}`);
    return { logo: result.url };
  }

  /* ──────────────────────────────────────────────────────────
   * POST — Uploader l'image de couverture
   * ────────────────────────────────────────────────────────── */

  async uploadCover(
    userId: string,
    file: Express.Multer.File,
  ): Promise<{ coverImage: string }> {
    const company = await this.findCompanyOrFail(userId);

    if (company.coverImage) {
      await this.deleteCloudinaryFile(company.coverImage);
    }

    const result = await this.uploadService.uploadImage(
      file,
      UPLOAD_FOLDERS.COMPANY,
      { width: 1200, height: 400 },
    );

    company.coverImage = result.url;
    await this.companyRepo.save(company);

    this.logger.log(`[COVER] Uploadée — userId=${userId} → ${result.url}`);
    return { coverImage: result.url };
  }

  /* ──────────────────────────────────────────────────────────
   * DELETE — Supprimer le logo
   * ────────────────────────────────────────────────────────── */

  async deleteLogo(userId: string): Promise<{ message: string }> {
    const company = await this.findCompanyOrFail(userId);

    if (company.logo) {
      await this.deleteCloudinaryFile(company.logo);
      company.logo = null;
      await this.companyRepo.save(company);
    }

    return { message: 'Logo supprimé avec succès.' };
  }

  /* ──────────────────────────────────────────────────────────
   * HELPERS PRIVÉS
   * ────────────────────────────────────────────────────────── */

  /* FIX m4 (historique) — le rejet du fallback par companyId visait un
   * companyId fourni PAR LE CLIENT (query/body, donc falsifiable → accès
   * cross-tenant). Ici, `userId` est en réalité `req.user.actorId`, signé
   * côté serveur dans le JWT à la connexion (voir AuthService.findProfileId) —
   * non falsifiable sans forger le JWT entier, donc le même risque ne
   * s'applique pas. Sans le clause `id`, ce lookup ne matchait quasiment
   * jamais (voir getParametres ci-dessus pour le détail du bug). */
  /* BUG CORRIGÉ (suite) — même correctif que getParametres() ci-dessus :
   * `id` en priorité, `userId` en repli déterministe, plutôt qu'un OR
   * ambigu en une seule requête. */
  /* ──────────────────────────────────────────────────────────
   * Catégories de mon activité — GET / PUT
   * Seules ces catégories sont proposées pour créer un produit / une
   * prestation (voir common/utils/company-categories.util.ts).
   * ────────────────────────────────────────────────────────── */

  async getMyCategories(userId: string) {
    const company = await this.findCompanyOrFail(userId);
    const manager = this.companyRepo.manager;

    const selectedIds = await getSelectedCategoryIds(manager, company.id);
    const available = company.companyTypeId
      ? await manager.getRepository(Category).find({
          where: { companyTypeId: company.companyTypeId, actif: true },
          order: { ordre: 'ASC', nom: 'ASC' },
        })
      : [];
    const availableIds = new Set(available.map(c => c.id));

    return {
      companyTypeId: company.companyTypeId,
      /* true = aucune sélection enregistrée : par repli, TOUTES les catégories
       * du type sont utilisables (entreprise antérieure à la règle). */
      usingFallback: selectedIds.length === 0,
      selectedIds:   selectedIds.filter(id => availableIds.has(id)),
      available: available.map(c => ({
        id: c.id, nom: c.nom, icone: c.icone, imageUrl: c.imageUrl, couleur: c.couleur,
      })),
    };
  }

  async updateMyCategories(userId: string, categoryIds: string[]) {
    const company = await this.findCompanyOrFail(userId);
    const manager = this.companyRepo.manager;

    if (!company.companyTypeId) {
      throw new BadRequestException("Choisissez d'abord votre type d'entreprise.");
    }

    const ids = [...new Set(categoryIds)];
    if (ids.length === 0 && (await countActiveCategoriesOfType(manager, company.companyTypeId)) > 0) {
      throw new BadRequestException('Choisissez au moins une catégorie.');
    }
    await validateCategoryIdsForType(manager, company.companyTypeId, ids);

    /* On ne retire pas une catégorie encore utilisée : ses produits /
     * prestations deviendraient orphelins de la liste de l'entreprise. */
    const previous = await getSelectedCategoryIds(manager, company.id);
    const removed  = previous.filter(id => !ids.includes(id));
    if (removed.length > 0) {
      const used: { nom: string; n: string }[] = await manager.query(
        `SELECT c."nom" AS nom, COUNT(*)::text AS n FROM (
           SELECT "categoryId" FROM products WHERE "companyId" = $1 AND "categoryId" = ANY($2::uuid[])
           UNION ALL
           SELECT "categoryId" FROM services WHERE "companyId" = $1 AND "categoryId" = ANY($2::uuid[])
         ) u JOIN categories c ON c.id = u."categoryId" GROUP BY c."nom"`,
        [company.id, removed],
      );
      if (used.length > 0) {
        throw new BadRequestException(
          'Impossible de retirer : ' + used.map(u => `"${u.nom}" (${u.n} produit(s)/service(s))`).join(', ') +
          '. Supprimez ou déplacez-les d\'abord.',
        );
      }
    }

    await replaceSelectedCategories(manager, company.id, ids);
    this.logger.log(`[CATEGORIES] Sélection mise à jour — companyId=${company.id} (${ids.length})`);
    return this.getMyCategories(userId);
  }

  private async findCompanyOrFail(userId: string): Promise<Company> {
    let company = await this.companyRepo.findOne({ where: { id: userId } });
    if (!company) company = await this.companyRepo.findOne({ where: { userId } });
    if (!company) throw new NotFoundException('Profil entreprise introuvable.');
    return company;
  }

  /**
   * Extrait le publicId d'une URL Cloudinary et supprime le fichier.
   * Ex: https://res.cloudinary.com/.../shopi/companies/abc.webp → shopi/companies/abc
   */
  private async deleteCloudinaryFile(url: string): Promise<void> {
    try {
      const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
      if (match) {
        await this.uploadService.delete(match[1], 'image');
      }
    } catch {
      // Ne pas bloquer si la suppression Cloudinary échoue
      this.logger.warn(`Suppression Cloudinary échouée pour : ${url}`);
    }
  }
}
