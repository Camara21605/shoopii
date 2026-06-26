import { EventSubscriber, EntitySubscriberInterface } from 'typeorm';
import { DataSource } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

@Injectable()
export class DisableFkSubscriber {
  constructor(@InjectDataSource() private dataSource: DataSource) {}

  async onModuleInit() {
    // Désactive les FK checks, synchronise, réactive
    await this.dataSource.query('SET FOREIGN_KEY_CHECKS = 0');
    await this.dataSource.synchronize();
    await this.dataSource.query('SET FOREIGN_KEY_CHECKS = 1');
  }
}