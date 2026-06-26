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

@Injectable()
export class VehiculeLivreurService {

  private readonly logger = new Logger(VehiculeLivreurService.name);

  constructor(
    @InjectRepository(Delivery)
    private readonly livreurRepo: Repository<Delivery>,
  ) {}

  async updateVehicule(userId: string, dto: UpdateVehiculeDto): Promise<Delivery> {
    const livreur = await this.findOrFail(userId);

    // ✅ Champs ENUM non-nullables : on n'assigne que si valeur présente et non-null
    if (dto.vehicleType     !== undefined && dto.vehicleType     !== null) {
      livreur.VehicleType = dto.vehicleType;
    }
    // ✅ Champ string non-nullable : on n'assigne que si valeur présente et non-null
    if (dto.vehiculeCapacite !== undefined && dto.vehiculeCapacite !== null) {
      livreur.vehiculeCapacite = dto.vehiculeCapacite;
    }
    // Champs nullables → on accepte null (vider le champ)
    if (dto.vehiculeMarque   !== undefined) livreur.vehiculeMarque  = dto.vehiculeMarque  ?? null;
    if (dto.vehiculeModele   !== undefined) livreur.vehiculeModele  = dto.vehiculeModele  ?? null;
    if (dto.vehiculeAnnee    !== undefined) livreur.vehiculeAnnee   = dto.vehiculeAnnee   ?? null;
    if (dto.vehiculeCouleur  !== undefined) livreur.vehiculeCouleur = dto.vehiculeCouleur ?? null;
    if (dto.vehiculePlaque   !== undefined) livreur.vehiculePlaque  = dto.vehiculePlaque  ?? null;
    if (dto.colisAcceptes    !== undefined) livreur.colisAcceptes   = dto.colisAcceptes   ?? null;

    const updated = await this.livreurRepo.save(livreur);
    this.logger.log(`[VEHICULE] Mis à jour — userId=${userId}`);
    return updated;
  }

  async findOrFail(userId: string): Promise<Delivery> {
    const l = await this.livreurRepo.findOne({ where: { userId } });
    if (!l) throw new NotFoundException('Profil livreur introuvable.');
    return l;
  }
}