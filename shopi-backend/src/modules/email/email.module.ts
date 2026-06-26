// ============================================================
// FICHIER : mail.module.ts
//
// MODULE : MailModule
//
// Rôle :
//   Déclare et exporte `MailService` pour qu'il soit injectable
//   dans n'importe quel autre module de l'application.
//
// Usage :
//   Importer `MailModule` dans le module qui a besoin d'envoyer
//   des emails, puis injecter `MailService` dans le constructeur.
//
// Pré-requis :
//   `ConfigModule` doit être disponible globalement (forRoot({ isGlobal: true }))
//   OU importé explicitement ici, car MailService dépend de ConfigService.
// ============================================================

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { MailService } from './email.service';

/**
 * Module NestJS dédié à l'envoi d'emails.
 *
 * Design :
 *   - `MailService` est le seul provider : il encapsule toute la logique SMTP.
 *   - `MailService` est exporté pour être injectable dans les autres modules
 *     (ex: `AuthModule`, `UsersModule`…) sans qu'ils aient à connaître
 *     les détails de Nodemailer.
 *   - `ConfigModule` est importé pour garantir que `ConfigService`
 *     est disponible même si l'app ne l'a pas déclaré global.
 *
 * @example
 * // Dans un autre module :
 * @Module({
 *   imports: [MailModule],
 *   providers: [AuthService],
 * })
 * export class AuthModule {}
 *
 * // Dans AuthService :
 * constructor(private readonly mailService: MailService) {}
 */
@Module({
  imports: [
    // Rend ConfigService disponible dans MailService.
    // Si ConfigModule.forRoot({ isGlobal: true }) est déjà appelé dans AppModule,
    // cet import est redondant mais inoffensif.
    ConfigModule,
  ],
  providers: [MailService],
  exports:   [MailService], // ← Rend MailService injectable hors de ce module
})
export class MailModule {}