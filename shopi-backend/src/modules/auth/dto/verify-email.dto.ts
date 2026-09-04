/* ============================================================
 * FICHIER : src/modules/auth/dto/verify-email.dto.ts
 *
 *  ├── VerifyEmailDto            → POST /auth/verify-email
 *  └── ResendVerificationDto     → POST /auth/resend-verification
 * ============================================================ */

import { IsNotEmpty, IsString, IsUUID, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailDto {
  @ApiProperty({ description: 'userId retourné par register()/login() quand requiresEmailVerification=true' })
  @IsUUID()
  @IsNotEmpty({ message: "L'identifiant du compte est obligatoire." })
  userId: string;

  @ApiProperty({ example: '482931', description: 'Code à 6 chiffres reçu par email' })
  @IsString()
  @IsNotEmpty({ message: 'Le code est obligatoire.' })
  @Length(6, 6, { message: 'Le code doit contenir exactement 6 chiffres.' })
  @Matches(/^\d{6}$/, { message: 'Le code doit être composé uniquement de chiffres.' })
  @Transform(({ value }) => (value as string).trim())
  code: string;
}

export class ResendVerificationDto {
  @ApiProperty({ description: 'userId retourné par register()/login() quand requiresEmailVerification=true' })
  @IsUUID()
  @IsNotEmpty({ message: "L'identifiant du compte est obligatoire." })
  userId: string;
}
