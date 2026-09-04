/* ============================================================
 * FICHIER : src/common/filters/throttler-exception.filter.ts
 *
 * RÔLE : Remplace le message brut de @nestjs/throttler par un texte
 * compréhensible.
 *
 * BUG CORRIGÉ — sans ce filtre, une réponse 429 renvoyait tel quel le
 * message par défaut du package : "ThrottlerException: Too Many
 * Requests", affiché directement à l'utilisateur (voir LoginForm.tsx),
 * y compris sous le titre trompeur "Identifiants incorrects" — rien à
 * voir avec le mot de passe, juste trop de tentatives en peu de temps.
 * ============================================================ */

import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Response } from 'express';

@Catch(ThrottlerException)
export class ThrottlerExceptionFilter implements ExceptionFilter {
  catch(_exception: ThrottlerException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    response.status(HttpStatus.TOO_MANY_REQUESTS).json({
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      message: 'Trop de tentatives en peu de temps. Merci de patienter quelques instants avant de réessayer.',
      error: 'Too Many Requests',
    });
  }
}
