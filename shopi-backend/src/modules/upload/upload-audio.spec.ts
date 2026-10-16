/* ============================================================
 * FICHIER : src/modules/upload/upload-audio.spec.ts
 * Messages vocaux : les noms de type audio annoncés par les téléphones
 * (.m4a de l'application mobile) doivent être acceptés.
 * ============================================================ */

import { BadRequestException } from '@nestjs/common';
import { UploadService } from './upload.service';

function fichier(mimetype: string): Express.Multer.File {
  return { mimetype, size: 1024, buffer: Buffer.from('x') } as Express.Multer.File;
}

function service() {
  const svc = new UploadService();
  jest.spyOn(svc as any, 'uploadToCloudinary').mockResolvedValue({
    secure_url: 'https://res.cloudinary.com/demo/video/upload/v1/vocal.m4a',
    public_id: 'vocal', format: 'm4a', bytes: 1024,
  });
  return svc;
}

describe('UploadService.uploadAudio — types annoncés par les téléphones', () => {
  it.each([
    'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/mp4a-latm',
    'audio/webm;codecs=opus', 'audio/ogg', 'audio/mpeg', 'audio/3gpp', 'AUDIO/MP4',
  ])('%s → accepté, livré en mp3', async (mime) => {
    const res = await service().uploadAudio(fichier(mime));
    expect(res.url.endsWith('.mp3')).toBe(true);
  });

  it.each(['image/png', 'application/pdf', '', 'audio/'])('%s → refusé', async (mime) => {
    await expect(service().uploadAudio(fichier(mime))).rejects.toBeInstanceOf(BadRequestException);
  });
});
