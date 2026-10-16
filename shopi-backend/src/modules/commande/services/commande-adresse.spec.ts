import { BadRequestException } from '@nestjs/common';
import { CommandeCreationService } from './commande-creation.service';

type Resolver = { resoudreAdresseLivraison(userId: string, dto: Record<string, unknown>): Promise<Record<string, unknown>> };

function monter(found: unknown) {
  const localisationRepo = { findOne: jest.fn().mockResolvedValue(found) };
  const svc = Object.assign(Object.create(CommandeCreationService.prototype), { localisationRepo }) as unknown as Resolver;
  return { svc, localisationRepo };
}

describe('Adresse de livraison figée dans la commande', () => {
  it('adresse enregistrée : référentiel + GPS du serveur, appartenant au client', async () => {
    const { svc, localisationRepo } = monter({
      ville: 'Conakry', commune: 'Ratoma', quartier: 'Kipé', rue: 'Près de la mosquée',
      latitude: 9.6412, longitude: -13.6201, telephone: '+224620000000', instructions: 'Portail bleu',
    });
    const r = await svc.resoudreAdresseLivraison('u1', { adresseId: 'a1', villeLivraison: 'Autre', latitudeLivraison: 1, longitudeLivraison: 1 });
    expect(localisationRepo.findOne).toHaveBeenCalledWith({ where: { id: 'a1', userId: 'u1' } });
    expect(r).toMatchObject({
      villeLivraison: 'Conakry', communeLivraison: 'Ratoma', quartierLivraison: 'Kipé',
      adresseLivraison: 'Près de la mosquée', latitudeLivraison: 9.6412, longitudeLivraison: -13.6201,
      telephoneLivraison: '+224620000000', notesClient: 'Portail bleu',
    });
  });

  it("adresse d'un autre compte : refusée", async () => {
    const { svc } = monter(null);
    await expect(svc.resoudreAdresseLivraison('u1', { adresseId: 'x' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('saisie libre : nettoyée, GPS invalide ignoré', async () => {
    const { svc } = monter(null);
    const r = await svc.resoudreAdresseLivraison('u1', {
      villeLivraison: '  Conakry ', quartierLivraison: 'Kipé', latitudeLivraison: 0, longitudeLivraison: -13.6,
    });
    expect(r).toMatchObject({ villeLivraison: 'Conakry', quartierLivraison: 'Kipé', latitudeLivraison: null, longitudeLivraison: null });
  });
});
