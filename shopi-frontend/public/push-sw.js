/* ============================================================
 * FICHIER : public/push-sw.js
 *
 * RÔLE : Logique Web Push du service worker. Chargé par le service worker
 * généré par vite-plugin-pwa (workbox.importScripts, voir vite.config.ts) :
 * il s'exécute donc même quand l'application est FERMÉE — c'est ce qui permet
 * d'afficher un message, un appel manqué OU UN APPEL ENTRANT sur l'écran du
 * téléphone, et de mettre le compteur sur l'icône de l'application installée.
 *
 * Contenu du push (envoyé par le backend) :
 *   messages / notifications : { title, body, url, tag, unread, type, icon, image, notifId }
 *   appel entrant            : { type:'call.incoming', title:<appelant>, body, icon, tag:'call:<id>',
 *                               data:{ callId, conversationId, callerUserId, callType, expiresAt,
 *                                      rejectUrl?, rejectToken? } }
 *   fin d'appel              : { type:'call.ended', tag:'call:<id>' }   → ferme la notification
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

function safeIcon(raw) {
  return (raw && /^https:\/\//.test(raw)) ? raw : '/pwa-192x192.png';
}

async function windows() {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true });
}

/* ── Appel entrant ───────────────────────────────────────────── */

const CALL_VIBRATION = [600, 300, 600, 300, 600, 300, 600, 300, 600];   // sonne ~4 s, la notification reste jusqu'à l'action

async function showIncomingCall(data) {
  const c = data.data || {};
  const type = c.callType === 'video' ? 'vidéo' : 'audio';

  /* Sonnerie déjà périmée (téléphone en veille profonde, réseau lent) : inutile de faire
   * croire qu'on peut encore répondre — on l'indique comme appel manqué. */
  if (c.expiresAt && Date.now() > c.expiresAt) {
    await self.registration.showNotification(data.title || 'Shoneya', {
      body: 'Appel ' + type + ' manqué',
      icon: safeIcon(data.icon),
      badge: '/notif-badge.png',
      tag: data.tag || 'call',
      data: { kind: 'call-missed', url: safeTarget(data.url) },
    });
    return;
  }

  /* Application ouverte ET au premier plan : l'écran d'appel de la page suffit. */
  if ((await windows()).some((w) => w.visibilityState === 'visible' && w.focused)) return;

  const actions = [{ action: 'accept', title: 'Répondre' }];
  if (c.rejectToken && c.rejectUrl) actions.push({ action: 'reject', title: 'Refuser' });

  await self.registration.showNotification(data.title || 'Shoneya', {
    body: data.body || 'Appel entrant',
    icon: safeIcon(data.icon),
    badge: '/notif-badge.png',
    tag: data.tag || 'incoming-call',
    renotify: true,
    requireInteraction: true,            // reste affichée tant qu'on n'a pas répondu / refusé
    silent: false,
    vibrate: CALL_VIBRATION,
    timestamp: Date.now(),
    actions,
    data: {
      kind: 'call',
      url: safeTarget(data.url),
      callId: c.callId, conversationId: c.conversationId, callerUserId: c.callerUserId,
      rejectUrl: c.rejectUrl || null, rejectToken: c.rejectToken || null,
    },
  });

  /* Pas d'attente ici : garder l'événement push ouvert 45 s bloquait inutilement le service worker.
   * La notification est fermée par le push « fin d'appel » (décroché / refusé / annulé / expiré) ; à
   * défaut, toucher une sonnerie périmée ouvre simplement la conversation (voir handleCallClick). */
}

/* Ferme la notification d'appel (décroché / refusé / annulé / manqué).
 * Chrome exige qu'un push affiche TOUJOURS quelque chose quand aucune fenêtre n'est visible :
 * on remplace donc la notification par une notification silencieuse de même tag, aussitôt fermée. */
async function endIncomingCall(data) {
  const tag = data.tag || 'incoming-call';
  const hadVisibleWindow = (await windows()).some((w) => w.visibilityState === 'visible');
  if (!hadVisibleWindow) {
    await self.registration.showNotification('Appel terminé', {
      body: '', tag, silent: true, requireInteraction: false, data: { kind: 'call-end' },
    });
  }
  const open = await self.registration.getNotifications({ tag });
  open.forEach((n) => n.close());
}

/* ── Réception d'un push ─────────────────────────────────────── */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { title: 'Shoneya', body: event.data ? event.data.text() : '' };
  }

  event.waitUntil((async () => {
    if (data.type === 'call.incoming') { await showIncomingCall(data); return; }
    if (data.type === 'call.ended')    { await endIncomingCall(data);  return; }

    await setBadge(data.unread);

    /* Application ouverte ET au premier plan : le toast intégré à la page
     * suffit, inutile de doubler avec une notification système. (Chrome
     * n'affiche pas de notification « générique » dans ce cas.) */
    if ((await windows()).some((w) => w.visibilityState === 'visible' && w.focused)) return;

    const options = {
      body: data.body || '',
      /* Avatar de l'expéditeur pour un message ; logo de l'application sinon. */
      icon: safeIcon(data.icon),
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

/* ── Clic sur une notification ───────────────────────────────── */

async function handleCallClick(event) {
  const d = event.notification.data || {};

  /* « Refuser » : aucune ouverture de l'application — on prévient le serveur avec le jeton signé. */
  if (event.action === 'reject') {
    if (d.rejectUrl && d.rejectToken) {
      try {
        await fetch(d.rejectUrl, {
          method: 'POST', mode: 'cors', credentials: 'omit',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: d.rejectToken }),
        });
      } catch (_) { /* hors ligne : l'appel expirera de lui-même chez l'appelant */ }
    }
    return;
  }

  /* « Répondre » → l'appli décroche toute seule ; toucher le corps → l'écran d'appel s'ouvre. */
  const action = event.action === 'accept' ? 'accept' : 'open';
  const params = new URLSearchParams({ callAction: action });
  if (d.callerUserId) params.set('callFrom', d.callerUserId);
  const base = safeTarget(d.url);
  const target = base + (base.indexOf('?') === -1 ? '?' : '&') + params.toString();

  const wins = await windows();
  for (const w of wins) {
    if ('focus' in w) {
      try { await w.focus(); } catch (_) { /* focus refusé : on transmet l'action quand même */ }
      /* Application déjà ouverte : on lui transmet l'action, sans rechargement (l'appel garde son état).
       * Une version ANCIENNE de l'application (pas encore mise à jour sur ce téléphone) ne sait pas traiter
       * ce message et ne répond pas. On NE la recharge surtout PAS : en se fermant, l'ancienne page raccroche
       * l'appel qui sonne. On ouvre à la place une fenêtre à jour, qui décroche à l'ouverture — l'ancienne
       * page voit « décroché ailleurs » et referme sa sonnerie. */
      w.postMessage({
        type: 'shoneya-call-action', action,
        callId: d.callId || null, conversationId: d.conversationId || null, callerUserId: d.callerUserId || null,
      });
      if (await waitForCallAck(1500)) return;
      break;
    }
  }
  await self.clients.openWindow(target);   // application fermée (ou ancienne version) : fenêtre à jour qui décroche
}

/* Attend l'accusé de réception de la page (« j'ai reçu l'action d'appel »). */
function waitForCallAck(ms) {
  return new Promise((resolve) => {
    const onMessage = (e) => {
      if (e.data && e.data.type === 'shoneya-call-action-ack') {
        clearTimeout(timer);
        self.removeEventListener('message', onMessage);
        resolve(true);
      }
    };
    const timer = setTimeout(() => { self.removeEventListener('message', onMessage); resolve(false); }, ms);
    self.addEventListener('message', onMessage);
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.notification.data && event.notification.data.kind === 'call') {
    event.waitUntil(handleCallClick(event));
    return;
  }

  const target = safeTarget(event.notification.data && event.notification.data.url);

  event.waitUntil((async () => {
    const wins = await windows();
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
