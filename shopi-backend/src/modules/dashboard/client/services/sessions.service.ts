
/* ============================================================
 * src/modules/dashboard/client/services/sessions.service.ts
 * Section 6 — Appareils connectés (sessions actives)
 * ============================================================ */

import { Injectable as Inj3, Logger as Log3, NotFoundException as NFE3 } from '@nestjs/common';
import { InjectRepository as IR3 } from '@nestjs/typeorm';
import { Repository as Repo3 }     from 'typeorm';
import { User as U3 }              from '../../../../database/entities/user.entity';
import { Client as CP3 }    from '../../../../database/entities/profiles/client-profile.entity';

@Inj3()
export class SessionsService {
  private readonly logger = new Log3(SessionsService.name);

  constructor(
    @IR3(U3)  private readonly userRepo:   Repo3<U3>,
    @IR3(CP3) private readonly clientRepo: Repo3<CP3>,
  ) {}

  /** Sessions stockées en JSON dans client-profile */
  async getAll(user: U3) {
    const profile = await this.clientRepo.findOne({ where: { userId: user.id } });
    try {
      return JSON.parse((profile as any)?.sessions ?? '[]');
    } catch { return []; }
  }

  /** Révoquer une session par son id */
  async revoquer(user: U3, sessionId: string): Promise<{ message: string }> {
    const profile = await this.clientRepo.findOne({ where: { userId: user.id } });
    if (!profile) throw new NFE3('Profil client introuvable.');
    let sessions: any[] = [];
    try { sessions = JSON.parse((profile as any).sessions ?? '[]'); } catch { sessions = []; }
    const before = sessions.length;
    sessions = sessions.filter((s: any) => s.id !== sessionId);
    if (sessions.length === before) throw new NFE3('Session introuvable.');
    (profile as any).sessions = JSON.stringify(sessions);
    await this.clientRepo.save(profile);
    this.logger.warn(`[SESSION RÉVOQUÉE] userId=${user.id} | sessionId=${sessionId}`);
    return { message: 'Session révoquée avec succès.' };
  }

  /** Déconnecter toutes les sessions sauf la session actuelle */
  async revoquerToutes(user: U3): Promise<{ message: string }> {
    const profile = await this.clientRepo.findOne({ where: { userId: user.id } });
    if (!profile) throw new NFE3('Profil client introuvable.');
    /* On garde uniquement la session courante (marquée isCurrent:true) */
    let sessions: any[] = [];
    try { sessions = JSON.parse((profile as any).sessions ?? '[]'); } catch { sessions = []; }
    const current = sessions.filter((s: any) => s.isCurrent);
    (profile as any).sessions = JSON.stringify(current);
    await this.clientRepo.save(profile);
    this.logger.warn(`[TOUTES SESSIONS RÉVOQUÉES] userId=${user.id}`);
    return { message: 'Toutes les autres sessions ont été révoquées.' };
  }
}
