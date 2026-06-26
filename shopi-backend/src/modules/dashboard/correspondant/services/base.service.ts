/* ============================================================
 * FICHIER : services/base.service.ts
 *
 * Classe de base abstraite partagée entre tous les services
 * des paramètres correspondant.
 *
 * Fournit :
 *   findCorOrFail(userId)  → Correspondent ou 404
 *   findUserOrFail(userId) → User (champs publics) ou 404
 *
 * Tous les services héritent de cette classe via `extends`.
 * Cela évite de dupliquer ces 2 méthodes dans chaque service.
 * ============================================================ */

import { NotFoundException } from '@nestjs/common';
import { Repository }        from 'typeorm';
import { Correspondent }     from '../../../../database/entities/profiles/correspondant-profile.entity';
import { User }              from '../../../../database/entities/user.entity';

export abstract class CorrespondantBaseService {

  constructor(
    protected readonly corRepo:  Repository<Correspondent>,
    protected readonly userRepo: Repository<User>,
  ) {}

  /**
   * Charge le profil Correspondent à partir du userId JWT.
   * Lève une NotFoundException si le profil n'existe pas.
   */
  protected async findCorOrFail(userId: string): Promise<Correspondent> {
    const cor = await this.corRepo.findOne({ where: { userId } });
    if (!cor) throw new NotFoundException('Profil correspondant introuvable.');
    return cor;
  }

  /**
   * Charge les champs publics de User (identité de base).
   * ⚠️  Ne charge PAS password (select:false) — utiliser QueryBuilder
   *     dans SecuriteService.changePassword() pour cela.
   */
  protected async findUserOrFail(userId: string): Promise<User> {
    const user = await this.userRepo.findOne({
      where:  { id: userId },
      select: ['id', 'firstName', 'lastName', 'email', 'phone', 'profilePicture'],
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
    return user;
  }
}