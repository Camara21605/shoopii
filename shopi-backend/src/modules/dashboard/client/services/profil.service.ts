/* ============================================================
 * src/modules/dashboard/client/services/profil.service.ts
 *
 * Profil personnel + coordonnées du client (paramètres du compte).
 *
 * Règles (audit « Paramètres du compte ») :
 *   - PROFIL : prénom/nom jamais vides ; nom d'utilisateur validé
 *     (3–30 : minuscules, chiffres, « . » « _ » « - ») et unique sans
 *     tenir compte de la casse ; date de naissance réelle (ni future, ni
 *     avant 1900) ; genre et langue parmi des valeurs connues ; un champ
 *     vidé est remis à NULL ; seuls les champs MODIFIÉS sont vérifiés
 *     (un ancien nom d'utilisateur atypique ne bloque pas l'enregistrement
 *     d'un autre champ).
 *   - COORDONNÉES : e-mail et téléphone sont des identifiants de compte →
 *     le mot de passe actuel est exigé pour les changer ; seule la
 *     coordonnée RÉELLEMENT modifiée perd sa vérification (avant : enregistrer
 *     sans rien changer dépubliait l'e-mail vérifié et effondrait le score de
 *     sécurité) ; unicité du téléphone contrôlée (avant : erreur 500 sur la
 *     contrainte unique) ; le nouvel e-mail reçoit un code de confirmation
 *     (avant : le message affirmait un envoi qui n'avait jamais lieu).
 *   - E-MAIL : code à 6 chiffres (10 min, 3 essais, 3 envois / 15 min) —
 *     mêmes champs et mêmes règles que la vérification à l'inscription.
 *   - Il n'existe pas encore de fournisseur SMS : le téléphone est enregistré
 *     mais reste « non vérifié », et la réponse ne prétend jamais le contraire.
 * ============================================================ */

import {
  BadRequestException, ConflictException, Injectable, Logger,
  NotFoundException, UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

import { User }   from '../../../../database/entities/user.entity';
import { Client } from '../../../../database/entities/profiles/client-profile.entity';
import { UpdateProfilDto, UpdateCoordonneesDto } from '../dto/client-parametres.dto';
import { MailService } from '../../../email/email.service';
import { hashUserPhone, normalizeUserPhoneE164 } from '../../../../common/utils/phone-hash.util';

const BCRYPT_ROUNDS         = 12;
const OTP_EXPIRY_MINUTES    = 10;
const OTP_MAX_ATTEMPTS      = 3;
const OTP_RATE_LIMIT_WINDOW = 15;   // minutes
const OTP_RATE_LIMIT_MAX    = 3;

const GENRES  = ['homme', 'femme', 'autre', 'non_precise'];
const LANGUES = ['fr', 'en', 'ar', 'pt', 'zh'];
const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;

export interface CoordonneesResult {
  message:        string;
  emailChanged:   boolean;
  phoneChanged:   boolean;
  emailVerified:  boolean;
  phoneVerified:  boolean;
  /** true = un code de confirmation vient d'être envoyé au nouvel e-mail */
  emailCodeSent:  boolean;
}

@Injectable()
export class ProfilService {
  private readonly logger = new Logger(ProfilService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,

    private readonly mailService: MailService,
  ) {}

  /* ── Helper — early return pour éviter null ── */
  private async getOrCreate(userId: string): Promise<Client> {
    const found = await this.clientRepo.findOne({ where: { userId } });
    if (found) return found;
    const created = this.clientRepo.create({ userId } as DeepPartial<Client>);
    return this.clientRepo.save(created);
  }

  /* ── GET — profil complet ── */
  async get(user: User) {
    const dbUser  = await this.userRepo.findOne({ where: { id: user.id } });
    if (!dbUser) throw new NotFoundException('Utilisateur introuvable.');
    const profile = await this.clientRepo.findOne({ where: { userId: user.id } });

    return {
      id:             dbUser.id,
      firstName:      dbUser.firstName,
      lastName:       dbUser.lastName,
      email:          dbUser.email,
      phone:          dbUser.phone,
      username:       dbUser.username,
      emailVerified:  dbUser.emailVerified,
      phoneVerified:  dbUser.phoneVerified,
      profilePicture: dbUser.profilePicture,
      dateNaissance:  (profile as any)?.dateNaissance ?? null,
      genre:          (profile as any)?.genre          ?? null,
      bio:            (profile as any)?.bio             ?? null,
      langue:         (profile as any)?.langue          ?? 'fr',
    };
  }

  /* ── PATCH — profil personnel ── */
  async updateProfil(user: User, dto: UpdateProfilDto) {
    const dbUser = await this.userRepo.findOne({ where: { id: user.id } });
    if (!dbUser) throw new NotFoundException('Utilisateur introuvable.');

    /* Tout est validé AVANT la moindre écriture : une erreur ne laisse jamais un enregistrement partiel */
    const birth = dto.dateNaissance !== undefined ? this.checkBirthDate(dto.dateNaissance) : undefined;
    const genre = dto.genre !== undefined ? dto.genre.trim() : undefined;
    if (genre && !GENRES.includes(genre)) throw new BadRequestException('Genre invalide.');
    const langue = dto.langue !== undefined ? dto.langue.trim() : undefined;
    if (langue !== undefined && !LANGUES.includes(langue)) throw new BadRequestException('Langue non prise en charge.');

    if (dto.firstName !== undefined) {
      const v = dto.firstName.trim();
      if (!v) throw new BadRequestException('Le prénom ne peut pas être vide.');
      dbUser.firstName = v;
    }
    if (dto.lastName !== undefined) {
      const v = dto.lastName.trim();
      if (!v) throw new BadRequestException('Le nom ne peut pas être vide.');
      dbUser.lastName = v;
    }

    if (dto.username !== undefined) {
      const wanted = dto.username.trim().toLowerCase().replace(/^@/, '');
      /* Inchangé : rien à contrôler (un ancien identifiant atypique reste valable) */
      if (wanted !== (dbUser.username ?? '').toLowerCase()) {
        if (!USERNAME_RE.test(wanted)) {
          throw new BadRequestException(
            "Nom d'utilisateur invalide : 3 à 30 caractères — lettres minuscules, chiffres, « . », « _ » ou « - ».",
          );
        }
        const taken = await this.userRepo
          .createQueryBuilder('u')
          .select('u.id')
          .where('LOWER(u.username) = :n AND u.id != :id', { n: wanted, id: user.id })
          .getOne();
        if (taken) throw new ConflictException(`Le nom d'utilisateur « ${wanted} » est déjà pris.`);
        dbUser.username = wanted;
      }
    }
    await this.userRepo.save(dbUser);

    const profile = await this.getOrCreate(user.id);

    if (birth  !== undefined) (profile as any).dateNaissance = birth;
    if (genre  !== undefined) (profile as any).genre         = genre || null;
    if (langue !== undefined) (profile as any).langue        = langue;
    if (dto.bio !== undefined) {
      (profile as any).bio = dto.bio.trim() || null;
    }
    await this.clientRepo.save(profile);

    this.logger.log(`[PROFIL UPDATE] userId=${user.id}`);
    return this.get(user);
  }

  /** '' → null ; sinon 'YYYY-MM-DD' réel, ni dans le futur ni avant 1900. */
  private checkBirthDate(raw: string): string | null {
    const v = raw.trim();
    if (!v) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    const d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
    if (!m || !d || d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) {
      throw new BadRequestException('Date de naissance invalide.');
    }
    if (+m[1] < 1900 || d.getTime() > Date.now()) {
      throw new BadRequestException('La date de naissance doit être comprise entre 1900 et aujourd’hui.');
    }
    return v;
  }

  /* ── PATCH — avatar ── */
  async updateAvatar(user: User, avatarUrl: string): Promise<{ profilePicture: string | null }> {
    const dbUser = await this.userRepo.findOne({ where: { id: user.id } });
    if (!dbUser) throw new NotFoundException('Utilisateur introuvable.');

    const url = (avatarUrl ?? '').trim();
    /* '' = suppression de la photo. Sinon uniquement une URL http(s) : jamais « javascript: » ni « data: » */
    if (url && (url.length > 500 || !/^https?:\/\/[^\s]+$/i.test(url))) {
      throw new BadRequestException('URL de photo invalide.');
    }
    dbUser.profilePicture = url || null;
    await this.userRepo.save(dbUser);
    return { profilePicture: dbUser.profilePicture };
  }

  /* ── PATCH — coordonnées ── */
  async updateCoordonnees(user: User, dto: UpdateCoordonneesDto): Promise<CoordonneesResult> {
    const dbUser = await this.userRepo.findOne({ where: { id: user.id } });
    if (!dbUser) throw new NotFoundException('Utilisateur introuvable.');

    const newEmail = dto.email !== undefined ? dto.email.toLowerCase().trim() : undefined;
    const emailChanged = newEmail !== undefined && newEmail !== (dbUser.email ?? '').toLowerCase();

    const newPhoneE164 = dto.phone !== undefined && dto.phone.trim() ? normalizeUserPhoneE164(dto.phone) : undefined;
    if (dto.phone !== undefined && dto.phone.trim() && !newPhoneE164) {
      throw new BadRequestException('Numéro de téléphone invalide : indiquez-le avec son indicatif pays (ex. +224 620 00 00 00).');
    }
    if (newPhoneE164 && newPhoneE164.length > 16) {
      throw new BadRequestException('Numéro de téléphone invalide (trop long).');
    }
    const phoneChanged = newPhoneE164 !== undefined && newPhoneE164 !== normalizeUserPhoneE164(dbUser.phone);

    const state = (over: Partial<CoordonneesResult>): CoordonneesResult => ({
      message: '', emailChanged, phoneChanged,
      emailVerified: dbUser.emailVerified, phoneVerified: dbUser.phoneVerified, emailCodeSent: false, ...over,
    });

    if (!emailChanged && !phoneChanged) {
      return state({ message: 'Aucune modification : vos coordonnées sont déjà à jour.' });
    }

    /* E-mail et téléphone identifient le compte : mot de passe actuel exigé */
    if (!dto.currentPassword) {
      throw new BadRequestException('Saisissez votre mot de passe actuel pour modifier vos coordonnées.');
    }
    const withPwd = await this.userRepo.findOne({ where: { id: user.id }, select: ['id', 'password'] });
    if (!withPwd || !(await bcrypt.compare(dto.currentPassword, withPwd.password))) {
      throw new UnauthorizedException('Mot de passe actuel incorrect.');
    }

    if (emailChanged) {
      /* Scopé par rôle (UNIQUE(email, role)) : seul un AUTRE compte de même rôle est un conflit */
      const exists = await this.userRepo.findOne({ where: { email: newEmail, role: dbUser.role } });
      if (exists && exists.id !== user.id) throw new ConflictException(`L'e-mail « ${newEmail} » est déjà utilisé.`);
      dbUser.email         = newEmail!;
      dbUser.emailVerified = false;
    }
    if (phoneChanged) {
      const hash = hashUserPhone(newPhoneE164);
      const taken = hash ? await this.userRepo.findOne({ where: { phoneHash: hash, role: dbUser.role } }) : null;
      if (taken && taken.id !== user.id) throw new ConflictException('Ce numéro de téléphone est déjà utilisé par un autre compte.');
      dbUser.phone         = newPhoneE164!;
      dbUser.phoneVerified = false;
    }
    await this.userRepo.save(dbUser);
    this.logger.log(`[COORDONNÉES] userId=${user.id} email=${emailChanged} phone=${phoneChanged}`);

    let emailCodeSent = false;
    if (emailChanged) {
      /* Le changement est déjà enregistré : un échec d'envoi (limite de débit, SMTP) ne doit pas
       * le faire passer pour une erreur — l'utilisateur pourra demander le code avec « Vérifier ». */
      try { emailCodeSent = (await this.sendEmailCode(dbUser)).sent; }
      catch (err) { this.logger.warn(`[VÉRIF EMAIL] envoi impossible : ${(err as Error).message}`); }
    }

    const parts: string[] = [];
    if (emailChanged) parts.push(emailCodeSent
      ? `un code de confirmation a été envoyé à ${dbUser.email}`
      : `confirmez ${dbUser.email} avec le bouton « Vérifier »`);
    if (phoneChanged) parts.push('la vérification par SMS n’est pas encore disponible pour le téléphone');
    return state({
      message: `Coordonnées mises à jour — ${parts.join(' ; ')}.`,
      emailVerified: dbUser.emailVerified, phoneVerified: dbUser.phoneVerified, emailCodeSent,
    });
  }

  /* ══════════════════════════════════════════════════════════
   * Vérification de l'e-mail (compte connecté)
   ══════════════════════════════════════════════════════════ */

  /** POST — envoie (ou renvoie) le code de confirmation à l'e-mail actuel. */
  async sendEmailCode(userOrEntity: Pick<User, 'id'> & Partial<User>): Promise<{ sent: boolean; message: string }> {
    const user = await this.userRepo
      .createQueryBuilder('u')
      .select(['u.id', 'u.email', 'u.firstName', 'u.emailVerified', 'u.emailVerifyRequestedAt', 'u.emailVerifyRequestCount'])
      .where('u.id = :id', { id: userOrEntity.id })
      .getOne();
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
    if (user.emailVerified) return { sent: false, message: 'Votre adresse e-mail est déjà vérifiée.' };

    const windowStart = new Date(Date.now() - OTP_RATE_LIMIT_WINDOW * 60_000);
    const inWindow = !!user.emailVerifyRequestedAt && user.emailVerifyRequestedAt > windowStart;
    if (inWindow && (user.emailVerifyRequestCount ?? 0) >= OTP_RATE_LIMIT_MAX) {
      throw new BadRequestException(`Trop de demandes : réessayez dans quelques minutes (maximum ${OTP_RATE_LIMIT_MAX} envois par ${OTP_RATE_LIMIT_WINDOW} min).`);
    }

    const otpCode   = crypto.randomInt(100_000, 999_999).toString();
    const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60_000);
    await this.userRepo.update(user.id, {
      emailVerifyOtpHash:      await bcrypt.hash(otpCode, BCRYPT_ROUNDS),
      emailVerifyOtpExpiry:    otpExpiry,
      emailVerifyOtpAttempts:  0,
      emailVerifyRequestedAt:  new Date(),
      emailVerifyRequestCount: inWindow ? (user.emailVerifyRequestCount ?? 0) + 1 : 1,
    });

    this.mailService
      .sendEmailVerificationOtp({ toEmail: user.email, firstName: user.firstName, otpCode, expiresAt: otpExpiry, userId: user.id })
      .catch(err => this.logger.error(`[VÉRIF EMAIL ❌] ${user.email} | ${(err as Error).message}`));

    return { sent: true, message: `Un code à 6 chiffres a été envoyé à ${user.email} (valable ${OTP_EXPIRY_MINUTES} min).` };
  }

  /** POST — confirme le code reçu : l'e-mail devient « vérifié » (sans ouvrir de nouvelle session). */
  async confirmEmailCode(user: User, code: string): Promise<{ message: string; emailVerified: true }> {
    if (!/^\d{6}$/.test((code ?? '').trim())) throw new BadRequestException('Le code doit contenir 6 chiffres.');

    const u = await this.userRepo
      .createQueryBuilder('u')
      .select(['u.id', 'u.emailVerified', 'u.emailVerifyOtpHash', 'u.emailVerifyOtpExpiry', 'u.emailVerifyOtpAttempts'])
      .where('u.id = :id', { id: user.id })
      .getOne();
    if (!u) throw new NotFoundException('Utilisateur introuvable.');
    if (u.emailVerified) return { message: 'Votre adresse e-mail est déjà vérifiée.', emailVerified: true };

    if (!u.emailVerifyOtpHash || !u.emailVerifyOtpExpiry || u.emailVerifyOtpExpiry < new Date()) {
      throw new BadRequestException('Ce code a expiré. Demandez-en un nouveau.');
    }
    const attempts = u.emailVerifyOtpAttempts ?? 0;
    const invalidate = () => this.userRepo.update(u.id, { emailVerifyOtpHash: null, emailVerifyOtpExpiry: null, emailVerifyOtpAttempts: 0 });

    if (attempts >= OTP_MAX_ATTEMPTS) {
      await invalidate();
      throw new BadRequestException('Trop de tentatives incorrectes. Demandez un nouveau code.');
    }
    if (!(await bcrypt.compare(code.trim(), u.emailVerifyOtpHash))) {
      const remaining = OTP_MAX_ATTEMPTS - attempts - 1;
      if (remaining <= 0) {
        await invalidate();
        throw new BadRequestException('Code incorrect. Il a été invalidé : demandez-en un nouveau.');
      }
      await this.userRepo.update(u.id, { emailVerifyOtpAttempts: attempts + 1 });
      throw new BadRequestException(`Code incorrect. Il vous reste ${remaining} tentative(s).`);
    }

    await this.userRepo.update(u.id, { emailVerified: true, emailVerifyOtpHash: null, emailVerifyOtpExpiry: null, emailVerifyOtpAttempts: 0 });
    this.logger.log(`[VÉRIF EMAIL ✅] userId=${u.id}`);
    return { message: 'Adresse e-mail vérifiée.', emailVerified: true };
  }
}
