/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/services/horaires-parametres.service.ts
 *
 * RÔLE : Gère les horaires d'ouverture (section 3)
 *   GET   /parametres/horaires         → lire les 7 horaires
 *   PUT   /parametres/horaires         → remplacer les 7 horaires d'un coup
 *   PATCH /parametres/horaires/:jour   → modifier un seul jour
 *
 * Logique :
 *   - Lors de la 1ère sauvegarde, crée les 7 lignes si elles n'existent pas.
 *   - UPSERT par (companyId + jour) → INSERT ou UPDATE selon existence.
 * ============================================================ */

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Company } from 'src/database/entities/profiles/entreprise-profile.entity';
import {
  CompanyHoraire,
  JourSemaine,
  JOURS_ORDER,
  DEFAULT_HORAIRES,
} from 'src/database/entities/entreprise.table/company-horaire.entity';

import { UpdateHorairesDto, HoraireJourDto } from '../dto/update-horaires.dto';
import { PublicBroadcastService } from 'src/modules/public/public-broadcast.service';

@Injectable()
export class HorairesParametresService {

  private readonly logger = new Logger(HorairesParametresService.name);

  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,

    @InjectRepository(CompanyHoraire)
    private readonly horaireRepo: Repository<CompanyHoraire>,

    /* Diffuse en direct aux visiteurs actuellement sur la fiche boutique
     * publique de cette entreprise — voir public/public.gateway.ts. */
    private readonly publicBroadcast: PublicBroadcastService,
  ) {}

  /* ──────────────────────────────────────────────────────────
   * GET — Retourner les horaires triés lundi → dimanche
   * ────────────────────────────────────────────────────────── */

  async getHoraires(userId: string): Promise<CompanyHoraire[]> {
    const company = await this.findCompanyOrFail(userId);

    let horaires = await this.horaireRepo.find({
      where: { companyId: company.id },
      order: { jour: 'ASC' },
    });

    // Si aucun horaire en base → initialiser avec les valeurs par défaut
    if (horaires.length === 0) {
      horaires = await this.initHorairesParDefaut(company.id);
    }

    // Trier selon l'ordre naturel de la semaine
    return this.sortByWeekOrder(horaires);
  }

  /* ──────────────────────────────────────────────────────────
   * PUT — Remplacer les 7 jours d'un coup
   * ────────────────────────────────────────────────────────── */

  async updateHoraires(
    userId: string,
    dto: UpdateHorairesDto,
  ): Promise<CompanyHoraire[]> {
    const company = await this.findCompanyOrFail(userId);

    // UPSERT pour chaque jour reçu dans le DTO
    for (const jourDto of dto.horaires) {
      await this.upsertJour(company.id, jourDto);
    }

    this.logger.log(`[HORAIRES] ${dto.horaires.length} jours mis à jour — companyId=${company.id}`);

    const horaires = await this.getHoraires(userId);
    this.broadcastHoraires(company.id, horaires);
    return horaires;
  }

  /* ──────────────────────────────────────────────────────────
   * PATCH — Modifier un seul jour
   * ────────────────────────────────────────────────────────── */

  async updateJour(
    userId: string,
    jour: JourSemaine,
    dto: HoraireJourDto,
  ): Promise<CompanyHoraire> {
    const company = await this.findCompanyOrFail(userId);

    const horaire = await this.upsertJour(company.id, { ...dto, jour });

    this.logger.log(`[HORAIRE] ${jour} mis à jour — companyId=${company.id}`);

    this.broadcastHoraires(company.id, await this.getHoraires(userId));
    return horaire;
  }

  /* ──────────────────────────────────────────────────────────
   * HELPERS PRIVÉS
   * ────────────────────────────────────────────────────────── */

  /**
   * UPSERT un jour :
   * Si la ligne existe → UPDATE
   * Sinon → INSERT
   */
  private async upsertJour(
    companyId: string,
    dto: HoraireJourDto,
  ): Promise<CompanyHoraire> {
    let horaire = await this.horaireRepo.findOne({
      where: { companyId, jour: dto.jour },
    });

    if (!horaire) {
      horaire = this.horaireRepo.create({ companyId, jour: dto.jour });
    }

    horaire.ouverture = dto.actif ? (dto.ouverture ?? null) : null;
    horaire.fermeture = dto.actif ? (dto.fermeture ?? null) : null;
    horaire.actif     = dto.actif;

    return this.horaireRepo.save(horaire);
  }

  /**
   * Crée les 7 lignes de la semaine avec les horaires par défaut.
   * Appelé automatiquement si la boutique n'a pas encore d'horaires.
   */
  private async initHorairesParDefaut(companyId: string): Promise<CompanyHoraire[]> {
    const entities = JOURS_ORDER.map(jour => {
      const def = DEFAULT_HORAIRES[jour];
      return this.horaireRepo.create({
        companyId,
        jour,
        ouverture: def.actif ? def.ouverture : null,
        fermeture: def.actif ? def.fermeture : null,
        actif:     def.actif,
      });
    });

    return this.horaireRepo.save(entities);
  }

  /** Trie les horaires dans l'ordre lundi → dimanche */
  private sortByWeekOrder(horaires: CompanyHoraire[]): CompanyHoraire[] {
    return [...horaires].sort(
      (a, b) => JOURS_ORDER.indexOf(a.jour) - JOURS_ORDER.indexOf(b.jour),
    );
  }

  /**
   * Pousse les horaires à jour en direct vers quiconque consulte la fiche
   * boutique publique de cette entreprise au même moment (visiteur, ou le
   * propriétaire lui-même sur "Voir ma boutique") — plus besoin de
   * recharger la page pour voir un changement. Même forme que
   * PublicBoutiqueResponse.horaires (public.service.ts) pour que le
   * frontend puisse appliquer directement le payload reçu.
   */
  private broadcastHoraires(companyId: string, horaires: CompanyHoraire[]): void {
    this.publicBroadcast.emitToBoutique(companyId, 'boutique:horaires_updated', {
      horaires: this.sortByWeekOrder(horaires).map(h => ({
        jour: h.jour, ouverture: h.ouverture, fermeture: h.fermeture, actif: h.actif,
      })),
    });
  }

  /* FIX m4 (historique, param client) — sans rapport ici : `userId` est en
   * réalité req.user.actorId, signé serveur (voir boutique-parametres.
   * service.ts pour le détail du bug que ce `[{id},{userId}]` corrige). */
  /* BUG CORRIGÉ — l'ancien `where:[{id},{userId}]` était un OR SQL sans
   * ordre garanti : quand une AUTRE entreprise a par accident un userId
   * identique à l'id de celle-ci (bug de profil fantôme, voir getParametres
   * dans boutique-parametres.service.ts), Postgres pouvait retourner l'une
   * ou l'autre selon le plan de requête — a réellement fait persister des
   * réglages sur la mauvaise fiche. `id` (cas normal, actorId) est
   * désormais toujours tenté en priorité ; `userId` n'est qu'un repli. */
  private async findCompanyOrFail(userId: string): Promise<Company> {
    let company = await this.companyRepo.findOne({ where: { id: userId } });
    if (!company) company = await this.companyRepo.findOne({ where: { userId } });
    if (!company) throw new NotFoundException('Profil entreprise introuvable.');
    return company;
  }
}
