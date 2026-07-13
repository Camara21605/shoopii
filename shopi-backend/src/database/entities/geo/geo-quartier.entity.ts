import { Entity, Column } from 'typeorm';
import { GeoBaseEntity }  from './geo-base.entity';

@Entity('geo_quartiers')
export class GeoQuartier extends GeoBaseEntity {
  @Column({ type: 'integer', nullable: true, default: 0 })
  population: number;
}
