/* ============================================================
 * FICHIER : src/modules/dashboard/super-admin/services/platform-settings.service.ts
 *
 * RÔLE    : Lire et mettre à jour la configuration globale Shopi.
 *           Pattern singleton : la table `platform_settings`
 *           contient toujours exactement une ligne (id = 1).
 *           Si elle n'existe pas encore, elle est créée avec
 *           les valeurs par défaut au premier GET.
 * ============================================================ */

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository }  from '@nestjs/typeorm';
import { Repository }        from 'typeorm';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

import { PlatformSettings } from '../../../../database/entities/platform-settings.entity';

/* ── DTO ────────────────────────────────────────────────────── */
export class UpdatePlatformSettingsDto {
  @IsOptional() @IsBoolean()
  emailVerifRequired?: boolean;

  @IsOptional() @IsBoolean()
  adminTwoFaRequired?: boolean;

  @IsOptional() @IsInt() @Min(1) @Max(20) @Type(() => Number)
  maxLoginAttempts?: number;

  @IsOptional() @IsBoolean()
  openSignup?: boolean;

  @IsOptional() @IsBoolean()
  codeRequiredForCompany?: boolean;

  @IsOptional() @IsBoolean()
  kycRequired?: boolean;

  @IsOptional() @IsBoolean()
  maintenanceMode?: boolean;

  @IsOptional() @IsNumber() @Min(0) @Max(50) @Type(() => Number)
  platformCommission?: number;

  @IsOptional() @IsString()
  timezone?: string;
}

/* ═══════════════════════════════════════════════════════════ */

@Injectable()
export class PlatformSettingsService {

  private readonly logger = new Logger(PlatformSettingsService.name);

  constructor(
    @InjectRepository(PlatformSettings)
    private readonly repo: Repository<PlatformSettings>,
  ) {}

  /* ──────────────────────────────────────────────────────────
   * GET — Récupère la configuration (ou la crée si absente)
   * ────────────────────────────────────────────────────────── */
  async getSettings(): Promise<PlatformSettings> {
    let settings = await this.repo.findOne({ where: { id: 1 } });
    if (!settings) {
      /* Première utilisation → initialise avec les valeurs par défaut */
      settings = this.repo.create({ id: 1 });
      settings = await this.repo.save(settings);
      this.logger.log('[SETTINGS] Initialisation des paramètres plateforme (première utilisation).');
    }
    return settings;
  }

  /* ──────────────────────────────────────────────────────────
   * PATCH — Met à jour un sous-ensemble de paramètres
   *
   * Seuls les champs présents dans le DTO sont modifiés.
   * ────────────────────────────────────────────────────────── */
  async updateSettings(dto: UpdatePlatformSettingsDto): Promise<PlatformSettings> {
    const settings = await this.getSettings();

    /* Validation métier : commission entre 0 et 50 */
    if (dto.platformCommission !== undefined) {
      if (dto.platformCommission < 0 || dto.platformCommission > 50) {
        throw new BadRequestException('La commission doit être comprise entre 0 % et 50 %.');
      }
      settings.platformCommission = dto.platformCommission;
    }

    /* Validation maxLoginAttempts */
    if (dto.maxLoginAttempts !== undefined) {
      if (dto.maxLoginAttempts < 1 || dto.maxLoginAttempts > 20) {
        throw new BadRequestException('Le nombre de tentatives doit être entre 1 et 20.');
      }
      settings.maxLoginAttempts = dto.maxLoginAttempts;
    }

    /* Champs booléens */
    if (dto.emailVerifRequired     !== undefined) settings.emailVerifRequired     = dto.emailVerifRequired;
    if (dto.adminTwoFaRequired     !== undefined) settings.adminTwoFaRequired     = dto.adminTwoFaRequired;
    if (dto.openSignup             !== undefined) settings.openSignup             = dto.openSignup;
    if (dto.codeRequiredForCompany !== undefined) settings.codeRequiredForCompany = dto.codeRequiredForCompany;
    if (dto.kycRequired            !== undefined) settings.kycRequired            = dto.kycRequired;
    if (dto.maintenanceMode        !== undefined) settings.maintenanceMode        = dto.maintenanceMode;
    if (dto.timezone               !== undefined) settings.timezone               = dto.timezone;

    const updated = await this.repo.save(settings);

    this.logger.log(
      `[SETTINGS] Mis à jour — maintenance=${updated.maintenanceMode} | commission=${updated.platformCommission}%`,
    );
    return updated;
  }
}
