// src/modules/upload/upload.module.ts

import { Module }       from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';      // ✅ AJOUT 1
import { memoryStorage } from 'multer';

import { CloudinaryProvider }        from 'src/config/cloudinary.config';
import { UploadService }             from './upload.service';
import { UploadController }          from './upload.controller';
import { ProductMediaUploadService } from './product-media-upload.service';
import { ProductMedia }              from 'src/database/entities/entreprise.table/product-media.entity'; // ✅ AJOUT 2

@Module({
  imports: [
    MulterModule.register({ storage: memoryStorage() }),
    TypeOrmModule.forFeature([ProductMedia]),
  ],
  providers:   [CloudinaryProvider, UploadService, ProductMediaUploadService],
  controllers: [UploadController],
  exports:     [UploadService, ProductMediaUploadService],
})
export class UploadModule {}