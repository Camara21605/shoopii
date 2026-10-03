/**
 * Clés du cache react-query — UNE seule source de vérité.
 *
 * Pourquoi : une clé tapée à la main dans deux écrans (« favoris » ici,
 * « favorites » là) = deux téléchargements de la même donnée, ou une liste qui
 * ne se rafraîchit pas après une modification. Toujours passer par `qk`.
 *
 * Règles :
 *   · une clé commence par son domaine (cart, shop, product…), du plus large au
 *     plus précis : invalider `qk.shop.all` rafraîchit tout ce qui concerne les
 *     boutiques, `qk.shop.detail(id)` une seule boutique (et ses sous-clés) ;
 *   · `as const` : les clés sont typées (pas de faute de frappe possible).
 * Les VALEURS sont celles déjà utilisées dans l'application (compatibilité avec
 * le code existant qui invalide par exemple ['cart'] ou ['follows']).
 */
export const qk = {
  /* Catalogue public */
  companyTypes: ['company-types'] as const,
  categories: ['categories'] as const,
  products: {
    all: ['products'] as const,
    list: (type: 'detail' | 'gros') => ['products', type] as const,
    search: (search: string, typeId: string | null, categoryId: string | null) => ['products', 'search', search, typeId, categoryId] as const,
    byCategory: (categoryId: string | null) => ['products', 'category', categoryId] as const,
  },
  shops: {
    home: ['shops', 'home'] as const,
    search: (search: string) => ['shops', 'all', search] as const,
  },

  /* Profil entreprise */
  shop: {
    all: ['shop'] as const,
    detail: (id: string | undefined) => ['shop', id] as const,
    products: (id: string | undefined) => ['shop', id, 'products'] as const,
    services: (id: string | undefined) => ['shop', id, 'services'] as const,
    drivers: (id: string | undefined) => ['shop', id, 'drivers'] as const,
    relays: (id: string | undefined) => ['shop', id, 'relays'] as const,
    promos: (id: string | undefined) => ['shop', id, 'promos'] as const,
    reviews: (id: string | undefined) => ['shop', id, 'reviews'] as const,
  },

  /* Fiche produit */
  product: {
    detail: (id: string) => ['product', id] as const,
    similar: (id: string) => ['product', id, 'similar'] as const,
    together: (id: string) => ['product', id, 'together'] as const,
  },
  deliveryFee: (city: string | null | undefined) => ['delivery-fee', city] as const,

  /* Explorer */
  explore: {
    all: ['explore'] as const,
    grid: (filters: object) => ['explore', 'grid', filters] as const,
    section: (kind: string, city: string | null) => ['explore', kind, city] as const,
  },

  /* Panier, favoris, souhaits, abonnements (propres au client connecté) */
  cart: ['cart'] as const,
  favorites: { ids: ['favorite-ids'] as const, list: ['client-favs'] as const },
  wishlist: { ids: ['wish-ids'] as const, list: ['client-wishlist'] as const },
  follows: {
    all: ['follows'] as const,
    mine: ['follows', 'all'] as const,
    shops: ['follows', 'entreprises'] as const,
    status: (kind: string, id: string | undefined) => ['follow-status', kind, id] as const,
    statusAll: ['follow-status'] as const,
    team: (shopId: string | undefined, ids: string[]) => ['follow-status', 'team', shopId, ids] as const,
  },

  /* Profil client */
  profile: {
    me: ['client-profile'] as const,
    orders: ['client-orders'] as const,
    returns: ['client-returns'] as const,
    city: ['home-city'] as const,
  },
  wallet: ['wallet-balance'] as const,
  defaultCity: ['default-city'] as const,
  villes: (dial: string) => ['villes', dial] as const,
  communes: (cityId: string | null) => ['geo', 'commune', cityId] as const,

  /* Passage de commande */
  checkout: {
    addresses: ['checkout', 'addresses'] as const,
    contact: ['checkout', 'contact'] as const,
    followedTeam: ['checkout', 'followed-team'] as const,
  },

  /* Espace entreprise › Ajouter un produit (sous-clés de ['company'] : rafraîchies avec qk.company.all) */
  companyProduct: {
    categories: ['company', 'product-categories'] as const,
    shopDefaults: ['company', 'shop-defaults'] as const,
    commission: (montant: number | null) => ['company', 'commission', montant] as const,
    slug: (slug: string) => ['company', 'slug', slug] as const,
  },

  /* Notifications */
  notifications: {
    all: ['notifications'] as const,
    list: (unreadOnly: boolean) => ['notifications', unreadOnly] as const,
    unread: ['unread', 'notifications'] as const,
  },

  /* Espace entreprise */
  company: {
    all: ['company'] as const,
    overview: ['company', 'overview'] as const,
    identity: ['company', 'identity'] as const,
    position: ['company', 'position'] as const,
    permissions: ['company', 'permissions'] as const,
    badges: ['company', 'badges'] as const,
    search: (term: string) => ['company', 'search', term] as const,
    /* Commandes de la boutique */
    orders: ['company', 'orders'] as const,
    order: (uuid: string) => ['company', 'orders', uuid] as const,
    drivers: ['company', 'drivers'] as const,
    /* Paramètres de la boutique */
    settings: ['company', 'settings'] as const,
    settingsCategories: ['company', 'settings', 'categories'] as const,
    settingsZones: ['company', 'settings', 'zones'] as const,
    settingsWallet: ['company', 'settings', 'wallet'] as const,
    settingsCommissions: ['company', 'settings', 'commissions'] as const,
    settingsNotifs: ['company', 'settings', 'notifs'] as const,
  },

  /* Messagerie (compteur de l'en-tête ; mêmes valeurs que la messagerie) */
  messages: {
    unread: ['unread', 'messages'] as const,
  },
} as const;
