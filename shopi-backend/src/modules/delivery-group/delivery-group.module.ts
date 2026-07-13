import { Module }         from '@nestjs/common';
import { TypeOrmModule }  from '@nestjs/typeorm';

import { DeliveryGroup }       from '../../database/entities/delivery-group/delivery-group.entity';
import { DeliveryGroupMember } from '../../database/entities/delivery-group/delivery-group-member.entity';
import { GroupMessage }        from '../../database/entities/delivery-group/group-message.entity';

import { MessagerieModule }        from '../messagerie/messagerie.module';
import { DeliveryGroupService }    from './delivery-group.service';
import { DeliveryGroupController } from './delivery-group.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([DeliveryGroup, DeliveryGroupMember, GroupMessage]),
    MessagerieModule,
  ],
  controllers: [DeliveryGroupController],
  providers:   [DeliveryGroupService],
  exports:     [DeliveryGroupService],
})
export class DeliveryGroupModule {}
