
/* ============================================================
 * src/modules/dashboard/client/services/activite.service.ts
 * Section 7 — Journal d'activité
 * ============================================================ */

import { Injectable as Inj4 } from '@nestjs/common';
import { InjectRepository as IR4 } from '@nestjs/typeorm';
import { Repository as Repo4 }     from 'typeorm';
import { User as U4 }              from '../../../../database/entities/user.entity';
import { Client as CP4 }    from '../../../../database/entities/profiles/client-profile.entity';

@Inj4()
export class ActiviteService {
  constructor(
    @IR4(CP4) private readonly clientRepo: Repo4<CP4>,
  ) {}

  async get(user: U4, limit = 20) {
    const profile = await this.clientRepo.findOne({ where: { userId: user.id } });
    try {
      const logs: any[] = JSON.parse((profile as any)?.activityLog ?? '[]');
      return logs.slice(0, limit);
    } catch { return []; }
  }

  async export(user: U4): Promise<{ message: string }> {
    /* En production : génère un CSV/JSON et envoie par email */
    return { message: 'Export du journal en cours. Vous recevrez un email dans quelques minutes.' };
  }
}