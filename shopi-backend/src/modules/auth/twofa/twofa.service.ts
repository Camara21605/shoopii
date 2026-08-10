/* ============================================================
 * FICHIER : src/modules/auth/twofa/twofa.service.ts
 *
 * RÔLE : Source unique de vérité pour la 2FA TOTP (RFC 6238),
 *        pour les 6 rôles (Admin, Company, Delivery, Correspondent,
 *        Partner, Client).
 *
 * FLUX (setup → confirm, jamais d'activation directe) :
 *   1. setup()  : génère un secret, le stocke, twoFaEnabled reste false.
 *   2. confirm(): vérifie un code TOTP contre ce secret ; si valide,
 *                 twoFaEnabled passe à true. Sans cette étape, un
 *                 secret jamais scanné avec succès ne peut jamais
 *                 activer la 2FA — impossible de se verrouiller
 *                 accidentellement hors de son compte.
 *   3. disable(): désactive (mot de passe actuel requis).
 *   4. verifyLoginCode() : utilisé par AuthService.login() lors du
 *                 défi 2FA — ne modifie rien, vérifie seulement.
 *
 * AVANT ce service, chaque dashboard avait son propre toggle qui
 * activait twoFaEnabled=true IMMÉDIATEMENT à la génération du secret,
 * sans jamais vérifier qu'un code valide pouvait être produit — et,
 * plus grave, AuthService.login() ne vérifiait jamais aucun code 2FA :
 * la fonctionnalité n'offrait donc aucune protection réelle.
 * ============================================================ */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { authenticator } from 'otplib';
import * as bcrypt from 'bcryptjs';

import { UserRole } from '../../../common/enums/user-role.enum';
import { User } from '../../../database/entities/user.entity';
import { Admin } from '../../../database/entities/profiles/admin-profile.entity';
import { Partner } from '../../../database/entities/profiles/partenaire-profile.entity';
import { Company } from '../../../database/entities/profiles/entreprise-profile.entity';
import { Delivery } from '../../../database/entities/profiles/livreur-profile.entity';
import { Correspondent, TwoFaMethod } from '../../../database/entities/profiles/correspondant-profile.entity';
import { Client } from '../../../database/entities/profiles/client-profile.entity';

authenticator.options = { window: 1 }; // tolère ±30s de dérive d'horloge

interface TwoFaProfile {
  twoFaEnabled: boolean;
  twoFaMethod:  string | null;
  twoFaSecret:  string | null;
}

@Injectable()
export class TwoFaService {

  constructor(
    @InjectRepository(User)          private readonly userRepo:          Repository<User>,
    @InjectRepository(Admin)         private readonly adminRepo:         Repository<Admin>,
    @InjectRepository(Partner)       private readonly partnerRepo:       Repository<Partner>,
    @InjectRepository(Company)       private readonly companyRepo:       Repository<Company>,
    @InjectRepository(Delivery)      private readonly deliveryRepo:      Repository<Delivery>,
    @InjectRepository(Correspondent) private readonly correspondentRepo: Repository<Correspondent>,
    @InjectRepository(Client)        private readonly clientRepo:        Repository<Client>,
  ) {}

  // ══════════════════════════════════════════════════════════
  // Résolution du profil (avec twoFaSecret — select:false partout)
  // ══════════════════════════════════════════════════════════

  private async loadProfile(
    role: UserRole,
    userId: string,
  ): Promise<{ repo: Repository<any>; entity: TwoFaProfile & { id: string } } | null> {
    const base = (repo: Repository<any>, alias: string) =>
      repo.createQueryBuilder(alias)
        .addSelect(`${alias}.twoFaSecret`)
        .where(`${alias}.userId = :userId`, { userId });

    switch (role) {
      case UserRole.ADMIN:
        return this.wrap(this.adminRepo, await base(this.adminRepo, 'a').getOne());
      case UserRole.PARTNER:
        return this.wrap(this.partnerRepo, await base(this.partnerRepo, 'p').getOne());
      case UserRole.COMPANY:
        return this.wrap(this.companyRepo, await base(this.companyRepo, 'c').getOne());
      case UserRole.DELIVERY:
        return this.wrap(this.deliveryRepo, await base(this.deliveryRepo, 'd').getOne());
      case UserRole.CORRESPONDENT:
        return this.wrap(this.correspondentRepo, await base(this.correspondentRepo, 'cor').getOne());
      case UserRole.CLIENT:
        return this.wrap(this.clientRepo, await base(this.clientRepo, 'cl').getOne());
      default:
        return null;
    }
  }

  private wrap(repo: Repository<any>, entity: any | null) {
    return entity ? { repo, entity } : null;
  }

  // ══════════════════════════════════════════════════════════
  // 1. SETUP — génère un secret (n'active pas encore la 2FA)
  // ══════════════════════════════════════════════════════════

  async setup(user: User): Promise<{ secret: string; otpauthUri: string }> {
    const found = await this.loadProfile(user.role as UserRole, user.id);
    if (!found) throw new NotFoundException('Profil introuvable.');

    const secret = authenticator.generateSecret();
    found.entity.twoFaSecret = secret;
    await found.repo.save(found.entity);

    const otpauthUri = authenticator.keyuri(user.email, 'Shopi', secret);
    return { secret, otpauthUri };
  }

  // ══════════════════════════════════════════════════════════
  // 2. CONFIRM — vérifie le 1er code et active réellement la 2FA
  // ══════════════════════════════════════════════════════════

  async confirm(user: User, code: string): Promise<{ message: string }> {
    const found = await this.loadProfile(user.role as UserRole, user.id);
    if (!found?.entity.twoFaSecret) {
      throw new BadRequestException(
        "Aucune configuration 2FA en attente. Lancez d'abord POST /auth/2fa/setup.",
      );
    }

    const valid = authenticator.check(code, found.entity.twoFaSecret);
    if (!valid) {
      throw new BadRequestException('Code invalide. Vérifiez l\'heure de votre appareil et réessayez.');
    }

    found.entity.twoFaEnabled = true;
    found.entity.twoFaMethod =
      user.role === UserRole.CORRESPONDENT ? TwoFaMethod.AUTHENTICATOR : 'app';
    await found.repo.save(found.entity);

    return { message: '2FA activée avec succès.' };
  }

  // ══════════════════════════════════════════════════════════
  // 3. DISABLE — désactive (mot de passe actuel requis)
  // ══════════════════════════════════════════════════════════

  async disable(user: User, currentPassword: string): Promise<{ message: string }> {
    const dbUser = await this.userRepo
      .createQueryBuilder('u')
      .addSelect('u.password')
      .where('u.id = :id', { id: user.id })
      .getOne();
    if (!dbUser) throw new NotFoundException('Utilisateur introuvable.');

    const valid = await bcrypt.compare(currentPassword, dbUser.password);
    if (!valid) throw new UnauthorizedException('Mot de passe actuel incorrect.');

    const found = await this.loadProfile(user.role as UserRole, user.id);
    if (!found) throw new NotFoundException('Profil introuvable.');

    found.entity.twoFaEnabled = false;
    found.entity.twoFaMethod  = null;
    found.entity.twoFaSecret  = null;
    await found.repo.save(found.entity);

    return { message: '2FA désactivée.' };
  }

  // ══════════════════════════════════════════════════════════
  // 4. Utilisé par AuthService.login() — lecture seule
  // ══════════════════════════════════════════════════════════

  /** true si ce compte doit passer par le défi 2FA au login. */
  async isEnabled(role: UserRole, userId: string): Promise<boolean> {
    const found = await this.loadProfile(role, userId);
    return !!found?.entity.twoFaEnabled && !!found.entity.twoFaSecret;
  }

  /** Vérifie un code TOTP soumis lors du défi de login. Ne modifie rien. */
  async verifyLoginCode(role: UserRole, userId: string, code: string): Promise<boolean> {
    const found = await this.loadProfile(role, userId);
    if (!found?.entity.twoFaEnabled || !found.entity.twoFaSecret) return false;
    return authenticator.check(code, found.entity.twoFaSecret);
  }
}
