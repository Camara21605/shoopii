/* ============================================================
 * FICHIER : public/push-sw.js
 *
 * RÔLE : Logique Web Push du service worker. Chargé par le service worker
 * généré par vite-plugin-pwa (workbox.importScripts, voir vite.config.ts) :
 * il s'exécute donc même quand l'application est FERMÉE — c'est ce qui permet
 * d'afficher un message ou un appel manqué sur l'écran du téléphone et de
 * mettre le compteur sur l'icône de l'application installée.
 *
 * Contenu du push (envoyé par WebPushService côté backend) :
 *   { title, body, url, tag, unread, type, image, notifId }
 * ============================================================ */

/* Pastille de l'icône (Badging API). Silencieux si non supporté. */
async function setBadge(count) {
  try {
    if (typeof count !== 'number') return;
    if (count > 0 && self.navigator && self.navigator.setAppBadge) {
      await self.navigator.setAppBadge(count);
    } else if (self.navigator && self.navigator.clearAppBadge) {
      await self.navigator.clearAppBadge();
    }
  } catch (_) { /* non supporté / refusé : sans conséquence */ }
}

/* N'autorise que des chemins de NOTRE site : le contenu d'un push ne doit
 * jamais pouvoir ouvrir un domaine externe. */
function safeTarget(raw) {
  try {
    const u = new URL(raw || '/', self.location.origin);
    if (u.origin === self.location.origin) return u.pathname + u.search + u.hash;
  } catch (_) { /* URL invalide */ }
  return '/';
}

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { title: 'Shoneya', body: event.data ? event.data.text() : '' };
  }

  event.waitUntil((async () => {
    await setBadge(data.unread);

    /* Application ouverte ET au premier plan : le toast intégré à la page
     * suffit, inutile de doubler avec une notification système. (Chrome
     * n'affiche pas de notification « générique » dans ce cas.) */
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (wins.some((w) => w.visibilityState === 'visible' && w.focused)) return;

    const options = {
      body: data.body || '',
      /* Avatar de l'expéditeur pour un message ; logo de l'application sinon. */
      icon: (data.icon && /^https:\/\//.test(data.icon)) ? data.icon : '/pwa-192x192.png',
      badge: '/notif-badge.png',           // icône monochrome de la barre d'état Android
      /* Un même `tag` REMPLACE la notification précédente : 10 messages d'une
       * même conversation = 1 seule ligne, pas 10. `renotify` fait quand même
       * sonner/vibrer à chaque nouveau message. */
      tag: data.tag || data.type || 'shoneya',
      renotify: true,
      data: { url: safeTarget(data.url), notifId: data.notifId || null },
    };
    if (data.image && /^https:\/\//.test(data.image)) options.image = data.image;
    if (String(data.type || '').indexOf('call.') === 0 || String(data.type || '').indexOf('group_call.') === 0) {
      options.requireInteraction = true;   // un appel manqué reste affiché jusqu'au geste de l'utilisateur
    }

    await self.registration.showNotification(data.title || 'Shoneya', options);
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = safeTarget(event.notification.data && event.notification.data.url);

  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if ('focus' in w) {
        await w.focus();
        if ('navigate' in w) { try { await w.navigate(target); } catch (_) { /* hors scope */ } }
        return;
      }
    }
    await self.clients.openWindow(target);   // application fermée : on la rouvre sur la bonne page
  })());
});
