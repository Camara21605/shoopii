/* ============================================================
 * FICHIER : src/modules/dashboard/livreur/services/profil-livreur.service.ts
 *
 * ✅ CORRECTIONS :
 *   1. updateProfil : champs explicites au lieu de Object.assign
 *      (firstName, lastName, email maintenant dans l'entité)
 *   2. updateProfil : fullName recalculé depuis firstName + lastName
 *   3. uploadPhoto : retourne { photoUrl } (pas { photo })
 * ============================================================ */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Delivery, LivreurVerificationStatus } from 'src/database/entities/profiles/livreur-profile.entity';
import { User }         from 'src/database/entities/user.entity';
import { UploadService, UPLOAD_FOLDERS } from 'src/modules/upload/upload.service';
import { SessionService } from 'src/modules/session/session.service';
import { parseUserAgent } from 'src/common/utils/user-agent.util';
import { UpdateLivreurProfilDto } from '../dto/livreur-parametres.dto';

/** Emojis de profil proposés à l'écran (voir parametresData.ts côté frontend). */
const LIVREUR_EMOJIS = ['🛵', '🚴', '🚗', '🛺', '🏍️', '📦', '⚡', '🌟'];

type DocumentType = 'cni' | 'permis' | 'assurance' | 'casier';

export interface CurrentSessionInfo {
  device:         string;
  browser:        string;
  ipAddress:      string | null;
  connectedSince: string;
}

const DOC_FIELD_MAP: Record<DocumentType, keyof Delivery> = {
  cni:       'documentCni',
  permis:    'documentPermis',
  assurance: 'documentAssurance',
  casier:    'documentCasier',
};

/* SÉCURITÉ — CNI, permis de conduire, assurance, casier judiciaire :
 * uploadés en type:'authenticated' (voir UploadService.uploadDocument),
 * jamais en public type:'upload'. Le champ Delivery stocke un public_id
 * Cloudinary, jamais une URL consultable directement, et aucune route ne
 * renvoie plus cette valeur brute au client (seulement `present:boolean`
 * — voir getDocuments() et le filtre dans getParametres()). Même
 * correctif que les modules Entreprise et Correspondant. */

@Injectable()
export class ProfilLivreurService {

  private readonly logger = new Logger(ProfilLivreurService.name);

  constructor(
    @InjectRepository(Delivery) private readonly livreurRepo: Repository<Delivery>,
    @InjectRepository(User)     private readonly userRepo:    Repository<User>,
    private readonly uploadService: UploadService,
    private readonly sessionService: SessionService,
  ) {}

  /* ── GET léger : photo + nom uniquement ── */
  async getAvatarInfo(userId: string): Promise<{ photoUrl: string | null; fullName: string }> {
    const livreur = await this.livreurRepo.findOne({
      where: { userId },
      select: ['photoUrl', 'fullName'],
    });
    if (!livreur) throw new NotFoundException('Profil livreur introuvable.');
    return { photoUrl: livreur.photoUrl ?? null, fullName: livreur.fullName ?? '' };
  }

  /* ── GET global ── */
  async getParametres(userId: string, currentSessionId?: string | null): Promise<Delivery> {
    const livreur = await this.livreurRepo.findOne({
      where: { userId },
      relations: ['horaires'],
    });
    if (!livreur) throw new NotFoundException('Profil livreur introuvable.');
    return this.attachCurrentSession(this.redactSensitiveDocuments(livreur), currentSessionId);
  }

  /**
   * BUG CORRIGÉ — la carte "Sessions" (SecSecurite.tsx) affichait 2
   * appareils ("iPhone", "MacBook") ENTIÈREMENT codés en dur, identiques
   * pour tout le monde, avec "Déconnecter"/"Tout déconnecter" qui ne
   * faisaient qu'un toast sans jamais rien déconnecter. Shoneya n'autorise
   * qu'UNE session active à la fois par compte (voir SessionService) :
   * il n'y a donc jamais eu plusieurs appareils à lister. Remplacé par la
   * session RÉELLE actuellement active (device/navigateur/IP/date), même
   * mécanisme que BoutiqueParametresService (entreprise) / ProfilPartenaireService.
   */
  private async attachCurrentSession(livreur: Delivery, currentSessionId?: string | null): Promise<Delivery> {
    const meta = await this.sessionService.getSessionMeta(currentSessionId);
    (livreur as any).currentSession = meta ? {
      ...parseUserAgent(meta.userAgent),
      ipAddress:      meta.ipAddress,
      connectedSince: meta.createdAt,
    } as CurrentSessionInfo : null;
    return livreur;
  }

  /* SÉCURITÉ — voir commentaire en tête de fichier. getParametres()
   * renvoie l'entité Delivery quasi brute (alimente toute la page
   * paramètres, y compris SecDocuments.tsx qui ne lit que present/absent,
   * jamais la valeur) : sans ce filtre, le public_id des 4 documents
   * sensibles partait tel quel dans la réponse JSON. */
  private redactSensitiveDocuments(livreur: Delivery): Delivery {
    const REDACTED = '••••••';
    if (livreur.documentCni)       livreur.documentCni       = REDACTED;
    if (livreur.documentPermis)    livreur.documentPermis    = REDACTED;
    if (livreur.documentAssurance) livreur.documentAssurance = REDACTED;
    if (livreur.documentCasier)    livreur.documentCasier    = REDACTED;
    return livreur;
  }

  /* ── PATCH profil ── */
  /*
   * BUGS CORRIGÉS :
   *   - `livreurRepo.save(livreur)` réécrivait la fiche lue en début de requête :
   *     une valeur changée entre-temps par ailleurs (disponibilité, compteur de
   *     livraisons, gains, statut décidé par l'administration…) était remise à
   *     l'ancienne valeur. Seules les colonnes du profil sont écrites (`update`).
   *   - Champ vidé enregistré comme '' au lieu d'être effacé (NULL).
   *   - Téléphone de contact (affiché aux boutiques, partenaires et clients)
   *     jamais vérifié : n'importe quel texte était accepté.
   *   - Prénom / nom vides acceptés (le nom affiché devenait vide).
   */
  async updateProfil(userId: string, dto: UpdateLivreurProfilDto): Promise<Delivery> {
    const livreur = await this.findOrFail(userId);
    const txt = (v?: string | null) => (v ?? '').replace(/\s+/g, ' ').trim() || null;
    const patch: Partial<Delivery> = {};

    if (dto.firstName !== undefined) {
      const v = txt(dto.firstName);
      if (!v) throw new BadRequestException('Le prénom ne peut pas être vide.');
      patch.firstName = v;
    }
    if (dto.lastName !== undefined) {
      const v = txt(dto.lastName);
      if (!v) throw new BadRequestException('Le nom ne peut pas être vide.');
      patch.lastName = v;
    }
    if (dto.bio      !== undefined) patch.bio     = (dto.bio ?? '').trim() || null;
    if (dto.langues  !== undefined) patch.langues = txt(dto.langues);
    if (dto.email    !== undefined) patch.email   = (dto.email ?? '').trim().toLowerCase() || null;
    if (dto.phone    !== undefined) {
      const brut = (dto.phone ?? '').trim();
      if (brut) {
        const chiffres = brut.replace(/\D/g, '');
        const local = chiffres.startsWith('224') && chiffres.length > 9 ? chiffres.slice(3) : chiffres;
        if (!/^[+\d\s().-]+$/.test(brut) || local.length < 8 || local.length > 9) {
          throw new BadRequestException('Numéro de téléphone invalide : 8 ou 9 chiffres après +224 (ex. 620 00 00 00).');
        }
        patch.phone = `+224 ${local}`;
      } else {
        patch.phone = null;
      }
    }
    /* Ville / commune / quartier : espaces normalisés, vide = effacé (jamais de valeur inventée) */
    if (dto.ville    !== undefined) patch.ville    = txt(dto.ville);
    if (dto.commune  !== undefined) patch.commune  = txt(dto.commune);
    if (dto.quartier !== undefined) patch.quartier = txt(dto.quartier);
    if (dto.deliveryEmoji !== undefined) {
      if (!LIVREUR_EMOJIS.includes(dto.deliveryEmoji)) throw new BadRequestException('Emoji de profil non proposé.');
      patch.deliveryEmoji = dto.deliveryEmoji;
    }

    /* Nom affiché recalculé à partir du prénom et du nom */
    const first = patch.firstName ?? livreur.firstName ?? '';
    const last  = patch.lastName  ?? livreur.lastName  ?? '';
    const computed = `${first} ${last}`.trim();
    if (computed) patch.fullName = computed;

    if (Object.keys(patch).length) await this.livreurRepo.update({ id: livreur.id }, patch as any);
    const updated = await this.findOrFail(userId);
    this.logger.log(`[PROFIL] Mis à jour — userId=${userId} → "${updated.fullName}"`);
    return this.redactSensitiveDocuments(updated);
  }

  /* ── POST photo ── */
  async uploadPhoto(userId: string, file: Express.Multer.File): Promise<{ photoUrl: string }> {
    const livreur = await this.findOrFail(userId);
    const ancienne = livreur.photoUrl;

    /* BUG CORRIGÉ — l'ancienne photo était supprimée AVANT l'envoi de la
     * nouvelle : si l'envoi échouait, le profil pointait vers une image
     * disparue. Nouvelle photo d'abord, seule sa colonne est écrite, puis
     * l'ancienne est supprimée. */
    const result = await this.uploadService.uploadImage(
      file, UPLOAD_FOLDERS.AVATAR, { width: 400, height: 400 },
    );
    await this.livreurRepo.update({ id: livreur.id }, { photoUrl: result.url });
    if (ancienne && ancienne !== result.url) await this.deleteCloudinary(ancienne);
    this.logger.log(`[PHOTO] Uploadée — userId=${userId}`);

    // ✅ Retourne { photoUrl } (pas { photo }) pour correspondre au hook frontend
    return { photoUrl: result.url };
  }

  /* ── GET documents ── */
  async getDocuments(userId: string) {
    const livreur = await this.findOrFail(userId);
    return {
      verificationStatus: livreur.verificationStatus,
      documents: {
        cni:       { present: !!livreur.documentCni       },
        permis:    { present: !!livreur.documentPermis    },
        assurance: { present: !!livreur.documentAssurance },
        casier:    { present: !!livreur.documentCasier    },
      },
    };
  }

  /* ── POST document ── */
  /*
   * BUGS CORRIGÉS (même correctif que les documents entreprise) :
   *   - l'ancien document était supprimé AVANT l'envoi du nouveau : un envoi
   *     raté laissait le livreur sans document ;
   *   - `save()` de toute la fiche : deux envois simultanés (CNI + permis) ou
   *     tout autre changement concurrent pouvaient être écrasés → seule la
   *     colonne du document est écrite ;
   *   - un livreur DÉJÀ vérifié qui renouvelait un document repassait « en
   *     cours de vérification » pour toujours (aucun écran d'administration ne
   *     revérifie après l'approbation) : seuls les statuts « en attente » et
   *     « refusé » passent à « en cours » quand CNI + permis sont présents.
   */
  async uploadDocument(userId: string, type: DocumentType, file: Express.Multer.File) {
    if (!DOC_FIELD_MAP[type]) throw new BadRequestException(
      `Type invalide : "${type}". Valeurs acceptées : cni, permis, assurance, casier`,
    );
    const livreur = await this.findOrFail(userId);
    const champ = DOC_FIELD_MAP[type];
    const ancienneValeur = livreur[champ] as string | null;

    const result = await this.uploadService.uploadDocument(file, UPLOAD_FOLDERS.DOCUMENT);
    await this.livreurRepo.update({ id: livreur.id }, { [champ]: result.publicId } as any);
    const verificationStatus = await this.refreshVerificationStatus(livreur.id);

    if (ancienneValeur && ancienneValeur !== result.publicId) await this.deleteStoredDocument(ancienneValeur);
    this.logger.log(`[DOC] ${type} uploadé — userId=${userId}`);
    return { present: true, type, verificationStatus };
  }

  /** CNI + permis présents et dossier « en attente » ou « refusé » → « en cours de vérification ». */
  private async refreshVerificationStatus(livreurId: string): Promise<LivreurVerificationStatus> {
    const l = await this.livreurRepo.findOne({
      where: { id: livreurId },
      select: ['id', 'documentCni', 'documentPermis', 'verificationStatus'],
    });
    if (!l) throw new NotFoundException('Profil livreur introuvable.');
    const aRevoir = [LivreurVerificationStatus.PENDING, LivreurVerificationStatus.REJECTED].includes(l.verificationStatus);
    if (aRevoir && l.documentCni && l.documentPermis) {
      await this.livreurRepo.update({ id: livreurId }, { verificationStatus: LivreurVerificationStatus.REVIEWING });
      return LivreurVerificationStatus.REVIEWING;
    }
    return l.verificationStatus;
  }

  /* ── DELETE document ── */
  async deleteDocument(userId: string, type: DocumentType) {
    if (!DOC_FIELD_MAP[type]) throw new BadRequestException(
      `Type invalide : "${type}". Valeurs acceptées : cni, permis, assurance, casier`,
    );
    const livreur = await this.findOrFail(userId);
    const champ = DOC_FIELD_MAP[type];
    const valeur = livreur[champ] as string | null;
    if (valeur) {
      await this.livreurRepo.update({ id: livreur.id }, { [champ]: null } as any);
      /* Pièce obligatoire retirée pendant la vérification : le dossier redevient incomplet */
      if ((type === 'cni' || type === 'permis') && livreur.verificationStatus === LivreurVerificationStatus.REVIEWING) {
        await this.livreurRepo.update({ id: livreur.id }, { verificationStatus: LivreurVerificationStatus.PENDING });
      }
      await this.deleteStoredDocument(valeur);
    }
    return { message: `Document "${type}" supprimé.` };
  }

  /* ── Helpers ── */
  async findOrFail(userId: string): Promise<Delivery> {
    const l = await this.livreurRepo.findOne({ where: { userId } });
    if (!l) throw new NotFoundException('Profil livreur introuvable.');
    return l;
  }

  /** Pour photoUrl (avatar, public type:'upload') — extraction du
   * public_id par regex depuis l'URL stockée. */
  private async deleteCloudinary(url: string): Promise<void> {
    try {
      const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
      if (match) {
        const isImage = /\.(webp|jpg|jpeg|png|gif)$/i.test(url);
        await this.uploadService.delete(match[1], isImage ? 'image' : 'raw');
      }
    } catch {
      this.logger.warn(`Cloudinary delete échoué : ${url}`);
    }
  }

  /** Pour les 4 documents sensibles (type:'authenticated') — le champ
   * stocke déjà un public_id brut, aucune extraction nécessaire. */
  private async deleteStoredDocument(publicId: string): Promise<void> {
    try {
      await this.uploadService.delete(publicId, 'raw', 'authenticated');
    } catch {
      this.logger.warn(`Cloudinary delete échoué : ${publicId}`);
    }
  }
}