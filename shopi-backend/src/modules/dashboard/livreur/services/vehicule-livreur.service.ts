/* ============================================================
 * FICHIER : src/modules/dashboard/livreur/services/vehicule-livreur.service.ts
 *
 * ✅ CORRIGÉ :
 *   - dto.VehicleType null → on garde l'ancienne valeur (champ non nullable)
 *   - dto.vehiculeCapacite null → on garde l'ancienne valeur
 *   - tous les champs nullables → ?? null géré proprement
 * ============================================================ */

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Delivery } from 'src/database/entities/profiles/livreur-profile.entity';
import { UpdateVehiculeDto } from '../dto/livreur-parametres.dto';
import { masquerDocuments } from './zone-livreur.service';

@Injectable()
export class VehiculeLivreurService {

  private readonly logger = new Logger(VehiculeLivreurService.name);

  constructor(
    @InjectRepository(Delivery)
    private readonly livreurRepo: Repository<Delivery>,
  ) {}

  /*
   * BUGS CORRIGÉS :
   *   - `save()` de toute la fiche : une valeur changée entre-temps ailleurs
   *     (disponibilité, compteurs, statut…) était remise à l'ancienne →
   *     seules les colonnes du véhicule sont écrites ;
   *   - un champ vidé était enregistré '' au lieu d'être effacé ; plaque non
   *     normalisée (affichée aux clients et aux boutiques) ;
   *   - la réponse contenait l'identifiant de stockage des pièces d'identité.
   */
  async updateVehicule(userId: string, dto: UpdateVehiculeDto): Promise<Delivery> {
    const livreur = await this.findOrFail(userId);
    const txt = (v?: string | null) => (v ?? '').replace(/\s+/g, ' ').trim() || null;
    const patch: Partial<Delivery> = {};

    // Champs non-nullables : seulement si une valeur est fournie
    if (dto.vehicleType)      patch.VehicleType      = dto.vehicleType;
    if (dto.vehiculeCapacite) patch.vehiculeCapacite = dto.vehiculeCapacite;
    // Champs nullables : vide = effacé
    if (dto.vehiculeMarque  !== undefined) patch.vehiculeMarque  = txt(dto.vehiculeMarque);
    if (dto.vehiculeModele  !== undefined) patch.vehiculeModele  = txt(dto.vehiculeModele);
    if (dto.vehiculeCouleur !== undefined) patch.vehiculeCouleur = txt(dto.vehiculeCouleur);
    if (dto.vehiculePlaque  !== undefined) patch.vehiculePlaque  = txt(dto.vehiculePlaque)?.toUpperCase() ?? null;
    if (dto.vehiculeAnnee   !== undefined) patch.vehiculeAnnee   = dto.vehiculeAnnee ?? null;
    if (dto.colisAcceptes   !== undefined) patch.colisAcceptes   = dto.colisAcceptes ?? null;

    if (Object.keys(patch).length) await this.livreurRepo.update({ id: livreur.id }, patch as any);
    this.logger.log(`[VEHICULE] Mis à jour — userId=${userId}`);
    return masquerDocuments(await this.findOrFail(userId));
  }

  async findOrFail(userId: string): Promise<Delivery> {
    const l = await this.livreurRepo.findOne({ where: { userId } });
    if (!l) throw new NotFoundException('Profil livreur introuvable.');
    return l;
  }
}