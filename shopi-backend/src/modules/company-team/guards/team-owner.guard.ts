/* ============================================================
 * FICHIER      : src/modules/company-team/guards/team-owner.guard.ts
 * MODULE       : Company Team
 * ROLE         : Vérifie que l'utilisateur est le propriétaire de l'entreprise.
 *
 * RESPONSABILITES :
 *   - Bloquer les collaborateurs (non-propriétaires) sur les routes
 *     réservées à la gestion de l'équipe.
 *   - Sécuriser contre l'élévation de privilèges où un collaborateur
 *     essaierait de modifier les permissions d'autres membres.
 *
 * COMMENT ÇA MARCHE :
 *   Le propriétaire d'une entreprise possède une entité Company liée
 *   à son User via la relation OneToOne (company.userId = user.id).
 *   Si cette entité existe → c'est le propriétaire → accès accordé.
 *   Si elle n'existe pas → c'est un collaborateur → accès refusé (403).
 *
 * UTILISATION :
 *   @UseGuards(JwtAuthGuard, TeamOwnerGuard)
 *   @Post('members')
 *   addMember(...) { ... }
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import {
  Injectable, CanActivate, ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../../../database/entities/profiles/entreprise-profile.entity';
import { User } from '../../../database/entities/user.entity';

@Injectable()
export class TeamOwnerGuard implements CanActivate {

  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req  = context.switchToHttp().getRequest();
    const user = req.user as User & { actorId?: string };

    if (!user?.id) {
      throw new ForbiddenException('Authentification requise.');
    }

    /* Vérifie que l'utilisateur est propriétaire d'une entreprise.
     * La relation Company.userId est l'identifiant du PROPRIÉTAIRE.
     * Les collaborateurs n'ont pas de Company propre → null → refusé. */
    const owned = await this.companyRepo.findOne({
      where: { userId: user.id },
      select: ['id'],
    });

    if (!owned) {
      throw new ForbiddenException(
        'Accès réservé au propriétaire de l\'entreprise. ' +
        'Les collaborateurs ne peuvent pas gérer l\'équipe.',
      );
    }

    /* Attache le companyId résolu sur la requête pour que les services
     * n'aient pas à le chercher une deuxième fois. */
    req.resolvedCompanyId = owned.id;

    return true;
  }
}
