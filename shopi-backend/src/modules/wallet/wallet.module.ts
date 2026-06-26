/* ============================================================
 * FICHIER : src/modules/wallet/wallet.module.ts
 * ============================================================ */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Wallet }            from 'src/database/entities/wallet.entity';
import { WalletTransaction } from 'src/database/entities/wallet-transaction.entity';

import { WalletController } from './wallet.controller';
import { WalletService }    from './wallet.service';
import { AuthModule }       from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet, WalletTransaction]),
    AuthModule,
  ],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
