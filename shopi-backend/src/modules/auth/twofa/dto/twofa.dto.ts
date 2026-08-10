/* ============================================================
 * FICHIER : src/modules/auth/twofa/dto/twofa.dto.ts
 *
 *  ├── ConfirmTwoFaDto      → POST /auth/2fa/confirm
 *  ├── DisableTwoFaDto      → POST /auth/2fa/disable
 *  └── VerifyTwoFaLoginDto  → POST /auth/2fa/verify-login
 * ============================================================ */

import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ConfirmTwoFaDto {
  @ApiProperty({ example: '482931', description: "Code à 6 chiffres généré par l'application d'authentification" })
  @IsString()
  @IsNotEmpty({ message: 'Le code est obligatoire.' })
  @Length(6, 6, { message: 'Le code doit contenir exactement 6 chiffres.' })
  @Matches(/^\d{6}$/, { message: 'Le code doit être composé uniquement de chiffres.' })
  @Transform(({ value }) => (value as string).trim())
  code: string;
}

export class DisableTwoFaDto {
  @ApiProperty({ description: 'Mot de passe actuel — requis pour désactiver la 2FA' })
  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe actuel est obligatoire.' })
  currentPassword: string;
}

export class VerifyTwoFaLoginDto {
  @ApiProperty({ description: 'challengeToken retourné par POST /auth/login quand requiresTwoFa=true' })
  @IsString()
  @IsNotEmpty({ message: 'Le token de défi est obligatoire.' })
  challengeToken: string;

  @ApiProperty({ example: '482931', description: "Code à 6 chiffres généré par l'application d'authentification" })
  @IsString()
  @IsNotEmpty({ message: 'Le code est obligatoire.' })
  @Length(6, 6, { message: 'Le code doit contenir exactement 6 chiffres.' })
  @Matches(/^\d{6}$/, { message: 'Le code doit être composé uniquement de chiffres.' })
  @Transform(({ value }) => (value as string).trim())
  code: string;
}
