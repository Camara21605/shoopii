import { IsUUID } from 'class-validator';
import { CreateSavTicketDto } from '../../entreprise/returns/dto/sav.dto';

export class ClientCreateSavTicketDto extends CreateSavTicketDto {
  @IsUUID()
  companyId: string;
}
