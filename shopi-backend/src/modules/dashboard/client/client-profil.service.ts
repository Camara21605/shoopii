/* ============================================================
 * FICHIER : src/modules/dashboard/client/client-profil.service.ts
 *
 * RÔLE : Logique métier du profil client.
 *        Lit l'entité Client (+ User lié) et renvoie un objet
 *        agrégé prêt à afficher (identité, KPI, wallet, points,
 *        moyens de paiement, infos perso, activité).
 *
 * SOURCE : table `clients` (entité Client) jointe à `users`.
 *
 * NOTE : Certains blocs (commandes, abonnements, favoris, avis)
 *        dépendent d'autres tables (commande, abonnement,
 *        product-like…). On expose ici ce qui est disponible
 *        directement sur l'entité Client ; les autres seront
 *        branchés via leurs propres services quand prêts.
 * ============================================================ */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository }              from '@nestjs/typeorm';
import { Repository }                    from 'typeorm';

import { Client }       from '../../../database/entities/profiles/client-profile.entity';
import { User }         from '../../../database/entities/user.entity';

/* ── Forme de la réponse renvoyée au frontend ── */
export interface ClientProfilResponse {
  /* Identité */
  id:            string;
  initiales:     string;
  nomComplet:    string;
  email:         string;
  emailVerifie:  boolean;
  telephone:     string | null;
  localisation:  string;
  membreDepuis:  string;
  enLigne:       boolean;
  bio:           string | null;
  genre:         string | null;
  dateNaissance: string | null;
  langue:        string;

  /* Statut / badges */
  twoFaEnabled:  boolean;
  status:        string;

  /* KPI / statistiques */
  totalOrders:    number;
  totalSpent:     number;
  totalFavorites: number;

  /* Wallet (placeholder tant que pas de table wallet dédiée côté client) */
  walletSolde:   number;

  /* Points fidélité */
  shopiPoints:      number;
  pointsGagnesMois: number;
  pointsUtilises:   number;
  pointsExpiration: string | null;

  /* Moyens de paiement (parsés depuis le JSON) */
  paymentMethods: unknown[];

  /* Journal d'activité (parsé depuis le JSON) */
  activityLog: unknown[];
}

@Injectable()
export class ClientProfilService {

  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
  ) {}

  /**
   * Récupère le profil complet du client connecté.
   * @param userId  ID du user extrait du JWT
   */
  async getMonProfil(userId: string): Promise<ClientProfilResponse> {

    /* Charger le profil client + le user lié en une requête */
    const client = await this.clientRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.user', 'user')
      .where('c.userId = :userId', { userId })
      .getOne();

    if (!client) {
      throw new NotFoundException('Profil client introuvable.');
    }

    const user = client.user;

    /* ── Identité dérivée ── */
    const prenom = user?.firstName ?? '';
    const nom    = user?.lastName  ?? '';
    const nomComplet = client.fullName || `${prenom} ${nom}`.trim() || 'Client';
    const initiales  = (prenom[0] ?? '') + (nom[0] ?? '') || nomComplet.slice(0, 2);

    /* En ligne = connexion il y a moins de 15 min */
    const enLigne = user?.lastLoginAt
      ? (Date.now() - new Date(user.lastLoginAt).getTime()) < 15 * 60 * 1000
      : false;

    /* Membre depuis (mois + année de création) */
    const membreDepuis = client.createdAt
      ? `Membre depuis ${new Date(client.createdAt).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}`
      : 'Nouveau membre';

    /* ── Parsing sûr des champs JSON ── */
    const paymentMethods = this.parseJsonArray(client.paymentMethods);
    const activityLog     = this.parseJsonArray(client.activityLog);

    return {
      id:            client.id,
      initiales:     initiales.toUpperCase(),
      nomComplet,
      email:         user?.email ?? '',
      emailVerifie:  true, // à brancher sur un vrai champ si présent dans User
      telephone:     user?.phone ?? null,
      localisation:  'Conakry, Guinée', // à enrichir depuis adresses si besoin
      membreDepuis,
      enLigne,
      bio:           client.bio,
      genre:         client.genre,
      dateNaissance: client.dateNaissance ? new Date(client.dateNaissance).toISOString().slice(0, 10) : null,
      langue:        client.langue,

      twoFaEnabled:  client.twoFaEnabled,
      status:        client.status,

      totalOrders:    client.totalOrders,
      totalSpent:     Number(client.totalSpent ?? 0),
      totalFavorites: client.totalFavorites,

      walletSolde:   0, // TODO : brancher sur la table wallet quand dispo

      shopiPoints:      client.shopiPoints,
      pointsGagnesMois: client.pointsGagnesMois,
      pointsUtilises:   client.pointsUtilises,
      pointsExpiration: client.pointsExpiration ? new Date(client.pointsExpiration).toISOString().slice(0, 10) : null,

      paymentMethods,
      activityLog,
    };
  }

  /**
   * Parse un champ JSON stocké en string (ou déjà objet) en tableau sûr.
   * Évite un crash si le champ est null / mal formé.
   */
  private parseJsonArray(value: unknown): unknown[] {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }
}