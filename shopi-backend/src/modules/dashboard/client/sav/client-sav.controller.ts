import {
  Controller, Get, Post, Param, Body, Query,
  UseGuards, Request,
} from '@nestjs/common';
import { JwtAuthGuard }            from '../../../../common/guards/auth.guard';
import { RolesGuard }              from '../../../../common/guards/roles.guard';
import { Roles }                   from '../../../../common/decorators/roles.decorator';
import { UserRole }                from '../../../../common/enums/user-role.enum';
import { SavService }              from '../../entreprise/returns/services/sav.service';
import { ReplySavDto, FilterSavDto } from '../../entreprise/returns/dto/sav.dto';
import { ClientCreateSavTicketDto }  from './client-sav.dto';

@Controller('dashboard/client/sav')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CLIENT)
export class ClientSavController {

  constructor(private readonly savService: SavService) {}

  @Post()
  create(@Body() dto: ClientCreateSavTicketDto, @Request() req: any) {
    const { companyId, ...rest } = dto;
    return this.savService.createByClient(req.user.id, companyId, rest);
  }

  @Get()
  findAll(@Query() filters: FilterSavDto, @Request() req: any) {
    return this.savService.findAllByClient(req.user.id, filters);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.savService.findOneByClient(req.user.id, id);
  }

  @Post(':id/reply')
  reply(@Param('id') id: string, @Body() dto: ReplySavDto, @Request() req: any) {
    return this.savService.replyByClient(req.user.id, id, dto);
  }
}
