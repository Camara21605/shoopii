/* ============================================================
 * FICHIER : src/common/guards/optional-jwt.guard.ts
 *
 * Guard JWT OPTIONNEL :
 *   - Token présent et valide → req.user hydraté normalement
 *   - Token absent ou invalide → req.user = undefined (PAS d'erreur)
 *
 * Utilisé sur les routes publiques qui ont besoin de connaître
 * l'utilisateur connecté SI disponible
 * (ex: isSuivi sur les cards, profil correspondant).
 * ============================================================ */

import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard }                    from '@nestjs/passport';
import { Observable }                   from 'rxjs';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {

  /**
   * ✅ On laisse Passport tenter l'authentification (pour hydrater
   *    req.user si un token valide est présent), MAIS on garantit
   *    que la route reste accessible quoi qu'il arrive.
   *
   *    On enveloppe l'appel parent : qu'il réussisse, échoue ou
   *    rejette, on renvoie toujours `true` → la requête continue.
   *    C'est handleRequest() qui décidera de la valeur de req.user.
   */
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const result = super.canActivate(context);

    /* super.canActivate peut renvoyer un boolean, une Promise ou un Observable.
       On normalise tout en Promise<true> pour ne jamais bloquer la route. */
    if (result instanceof Promise) {
      return result.then(() => true).catch(() => true);
    }
    if (result instanceof Observable) {
      /* Conversion simple : on ignore l'erreur, on autorise toujours */
      return new Promise<boolean>(resolve => {
        result.subscribe({
          next:     () => resolve(true),
          error:    () => resolve(true),
          complete: () => resolve(true),
        });
      });
    }
    /* boolean direct */
    return true;
  }

  /**
   * ✅ Token absent/invalide → on renvoie undefined au lieu de throw.
   *    Token valide → on renvoie le user (req.user sera hydraté).
   *
   *    ⚠️ On NE relance JAMAIS l'erreur ici (pas de `throw err`),
   *    sinon la route ne serait plus optionnelle.
   */
  handleRequest(_err: any, user: any) {
    return user || undefined;   // undefined = visiteur anonyme accepté
  }
}