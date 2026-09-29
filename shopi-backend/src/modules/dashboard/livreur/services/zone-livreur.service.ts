/* ============================================================
 * FICHIER : src/modules/dashboard/livreur/services/zone-livreur.service.ts
 * RÔLE : Section 3 — Zones, Horaires, Disponibilité automatique
 *   GET   /parametres/zone        → zones + distanceMax + autoDispoSettings
 *   PATCH /parametres/zone        → MAJ zones + distanceMax + autoDispoSettings
 *   GET   /parametres/horaires    → horaires 7 jours triés
 *   PATCH /parametres/horaires    → remplacer tous les horaires
 *   PATCH /parametres/horaires/:jour → modifier un seul jour
 * ============================================================ */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Delivery } from 'src/database/entities/profiles/livreur-profile.entity';
import {
  LivreurHoraire, JourSemaine,
  JOURS_ORDER, DEFAULT_HORAIRES_LIVREUR,
} from 'src/database/entities/livreur.table/livreur-horaire.entity';
import { UpdateZonesDto, UpdateZonesDispoDto, UpdateHorairesLivreurDto, HoraireJourDto } from '../dto/livreur-parametres.dto';

/** Types de livraison proposés à l'écran (buildDeliveryTypes, parametresData.ts). */
const DELIVERY_TYPES = ['entre_pays', 'entre_regions', 'entre_prefectures', 'entre_villes', 'entre_communes', 'entre_quartiers'];
const MAX_ZONES = 300;

/** SÉCURITÉ — ne jamais renvoyer l'identifiant de stockage des pièces sensibles
 *  (CNI, permis, assurance, casier) : l'écran n'utilise que présent / absent. */
export function masquerDocuments(l: Delivery): Delivery {
  const MASQUE = '••••••';
  if (l.documentCni)       l.documentCni       = MASQUE;
  if (l.documentPermis)    l.documentPermis    = MASQUE;
  if (l.documentAssurance) l.documentAssurance = MASQUE;
  if (l.documentCasier)    l.documentCasier    = MASQUE;
  return l;
}

@Injectable()
export class ZoneLivreurService {

  private readonly logger = new Logger(ZoneLivreurService.name);

  constructor(
    @InjectRepository(Delivery)       private readonly livreurRepo:  Repository<Delivery>,
    @InjectRepository(LivreurHoraire) private readonly horaireRepo:  Repository<LivreurHoraire>,
  ) {}

  /* ── PATCH — Zones & disponibilité ── */
  /*
   * BUGS CORRIGÉS :
   *   - type de livraison jamais vérifié (n'importe quel texte accepté) ;
   *   - liste de zones sans contrôle (doublons, espaces, taille illimitée) ;
   *   - une zone retirée restait dans `zonesDisponibles` (page « Ma zone de
   *     livraison ») ; changer de type gardait les zones de l'ancien niveau ;
   *   - `save()` de toute la fiche (disponibilité, compteurs… écrasés si
   *     modifiés entre-temps) → seules les colonnes concernées sont écrites.
   */
  async updateZones(userId: string, dto: UpdateZonesDto): Promise<Delivery> {
    const livreur = await this.findOrFail(userId);
    const patch: Partial<Delivery> = {};

    if (dto.deliveryType !== undefined && dto.deliveryType !== livreur.deliveryType) {
      if (!DELIVERY_TYPES.includes(dto.deliveryType)) {
        throw new BadRequestException('Type de livraison inconnu.');
      }
      /* Vérification du verrouillage 6 mois */
      if (livreur.deliveryType && livreur.deliveryTypeSetAt) {
        const unlock = new Date(livreur.deliveryTypeSetAt);
        unlock.setMonth(unlock.getMonth() + 6);
        if (new Date() < unlock) {
          const date = unlock.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
          throw new BadRequestException(
            `Le type de livraison est verrouillé jusqu'au ${date}. Vous ne pouvez modifier que vos zones actives.`,
          );
        }
      }
      patch.deliveryType      = dto.deliveryType;
      patch.deliveryTypeSetAt = new Date();
      /* Nouveau niveau (communes, quartiers…) : les zones de l'ancien niveau ne valent plus */
      if (dto.communesActives === undefined) patch.communesActives = [];
    }

    if (dto.communesActives !== undefined) {
      const zones = [...new Set((dto.communesActives ?? []).map(z => (z ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean))];
      if (zones.length > MAX_ZONES) throw new BadRequestException(`${MAX_ZONES} zones au maximum.`);
      if (zones.some(z => z.length > 100)) throw new BadRequestException('Nom de zone trop long.');
      patch.communesActives = zones;
    }
    if (dto.distanceMax       !== undefined) patch.distanceMax       = dto.distanceMax;
    if (dto.autoDispoSettings !== undefined) patch.autoDispoSettings = dto.autoDispoSettings;

    /* Zones « disponibles » : seulement parmi les zones encore actives */
    if (patch.communesActives !== undefined) {
      const actives = patch.communesActives as string[];
      patch.zonesDisponibles = (livreur.zonesDisponibles ?? []).filter(z => actives.includes(z));
    }

    if (Object.keys(patch).length) await this.livreurRepo.update({ id: livreur.id }, patch as any);
    const updated = await this.findOrFail(userId);
    this.logger.log(`[ZONE] Mis à jour — userId=${userId}`);
    return masquerDocuments(updated);
  }

  /* ── GET — Horaires triés lundi → dimanche ── */
  async getHoraires(userId: string): Promise<LivreurHoraire[]> {
    const livreur = await this.findOrFail(userId);
    let horaires = await this.horaireRepo.find({ where: { livreurId: livreur.id } });
    if (horaires.length === 0) horaires = await this.initHorairesDefaut(livreur.id);
    return this.sortByWeek(horaires);
  }

  /* ── PATCH — Remplacer tous les horaires ── */
  async updateHoraires(userId: string, dto: UpdateHorairesLivreurDto): Promise<LivreurHoraire[]> {
    const livreur = await this.findOrFail(userId);
    /* Tout est vérifié AVANT la moindre écriture (jamais une semaine à moitié enregistrée) */
    for (const h of dto.horaires) this.assertJourValide(h);
    for (const h of dto.horaires) await this.upsertJour(livreur.id, h);
    this.logger.log(`[HORAIRES] ${dto.horaires.length} jours mis à jour — userId=${userId}`);
    return this.getHoraires(userId);
  }

  /* ── PATCH — Un seul jour ── */
  async updateJour(userId: string, jour: JourSemaine, dto: HoraireJourDto): Promise<LivreurHoraire> {
    const livreur = await this.findOrFail(userId);
    this.assertJourValide({ ...dto, jour });
    const h = await this.upsertJour(livreur.id, { ...dto, jour });
    this.logger.log(`[HORAIRE] ${jour} mis à jour — userId=${userId}`);
    return h;
  }

  /* ── Helpers ── */
  /**
   * BUG CORRIGÉ — un jour « ouvert » s'enregistrait sans heure ou avec la même
   * heure d'ouverture et de fermeture (affiché tel quel aux clients).
   * Fermeture avant ouverture = fin après minuit (acceptée).
   */
  private assertJourValide(dto: HoraireJourDto): void {
    if (!dto.actif) return;
    if (!dto.ouverture || !dto.fermeture) {
      throw new BadRequestException(`Horaires incomplets pour ${dto.jour} : heure de début et de fin requises.`);
    }
    if (dto.ouverture.slice(0, 5) === dto.fermeture.slice(0, 5)) {
      throw new BadRequestException(`Horaires invalides pour ${dto.jour} : le début et la fin sont identiques.`);
    }
  }

  private async upsertJour(livreurId: string, dto: HoraireJourDto): Promise<LivreurHoraire> {
    let h = await this.horaireRepo.findOne({ where: { livreurId, jour: dto.jour } });
    if (!h) h = this.horaireRepo.create({ livreurId, jour: dto.jour });
    h.ouverture = dto.actif ? (dto.ouverture ?? null) : null;
    h.fermeture = dto.actif ? (dto.fermeture ?? null) : null;
    h.actif = dto.actif;
    return this.horaireRepo.save(h);
  }

  private async initHorairesDefaut(livreurId: string): Promise<LivreurHoraire[]> {
    const entities = JOURS_ORDER.map(jour => {
      const def = DEFAULT_HORAIRES_LIVREUR[jour];
      return this.horaireRepo.create({
        livreurId, jour,
        ouverture: def.actif ? def.ouverture : null,
        fermeture: def.actif ? def.fermeture : null,
        actif:     def.actif,
      });
    });
    return this.horaireRepo.save(entities);
  }

  private sortByWeek(horaires: LivreurHoraire[]): LivreurHoraire[] {
    return [...horaires].sort((a, b) => JOURS_ORDER.indexOf(a.jour) - JOURS_ORDER.indexOf(b.jour));
  }

  /* ── PATCH — Disponibilité par zone ── */
  async updateZonesDisponibles(userId: string, dto: UpdateZonesDispoDto): Promise<Delivery> {
    const livreur = await this.findOrFail(userId);
    /* Filtre : seules les zones déjà configurées peuvent être activées */
    const configured = livreur.communesActives ?? [];
    const zonesDisponibles = [...new Set(dto.zonesDisponibles)].filter(z => configured.includes(z));
    await this.livreurRepo.update({ id: livreur.id }, { zonesDisponibles });
    this.logger.log(`[DISPO] ${zonesDisponibles.length} zone(s) disponible(s) — userId=${userId}`);
    return masquerDocuments(await this.findOrFail(userId));
  }

  async findOrFail(userId: string): Promise<Delivery> {
    const l = await this.livreurRepo.findOne({ where: { userId } });
    if (!l) throw new NotFoundException('Profil livreur introuvable.');
    return l;
  }
}