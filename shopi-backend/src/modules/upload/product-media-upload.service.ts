// src/modules/upload/product-media-upload.service.ts

import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductMedia, MediaType } from 'src/database/entities/entreprise.table/product-media.entity';
import { UploadService, UPLOAD_FOLDERS } from './upload.service';

@Injectable()
export class ProductMediaUploadService {

  constructor(
    private readonly uploadService: UploadService,
    @InjectRepository(ProductMedia)
    private readonly mediaRepo: Repository<ProductMedia>,
  ) {}

  // ── Upload + sauvegarde en BDD ──────────────────────────────────────────

  async addImage(
    file: Express.Multer.File,
    productId: string,
    options?: { ordre?: number; alt?: string; width?: number; height?: number },
  ): Promise<ProductMedia> {

    const result = await this.uploadService.uploadImage(file, UPLOAD_FOLDERS.PRODUCT, {
      width:  options?.width  ?? 800,
      height: options?.height,
    });

    const media = this.mediaRepo.create({
      type:         MediaType.IMAGE,
      url:          result.url,
      originalName: file.originalname,
      mimeType:     result.format ? `image/${result.format}` : file.mimetype,
      size:         result.size,
      ordre:        options?.ordre ?? 0,
      alt:          options?.alt   ?? null,
      product:      { id: productId } as any,
    });

    return this.mediaRepo.save(media);
  }

  async addVideo(
    file: Express.Multer.File,
    productId: string,
    options?: { ordre?: number; alt?: string },
  ): Promise<ProductMedia> {

    const result = await this.uploadService.uploadVideo(file, UPLOAD_FOLDERS.VIDEO);

    const media = this.mediaRepo.create({
      type:         MediaType.VIDEO,
      url:          result.url,
      originalName: file.originalname,
      mimeType:     file.mimetype,
      size:         result.size,
      ordre:        options?.ordre ?? 0,
      alt:          options?.alt   ?? null,
      product:      { id: productId } as any,
    });

    return this.mediaRepo.save(media);
  }

  async addDocument(
    file: Express.Multer.File,
    productId: string,
    options?: { ordre?: number; alt?: string },
  ): Promise<ProductMedia> {

    const result = await this.uploadService.uploadDocument(file, UPLOAD_FOLDERS.DOCUMENT);

    const media = this.mediaRepo.create({
      type:         MediaType.FILE,
      url:          result.url,
      originalName: file.originalname,
      mimeType:     file.mimetype,
      size:         result.size,
      ordre:        options?.ordre ?? 0,
      alt:          options?.alt   ?? null,
      product:      { id: productId } as any,
    });

    return this.mediaRepo.save(media);
  }

  // ── Suppression Cloudinary + BDD ───────────────────────────────────────

  async remove(mediaId: string): Promise<void> {
    const media = await this.mediaRepo.findOneByOrFail({ id: mediaId });

    // Extraire le publicId depuis l'URL Cloudinary
    // URL format : https://res.cloudinary.com/<cloud>/image/upload/v123/<publicId>.webp
    const publicId = this.extractPublicId(media.url);

    const resourceType =
      media.type === MediaType.IMAGE ? 'image' :
      media.type === MediaType.VIDEO ? 'video' : 'raw';

    await this.uploadService.delete(publicId, resourceType);
    await this.mediaRepo.remove(media);
  }

  // ── Helper ─────────────────────────────────────────────────────────────

  private extractPublicId(cloudinaryUrl: string): string {
    // ex: https://res.cloudinary.com/demo/image/upload/v1234/shopi/products/abc.webp
    //  → shopi/products/abc
    const match = cloudinaryUrl.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
    if (!match) throw new BadRequestException('URL Cloudinary invalide');
    return match[1];
  }
}