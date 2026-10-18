/* ============================================================
 * FICHIER : src/modules/contact-directory/contact-directory.service.ts
 * MODULE : ContactDirectoryModule
 * ROLE : transformer des comptes (users.id) en « cartes » d'annuaire de la
 *        messagerie : profil à ouvrir (type + id), nom et photo publics.
 * RESPONSABILITES :
 *   - une requête par type de profil (pas de N+1), quel que soit le nombre
 *     de comptes demandés ;
 *   - ne renvoyer QUE des comptes actifs (ni suspendus, ni bannis, ni
 *     supprimés : softDelete exclu par TypeORM) ;
 *   - même format que GET /messagerie/users/search (id, type, name, logo),
 *     pour que l'application ouvre la discussion comme ailleurs
 *     (POST /messagerie/conversations { targetType, targetId }).
 * DEPENDANCES : TypeORM (User + profils)
 * AUTEUR : Shopi03
 * DERNIERE MISE A JOUR : 2026-10-18
 * ============================================================ */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { UserRole } from 'src/common/enums/user-role.enum';
import { User, UserStatus } from 'src/database/entities/user.entity';
import { Client } from 'src/database/entities/profiles/client-profile.entity';
import { Company } from 'src/database/entities/profiles/entreprise-profile.entity';
import { Delivery } from 'src/database/entities/profiles/livreur-profile.entity';
import { Correspondent } from 'src/database/entities/profiles/correspondant-profile.entity';
import { Partner } from 'src/database/entities/profiles/partenaire-profile.entity';

/** Type d'acteur de la messagerie (valeurs de ConversationActorType). */
export type DirectoryActorType = 'client' | 'company' | 'delivery' | 'correspondent' | 'partner';

export interface DirectoryCard {
  userId: string;
  /** Profil à ouvrir dans la messagerie */
  type:   DirectoryActorType;
  id:     string;
  /** Nom public sur Shoneya (boutique : nom commercial) */
  name:   string;
  /** Photo de profil ou logo */
  logo:   string | null;
}

const ROLE_TO_TYPE: Partial<Record<UserRole, DirectoryActorType>> = {
  [UserRole.CLIENT]:        'client',
  [UserRole.COMPANY]:       'company',
  [UserRole.DELIVERY]:      'delivery',
  [UserRole.CORRESPONDENT]: 'correspondent',
  [UserRole.PARTNER]:       'partner',
};

@Injectable()
export class ContactDirectoryService {
  constructor(
    @InjectRepository(User)          private readonly userRepo:     Repository<User>,
    @InjectRepository(Client)        private readonly clientRepo:   Repository<Client>,
    @InjectRepository(Company)       private readonly companyRepo:  Repository<Company>,
    @InjectRepository(Delivery)      private readonly deliveryRepo: Repository<Delivery>,
    @InjectRepository(Correspondent) private readonly corrRepo:     Repository<Correspondent>,
    @InjectRepository(Partner)       private readonly partnerRepo:  Repository<Partner>,
  ) {}

  /** Cartes des comptes ACTIFS parmi `userIds` (clé : users.id). Les comptes
   *  sans profil joignable (admins, collaborateurs d'entreprise…) sont omis. */
  async cardsFor(userIds: string[]): Promise<Map<string, DirectoryCard>> {
    const out = new Map<string, DirectoryCard>();
    const ids = [...new Set(userIds.filter(Boolean))];
    if (ids.length === 0) return out;

    const users = await this.userRepo.find({
      where:  { id: In(ids), status: UserStatus.ACTIVE },
      select: ['id', 'role', 'firstName', 'lastName', 'profilePicture'] as (keyof User)[],
    });
    const byRole = new Map<DirectoryActorType, User[]>();
    for (const u of users) {
      const t = ROLE_TO_TYPE[u.role];
      if (!t) continue;
      byRole.set(t, [...(byRole.get(t) ?? []), u]);
    }
    const person = (u: User) => `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || 'Utilisateur';
    const photo = (u: User) => ((u as unknown as { profilePicture?: string | null }).profilePicture ?? null);

    const clients = byRole.get('client') ?? [];
    if (clients.length) {
      const rows = await this.clientRepo.find({ where: { userId: In(clients.map(u => u.id)) }, select: ['id', 'userId'] });
      const map = new Map(rows.map(r => [r.userId, r.id]));
      for (const u of clients) {
        const pid = map.get(u.id);
        if (pid) out.set(u.id, { userId: u.id, type: 'client', id: pid, name: person(u), logo: photo(u) });
      }
    }

    const companies = byRole.get('company') ?? [];
    if (companies.length) {
      const rows = await this.companyRepo.find({ where: { userId: In(companies.map(u => u.id)) }, select: ['id', 'userId', 'companyName', 'logo'] });
      const map = new Map(rows.map(r => [r.userId, r]));
      for (const u of companies) {
        const c = map.get(u.id);
        if (c) out.set(u.id, { userId: u.id, type: 'company', id: c.id, name: c.companyName || person(u), logo: c.logo ?? null });
      }
    }

    const drivers = byRole.get('delivery') ?? [];
    if (drivers.length) {
      const rows = await this.deliveryRepo.find({ where: { userId: In(drivers.map(u => u.id)) }, select: ['id', 'userId', 'fullName', 'photoUrl'] });
      const map = new Map(rows.map(r => [r.userId, r]));
      for (const u of drivers) {
        const d = map.get(u.id);
        if (d) out.set(u.id, { userId: u.id, type: 'delivery', id: d.id, name: d.fullName || person(u), logo: d.photoUrl ?? photo(u) });
      }
    }

    const relays = byRole.get('correspondent') ?? [];
    if (relays.length) {
      const rows = await this.corrRepo.find({ where: { userId: In(relays.map(u => u.id)) }, select: ['id', 'userId'] });
      const map = new Map(rows.map(r => [r.userId, r.id]));
      for (const u of relays) {
        const pid = map.get(u.id);
        if (pid) out.set(u.id, { userId: u.id, type: 'correspondent', id: pid, name: person(u), logo: photo(u) });
      }
    }

    const partners = byRole.get('partner') ?? [];
    if (partners.length) {
      const rows = await this.partnerRepo.find({ where: { userId: In(partners.map(u => u.id)) }, select: ['id', 'userId'] });
      const map = new Map(rows.map(r => [r.userId, r.id]));
      for (const u of partners) {
        const pid = map.get(u.id);
        if (pid) out.set(u.id, { userId: u.id, type: 'partner', id: pid, name: person(u), logo: photo(u) });
      }
    }

    return out;
  }
}
