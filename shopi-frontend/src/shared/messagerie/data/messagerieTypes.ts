/*
 * FICHIER : src/shared/messagerie/data/messagerieTypes.ts
 * Types TypeScript et config rôles partagés par toute la messagerie Shopi.
 */

export type UserRole = 'client' | 'vendeur' | 'livreur' | 'partenaire' | 'correspondant' | 'admin';

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

export type MessageType = 'text' | 'image' | 'video' | 'file' | 'voice' | 'product' | 'order' | 'call';

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
  product?:    { em: string; nm: string; price: string };
  order?:      { id: string; nm: string; status: string };
  /** Métadonnées d'un événement d'appel audio */
  callMeta?:   {
    status:    'completed' | 'missed' | 'rejected' | 'cancelled' | 'busy';
    direction: 'outgoing' | 'incoming';
    duration?: number;                 // secondes
    callType?: 'audio' | 'video';     // type d'appel
  };
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
}

export interface NewConvUser {
  id:   string;
  name: string;
  role: UserRole;
  ava:  string;
  sub:  string;
}

// ── Config rôles (couleurs + icônes) ──────────────────────────
export const ROLE_CONFIG: Record<UserRole, { label: string; icon: string; color: string; bg: string }> = {
  client:        { label: 'Client',        icon: '🛍️', color: '#1A4FC4',  bg: 'rgba(26,79,196,.1)'   },
  vendeur:       { label: 'Vendeur',       icon: '🏪', color: '#047857',  bg: 'rgba(4,120,87,.1)'    },
  livreur:       { label: 'Livreur',       icon: '🛵', color: '#0E7490',  bg: 'rgba(14,116,144,.1)'  },
  partenaire:    { label: 'Partenaire',    icon: '🤝', color: '#6D28D9',  bg: 'rgba(109,40,217,.1)'  },
  correspondant: { label: 'Correspondant', icon: '📍', color: '#B45309',  bg: 'rgba(180,83,9,.1)'    },
  admin:         { label: 'Admin',         icon: '🛡️', color: '#DC2626',  bg: 'rgba(220,38,38,.1)'   },
};

// ── Emojis picker ──────────────────────────────────────────────
export const EMOJIS: Record<string, string[]> = {
  'Récents': ['😀','👋','🙏','✅','🚀','❤️','👍','💯','🔥','😊','🎉','💪'],
  'Smileys': ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊','😇','🥰','😍','😘','😋','😛','😜','🤪','😴','😔','🤔'],
  'Gestes':  ['👋','🤚','✋','👌','✌️','🤞','💪','🙏','👐','🤝','👍','👎','✊','👏','🙌'],
  'Objets':  ['📱','💻','⌚','🎧','📷','🎮','📦','🛵','💰','💳','📄','🔑','⚡','🌟','💎','🏆','🎯','📍'],
};