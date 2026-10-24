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
  /* Stories de l'accueil (GET /public/stories) */
  homeStories: ['public', 'stories'] as const,
  /* Promotions de l'accueil (GET /promotions/public) */
  homePromos: ['public', 'promotions'] as const,
  /* Galerie de l'accueil : images du produit le plus consulté (GET /public/produits/plus-consulte) */
  homeGallery: ['public', 'products', 'plus-consulte'] as const,
  /* Livreurs et points relais de l'accueil (préfixe [kind] : rafraîchis après un abonnement) */
  /* Recherche de l'accueil : comptes correspondants (suivis compris) — préfixe = type de compte */
  accountSearch: (kind: 'shops' | 'livreurs' | 'correspondants', term: string) => [kind, 'search', term] as const,
  /* Accueil : sans les comptes déjà suivis par CE compte (viewer) — voir masquerSuivis */
  homeActors: (kind: 'livreurs' | 'correspondants', viewer: string | null) => [kind, 'home', viewer] as const,
  /* Profil public d'un point relais (préfixe ['correspondants'] : rafraîchi après un abonnement) */
  relayPublic: (id: string) => ['correspondants', 'profile', id] as const,
  /* Identifiant de MON point relais (compte correspondant) — pour reconnaître mon propre profil */
  myRelayId: ['correspondants', 'me'] as const,
  /* Profil public d'un livreur vu par un client (préfixe ['livreurs'] : rafraîchi après un abonnement) */
  driverPublic: (id: string) => ['livreurs', 'profile', id] as const,
  /* Fiche publique d'une prestation (GET /public/services/:id) */
  servicePublic: (id: string) => ['services', 'public', id] as const,
  /* Écran Itinéraire : trajet par mode (départ arrondi à ~100 m pour ne pas recalculer à chaque pas) */
  directions: (from: string, to: string, profile: string) => ['directions', from, to, profile] as const,
  /* Bascule compte pro ↔ compte client lié (GET /auth/client-account/status) */
  accountLink: ['auth', 'client-account'] as const,
  /* Centre d'aide & support */
  help: {
    categories: ['help', 'categories'] as const,
    category: (slug: string) => ['help', 'categories', slug] as const,
    article: (slug: string) => ['help', 'articles', slug] as const,
    popular: ['help', 'popular'] as const,
    faq: ['help', 'faq'] as const,
    search: (q: string) => ['help', 'search', q] as const,
    suggest: (q: string) => ['help', 'suggest', q] as const,
    ticketsAll: ['support', 'tickets'] as const,
    tickets: (status: string) => ['support', 'tickets', status] as const,
    ticket: (id: string) => ['support', 'tickets', 'detail', id] as const,
  },
  shops: {
    home: (viewer: string | null) => ['shops', 'home', viewer] as const,
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
  /* Comparaison : produits proposables pour compléter (GET /public/produits/comparables) */
  comparables: (ids: string[], scope: 'sub' | 'cat', search: string, limit: number) => ['product', 'comparables', ids.join(','), scope, search, limit] as const,

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
    /** Suivi d'UNE commande (écran natif /commandes/:id) */
    order: (id: string) => ['client-orders', id] as const,
    returns: ['client-returns'] as const,
    city: ['home-city'] as const,
  },
  /* Paramètres du compte client (mêmes valeurs que les écrans src/app/(app)/parametres) */
  accountSettings: {
    all: ['settings'] as const,
    profil: ['settings', 'profil'] as const,
    /* Mes données : rapport de confidentialité (GET /client/parametres/donnees/rapport) */
    rapportDonnees: ['settings', 'donnees', 'rapport'] as const,
  },
  wallet: ['wallet-balance'] as const,
  /* Mes adresses (GET /location/addresses) — après une écriture, rafraîchir aussi
   * qk.checkout.addresses, qk.profile.city et qk.defaultCity (voir features/addresses/hooks.ts) */
  addresses: ['addresses'] as const,
  defaultCity: ['default-city'] as const,
  villes: (dial: string) => ['villes', dial] as const,
  /* Communes d'une ville (GET /geo/ville-communes) — sélecteur « Ville › Commune » d'Explorer */
  villeCommunes: (ville: string) => ['villes', 'communes', ville] as const,
  communes: (cityId: string | null) => ['geo', 'commune', cityId] as const,
  /* Référentiel du super admin (formulaire d'adresse) : pays → villes → communes → quartiers */
  geo: {
    pays: ['geo-ref', 'pays'] as const,
    villes: (paysId: string | null) => ['geo-ref', 'villes', paysId] as const,
    items: (niveau: 'commune' | 'quartier', parentId: string | null) => ['geo-ref', niveau, parentId] as const,
  },

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

  /* Espace entreprise › Mes livreurs (sous-clés de ['company', 'drivers'] : la liste d'assignation des
   * commandes, qk.company.drivers, est rafraîchie en même temps) */
  companyDrivers: {
    all: ['company', 'drivers'] as const,
    team: ['company', 'drivers', 'team'] as const,
    stats: ['company', 'drivers', 'stats'] as const,
    zones: ['company', 'drivers', 'zones'] as const,
    recent: ['company', 'drivers', 'recent'] as const,
    detail: (id: string) => ['company', 'drivers', 'detail', id] as const,
    missions: ['company', 'drivers', 'missions'] as const,
    network: (search: string) => ['company', 'drivers', 'network', search] as const,
  },

  /* Espace entreprise › Mes correspondants */
  companyRelays: {
    all: ['company', 'relays'] as const,
    team: ['company', 'relays', 'team'] as const,
    stats: ['company', 'relays', 'stats'] as const,
    zones: ['company', 'relays', 'zones'] as const,
    recent: ['company', 'relays', 'recent'] as const,
    detail: (id: string) => ['company', 'relays', 'detail', id] as const,
    positions: (ids: string) => ['company', 'relays', 'positions', ids] as const,
    network: (search: string) => ['company', 'relays', 'network', search] as const,
  },

  /* Espace entreprise › Promotions et Fournisseurs */
  companyPromos: {
    all: ['company', 'promos'] as const,
    stats: ['company', 'promos', 'stats'] as const,
    list: (search: string) => ['company', 'promos', 'list', search] as const,
    detail: (id: string) => ['company', 'promos', 'detail', id] as const,
  },
  companySuppliers: {
    all: ['company', 'suppliers'] as const,
    list: ['company', 'suppliers', 'list'] as const,
    search: (q: string) => ['company', 'suppliers', 'search', q] as const,
    catalogue: (companyId: string) => ['company', 'suppliers', 'catalogue', companyId] as const,
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
    /* Gestion de l'équipe */
    team: ['company', 'team'] as const,
    teamStats: ['company', 'team', 'stats'] as const,
    teamPlan: ['company', 'team', 'plan'] as const,
    teamMembers: (search: string) => ['company', 'team', 'members', search] as const,
    teamInvitations: ['company', 'team', 'invitations'] as const,
    teamTemplates: ['company', 'team', 'templates'] as const,
    teamActivity: (memberId: string) => ['company', 'team', 'activity', memberId] as const,
    /* Clients & avis */
    clientsAll: ['company', 'clients'] as const,
    clients: (filters: object) => ['company', 'clients', 'list', filters] as const,
    client: (id: string) => ['company', 'clients', 'detail', id] as const,
    clientsCrm: (type: string) => ['company', 'clients', 'crm', type] as const,
    reviews: ['company', 'reviews'] as const,
    /* Analytics, SEO & Marketing */
    analytics: ['company', 'analytics'] as const,
    marketing: ['company', 'marketing'] as const,
    /* Retours, SAV, finances */
    returnsAll: ['company', 'returns'] as const,
    returnStats: ['company', 'returns', 'stats'] as const,
    returns: (filters: object) => ['company', 'returns', 'list', filters] as const,
    returnDetail: (id: string) => ['company', 'returns', 'detail', id] as const,
    savAll: ['company', 'returns', 'sav'] as const,
    savStats: ['company', 'returns', 'sav', 'stats'] as const,
    savTickets: (filters: object) => ['company', 'returns', 'sav', 'list', filters] as const,
    savTicket: (id: string) => ['company', 'returns', 'sav', 'ticket', id] as const,
    finances: ['company', 'finances'] as const,
    search: (term: string) => ['company', 'search', term] as const,
    /* Commandes de la boutique */
    orders: ['company', 'orders'] as const,
    order: (uuid: string) => ['company', 'orders', uuid] as const,
    drivers: ['company', 'drivers'] as const,
    /* Produits de la boutique */
    products: ['company', 'products'] as const,
    services: ['company', 'services'] as const,
    service: (id: string) => ['company', 'services', id] as const,
    serviceCategories: ['company', 'services', 'categories'] as const,
    product: (id: string) => ['company', 'products', id] as const,
    productStories: (id: string) => ['company', 'products', id, 'stories'] as const,
    myStories: ['company', 'stories'] as const,
    storyViewers: (storyId: string) => ['company', 'stories', storyId, 'viewers'] as const,
    commissionRate: ['company', 'commission-rate'] as const,
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
  /* Répertoire du téléphone : mes contacts qui sont sur Shoneya (GET /contacts/shopi) */
  contacts: {
    all: ['contacts'] as const,
    list: ['contacts', 'shoneya'] as const,
  },
  /* Présence (en ligne · joignable · hors ligne) du propriétaire d'un profil public */
  presence: {
    actor: (type: string, id: string, signedIn: boolean) => ['presence', 'actor', type, id, signedIn] as const,
  },
  /* Appels : contacts proposés pour ajouter quelqu'un à un appel */
  calls: {
    inviteCandidates: ['calls', 'invite-candidates'] as const,
  },
  /* Page Portefeuille (commune à tous les espaces) */
  walletPage: {
    all: ['wallet'] as const,
    summary: ['wallet', 'summary'] as const,
    chart: (period: string) => ['wallet', 'chart', period] as const,
    transactions: (filter: string) => ['wallet', 'transactions', filter] as const,
  },
  /* Espace livreur */
  livreur: {
    all: ['livreur'] as const,
    me: ['livreur', 'me'] as const,
    stats: ['livreur', 'stats'] as const,
    missions: ['livreur', 'missions'] as const,
    activeCount: ['livreur', 'active-count'] as const,
    dispos: ['livreur', 'dispos'] as const,
    encours: ['livreur', 'encours'] as const,
    history: ['livreur', 'history'] as const,
    revenus: ['livreur', 'revenus'] as const,
    chart: (period: string) => ['livreur', 'chart', period] as const,
    activity: ['livreur', 'activity'] as const,
    boutiques: ['livreur', 'boutiques'] as const,
    avis: ['livreur', 'avis'] as const,
    order: (uuid: string) => ['livreur', 'order', uuid] as const,
    /* Paramètres du livreur */
    settings: ['livreur', 'settings'] as const,
    notifPrefs: ['livreur', 'settings', 'notifs'] as const,
    privacy: ['livreur', 'settings', 'privacy'] as const,
    danger: ['livreur', 'settings', 'danger'] as const,
    geo: (niveau: string) => ['livreur', 'geo', niveau] as const,
    zoneGeo: (niveau: string) => ['livreur', 'zone-geo', niveau] as const,
    /* Réseau du livreur (correspondants, livreurs) */
    network: ['livreur', 'network'] as const,
    relays: (search: string, filter: string) => ['livreur', 'network', 'relays', search, filter] as const,
    drivers: (search: string, filter: string, sort: string) => ['livreur', 'network', 'drivers', search, filter, sort] as const,
    relay: (id: string) => ['livreur', 'network', 'relay', id] as const,
    driver: (id: string) => ['livreur', 'network', 'driver', id] as const,
    distances: (role: string, ids: string) => ['livreur', 'network', 'distances', role, ids] as const,
  },
  /* Espace correspondant (point relais) */
  correspondant: {
    all: ['correspondant'] as const,
    me: ['correspondant', 'me'] as const,
    overview: ['correspondant', 'overview'] as const,
    colis: ['correspondant', 'colis'] as const,
    boutiques: ['correspondant', 'boutiques'] as const,
    livreurs: ['correspondant', 'livreurs'] as const,
    clients: ['correspondant', 'clients'] as const,
    revenus: ['correspondant', 'revenus'] as const,
    zone: ['correspondant', 'zone'] as const,
    evaluation: ['correspondant', 'evaluation'] as const,
    avis: ['correspondant', 'avis'] as const,
    order: (uuid: string) => ['correspondant', 'order', uuid] as const,
    profile: (id: string) => ['correspondant', 'profile', id] as const,
    /* Paramètres du correspondant */
    settings: ['correspondant', 'settings'] as const,
    recruiter: ['correspondant', 'settings', 'recruiter'] as const,
  },
} as const;
