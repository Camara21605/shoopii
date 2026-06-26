/* ============================================================
 * FICHIER : src/modules/location/interfaces/location.interfaces.ts
 * RÔLE    : Interfaces TypeScript partagées dans tout le module
 *           location (services, gateway, controllers).
 * ============================================================ */

/** Paire de coordonnées GPS */
export interface ICoordinates {
  latitude:  number;
  longitude: number;
}

/** Adresse structurée complète */
export interface IAddress {
  adresse?:    string;
  quartier?:   string;
  commune?:    string;
  ville:       string;
  region?:     string;
  prefecture?: string;
  pays:        string;
  codePostal?: string;
  latitude?:   number;
  longitude?:  number;
}

/** Résultat d'un reverse geocoding Nominatim */
export interface INominatimResult {
  displayName:  string;
  adresse?:     string;
  quartier?:    string;
  commune?:     string;
  ville?:       string;
  region?:      string;
  pays?:        string;
  codePostal?:  string;
  latitude:     number;
  longitude:    number;
}

/** Position temps réel d'un livreur */
export interface IDeliveryPosition extends ICoordinates {
  deliveryId:  string;
  userId:      string;
  precisionM?: number;
  cap?:        number;
  vitesseKmh?: number;
  sessionId?:  string;
  horodatage:  string;   // ISO 8601
}

/** Payload émis depuis le client (Socket.IO) */
export interface ILocationUpdatePayload {
  latitude:   number;
  longitude:  number;
  precisionM?: number;
  cap?:        number;
  vitesseKmh?: number;
  sessionId?:  string;
  horodatage?: string;
}

/** Résultat de recherche de proximité */
export interface IProximityResult {
  id:          string;
  nom:         string;
  type:        'livreur' | 'entreprise' | 'correspondant';
  latitude:    number;
  longitude:   number;
  distanceKm:  number;
  adresse?:    string;
  ville?:      string;
  telephone?:  string;
  logo?:       string;
  disponible?: boolean;
}

/** Socket authentifié (userId injecté par le guard) */
export interface IAuthenticatedSocket {
  id:   string;
  data: { userId: string; deliveryId?: string };
  join(room: string): Promise<void>;
  leave(room: string): Promise<void>;
  emit(event: string, data: unknown): void;
  handshake: { auth?: { token?: string }; query?: Record<string, unknown>; headers?: Record<string, string> };
}
