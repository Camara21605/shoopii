/* ============================================================
 * FICHIER : src/modules/wallet/wallet.module.ts
 * ============================================================ */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Wallet }               from 'src/database/entities/wallet.entity';
import { WalletTransaction }    from 'src/database/entities/wallet-transaction.entity';
import { PaiementDistribution } from 'src/database/entities/paiement/paiement-distribution.entity';
import { Partner }              from 'src/database/entities/profiles/partenaire-profile.entity';

import { WalletController } from './wallet.controller';
import { WalletService }    from './wallet.service';
import { AuthModule }       from '../auth/auth.module';
import { PerformanceModule } from '../performance-engine/performance.module';

@Module({
  imports: [
    /* Partner — garde KYC sur le retrait, voir WalletService.applyOperation() */
    TypeOrmModule.forFeature([Wallet, WalletTransaction, PaiementDistribution, Partner]),
    AuthModule,
    PerformanceModule,
  ],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
