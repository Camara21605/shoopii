/* ============================================================
 * FICHIER : src/modules/dashboard/client/client-public-profil.service.ts
 *
 * RÔLE : Profil public d'UN client, tel que consulté par un autre
 *        utilisateur (@Controller('client/profils') dans
 *        client-public-profil.controller.ts).
 *
 * Respecte Client.privacySettings (section "Confidentialité du
 * profil" des paramètres du compte) :
 *   - visibilite: 'public' | 'members' | 'nobody' (défaut 'public')
 *     → 'nobody' : personne d'autre que le client lui-même ne peut
 *       consulter ce profil (404, pas de fuite d'existence).
 *     → 'members' : requiert un visiteur authentifié (n'importe quel
 *       rôle) ; visiteur anonyme → 404.
 *     → 'public' : accessible à tous, y compris anonyme.
 *   - historique: inclut ou non le nombre de commandes complétées.
 *   - wishlist: inclut ou non la liste de souhaits (voir WishlistService).
 * ============================================================ */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Client }   from '../../../database/entities/profiles/client-profile.entity';
import { Commande, CommandeStatus } from '../../../database/entities/commande/commande.entity';
import { WishlistService } from './services/wishlist.service';

export interface ClientPublicProfilResponse {
  id:           string;
  nom:          string;
  initiales:    string;
  avatar:       string | null;
  bio:          string | null;
  membreDepuis: string;
  commandesCount?: number;
  wishlist?:  Awaited<ReturnType<WishlistService['getAllForClient']>>;
}

@Injectable()
export class ClientPublicProfilService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,

    @InjectRepository(Commande)
    private readonly commandeRepo: Repository<Commande>,

    private readonly wishlistService: WishlistService,
  ) {}

  async getProfil(id: string, viewerUserId?: string): Promise<ClientPublicProfilResponse> {
    const target = await this.clientRepo.findOne({ where: { id }, relations: ['user'] });
    if (!target) throw new NotFoundException('Profil introuvable.');

    const isOwnProfile = !!viewerUserId && viewerUserId === target.userId;
    const privacy = this.parsePrivacy(target.privacySettings);

    if (!isOwnProfile) {
      if (privacy.visibilite === 'nobody') throw new NotFoundException('Profil introuvable.');
      if (privacy.visibilite === 'members' && !viewerUserId) throw new NotFoundException('Profil introuvable.');
    }

    const u   = target.user;
    const nom = target.fullName || `${u?.firstName ?? ''} ${u?.lastName ?? ''}`.trim() || 'Utilisateur Shopi';

    const response: ClientPublicProfilResponse = {
      id:           target.id,
      nom,
      initiales:    this.initiales(nom),
      avatar:       u?.profilePicture ?? null,
      bio:          target.bio,
      membreDepuis: this.membreDepuis(u?.createdAt ?? target.createdAt),
    };

    /* Toujours visibles pour le propriétaire du profil, quel que soit
     * son propre réglage de confidentialité (il ne se cache pas de
     * lui-même). */
    if (isOwnProfile || privacy.historique) {
      response.commandesCount = await this.countCommandesCompletees(target.id);
    }
    if (isOwnProfile || privacy.wishlist) {
      response.wishlist = await this.wishlistService.getAllForClient(target.id);
    }

    return response;
  }

  private parsePrivacy(raw: object | null): { visibilite: string; historique: boolean; wishlist: boolean } {
    const parsed = (raw ?? {}) as Record<string, unknown>;
    return {
      visibilite: typeof parsed.visibilite === 'string' ? parsed.visibilite : 'public',
      historique: parsed.historique === true,
      wishlist:   parsed.wishlist !== false, // défaut true, cohérent avec defaultPrivacy côté frontend
    };
  }

  private async countCommandesCompletees(clientId: string): Promise<number> {
    return this.commandeRepo.count({
      where: { clientId, status: In([CommandeStatus.DELIVERED, CommandeStatus.AUTO_DELIVERED]) },
    });
  }

  private initiales(nom: string): string {
    const p = nom.trim().split(/\s+/);
    return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || 'CL';
  }

  private membreDepuis(createdAt?: Date): string {
    if (!createdAt) return 'Membre Shopi';
    const d = new Date(createdAt);
    const mois = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
    return `Membre depuis ${mois}. ${d.getFullYear()}`;
  }
}
