/* ============================================================
 * FICHIER      : src/config/env.config.ts
 * MODULE       : Config
 * ROLE         : Validation et typage des variables d'environnement.
 *
 * RESPONSABILITES (à implémenter) :
 *   - Définir un schéma de validation (Joi ou Zod) pour toutes les variables requises.
 *   - Faire crasher l'application AU DÉMARRAGE si une variable critique est absente,
 *     avec un message explicite indiquant quelle variable manque et comment la définir.
 *
 * ÉTAT ACTUEL :
 *   Ce fichier est un placeholder vide. La validation env n'est pas encore implémentée.
 *   La configuration JWT est définie directement dans src/modules/auth/auth.module.ts.
 *   La validation DATABASE_URL est faite dans database.config.ts (throw manuel).
 *
 * POURQUOI IMPLÉMENTER CE FICHIER :
 *   Sans validation centralisée, une variable manquante cause un crash tardif
 *   avec un message cryptique (ex: "Cannot read property of undefined").
 *   Avec Joi/Zod, le message serait : "Missing required env var: REDIS_PASSWORD".
 *
 * EXEMPLE D'IMPLÉMENTATION (Joi) :
 *   import * as Joi from 'joi';
 *   export const envValidationSchema = Joi.object({
 *     NODE_ENV:               Joi.string().valid('development','production','test').required(),
 *     DATABASE_URL:           Joi.string().uri().required(),
 *     JWT_SECRET:             Joi.string().min(32).required(),
 *     JWT_REFRESH_SECRET:     Joi.string().min(32).required(),
 *     REDIS_HOST:             Joi.string().default('127.0.0.1'),
 *     CLOUDINARY_CLOUD_NAME:  Joi.string().required(),
 *     CLOUDINARY_API_KEY:     Joi.string().required(),
 *     CLOUDINARY_API_SECRET:  Joi.string().required(),
 *   });
 *
 *   // Dans AppModule :
 *   ConfigModule.forRoot({ validationSchema: envValidationSchema })
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */
