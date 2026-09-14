/* ============================================================
 * FICHIER : src/modules/auth/twofa/twofa.module.ts
 *
 * TwoFaService extrait dans son propre module (au lieu de rester
 * un provider interne à AuthModule) pour que les 6 modules de
 * paramètres par rôle (client/entreprise/livreur/partenaire/
 * correspondant/super-admin) puissent l'importer directement,
 * sans dépendre de tout AuthModule (JwtModule, MailModule,
 * SessionModule, etc. — inutile ici et risque de dépendances
 * circulaires avec ces modules dashboard).
 * ============================================================ */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TwoFaService } from './twofa.service';

import { User }          from '../../../database/entities/user.entity';
import { Admin }         from '../../../database/entities/profiles/admin-profile.entity';
import { Partner }       from '../../../database/entities/profiles/partenaire-profile.entity';
import { Company }       from '../../../database/entities/profiles/entreprise-profile.entity';
import { Delivery }      from '../../../database/entities/profiles/livreur-profile.entity';
import { Correspondent } from '../../../database/entities/profiles/correspondant-profile.entity';
import { Client }        from '../../../database/entities/profiles/client-profile.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Admin, Partner, Company, Delivery, Correspondent, Client]),
  ],
  providers: [TwoFaService],
  exports: [TwoFaService],
})
export class TwoFaModule {}
