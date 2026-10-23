/* ============================================================
 * FICHIER : src/modules/location/controllers/delivery-location.security.spec.ts
 * RÔLE    : Un livreur ne modifie que SA position et SA zone.
 * ============================================================ */
import { ForbiddenException } from '@nestjs/common';

import { DeliveryLocationController } from './delivery-location.controller';

describe('Position d’un livreur — sécurité', () => {
  const svc = { updatePosition: jest.fn(), updateZone: jest.fn() };
  const ctrl = new DeliveryLocationController(svc as any);
  const moi = { id: 'u1', role: 'delivery', actorId: 'livreur-a' } as any;
  afterEach(() => jest.clearAllMocks());

  it('refuse de modifier la position d’un autre livreur', () => {
    expect(() => ctrl.updatePosition('livreur-b', { latitude: 9.5, longitude: -13.7 } as any, moi)).toThrow(ForbiddenException);
    expect(svc.updatePosition).not.toHaveBeenCalled();
  });

  it('refuse de modifier la zone d’un autre livreur', () => {
    expect(() => ctrl.updateZone('livreur-b', { ville: 'Conakry' } as any, moi)).toThrow(ForbiddenException);
    expect(svc.updateZone).not.toHaveBeenCalled();
  });

  it('accepte sa propre position', () => {
    ctrl.updatePosition('livreur-a', { latitude: 9.5, longitude: -13.7 } as any, moi);
    expect(svc.updatePosition).toHaveBeenCalledWith('livreur-a', expect.anything());
  });
});
