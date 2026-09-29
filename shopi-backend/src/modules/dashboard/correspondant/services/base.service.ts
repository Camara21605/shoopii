/* ============================================================
 * FICHIER : services/base.service.ts
 *
 * Classe de base abstraite partagée entre tous les services
 * des paramètres correspondant.
 *
 * Fournit :
 *   findCorOrFail(userId)  → Correspondent ou 404
 *   findUserOrFail(userId) → User (champs publics) ou 404
 *
 * Tous les services héritent de cette classe via `extends`.
 * Cela évite de dupliquer ces 2 méthodes dans chaque service.
 * ============================================================ */

import { NotFoundException } from '@nestjs/common';
import { Repository }        from 'typeorm';
import { Correspondent }     from '../../../../database/entities/profiles/correspondant-profile.entity';
import { User }              from '../../../../database/entities/user.entity';

/** Colonnes des pièces sensibles (CNI, bail, assurance, casier, registre) — stockées en privé. */
const DOCUMENTS_SENSIBLES = ['documentCni', 'documentBail', 'documentAssurance', 'documentCasier', 'documentRegistre'] as const;

/**
 * SÉCURITÉ — l'identifiant de stockage des pièces sensibles ne quitte jamais le serveur : l'écran
 * n'en utilise que la présence (et demande un lien temporaire via GET documents/:type/url).
 * BUG CORRIGÉ — GET /correspondant/parametres et chaque enregistrement renvoyaient la fiche brute,
 * identifiants compris (même correctif que les comptes entreprise et livreur).
 */
export function masquerDocumentsCorrespondant<T extends Partial<Correspondent>>(c: T): T {
  for (const k of DOCUMENTS_SENSIBLES) if (c[k]) (c as Record<string, unknown>)[k] = '••••••';
  return c;
}

export abstract class CorrespondantBaseService {

  constructor(
    protected readonly corRepo:  Repository<Correspondent>,
    protected readonly userRepo: Repository<User>,
  ) {}

  /**
   * Charge le profil Correspondent à partir du userId JWT.
   * Lève une NotFoundException si le profil n'existe pas.
   */
  protected async findCorOrFail(userId: string): Promise<Correspondent> {
    const cor = await this.corRepo.findOne({ where: { userId } });
    if (!cor) throw new NotFoundException('Profil correspondant introuvable.');
    return cor;
  }

  /**
   * Charge les champs publics de User (identité de base).
   * ⚠️  Ne charge PAS password (select:false) — utiliser QueryBuilder
   *     dans SecuriteService.changePassword() pour cela.
   */
  /**
   * Écrit UNIQUEMENT les colonnes modifiées puis renvoie la fiche à jour (pièces masquées).
   * BUG CORRIGÉ — `save(cor)` réécrivait toute la fiche lue en début de requête : un changement fait
   * entre-temps ailleurs (suspension par une entreprise, compteurs, note…) était remis à l'ancienne
   * valeur dès que le correspondant enregistrait un réglage.
   */
  protected async enregistrer(cor: Correspondent, champs: (keyof Correspondent)[]): Promise<Correspondent> {
    const patch: Record<string, unknown> = {};
    for (const k of champs) patch[k] = cor[k];
    if (champs.length) await this.corRepo.update(cor.id, patch);
    return masquerDocumentsCorrespondant(await this.findCorOrFail(cor.userId));
  }

  protected async findUserOrFail(userId: string): Promise<User> {
    const user = await this.userRepo.findOne({
      where:  { id: userId },
      select: ['id', 'firstName', 'lastName', 'email', 'phone', 'profilePicture'],
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
    return user;
  }
}