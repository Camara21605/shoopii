/* ============================================================
 * FICHIER : src/modules/location/services/geo.service.ts
 * RÔLE    : Calculs géographiques purs (distance, cap, bbox).
 *           Aucune dépendance externe — formule Haversine pure.
 *           Peut être utilisé partout dans l'application.
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import type { ICoordinates, IProximityResult } from '../interfaces/location.interfaces';

const EARTH_RADIUS_KM = 6371;

@Injectable()
export class GeoService {

  /* ── Distance ──────────────────────────────────────────────── */

  /**
   * Calcule la distance entre deux points GPS (formule Haversine).
   * @returns Distance en kilomètres (arrondie à 2 décimales).
   */
  distanceKm(a: ICoordinates, b: ICoordinates): number {
    const dLat = this.toRad(b.latitude  - a.latitude);
    const dLng = this.toRad(b.longitude - a.longitude);
    const lat1 = this.toRad(a.latitude);
    const lat2 = this.toRad(b.latitude);

    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    return Math.round(EARTH_RADIUS_KM * c * 100) / 100;
  }

  /**
   * Calcule la distance entre deux points en mètres.
   */
  distanceM(a: ICoordinates, b: ICoordinates): number {
    return this.distanceKm(a, b) * 1000;
  }

  /* ── Bounding box ──────────────────────────────────────────── */

  /**
   * Retourne un bounding box (rectangle) autour d'un point GPS.
   * Utile pour les requêtes SQL WHERE lat BETWEEN x AND y.
   * @param center  Centre du rectangle
   * @param rayonKm Rayon en km
   */
  boundingBox(
    center:  ICoordinates,
    rayonKm: number,
  ): { latMin: number; latMax: number; lngMin: number; lngMax: number } {
    const deltaLat = rayonKm / EARTH_RADIUS_KM;
    const deltaLng =
      rayonKm / (EARTH_RADIUS_KM * Math.cos(this.toRad(center.latitude)));

    const latDeg = this.toDeg(deltaLat);
    const lngDeg = this.toDeg(deltaLng);

    return {
      latMin: center.latitude  - latDeg,
      latMax: center.latitude  + latDeg,
      lngMin: center.longitude - lngDeg,
      lngMax: center.longitude + lngDeg,
    };
  }

  /* ── Cap (bearing) ─────────────────────────────────────────── */

  /**
   * Calcule le cap de déplacement de A vers B (0–360°).
   */
  bearing(a: ICoordinates, b: ICoordinates): number {
    const dLng  = this.toRad(b.longitude - a.longitude);
    const lat1  = this.toRad(a.latitude);
    const lat2  = this.toRad(b.latitude);

    const y = Math.sin(dLng) * Math.cos(lat2);
    const x =
      Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

    const deg = (this.toDeg(Math.atan2(y, x)) + 360) % 360;
    return Math.round(deg * 10) / 10;
  }

  /* ── Tri par proximité ─────────────────────────────────────── */

  /**
   * Trie un tableau d'entités par distance croissante.
   * Filtre également les entités hors du rayon spécifié.
   */
  sortByProximity<T extends { latitude?: number | null; longitude?: number | null }>(
    items:   T[],
    origin:  ICoordinates,
    rayonKm: number,
  ): Array<T & { distanceKm: number }> {
    return items
      .filter(item => item.latitude != null && item.longitude != null)
      .map(item => ({
        ...item,
        distanceKm: this.distanceKm(origin, {
          latitude:  Number(item.latitude),
          longitude: Number(item.longitude),
        }),
      }))
      .filter(item => item.distanceKm <= rayonKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }

  /* ── Détection de mouvement significatif ──────────────────── */

  /**
   * Détermine si le mouvement entre deux positions est significatif.
   * Évite les mises à jour inutiles quand le livreur est immobile.
   * @param seuilM  Seuil minimum en mètres (défaut : 10m)
   */
  isSignificantMove(
    prev:    ICoordinates,
    next:    ICoordinates,
    seuilM:  number = 10,
  ): boolean {
    return this.distanceM(prev, next) >= seuilM;
  }

  /* ── Formatage distance lisible ────────────────────────────── */

  formatDistance(km: number): string {
    if (km < 1) return `${Math.round(km * 1000)} m`;
    return `${km.toFixed(1)} km`;
  }

  /* ── Durée estimée ─────────────────────────────────────────── */

  /**
   * Estimation du temps de trajet à moto (vitesse moyenne : 30 km/h).
   * @returns Chaîne lisible : "5 min", "1h 20 min"
   */
  estimatedDuration(km: number, vitesseMoyenneKmh = 30): string {
    const minutes = Math.ceil((km / vitesseMoyenneKmh) * 60);
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m} min` : `${h}h`;
  }

  /* ── Privées ───────────────────────────────────────────────── */

  private toRad(deg: number): number { return (deg * Math.PI) / 180; }
  private toDeg(rad: number): number { return (rad * 180) / Math.PI; }
}
