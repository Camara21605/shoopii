/* ============================================================
 * FICHIER : src/modules/delivery-group/delivery-group.controller.ts
 *
 * Base URL : /api/delivery-groups
 * Auth     : JWT obligatoire
 * ============================================================ */

import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard }         from '../../common/guards/auth.guard';
import { DeliveryGroupService } from './delivery-group.service';
import {
  SendGroupMessageDto, EditGroupMessageDto,
  DeleteGroupMessageDto, ToggleGroupReactionDto, UpdateGroupDto,
} from './dto/delivery-group.dto';

@Controller('delivery-groups')
@UseGuards(JwtAuthGuard)
export class DeliveryGroupController {

  constructor(private readonly svc: DeliveryGroupService) {}

  private uid(req: Request): string {
    const u = (req as any).user;
    return u.userId ?? u.id;
  }

  /** GET /delivery-groups — liste les groupes actifs/complétés de l'utilisateur */
  @Get()
  getGroups(@Req() req: Request) {
    return this.svc.getGroupsForUser(this.uid(req));
  }

  /** PATCH /delivery-groups/:id — modifier la description du groupe */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  updateGroup(
    @Req()     req:     Request,
    @Param('id')       groupId: string,
    @Body()            dto:     UpdateGroupDto,
  ) {
    return this.svc.updateGroupInfo(groupId, this.uid(req), dto);
  }

  /** GET /delivery-groups/:id/members — liste des membres actifs */
  @Get(':id/members')
  getMembers(@Req() req: Request, @Param('id') groupId: string) {
    return this.svc.getGroupMembers(groupId, this.uid(req));
  }

  /** GET /delivery-groups/:id/messages */
  @Get(':id/messages')
  getMessages(
    @Req()   req:   Request,
    @Param('id')   groupId: string,
    @Query('page',  new ParseIntPipe({ optional: true })) page  = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 30,
  ) {
    return this.svc.getGroupMessages(groupId, this.uid(req), page, limit);
  }

  /** POST /delivery-groups/:id/messages */
  @Post(':id/messages')
  sendMessage(
    @Req()  req:     Request,
    @Param('id')     groupId: string,
    @Body()          dto:     SendGroupMessageDto,
  ) {
    return this.svc.sendGroupMessage(groupId, this.uid(req), dto);
  }

  /** PATCH /delivery-groups/:id/messages/:msgId */
  @Patch(':id/messages/:msgId')
  editMessage(
    @Req()  req:      Request,
    @Param('id')      groupId:   string,
    @Param('msgId')   messageId: string,
    @Body()           dto:       EditGroupMessageDto,
  ) {
    return this.svc.editGroupMessage(groupId, messageId, this.uid(req), dto);
  }

  /** DELETE /delivery-groups/:id/messages/:msgId */
  @Delete(':id/messages/:msgId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteMessage(
    @Req()  req:      Request,
    @Param('id')      groupId:   string,
    @Param('msgId')   messageId: string,
    @Body()           dto:       DeleteGroupMessageDto,
  ): Promise<void> {
    return this.svc.deleteGroupMessage(groupId, messageId, this.uid(req), dto);
  }

  /** POST /delivery-groups/:id/messages/:msgId/reactions */
  @Post(':id/messages/:msgId/reactions')
  @HttpCode(HttpStatus.OK)
  toggleReaction(
    @Req()  req:      Request,
    @Param('id')      groupId:   string,
    @Param('msgId')   messageId: string,
    @Body()           dto:       ToggleGroupReactionDto,
  ) {
    return this.svc.toggleGroupReaction(groupId, messageId, this.uid(req), dto);
  }

  /** PATCH /delivery-groups/:id/read */
  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markAsRead(@Req() req: Request, @Param('id') groupId: string): Promise<void> {
    return this.svc.markGroupAsRead(groupId, this.uid(req));
  }
}
