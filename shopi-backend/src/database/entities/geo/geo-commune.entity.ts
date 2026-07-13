import { Entity, Column } from 'typeorm';
import { GeoBaseEntity }  from './geo-base.entity';

export type CommuneType = 'urbaine' | 'semi-urbaine' | 'rurale';

@Entity('geo_communes')
export class GeoCommune extends GeoBaseEntity {
  @Column({
    type: 'enum',
    enum: ['urbaine', 'semi-urbaine', 'rurale'],
    default: 'urbaine',
  })
  type: CommuneType;
}
