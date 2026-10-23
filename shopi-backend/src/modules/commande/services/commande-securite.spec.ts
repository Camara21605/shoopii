/* ============================================================
 * FICHIER : src/modules/commande/services/commande-securite.spec.ts
 * RÔLE    : Règles de sécurité du parcours commande / livraison :
 *   - notation : seulement le client, seulement une commande LIVRÉE,
 *     une note par rôle ;
 *   - signalement : refusé sur une commande annulée / remboursée,
 *     description transmise à la boutique ;
 *   - validation d'étape : jamais sur une commande annulée ;
 *   - changer de livreur : jamais une fois livrée ni après la prise du colis,
 *     et le client ne remplace pas un livreur qui a accepté.
 * ============================================================ */

import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { CommandeFeedbackService } from './commande-feedback.service';
import { CommandeLivreurAssignmentService } from './commande-livreur-assignment.service';
import { CommandeValidationService } from './commande-validation.service';
import { CommandeStatus, LivreurAssignmentStatus } from '../../../database/entities/commande/commande.entity';
import { CodeActeurType, CodeCommandeStatus } from '../../../database/entities/commande/commande-code.entity';

const repo = () => ({
  findOne: jest.fn(), find: jest.fn().mockResolvedValue([]), save: jest.fn(async (x: unknown) => x),
  create: jest.fn((x: unknown) => x), update: jest.fn(), count: jest.fn().mockResolvedValue(0),
});
const notif = () => ({
  notifyOrderStatusChanged: jest.fn(), notifyReviewReceived: jest.fn(),
  notifyLivreurReviewReceived: jest.fn(), notifyCorrespondantReviewReceived: jest.fn(),
});
const client = { id: 'user-client', firstName: 'Awa', lastName: 'Diallo', actorId: 'client-1' } as any;

function feedback() {
  const r = { commande: repo(), company: repo(), delivery: repo(), corr: repo(), client: repo(), avis: repo(), lavis: repo(), cavis: repo() };
  const n = notif();
  const svc = new CommandeFeedbackService(r.commande as any, r.company as any, r.delivery as any, r.corr as any,
    r.client as any, r.avis as any, r.lavis as any, r.cavis as any, n as any);
  return { svc, r, n };
}

describe('Notation des acteurs', () => {
  it('refusée tant que la commande n’est pas livrée', async () => {
    const { svc, r } = feedback();
    r.commande.findOne.mockResolvedValue({ id: 'c1', clientId: 'client-1', companyId: 'co1', status: CommandeStatus.IN_PROGRESS });
    await expect(svc.envoyerNotations('c1', client, { notes: [{ role: 'entreprise', note: 5 }] }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(r.avis.save).not.toHaveBeenCalled();
  });

  it('refusée à quelqu’un d’autre que le client de la commande', async () => {
    const { svc, r } = feedback();
    r.commande.findOne.mockResolvedValue({ id: 'c1', clientId: 'autre-client', status: CommandeStatus.DELIVERED });
    await expect(svc.envoyerNotations('c1', client, { notes: [{ role: 'entreprise', note: 5 }] }))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('commande livrée : un seul avis par rôle, même si la note est envoyée deux fois', async () => {
    const { svc, r } = feedback();
    r.commande.findOne.mockResolvedValue({ id: 'c1', clientId: 'client-1', companyId: 'co1', status: CommandeStatus.DELIVERED });
    r.company.findOne.mockResolvedValue({ id: 'co1', allowReviews: true, averageRating: 0, totalRatings: 0 });
    r.avis.findOne.mockResolvedValue(null);
    await svc.envoyerNotations('c1', client, { notes: [{ role: 'entreprise', note: 5 }, { role: 'entreprise', note: 1 }] });
    expect(r.avis.save).toHaveBeenCalledTimes(1);
    expect(r.avis.create).toHaveBeenCalledWith(expect.objectContaining({ note: 5 }));
  });
});

describe('Signaler un problème', () => {
  it('refusé sur une commande annulée', async () => {
    const { svc, r } = feedback();
    r.commande.findOne.mockResolvedValue({ id: 'c1', clientId: 'client-1', companyId: 'co1', status: CommandeStatus.CANCELLED });
    await expect(svc.signalerProbleme('c1', client, { type: 'retard', description: 'x' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('la description est transmise à la boutique', async () => {
    const { svc, r, n } = feedback();
    r.commande.findOne.mockResolvedValue({ id: 'c1', numero: 'CMD-1', clientId: 'client-1', companyId: 'co1', status: CommandeStatus.IN_PROGRESS });
    await svc.signalerProbleme('c1', client, { type: 'endommage', description: 'Carton écrasé' });
    expect(n.notifyOrderStatusChanged).toHaveBeenCalledWith(expect.objectContaining({
      title: expect.stringContaining('Colis endommagé'), body: expect.stringContaining('Carton écrasé'),
    }));
  });
});

describe('Validation d’une étape', () => {
  it('jamais sur une commande annulée', async () => {
    const commandeRepo = repo();
    commandeRepo.findOne.mockResolvedValue({ id: 'c1', status: CommandeStatus.CANCELLED, codes: [] });
    const svc = new CommandeValidationService(commandeRepo as any, repo() as any, notif() as any, {} as any, {} as any);
    await expect(svc.validerEtape('c1', client, { role: 'client', code: 'ABC123' })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('Changer de livreur', () => {
  function assignment() {
    const r = { commande: repo(), code: repo(), delivery: repo(), client: repo(), company: repo() };
    r.client.findOne.mockResolvedValue({ id: 'client-1' });
    const svc = new CommandeLivreurAssignmentService(r.commande as any, r.code as any, r.delivery as any, r.client as any, r.company as any, notif() as any);
    return { svc, r };
  }

  it('le client ne remplace pas un livreur qui a accepté', async () => {
    const { svc, r } = assignment();
    r.commande.findOne.mockResolvedValue({ id: 'c1', clientId: 'client-1', status: CommandeStatus.IN_PROGRESS, livreurAssignmentStatus: LivreurAssignmentStatus.ACCEPTED });
    await expect(svc.assignerParClient(client, 'c1', 'l2')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('jamais sur une commande livrée', async () => {
    const { svc, r } = assignment();
    r.commande.findOne.mockResolvedValue({ id: 'c1', clientId: 'client-1', status: CommandeStatus.DELIVERED, livreurAssignmentStatus: LivreurAssignmentStatus.REFUSED });
    await expect(svc.assignerParClient(client, 'c1', 'l2')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('jamais après la prise du colis par le livreur', async () => {
    const { svc, r } = assignment();
    r.commande.findOne.mockResolvedValue({ id: 'c1', clientId: 'client-1', status: CommandeStatus.IN_PROGRESS, livreurAssignmentStatus: LivreurAssignmentStatus.REFUSED });
    r.code.findOne.mockResolvedValue({ acteurType: CodeActeurType.LIVREUR, status: CodeCommandeStatus.VALIDATED });
    await expect(svc.assignerParClient(client, 'c1', 'l2')).rejects.toBeInstanceOf(BadRequestException);
    expect(r.delivery.findOne).not.toHaveBeenCalled();
  });
});
