/* ============================================================
 * FICHIER : src/modules/wallet/wallet.controller.ts
 *
 * RÔLE    : Endpoints du Portefeuille (Wallet), accessibles à
 *           tout utilisateur authentifié — chacun gère son
 *           propre portefeuille.
 * ============================================================ */

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from 'src/common/guards/auth.guard';
import { CurrentUser }  from 'src/common/decorators/roles.decorator';
import { User }         from 'src/database/entities/user.entity';

import { WalletService } from './wallet.service';
import {
  AddPaymentMethodDto,
  AutoTransferDto,
  ListWalletTransactionsDto,
  WalletChartQueryDto,
  WalletOperationDto,
} from './dto/wallet.dto';

@ApiTags('💰 Portefeuille')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {

  constructor(private readonly walletService: WalletService) {}

  // ── GET /wallet ────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Résumé du portefeuille (solde, KPI, méthodes)' })
  getSummary(@CurrentUser() user: User) {
    return this.walletService.getSummary(user);
  }

  // ── GET /wallet/transactions ──────────────────────────────────

  @Get('transactions')
  @ApiOperation({ summary: 'Lister les transactions du portefeuille' })
  getTransactions(@Query() dto: ListWalletTransactionsDto, @CurrentUser() user: User) {
    return this.walletService.getTransactions(user, dto);
  }

  // ── GET /wallet/chart ──────────────────────────────────────────

  @Get('chart')
  @ApiOperation({ summary: "Graphique d'évolution des revenus" })
  getChart(@Query() dto: WalletChartQueryDto, @CurrentUser() user: User) {
    return this.walletService.getChart(user, dto);
  }

  // ── POST /wallet/deposit ───────────────────────────────────────

  @Post('deposit')
  @ApiOperation({ summary: 'Déposer des fonds' })
  deposit(@Body() dto: WalletOperationDto, @CurrentUser() user: User) {
    return this.walletService.deposit(user, dto);
  }

  // ── POST /wallet/withdraw ──────────────────────────────────────

  @Post('withdraw')
  @ApiOperation({ summary: 'Retirer des fonds' })
  withdraw(@Body() dto: WalletOperationDto, @CurrentUser() user: User) {
    return this.walletService.withdraw(user, dto);
  }

  // ── POST /wallet/transfer ──────────────────────────────────────

  @Post('transfer')
  @ApiOperation({ summary: 'Transférer des fonds' })
  transfer(@Body() dto: WalletOperationDto, @CurrentUser() user: User) {
    return this.walletService.transfer(user, dto);
  }

  // ── POST /wallet/payment-methods ───────────────────────────────

  @Post('payment-methods')
  @ApiOperation({ summary: 'Ajouter une méthode de paiement' })
  addPaymentMethod(@Body() dto: AddPaymentMethodDto, @CurrentUser() user: User) {
    return this.walletService.addPaymentMethod(user, dto);
  }

  // ── PATCH /wallet/payment-methods/:id/default ──────────────────

  @Patch('payment-methods/:id/default')
  @ApiOperation({ summary: 'Définir la méthode de paiement par défaut' })
  setDefaultPaymentMethod(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.walletService.setDefaultPaymentMethod(user, id);
  }

  // ── DELETE /wallet/payment-methods/:id ─────────────────────────

  @Delete('payment-methods/:id')
  @ApiOperation({ summary: 'Supprimer une méthode de paiement' })
  removePaymentMethod(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.walletService.removePaymentMethod(user, id);
  }

  // ── PATCH /wallet/auto-transfer ─────────────────────────────────

  @Patch('auto-transfer')
  @ApiOperation({ summary: 'Activer/désactiver le virement automatique' })
  setAutoTransfer(@Body() dto: AutoTransferDto, @CurrentUser() user: User) {
    return this.walletService.setAutoTransfer(user, dto);
  }
}
