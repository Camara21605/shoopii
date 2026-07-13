import { Entity, Column } from 'typeorm';
import { GeoBaseEntity }  from './geo-base.entity';

@Entity('geo_prefectures')
export class GeoPrefecture extends GeoBaseEntity {
  @Column({ length: 255, nullable: true, default: '' })
  chef_lieu: string;
}
