import { AndroidPushService, appRoute, pushCategory } from './android-push.service';

describe('Notifications Android', () => {
  it('chaque type est rangé dans une catégorie lisible', () => {
    expect(pushCategory('message.received')).toEqual({ id: 'messages', label: 'Message' });
    expect(pushCategory('order.confirmed').label).toBe('Commande');
    expect(pushCategory('delivery.en_route').label).toBe('Livraison');
    expect(pushCategory('payment.received').label).toBe('Paiement');
    expect(pushCategory('product.liked').label).toBe('Activité');
    expect(pushCategory('product.price_drop').label).toBe('Produit');
    expect(pushCategory('support.ticket_reply').label).toBe('Assistance');
    expect(pushCategory('inconnu').id).toBe('general');
  });

  it('ouvre le bon écran de l’application', () => {
    expect(appRoute('conversation', 'c1', { name: 'Awa Diallo', logo: null })).toBe('/messages/c1?name=Awa%20Diallo');
    expect(appRoute('delivery_group', 'g1')).toBe('/messages/groupe/g1');
    expect(appRoute('order', 'o1')).toBe('/notifications');
  });

  it('données FCM : uniquement des chaînes, boutons seulement avec une URL d’API', () => {
    const fcm = { isEnabled: () => true, sendData: jest.fn() };
    const withApi = new AndroidPushService(fcm as any, { get: (k: string) => (k === 'API_PUBLIC_URL' ? 'https://api.test/api' : undefined) } as any);
    const data = withApi.buildData({ type: 'message.received', title: 'Awa', body: 'Salut', route: '/messages/c1', tag: 'message:c1', unread: 3, actionToken: 'tok' });
    expect(Object.values(data).every(v => typeof v === 'string')).toBe(true);
    expect(data).toMatchObject({ kind: 'notif', category: 'messages', categoryLabel: 'Message', unread: '3', replyUrl: 'https://api.test/api/messagerie/push-reply' });

    const noApi = new AndroidPushService(fcm as any, { get: () => undefined } as any);
    expect(noApi.buildData({ type: 'message.received', title: 'A', body: 'B', route: '/', tag: 't', actionToken: 'tok' }).replyUrl).toBeUndefined();
  });
});
