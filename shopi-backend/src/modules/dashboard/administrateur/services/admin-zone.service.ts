/* ============================================================
 * SERVICE : admin-zone.service.ts
 *
 * Résolution du profil administrateur et de ses IDs d'acteurs.
 *
 * Ce service est la FONDATION injectée par tous les autres
 * services du module. Il centralise :
 *   — la résolution admin (userId JWT → profil Admin en base)
 *   — les listes d'IDs d'acteurs filtrés par zone
 *
 * Aucun service de domaine ne doit requêter adminRepo directement ;
 * il doit passer par adminOf() pour garantir la cohérence des erreurs.
 * ============================================================ */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository }              from '@nestjs/typeorm';
import { Repository }                    from 'typeorm';

import { Admin }    from '../../../../database/entities/profiles/admin-profile.entity';
import { Partner }  from '../../../../database/entities/profiles/partenaire-profile.entity';
import { Company }  from '../../../../database/entities/profiles/entreprise-profile.entity';
import { Delivery } from '../../../../database/entities/profiles/livreur-profile.entity';

@Injectable()
export class AdminZoneService {

  constructor(
    @InjectRepository(Admin)
    private readonly adminRepo: Repository<Admin>,

    @InjectRepository(Partner)
    private readonly partnerRepo: Repository<Partner>,

    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,

    @InjectRepository(Delivery)
    private readonly deliveryRepo: Repository<Delivery>,
  ) {}

  /**
   * Retrouve le profil Admin à partir de l'UUID utilisateur JWT.
   *
   * Lève une NotFoundException si aucun profil n'existe :
   * cela signifie que l'utilisateur authentifié n'a pas encore
   * de profil Admin créé en base (inscription incomplète).
   */
  async adminOf(userId: string): Promise<Admin> {
    const admin = await this.adminRepo.findOne({ where: { userId } });
    if (!admin) throw new NotFoundException('Profil administrateur introuvable.');
    return admin;
  }

  /**
   * Retourne les UUIDs de tous les partenaires rattachés à cet admin.
   * Résultat vide [] si l'admin n'a pas encore de partenaires.
   */
  async partnerIds(adminId: string): Promise<string[]> {
    const rows = await this.partnerRepo.find({ where: { adminId }, select: ['id'] });
    return rows.map(r => r.id);
  }

  /**
   * Retourne les UUIDs de toutes les entreprises rattachées à cet admin.
   * Nécessaire pour filtrer les commandes par zone.
   */
  async companyIds(adminId: string): Promise<string[]> {
    const rows = await this.companyRepo.find({ where: { adminId }, select: ['id'] });
    return rows.map(r => r.id);
  }

  /**
   * Retourne les UUIDs de tous les livreurs rattachés à cet admin.
   */
  async deliveryIds(adminId: string): Promise<string[]> {
    const rows = await this.deliveryRepo.find({ where: { adminId }, select: ['id'] });
    return rows.map(r => r.id);
  }
}
