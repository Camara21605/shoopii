/* ============================================================
 * FICHIER  : src/modules/support/services/attachment.service.ts
 * MODULE   : Support
 * ROLE     : Upload et suppression des pièces jointes support.
 *
 * RESPONSABILITES :
 *   - Valider le fichier (type MIME + taille) avant upload.
 *   - Vérifier les magic bytes pour prévenir le MIME spoofing.
 *   - Vérifier que le messageId appartient bien au ticketId fourni (IDOR).
 *   - Uploader vers Cloudinary (dossier shopi/support).
 *   - Créer l'entité Attachment en base avec les métadonnées.
 *   - Lister les pièces jointes d'un message (avec vérification ticket).
 *   - Soft delete d'un attachment + appel Cloudinary destroy.
 *
 * DEPENDANCES :
 *   - Attachment        (InjectRepository)
 *   - SupportMessage    (InjectRepository — vérification IDOR message→ticket)
 *   - UploadService     (Cloudinary uploadBuffer + delete)
 *   - support.exceptions (exceptions métier typées)
 *
 * SECURITE :
 *   - OWASP A01:2021 (IDOR) : verifyMessageInTicket() empêche un
 *     utilisateur de lier une pièce jointe à un message d'un autre ticket.
 *   - OWASP A05:2021 (MIME Spoofing) : validateMagicBytes() lit les 12
 *     premiers octets du buffer pour confirmer le type réel du fichier.
 *
 * AUTEUR : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-03
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository }         from 'typeorm';

import { Attachment }     from '../../../database/entities/support/attachment.entity';
import { SupportMessage } from '../../../database/entities/support/support-message.entity';
import { UploadService, UPLOAD_FOLDERS } from '../../upload/upload.service';

import {
  AttachmentNotFoundException,
  AttachmentTooLargeException,
  AttachmentTypeNotAllowedException,
  AttachmentUploadFailedException,
  MessageNotFoundException,
  MessageNotInTicketException,
} from '../../../common/exceptions/support.exceptions';

/* ── Contraintes métier ──────────────────────────────────────── */

/** Taille maximale par pièce jointe : 10 MB.
 *  Cohérent avec MAX_DOC_SIZE de UploadService. */
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

/** Liste blanche des types MIME autorisés → extension fichier correspondante.
 *  Seule la liste blanche autorise un type ; tout le reste est rejeté (fail-closed). */
const ALLOWED_ATTACHMENT_MIME_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg':      'jpg',
  'image/png':       'png',
  'image/webp':      'webp',
  'video/mp4':       'mp4',
  'video/webm':      'webm',
};

/* ── Magic bytes validation ──────────────────────────────────── */

/**
 * Vérifie les magic bytes (signature binaire) du buffer pour confirmer
 * que le type MIME déclaré correspond au contenu réel du fichier.
 *
 * Un attaquant peut falsifier le header Content-Type et envoyer un
 * fichier HTML ou JS avec mimetype "image/png" pour exécuter du code
 * côté client si ce fichier est servi depuis le CDN.
 *
 * La vérification des magic bytes lit les octets réels du buffer APRÈS
 * la liste blanche MIME, ajoutant une couche de défense en profondeur.
 *
 * Référence : https://en.wikipedia.org/wiki/List_of_file_signatures
 * OWASP A05:2021 – Security Misconfiguration
 */
function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  /* Un fichier trop petit pour contenir une signature valide est rejeté. */
  if (buffer.length < 12) return false;

  switch (mimeType) {
    case 'application/pdf':
      /* Signature PDF : %PDF  (hex: 25 50 44 46) */
      return buffer.slice(0, 4).toString('ascii') === '%PDF';

    case 'image/jpeg':
      /* Signature JPEG : FF D8 FF (Start Of Image + marqueur APP) */
      return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;

    case 'image/png':
      /* Signature PNG : 89 50 4E 47 0D 0A 1A 0A (8 octets) */
      return buffer[0] === 0x89 && buffer[1] === 0x50 &&
             buffer[2] === 0x4E && buffer[3] === 0x47 &&
             buffer[4] === 0x0D && buffer[5] === 0x0A &&
             buffer[6] === 0x1A && buffer[7] === 0x0A;

    case 'image/webp':
      /* Signature WebP : RIFF????WEBP (offset 0-3 = RIFF, offset 8-11 = WEBP) */
      return buffer.slice(0, 4).toString('ascii') === 'RIFF' &&
             buffer.slice(8, 12).toString('ascii') === 'WEBP';

    case 'video/mp4':
      /* Signature MP4 : box "ftyp" à l'offset 4 (ISO 14496-12).
       * Les 4 premiers octets sont la taille de la box (variable). */
      return buffer.slice(4, 8).toString('ascii') === 'ftyp';

    case 'video/webm':
      /* Signature WebM/MKV : En-tête EBML — 1A 45 DF A3 */
      return buffer[0] === 0x1A && buffer[1] === 0x45 &&
             buffer[2] === 0xDF && buffer[3] === 0xA3;

    default:
      /* Type inconnu → rejeté (fail-closed).
       * Ne jamais autoriser un type non listé même s'il passe la liste blanche. */
      return false;
  }
}

/* ════════════════════════════════════════════════════════════════
 * SERVICE
 * ════════════════════════════════════════════════════════════════ */

@Injectable()
export class AttachmentService {
  private readonly logger = new Logger(AttachmentService.name);

  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentRepo: Repository<Attachment>,

    /* Injecté pour vérifier qu'un messageId appartient bien à un ticketId
     * avant tout upload. Prévient les attaques IDOR cross-ticket. */
    @InjectRepository(SupportMessage)
    private readonly msgRepo: Repository<SupportMessage>,

    private readonly uploadService: UploadService,
  ) {}

  /* ── Vérification d'intégrité message → ticket ───────────────
   *
   * Avant d'uploader une pièce jointe, on s'assure que le messageId
   * fourni appartient réellement au ticketId fourni.
   *
   * Cas d'attaque bloqué :
   *   Un utilisateur connaît son ticketId A (qu'il possède) mais fournit
   *   un messageId de la conversation du ticket B (qu'il ne possède pas).
   *   Sans cette vérification, la pièce jointe serait rattachée à un message
   *   d'un autre utilisateur.
   *
   * OWASP A01:2021 — Broken Object Level Authorization (IDOR)
   * ─────────────────────────────────────────────────────────── */
  private async verifyMessageInTicket(
    ticketId:  string,
    messageId: string,
  ): Promise<void> {
    const msg = await this.msgRepo.findOne({
      where:  { id: messageId },
      select: ['id', 'ticketId'],
    });

    if (!msg) throw new MessageNotFoundException(messageId);

    /* msg.ticketId doit correspondre au ticketId de la requête.
     * Si ce n'est pas le cas → attaque IDOR → 403 Forbidden. */
    if (msg.ticketId !== ticketId) {
      throw new MessageNotInTicketException(messageId, ticketId);
    }
  }

  /* ── Upload d'une pièce jointe ───────────────────────────────
   *
   * Flux de validation (ordre important — fail-fast) :
   *   1. Vérification message-ticket (IDOR)
   *   2. Liste blanche MIME
   *   3. Taille maximale
   *   4. Magic bytes (anti-MIME spoofing)
   *   5. Upload Cloudinary
   *   6. Enregistrement en base
   * ─────────────────────────────────────────────────────────── */
  async upload(
    ticketId:       string,
    messageId:      string,
    file:           Express.Multer.File,
    uploadedById:   string,
    uploadedByRole: string,
  ): Promise<Attachment> {

    /* ── 1. Vérification intégrité message → ticket ─────────── */
    await this.verifyMessageInTicket(ticketId, messageId);

    /* ── 2. Liste blanche MIME ───────────────────────────────── */
    const mimeType = file.mimetype.toLowerCase();
    const extension = ALLOWED_ATTACHMENT_MIME_TYPES[mimeType];

    if (!extension) {
      throw new AttachmentTypeNotAllowedException(file.originalname, mimeType);
    }

    /* ── 3. Vérification taille ──────────────────────────────── */
    if (file.size > MAX_ATTACHMENT_SIZE) {
      throw new AttachmentTooLargeException(file.originalname, file.size, MAX_ATTACHMENT_SIZE);
    }

    /* ── 4. Vérification magic bytes (anti-MIME spoofing) ───────
     * Le MIME type fourni par le client n'est pas fiable :
     * un attaquant peut déclarer image/png pour un fichier HTML.
     * On vérifie la signature binaire réelle du buffer. */
    if (!validateMagicBytes(file.buffer, mimeType)) {
      this.logger.warn(
        `[ATTACHMENT] Magic bytes invalides pour "${file.originalname}" ` +
        `(MIME déclaré: ${mimeType}, ticketId: ${ticketId})`,
      );
      throw new AttachmentTypeNotAllowedException(file.originalname, mimeType);
    }

    /* ── 5. Upload Cloudinary ─────────────────────────────────── */
    let result: { url: string; publicId: string };
    try {
      result = await this.uploadService.uploadBuffer(
        file.buffer,
        UPLOAD_FOLDERS.SUPPORT,
        mimeType,
      );
    } catch (e) {
      this.logger.error(
        `[ATTACHMENT] Upload Cloudinary échoué pour message ${messageId}: ${e}`,
      );
      throw new AttachmentUploadFailedException();
    }

    /* ── 6. Enregistrement en base ───────────────────────────── */
    const attachment = this.attachmentRepo.create({
      messageId,
      publicId:         result.publicId,
      secureUrl:        result.url,
      /* Limite l'originalFilename à 500 chars pour éviter tout dépassement de colonne. */
      originalFilename: file.originalname.substring(0, 500),
      mimeType,
      extension,
      sizeBytes:        file.size,
      uploadedById,
      uploadedByRole,
    });

    const saved = await this.attachmentRepo.save(attachment);
    this.logger.log(
      `[ATTACHMENT] ${saved.id} (${extension}, ` +
      `${(file.size / 1024).toFixed(0)} KB) enregistré → message ${messageId}`,
    );

    return saved;
  }

  /* ── Récupérer une pièce jointe par son ID ──────────────────
   *
   * Utilisé par SupportService pour vérifier l'ownership avant
   * suppression par un client (attachment.uploadedById === userId).
   * ─────────────────────────────────────────────────────────── */
  async findOne(attachmentId: string): Promise<Attachment> {
    const att = await this.attachmentRepo.findOne({ where: { id: attachmentId } });
    if (!att) throw new AttachmentNotFoundException(attachmentId);
    return att;
  }

  /* ── Lister les pièces jointes d'un message ──────────────────
   *
   * Vérifie d'abord que le messageId appartient au ticketId pour
   * éviter qu'un utilisateur liste les pièces jointes d'un message
   * d'un autre ticket (IDOR).
   * ─────────────────────────────────────────────────────────── */
  async findByMessage(
    ticketId:  string,
    messageId: string,
  ): Promise<Attachment[]> {
    /* Vérification IDOR avant toute requête sur les attachments. */
    await this.verifyMessageInTicket(ticketId, messageId);

    return this.attachmentRepo.find({
      where: { messageId },
      order: { createdAt: 'ASC' },
    });
  }

  /* ── Soft delete + suppression Cloudinary ────────────────────
   *
   * On soft delete en base AVANT d'appeler Cloudinary.
   * Raison : si Cloudinary échoue (timeout, quota), l'asset reste
   * inaccessible côté DB (soft delete) et un futur cron peut
   * réessayer la suppression Cloudinary en cherchant les publicId
   * des attachments avec deletedAt non null.
   *
   * Le vérification d'appartenance (uploadedById === userId pour un
   * client) est faite en amont dans SupportService avant d'appeler
   * cette méthode.
   * ─────────────────────────────────────────────────────────── */
  async remove(attachmentId: string, requestedBy: string): Promise<void> {
    const attachment = await this.attachmentRepo.findOne({
      where: { id: attachmentId },
    });
    if (!attachment) throw new AttachmentNotFoundException(attachmentId);

    await this.attachmentRepo.softDelete(attachmentId);
    this.logger.log(
      `[ATTACHMENT] Soft delete ${attachmentId} demandé par ${requestedBy}`,
    );

    try {
      /* Cloudinary distingue 3 resource_type :
       *   image → PNG, JPG, WebP
       *   video → MP4, WebM
       *   raw   → PDF et tous les autres
       * Utiliser le mauvais resource_type provoque un 404 Cloudinary.
       * On le déduit du mimeType stocké en base (jamais du client). */
      const resourceType: 'image' | 'video' | 'raw' =
        attachment.mimeType.startsWith('image/') ? 'image' :
        attachment.mimeType.startsWith('video/') ? 'video' : 'raw';

      await this.uploadService.delete(attachment.publicId, resourceType);
      this.logger.log(
        `[ATTACHMENT] Asset Cloudinary ${attachment.publicId} supprimé`,
      );
    } catch (e) {
      /* Cloudinary peut échouer (timeout, asset déjà supprimé, quota).
       * On log l'erreur mais on ne la propage pas : le soft delete en DB
       * est fait, l'asset Cloudinary sera nettoyé par le cron. */
      this.logger.error(
        `[ATTACHMENT] Suppression Cloudinary ${attachment.publicId} échouée : ${e}`,
      );
    }
  }
}
