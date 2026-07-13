import { Entity, Column } from 'typeorm';
import { GeoBaseEntity }  from './geo-base.entity';

export type ZoneCoverageType = 'pays' | 'region' | 'prefecture' | 'commune' | 'quartier';

@Entity('geo_zones')
export class GeoZone extends GeoBaseEntity {
  @Column({
    type: 'enum',
    enum: ['pays', 'region', 'prefecture', 'commune', 'quartier'],
    default: 'commune',
    name: 'couverture_type',
  })
  couvertureType: ZoneCoverageType;

  /* Stocké en JSON — tableau de UUIDs des entités couvertes.
   * jsonb gère nativement les tableaux vides sans ambiguïté. */
  @Column({ type: 'jsonb', default: '[]', name: 'couverture_ids' })
  couvertureIds: string[];

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true, name: 'rayon_km' })
  rayonKm: number;

  @Column({ type: 'integer', default: 0, name: 'frais_livraison' })
  fraisLivraison: number;

  @Column({ type: 'integer', nullable: true, name: 'temps_estime' })
  tempsEstime: number;

  @Column({ type: 'integer', default: 0, name: 'acteurs_cover' })
  acteursCover: number;
}
