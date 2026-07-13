import { Entity, Column } from 'typeorm';
import { GeoBaseEntity }  from './geo-base.entity';

@Entity('geo_pays')
export class GeoPays extends GeoBaseEntity {
  @Column({ length: 3, nullable: true, name: 'iso3', default: '' })
  iso3: string;

  @Column({ length: 10, nullable: true, name: 'indicatif', default: '' })
  indicatif: string;

  @Column({ length: 10, nullable: true, name: 'devise', default: '' })
  devise: string;
}
