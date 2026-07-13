import {
  IsString, IsEmail, IsEnum, IsOptional,
  MinLength, MaxLength,
} from 'class-validator';
import { ContactMessageType } from '../../../database/entities/contact/contact-message.entity';

export class CreateContactMessageDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name!: string;

  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  subject!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(3000)
  body!: string;

  @IsOptional()
  @IsEnum(ContactMessageType)
  type?: ContactMessageType;
}
