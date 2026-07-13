/* ================================================================
 * FICHIER : src/modules/appearance/appearance.service.ts
 *
 * RÔLE : Gestion CRUD des préférences d'apparence par utilisateur.
 *
 * PATTERN upsert :
 *   - getOrCreate : retourne la ligne existante, ou en crée une
 *     avec les valeurs par défaut si c'est la première connexion.
 *   - update      : met à jour les champs transmis (partial update).
 *   - reset       : remet toutes les valeurs aux défauts Shopi.
 * ================================================================ */

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository }          from 'typeorm';
import { AppearancePreference } from '../../database/entities/appearance-preference.entity';
import { User }                 from '../../database/entities/user.entity';

/* Champs gérables par le DTO (exclus : id, userId, user, timestamps) */
type PrefFields = Omit<AppearancePreference, 'id' | 'userId' | 'user' | 'createdAt' | 'updatedAt'>;

/** Valeurs par défaut du design system Shopi — identiques au frontend */
const DEFAULTS: PrefFields = {
  theme:             'light',
  accentColor:       'blue',
  fontFamily:        'DM Sans',
  fontScale:         'normal',
  density:           'normal',
  borderRadius:      'medium',
  sidebarCollapsed:  false,
  animationsEnabled: true,
  highContrast:      false,
  reduceMotion:      false,
};

/* ═══════════════════════════════════════════════════════════════════
 * SERVICE
 * ═══════════════════════════════════════════════════════════════════ */
@Injectable()
export class AppearanceService {

  private readonly logger = new Logger(AppearanceService.name);

  constructor(
    @InjectRepository(AppearancePreference)
    private readonly prefRepo: Repository<AppearancePreference>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /* ──────────────────────────────────────────────────────────────
   * GET — Charger ou initialiser les préférences
   *
   * Si l'utilisateur n'a jamais personnalisé son apparence,
   * une ligne avec les valeurs par défaut est créée en base.
   * ────────────────────────────────────────────────────────────── */
  async getOrCreate(userId: string): Promise<AppearancePreference> {
    /* Vérifier que l'utilisateur existe avant d'opérer */
    const userExists = await this.userRepo.exists({ where: { id: userId } });
    if (!userExists) throw new NotFoundException('Utilisateur introuvable.');

    let prefs = await this.prefRepo.findOne({ where: { userId } });

    if (!prefs) {
      /* Première visite → initialiser avec les defaults */
      prefs = this.prefRepo.create({ ...DEFAULTS, userId });
      prefs = await this.prefRepo.save(prefs);
      this.logger.log(`[APPARENCE] Préférences initialisées pour userId=${userId}`);
    }

    return prefs;
  }

  /* ──────────────────────────────────────────────────────────────
   * PUT — Mettre à jour tout ou partie des préférences
   *
   * Utilise un upsert : si la ligne n'existe pas encore, elle est
   * créée avec les defaults puis écrasée par les champs transmis.
   * ────────────────────────────────────────────────────────────── */
  async update(
    userId: string,
    dto: Partial<PrefFields>,
  ): Promise<AppearancePreference> {
    let prefs = await this.prefRepo.findOne({ where: { userId } });

    if (!prefs) {
      /* Première fois → créer avec les defaults */
      prefs = this.prefRepo.create({ ...DEFAULTS, userId });
    }

    /* Ne mettre à jour que les champs présents dans le DTO */
    Object.assign(prefs, dto);
    const saved = await this.prefRepo.save(prefs);

    this.logger.log(`[APPARENCE] Préférences mises à jour pour userId=${userId}`);
    return saved;
  }

  /* ──────────────────────────────────────────────────────────────
   * POST /reset — Réinitialiser aux valeurs par défaut
   * ────────────────────────────────────────────────────────────── */
  async reset(userId: string): Promise<AppearancePreference> {
    this.logger.log(`[APPARENCE] Réinitialisation pour userId=${userId}`);
    return this.update(userId, DEFAULTS);
  }
}
