/* ============================================================
 * FICHIER : src/modules/location/services/client-address.service.ts
 * RÔLE    : CRUD des adresses client via l'entité Localisation.
 *           Remplace la version JSON de adresses.service.ts
 *           avec une implémentation propre basée sur des entités.
 * ============================================================ */

import {
  Injectable, Logger, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';

import { Localisation, TypeAdresse } from '../../../database/entities/localisation.entity';
import { User }                       from '../../../database/entities/user.entity';
import { CreateClientAddressDto, UpdateClientAddressDto } from '../dto/client-address.dto';

@Injectable()
export class ClientAddressService {

  private readonly logger = new Logger(ClientAddressService.name);

  constructor(
    @InjectRepository(Localisation)
    private readonly locRepo: Repository<Localisation>,
  ) {}

  /* ── Lister les adresses ─────────────────────────────────────── */

  async findAll(userId: string): Promise<Localisation[]> {
    return this.locRepo.find({
      where: { userId },
      order: { estDefaut: 'DESC', creeLe: 'DESC' },
    });
  }

  /* ── Récupérer une adresse ───────────────────────────────────── */

  async findOne(id: string, userId: string): Promise<Localisation> {
    const loc = await this.locRepo.findOne({ where: { id } });
    if (!loc)           throw new NotFoundException(`Adresse introuvable (id: ${id}).`);
    if (loc.userId !== userId) throw new ForbiddenException('Accès refusé.');
    return loc;
  }

  /* ── Créer une adresse ───────────────────────────────────────── */

  async create(userId: string, dto: CreateClientAddressDto): Promise<Localisation> {
    // Si nouvelle adresse par défaut → retirer le flag des autres
    if (dto.estDefaut) {
      await this.locRepo.update({ userId, estDefaut: true }, { estDefaut: false });
    }

    const loc = this.locRepo.create({
      userId,
      typeAdresse:  dto.typeAdresse  ?? TypeAdresse.DOMICILE,
      libelle:      dto.libelle      ?? null,
      rue:          dto.rue          ?? null,
      quartier:     dto.quartier     ?? null,
      commune:      dto.commune      ?? null,
      ville:        dto.ville,
      prefecture:   dto.prefecture   ?? null,
      region:       dto.region       ?? null,
      pays:         dto.pays         ?? 'GN',
      codePostal:   dto.codePostal   ?? null,
      latitude:     dto.latitude     ?? null,
      longitude:    dto.longitude    ?? null,
      instructions: dto.instructions ?? null,
      telephone:    dto.telephone    ?? null,
      estDefaut:    dto.estDefaut    ?? false,
    });

    const saved = await this.locRepo.save(loc);
    this.logger.log(`[ADDRESS ✅] Créée userId=${userId} id=${saved.id}`);
    return saved;
  }

  /* ── Mettre à jour une adresse ───────────────────────────────── */

  async update(
    id:     string,
    userId: string,
    dto:    UpdateClientAddressDto,
  ): Promise<Localisation> {
    const loc = await this.findOne(id, userId);

    if (dto.estDefaut) {
      await this.locRepo.update({ userId, estDefaut: true }, { estDefaut: false });
    }

    Object.assign(loc, {
      typeAdresse:  dto.typeAdresse  ?? loc.typeAdresse,
      libelle:      dto.libelle      ?? loc.libelle,
      rue:          dto.rue          ?? loc.rue,
      quartier:     dto.quartier     ?? loc.quartier,
      commune:      dto.commune      ?? loc.commune,
      ville:        dto.ville        ?? loc.ville,
      prefecture:   dto.prefecture   ?? loc.prefecture,
      region:       dto.region       ?? loc.region,
      pays:         dto.pays         ?? loc.pays,
      codePostal:   dto.codePostal   ?? loc.codePostal,
      latitude:     dto.latitude     !== undefined ? dto.latitude     : loc.latitude,
      longitude:    dto.longitude    !== undefined ? dto.longitude    : loc.longitude,
      instructions: dto.instructions !== undefined ? dto.instructions : loc.instructions,
      telephone:    dto.telephone    ?? loc.telephone,
      estDefaut:    dto.estDefaut    !== undefined ? dto.estDefaut    : loc.estDefaut,
    });

    return this.locRepo.save(loc);
  }

  /* ── Supprimer une adresse ───────────────────────────────────── */

  async remove(id: string, userId: string): Promise<void> {
    const loc = await this.findOne(id, userId);
    await this.locRepo.remove(loc);
    this.logger.log(`[ADDRESS 🗑️] Supprimée userId=${userId} id=${id}`);
  }

  /* ── Définir comme adresse par défaut ────────────────────────── */

  async setDefault(id: string, userId: string): Promise<Localisation[]> {
    // Retire le flag default de toutes les adresses
    await this.locRepo.update({ userId, estDefaut: true }, { estDefaut: false });
    // Applique le flag sur l'adresse choisie
    const loc = await this.findOne(id, userId);
    loc.estDefaut = true;
    await this.locRepo.save(loc);
    return this.findAll(userId);
  }

  /* ── Adresse par défaut ──────────────────────────────────────── */

  async getDefault(userId: string): Promise<Localisation | null> {
    return this.locRepo.findOne({ where: { userId, estDefaut: true } });
  }
}
