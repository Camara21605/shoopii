/* ============================================================
 * FICHIER : src/modules/messagerie/filters/ws-validation.filter.ts
 *
 * RÔLE : Sans ce filtre, une violation de ValidationPipe (payload invalide/
 * incomplet/trop volumineux — voir call-socket.dto.ts) remonte comme une
 * BadRequestException standard, que le WsExceptionsHandler par défaut de
 * NestJS aplatit en {status:'error', message:'Internal server error'} —
 * message générique qui ne permet ni au client de comprendre pourquoi son
 * événement a été rejeté, ni de le distinguer d'une vraie panne serveur
 * (constaté en vérification live sur cette partie).
 *
 * Ce filtre reconnaît spécifiquement les erreurs de validation et renvoie
 * un message exploitable ; toute autre exception retombe sur le
 * comportement par défaut de NestJS (délégation à BaseWsExceptionFilter).
 * Ne change RIEN au comportement de sécurité — le payload invalide est
 * toujours rejeté, seul le message renvoyé au client change.
 * ============================================================ */

import { ArgumentsHost, BadRequestException, Catch, ExceptionFilter } from '@nestjs/common';
import { BaseWsExceptionFilter } from '@nestjs/websockets';
import type { Socket } from 'socket.io';

@Catch(BadRequestException)
export class WsValidationExceptionFilter extends BaseWsExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost): void {
    const client = host.switchToWs().getClient<Socket>();
    const response = exception.getResponse();
    const message = typeof response === 'string'
      ? response
      : (response as { message?: string | string[] }).message ?? 'Payload invalide.';

    client.emit('exception', {
      status:  'error',
      message: 'Payload invalide.',
      details: Array.isArray(message) ? message : [message],
    });
  }
}
