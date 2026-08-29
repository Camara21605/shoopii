/*
 * FICHIER : src/shared/messagerie/data/messagerieTypes.ts
 * Types TypeScript et config rôles partagés par toute la messagerie Shoneya.
 */

export type UserRole = 'client' | 'vendeur' | 'livreur' | 'partenaire' | 'correspondant' | 'admin' | 'groupe';

export interface ChatUser {
  id:       string;   // profile ID (contactId)
  userId?:  string;   // JWT user ID — utilisé pour matcher les événements de présence Socket.IO
  name:     string;
  role:     UserRole;
  ava:      string;      // emoji ou initiales
  avaColor: string;      // gradient CSS background
  online:   boolean;
  context?: string;      // ex : "Commande SH-2025-0901"
}

export type MessageType = 'text' | 'image' | 'video' | 'file' | 'voice' | 'product' | 'order' | 'location' | 'call';

export interface ChatMessage {
  id:          string;
  from:        string;     // userId ou 'me'
  type:        MessageType;
  text?:       string;
  time:        string;     // "14:32"
  /**
   * Statut de lecture — 3 états (identique WhatsApp) :
   *   delivered=false, read=false → ✓  (envoyé, pas encore livré)
   *   delivered=true,  read=false → ✓✓ gris (livré, pas encore lu)
   *   read=true                   → ✓✓ coloré (vu par le destinataire)
   */
  delivered?:  boolean;   // arrivé chez le destinataire (connecté)
  read:        boolean;   // ouvert et vu par le destinataire
  replyToId?:  string;    // message auquel on répond
  duration?:   string;    // vocaux ex: "0:24"
  mediaUrl?:   string;    // URL Cloudinary (image / vidéo / document)
  mediaName?:  string;    // nom du fichier (documents)
  mediaMime?:  string;    // type MIME
  /** Carte produit partagée — `summary` est le résumé (nom/prix) déjà formaté par le backend. */
  product?:    { productId: string; summary: string };
  /** Carte commande partagée — `summary` est le résumé (numéro/statut/total) déjà formaté par le backend. */
  order?:      { orderId: string; summary: string };
  /** Position GPS partagée — `label` est une adresse lisible si fournie, sinon null. */
  location?:   { lat: number; lng: number; label: string | null };
  /** Métadonnées d'un événement d'appel audio */
  callMeta?:   {
    status:    'completed' | 'missed' | 'rejected' | 'cancelled' | 'busy';
    direction: 'outgoing' | 'incoming';
    duration?: number;                 // secondes
    callType?: 'audio' | 'video';     // type d'appel
  };
  /** true si le contenu a été modifié après envoi */
  isEdited?:   boolean;
  /** true si le message a été supprimé (soft delete) */
  deleted?:    boolean;
  /**
   * Réactions emoji — clé = emoji, valeur = tableau de userIds ayant réagi.
   * Ex: { "❤️": ["user-1", "user-2"], "👍": ["user-3"] }
   */
  reactions?:  Record<string, string[]>;
  /** true si l'envoi a échoué (optimiste jamais confirmé par le serveur) — affiche "Échec, réessayer". */
  sendFailed?: boolean;
}

export interface Conversation {
  id:       string;
  userId:   string;
  pinned:   boolean;
  unread:   number;
  lastMsg:  string;
  lastTime: string;
  muted:    boolean;
  messages: ChatMessage[];
  /** Groupe de livraison automatique */
  isGroup?:        boolean;
  groupStatus?:    'active' | 'completed' | 'expired' | 'cancelled';
  commandeNumero?: string;
  memberCount?:    number;
  expiresAt?:      string;
  description?:    string;
  /** Pagination des messages — undefined = pas encore su, true = scroll-up peut charger plus ancien. */
  hasMoreMessages?: boolean;
  /** true pendant le chargement des messages plus anciens (spinner en haut de MessagesZone). */
  loadingOlder?:    boolean;
}

export interface GroupMember {
  id:          string;
  actorType:   'client' | 'company' | 'delivery' | 'correspondent';
  actorId:     string;
  userId:      string;
  displayName: string;
  joinedAt:    string;
}

// ── Types appels de groupe ─────────────────────────────────────

/** Invitation d'appel entrant pour un groupe. */
export interface GroupCallInvite {
  callId:        string;
  groupId:       string;
  initiatorId:   string;
  initiatorName: string;
  callType:      'audio' | 'video';
}

/** État d'un pair WebRTC dans un appel de groupe. */
export interface GroupCallPeer {
  userId:       string;
  displayName:  string;
  stream:       MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
  /** undefined = connexion stable — coupure réseau transitoire avec CE pair uniquement (n'affecte pas les autres). */
  connectionState?: 'unstable' | 'reconnecting';
}

/** État complet de l'appel de groupe actif. */
export interface GroupCallState {
  callId:   string;
  groupId:  string;
  callType: 'audio' | 'video';
  /** 'joining' = on a rejoint mais les PeerConnections ne sont pas encore établies */
  status:   'joining' | 'connected';
}

export interface NewConvUser {
  id:   string;
  name: string;
  role: UserRole;
  ava:  string;
  sub:  string;
}

// ── Résultat brut de GET /messagerie/users/search ───────────────
export interface ApiSearchUser {
  id:       string;   // profileId
  type:     string;   // actor type (client, company, delivery, correspondent)
  name:     string;
  logo:     string | null;
  subtitle: string;
  online:   boolean;
}

const SEARCH_TYPE_TO_ROLE: Record<string, UserRole> = {
  company:       'vendeur',
  delivery:      'livreur',
  correspondent: 'correspondant',
  client:        'client',
};

function initialsFrom(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}

/**
 * Convertit un résultat de GET /messagerie/users/search en NewConvUser
 * exploitable par startNewConv() — utilisé par ConvList pour démarrer une
 * conversation directement depuis un contact lié (sans conversation
 * existante) affiché dans l'onglet par rôle dédié, ou depuis la recherche
 * globale de l'onglet "Tous".
 */
export function apiSearchUserToNewConvUser(api: ApiSearchUser): NewConvUser {
  return {
    id:   `${api.type}:${api.id}`,
    name: api.name,
    role: SEARCH_TYPE_TO_ROLE[api.type] ?? 'client',
    ava:  api.logo ?? initialsFrom(api.name) ?? '?',
    sub:  api.subtitle,
  };
}

// ── Config rôles (couleurs + icônes) ──────────────────────────
export function getRoleConfig(t: (key: string) => string): Record<UserRole, { label: string; icon: string; color: string; bg: string }> {
  return {
    groupe:        { label: t('messagerie.roles.groupe'),        icon: '📦', color: '#0E7490',  bg: 'rgba(14,116,144,.1)'  },
    client:        { label: t('messagerie.roles.client'),        icon: '🛍️', color: '#1A4FC4',  bg: 'rgba(26,79,196,.1)'   },
    vendeur:       { label: t('messagerie.roles.vendeur'),       icon: '🏪', color: '#047857',  bg: 'rgba(4,120,87,.1)'    },
    livreur:       { label: t('messagerie.roles.livreur'),       icon: '🛵', color: '#0E7490',  bg: 'rgba(14,116,144,.1)'  },
    partenaire:    { label: t('messagerie.roles.partenaire'),    icon: '🤝', color: '#6D28D9',  bg: 'rgba(109,40,217,.1)'  },
    correspondant: { label: t('messagerie.roles.correspondant'), icon: '📍', color: '#B45309',  bg: 'rgba(180,83,9,.1)'    },
    admin:         { label: t('messagerie.roles.admin'),         icon: '🛡️', color: '#DC2626',  bg: 'rgba(220,38,38,.1)'   },
  };
}

// ── Emojis picker ──────────────────────────────────────────────
export const EMOJIS: Record<string, string[]> = {
  'Récents': ['😀','👋','🙏','✅','🚀','❤️','👍','💯','🔥','😊','🎉','💪'],
  'Smileys': ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊','😇','🥰','😍','😘','😋','😛','😜','🤪','😴','😔','🤔'],
  'Gestes':  ['👋','🤚','✋','👌','✌️','🤞','💪','🙏','👐','🤝','👍','👎','✊','👏','🙌'],
  'Objets':  ['📱','💻','⌚','🎧','📷','🎮','📦','🛵','💰','💳','📄','🔑','⚡','🌟','💎','🏆','🎯','📍'],
};