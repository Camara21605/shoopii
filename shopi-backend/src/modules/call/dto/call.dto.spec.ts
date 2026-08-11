/* ============================================================
 * FICHIER      : src/modules/call/dto/call.dto.spec.ts
 * RÔLE         : Preuve que la validation runtime de CallHistoryQueryDto
 *                (GET /calls/history?page=&limit=) fonctionne réellement
 *                (partie 9 — bornes ajoutées à la pagination).
 *
 * Utilise plainToInstance + validate() de class-validator/class-
 * transformer DIRECTEMENT — exactement ce que fait le ValidationPipe
 * global de main.ts en coulisses (transform + whitelist +
 * forbidNonWhitelisted + enableImplicitConversion).
 *
 * COUVERTURE :
 *   ✅ absent → défauts (page=1, limit=20) après transform
 *   ✅ valeurs valides → acceptées telles quelles
 *   ✅ limit > 50 → rejeté (plafond anti-payload disproportionné)
 *   ✅ page/limit < 1 → rejeté
 *   ✅ valeur non numérique → rejetée (au lieu d'un NaN silencieux)
 *   ✅ champ inconnu → rejeté (whitelist)
 * ============================================================ */

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CallHistoryQueryDto } from './call.dto';

const VALIDATOR_OPTIONS = { whitelist: true, forbidNonWhitelisted: true };

describe('CallHistoryQueryDto', () => {
  it('payload absent → défauts page=1, limit=20 appliqués', async () => {
    const dto = plainToInstance(CallHistoryQueryDto, {}, { enableImplicitConversion: true });
    expect(await validate(dto, VALIDATOR_OPTIONS)).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
  });

  it('page/limit valides (chaînes de query string) → converties en nombres, acceptées', async () => {
    const dto = plainToInstance(CallHistoryQueryDto, { page: '3', limit: '50' }, { enableImplicitConversion: true });
    expect(await validate(dto, VALIDATOR_OPTIONS)).toHaveLength(0);
    expect(dto.page).toBe(3);
    expect(dto.limit).toBe(50);
  });

  it('limit > 50 → rejeté (plafond anti-payload disproportionné)', async () => {
    const dto = plainToInstance(CallHistoryQueryDto, { limit: '999999' }, { enableImplicitConversion: true });
    const errors = await validate(dto, VALIDATOR_OPTIONS);
    expect(errors.some(e => e.property === 'limit')).toBe(true);
  });

  it('page < 1 → rejeté', async () => {
    const dto = plainToInstance(CallHistoryQueryDto, { page: '0' }, { enableImplicitConversion: true });
    const errors = await validate(dto, VALIDATOR_OPTIONS);
    expect(errors.some(e => e.property === 'page')).toBe(true);
  });

  it('limit < 1 → rejeté', async () => {
    const dto = plainToInstance(CallHistoryQueryDto, { limit: '0' }, { enableImplicitConversion: true });
    const errors = await validate(dto, VALIDATOR_OPTIONS);
    expect(errors.some(e => e.property === 'limit')).toBe(true);
  });

  it('valeur non numérique → rejetée (pas de NaN silencieux transmis à TypeORM skip/take)', async () => {
    const dto = plainToInstance(CallHistoryQueryDto, { page: 'abc' }, { enableImplicitConversion: true });
    const errors = await validate(dto, VALIDATOR_OPTIONS);
    expect(errors.some(e => e.property === 'page')).toBe(true);
  });

  it('champ inconnu → rejeté (whitelist)', async () => {
    const dto = plainToInstance(CallHistoryQueryDto, { page: '1', evil: 'x' }, { enableImplicitConversion: true });
    const errors = await validate(dto, VALIDATOR_OPTIONS);
    expect(errors.length).toBeGreaterThan(0);
  });
});
