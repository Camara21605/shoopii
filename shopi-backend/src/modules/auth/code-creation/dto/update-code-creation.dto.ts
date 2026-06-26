import { PartialType } from '@nestjs/mapped-types';
import { CreateCodeCreationDto } from './create-code-creation.dto';

export class UpdateCodeCreationDto extends PartialType(CreateCodeCreationDto) {}
