import { commandeIdOf, resolveNotificationTarget, withNotifParam, type NotificationTargetInput } from './notification-target.util';

const CMD = '11111111-2222-4333-8444-555555555555';
const OTHER = '99999999-8888-4777-8666-555555555555';
const liv = (n: Partial<NotificationTargetInput>): NotificationTargetInput => ({ recipientType: 'delivery', type: 'system.announcement', ...n });

describe('resolveNotificationTarget — livreur', () => {
  it('nouvelle mission confiée → Missions (site) / détail de la mission (appli)', () => {
    const t = resolveNotificationTarget(liv({ type: 'order.placed', resourceType: 'order', resourceId: CMD, payload: { commandeId: CMD } }));
    expect(t).toMatchObject({ web: `/dashboard/livreur/missions?mission=${CMD}`, app: `/livreur/missions/${CMD}`, label: 'Voir la mission', category: 'missions' });
  });

  it('affectation (order.status_changed + kind) → Missions pour accepter', () => {
    const t = resolveNotificationTarget(liv({ type: 'order.status_changed', resourceType: 'order', resourceId: CMD, payload: { commandeId: CMD, kind: 'mission_assigned' } }));
    expect(t?.web).toBe(`/dashboard/livreur/missions?mission=${CMD}`);
  });

  it('changement de statut → suivi de la commande / mission', () => {
    const t = resolveNotificationTarget(liv({ type: 'order.status_changed', resourceType: 'order', resourceId: CMD, payload: { commandeId: CMD, status: 'DELIVERED' } }));
    expect(t).toMatchObject({ web: `/commande/${CMD}/suivi`, app: `/livreur/missions/${CMD}`, category: 'missions' });
  });

  it('retrait EN ATTENTE (type order.status_changed) → portefeuille, jamais /commande/<id du retrait>', () => {
    const t = resolveNotificationTarget(liv({ type: 'order.status_changed', resourceType: 'retrait', resourceId: OTHER, actionUrl: '/dashboard/livreur/revenus' }));
    expect(t).toMatchObject({ web: '/dashboard/livreur/wallet', app: '/livreur/portefeuille', category: 'gains' });
  });

  it('séquestre : commande retrouvée depuis l’ancienne actionUrl (pas l’id du séquestre)', () => {
    const t = resolveNotificationTarget(liv({ type: 'order.status_changed', resourceType: 'escrow', resourceId: OTHER, actionUrl: `/commande/${CMD}/suivi` }));
    expect(t?.app).toBe(`/livreur/missions/${CMD}`);
    expect(t?.category).toBe('gains');
  });

  it('commission → revenus ; mouvement du portefeuille → portefeuille ; portefeuille gelé → aide', () => {
    expect(resolveNotificationTarget(liv({ type: 'payment.sent', resourceType: 'commission', resourceId: CMD }))?.app).toBe('/livreur/revenus');
    expect(resolveNotificationTarget(liv({ type: 'payment.received', resourceType: 'wallet', resourceId: OTHER }))?.app).toBe('/livreur/portefeuille');
    expect(resolveNotificationTarget(liv({ type: 'account.suspended', resourceType: 'wallet', resourceId: OTHER }))?.web).toBe('/support');
  });

  it('avis → évaluation ; mission diffusée → accueil (missions disponibles)', () => {
    expect(resolveNotificationTarget(liv({ type: 'review.received', resourceType: 'review', resourceId: CMD }))).toMatchObject({ web: '/dashboard/livreur/evaluation', app: '/livreur/evaluation', category: 'avis' });
    expect(resolveNotificationTarget(liv({ resourceType: 'livreur_mission', resourceId: OTHER }))).toMatchObject({ web: '/dashboard/livreur', app: '/livreur', category: 'missions' });
  });

  it('nouvel abonné : profil réseau d’un livreur / correspondant, sinon mon profil', () => {
    expect(resolveNotificationTarget(liv({ type: 'follow.new', actorType: 'delivery', actorId: OTHER }))?.app).toBe(`/livreur/reseau/livreurs/${OTHER}`);
    expect(resolveNotificationTarget(liv({ type: 'follow.new', actorType: 'correspondent', actorId: OTHER }))?.web).toBe(`/dashboard/livreur/reseau/correspondants/${OTHER}`);
    expect(resolveNotificationTarget(liv({ type: 'follow.new', actorType: 'client', actorId: OTHER, actionUrl: '/home' }))).toMatchObject({ web: '/dashboard/livreur/profil', app: '/livreur/profil' });
  });

  it('compte, ticket d’aide, conversation', () => {
    expect(resolveNotificationTarget(liv({ type: 'account.approved', resourceType: 'account', resourceId: OTHER }))?.app).toBe('/livreur/profil');
    expect(resolveNotificationTarget(liv({ type: 'support.ticket_reply', resourceType: 'support_ticket', resourceId: OTHER }))).toMatchObject({ web: `/support/tickets/${OTHER}`, app: `/support/${OTHER}` });
    expect(resolveNotificationTarget(liv({ type: 'call.missed', resourceType: 'conversation', resourceId: OTHER }))?.app).toBe(`/messages/${OTHER}`);
  });

  it('annonce sans page dédiée : pas d’écran dans l’appli (détail affiché), jamais une page hors de l’espace livreur', () => {
    const t = resolveNotificationTarget(liv({ type: 'system.announcement', actionUrl: '/home' }));
    expect(t).toMatchObject({ web: '/dashboard/livreur', app: null });
  });
});

describe('resolveNotificationTarget — autres rôles', () => {
  it('pas de règle spécifique → null (le client garde sa logique)', () => {
    expect(resolveNotificationTarget({ recipientType: 'client', type: 'order.placed', resourceType: 'order', resourceId: CMD })).toBeNull();
  });
  it('conversation → universelle', () => {
    expect(resolveNotificationTarget({ recipientType: 'company', type: 'call.missed', resourceType: 'conversation', resourceId: CMD })?.app).toBe(`/messages/${CMD}`);
  });
});

describe('outils', () => {
  it('commandeIdOf ignore un id qui n’est pas celui d’une commande', () => {
    expect(commandeIdOf({ recipientType: 'delivery', type: 'x', resourceType: 'retrait', resourceId: OTHER })).toBeNull();
  });
  it('withNotifParam', () => {
    expect(withNotifParam('/livreur/evaluation', 'abc')).toBe('/livreur/evaluation?notif=abc');
    expect(withNotifParam('/a?b=1', 'abc')).toBe('/a?b=1&notif=abc');
    expect(withNotifParam('/a', '')).toBe('/a');
  });
});

describe('resolveNotificationTarget — entreprise', () => {
  const ent = (n: Partial<NotificationTargetInput>): NotificationTargetInput => ({ recipientType: 'company', type: 'system.announcement', ...n });

  it('nouvelle commande → détail natif de la commande / suivi sur le site', () => {
    expect(resolveNotificationTarget(ent({ type: 'order.placed', resourceType: 'order', resourceId: CMD }))).toMatchObject({
      web: `/commande/${CMD}/suivi`, app: `/entreprise/commandes/${CMD}`, label: 'Traiter la commande', category: 'commandes', section: 'commandes',
    });
  });
  it('retour demandé → le retour (modale sur le site)', () => {
    expect(resolveNotificationTarget(ent({ type: 'return.requested', resourceType: 'return', resourceId: OTHER }))).toMatchObject({
      web: `/dashboard/entreprise/retours?retour=${OTHER}`, app: `/entreprise/retours/${OTHER}`, label: 'Traiter le retour', category: 'retours',
    });
  });
  it('rupture de stock → fiche du produit ; avis → rubrique Avis', () => {
    expect(resolveNotificationTarget(ent({ type: 'stock.critical', resourceType: 'product', resourceId: OTHER }))).toMatchObject({ app: `/entreprise/produits/${OTHER}`, category: 'stock', section: 'inventaire' });
    expect(resolveNotificationTarget(ent({ type: 'review.received', resourceType: 'review', resourceId: CMD }))).toMatchObject({ web: '/dashboard/entreprise/avis', app: '/entreprise/avis', category: 'avis' });
  });
  it('retrait en attente → portefeuille (jamais /commande/<id du retrait>)', () => {
    expect(resolveNotificationTarget(ent({ type: 'order.status_changed', resourceType: 'retrait', resourceId: OTHER, actionUrl: '/dashboard/entreprise/finances' }))).toMatchObject({ app: '/entreprise/portefeuille', category: 'argent' });
  });
  it('séquestre → la commande, catégorie argent ; équipe ; mission acceptée', () => {
    expect(resolveNotificationTarget(ent({ type: 'order.status_changed', resourceType: 'escrow', resourceId: OTHER, payload: { commandeId: CMD } }))).toMatchObject({ app: `/entreprise/commandes/${CMD}`, category: 'argent' });
    expect(resolveNotificationTarget(ent({ resourceType: 'team_member', actionUrl: '/dashboard/entreprise/equipe' }))?.app).toBe('/entreprise/equipe');
    expect(resolveNotificationTarget(ent({ resourceType: 'livreur_mission', resourceId: OTHER }))?.app).toBe('/entreprise/livreurs');
  });
  it('prestations : pas d’écran natif → app null, page du site', () => {
    expect(resolveNotificationTarget(ent({ type: 'service.liked', resourceType: 'service', resourceId: OTHER }))).toMatchObject({ web: '/dashboard/entreprise/services', app: null });
  });
});
