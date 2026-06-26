// src/modules/codes/codes.module.ts

import { Module }          from '@nestjs/common';
import { TypeOrmModule }   from '@nestjs/typeorm';
import { JwtModule }       from '@nestjs/jwt';
import { PassportModule }  from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { CodesController }     from './code-creation.controller';
import { CodeCreationService } from './code-creation.service';
import { CreationCode }        from '../../../database/entities/code-creation.entity';
import { User }                from '../../../database/entities/user.entity';
import { MailModule } from 'src/modules/email/email.module';

// ✅ CORRIGÉ : on n'importe plus AuthModule (évite l'import circulaire)
// JwtModule et PassportModule sont importés directement

@Module({
  imports: [
    TypeOrmModule.forFeature([CreationCode, User]),
    MailModule,

    PassportModule.register({ defaultStrategy: 'jwt' }),

    // JwtModule configuré avec les mêmes params que AuthModule
    JwtModule.registerAsync({
      imports:    [ConfigModule],
      inject:     [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret:      config.get<string>('JWT_SECRET'),
        signOptions: {
          // ✅ CORRIGÉ : cast en StringValue pour satisfaire @nestjs/jwt
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') ?? '24h') as any,
        },
      }),
    }),
  ],
  controllers: [CodesController],
  providers:   [CodeCreationService],
  exports:     [CodeCreationService], // Exporté pour AuthService.register()
})
export class CodesModule {}