/* ============================================================
 * FICHIER : src/modules/location/services/client-address.service.ts
 * RÔLE    : CRUD des adresses client via l'entité Localisation.
 *           Remplace la version JSON de adresses.service.ts
 *           avec une implémentation propre basée sur des entités.
 *
 * RÈGLES (2e passe « Paramètres client ») :
 *   - Il y a TOUJOURS une adresse par défaut dès qu'il existe une adresse
 *     (utilisée pour les distances, voir useClientPosition côté frontend) :
 *     la première adresse le devient d'office ; supprimer l'adresse par
 *     défaut la transfère à la plus récente des autres ; on ne peut pas la
 *     « décocher » (il faut en choisir une autre).
 *   - 20 adresses au plus par compte.
 *
 * BUGS CORRIGÉS :
 *   - Vider un champ (libellé, rue, quartier, téléphone…) ne s'enregistrait
 *     pas : l'écran envoie `null` et `null ?? ancienneValeur` gardait
 *     l'ancienne valeur.
 *   - « Définir par défaut » retirait le drapeau de toutes les adresses AVANT
 *     de vérifier que l'adresse visée appartenait au compte : un identifiant
 *     inconnu ou étranger laissait le client sans adresse par défaut.
 *   - Changement d'adresse par défaut en deux requêtes séparées : désormais
 *     dans une transaction (jamais zéro ni deux adresses par défaut).
 * ============================================================ */

import {
  Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository }  from 'typeorm';

import { Localisation, TypeAdresse } from '../../../database/entities/localisation.entity';
import { CreateClientAddressDto, UpdateClientAddressDto } from '../dto/client-address.dto';

const MAX_ADDRESSES = 20;

/** Champs texte facultatifs : '' ou null → NULL, sinon valeur nettoyée. */
const TEXT_FIELDS = [
  'libelle', 'rue', 'quartier', 'commune', 'prefecture', 'region', 'codePostal', 'instructions', 'telephone',
] as const;
const clean = (v: string | null | undefined): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s || null;
};

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

  /* ── Créer ───────────────────────────────────────────────────── */

  async create(userId: string, dto: CreateClientAddressDto): Promise<Localisation> {
    const count = await this.locRepo.count({ where: { userId } });
    if (count >= MAX_ADDRESSES) {
      throw new BadRequestException(`Vous avez déjà ${MAX_ADDRESSES} adresses : supprimez-en une avant d'en ajouter une autre.`);
    }
    const ville = clean(dto.ville);
    if (!ville) throw new BadRequestException('La ville est obligatoire.');

    /* La première adresse devient d'office l'adresse par défaut */
    const estDefaut = count === 0 || dto.estDefaut === true;

    const saved = await this.locRepo.manager.transaction(async em => {
      if (estDefaut) await em.update(Localisation, { userId, estDefaut: true }, { estDefaut: false });
      const loc = em.create(Localisation, {
        userId,
        typeAdresse: dto.typeAdresse ?? TypeAdresse.DOMICILE,
        ...Object.fromEntries(TEXT_FIELDS.map(k => [k, clean(dto[k])])),
        ville,
        pays:      clean(dto.pays) ?? 'GN',
        latitude:  dto.latitude  ?? null,
        longitude: dto.longitude ?? null,
        estDefaut,
      });
      return em.save(loc);
    });
    this.logger.log(`[ADDRESS ✅] Créée userId=${userId} id=${saved.id}`);
    return saved;
  }

  /* ── Modifier ────────────────────────────────────────────────── */

  async update(
    id:     string,
    userId: string,
    dto:    UpdateClientAddressDto,
  ): Promise<Localisation> {
    const loc = await this.findOne(id, userId);

    const patch: Partial<Localisation> = {};
    if (dto.typeAdresse !== undefined) patch.typeAdresse = dto.typeAdresse;
    for (const k of TEXT_FIELDS) {
      if (dto[k] !== undefined) (patch as Record<string, unknown>)[k] = clean(dto[k]);
    }
    if (dto.ville !== undefined) {
      const ville = clean(dto.ville);
      if (!ville) throw new BadRequestException('La ville est obligatoire.');
      patch.ville = ville;
    }
    if (dto.pays !== undefined) patch.pays = clean(dto.pays) ?? 'GN';
    if (dto.latitude  !== undefined) patch.latitude  = dto.latitude  ?? null;
    if (dto.longitude !== undefined) patch.longitude = dto.longitude ?? null;

    /* Devenir l'adresse par défaut : oui. Cesser de l'être sans en choisir une autre : non (ignoré). */
    const devientDefaut = dto.estDefaut === true && !loc.estDefaut;

    await this.locRepo.manager.transaction(async em => {
      if (devientDefaut) {
        await em.update(Localisation, { userId, estDefaut: true }, { estDefaut: false });
        patch.estDefaut = true;
      }
      if (Object.keys(patch).length) await em.update(Localisation, { id, userId }, patch as any);
    });
    return this.findOne(id, userId);
  }

  /* ── Supprimer ───────────────────────────────────────────────── */

  async remove(id: string, userId: string): Promise<void> {
    const loc = await this.findOne(id, userId);
    await this.locRepo.manager.transaction(async em => {
      await em.delete(Localisation, { id, userId });
      if (loc.estDefaut) {
        /* L'adresse par défaut passe à la plus récente des autres */
        const next = await em.findOne(Localisation, { where: { userId, id: Not(id) }, order: { creeLe: 'DESC' } });
        if (next) await em.update(Localisation, { id: next.id }, { estDefaut: true });
      }
    });
    this.logger.log(`[ADDRESS 🗑️] Supprimée userId=${userId} id=${id}`);
  }

  /* ── Définir par défaut ──────────────────────────────────────── */

  async setDefault(id: string, userId: string): Promise<Localisation[]> {
    await this.findOne(id, userId);          // appartenance vérifiée AVANT toute écriture
    await this.locRepo.manager.transaction(async em => {
      await em.update(Localisation, { userId, estDefaut: true }, { estDefaut: false });
      await em.update(Localisation, { id, userId }, { estDefaut: true });
    });
    return this.findAll(userId);
  }

  /* ── Adresse par défaut ──────────────────────────────────────── */

  async getDefault(userId: string): Promise<Localisation | null> {
    return this.locRepo.findOne({ where: { userId, estDefaut: true } });
  }
}
