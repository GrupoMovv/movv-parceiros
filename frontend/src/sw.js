import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

// injectManifest (vite-plugin-pwa) troca essa linha pela lista real de
// arquivos do build no momento do build — é isso que dá o "app shell"
// funcionando offline (item 9 do pedido: cache offline básico). Em dev
// (devOptions.enabled) o manifest vem vazio ([]) de propósito (nada foi
// buildado ainda), então createHandlerBoundToURL não pode rodar — ele
// exige a URL já precacheada e lança na hora se não achar.
const precacheManifest = self.__WB_MANIFEST;
precacheAndRoute(precacheManifest);
cleanupOutdatedCaches();
self.skipWaiting();
self.clients.claim();

// SPA: qualquer navegação (recarregar numa rota tipo /marketplace/produto/5
// offline) cai no index.html precacheado, não em 404 — sem isso só a home
// funcionaria offline.
if (precacheManifest.length > 0) {
  registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));
}

// API sempre busca da rede primeiro (preço/estoque não pode ficar velho);
// só cai pro cache se a rede falhar/demorar, e só por 5min — é conveniência
// de "abriu offline e viu algo" não uma cópia confiável dos dados.
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'iubmais-api',
    networkTimeoutSeconds: 8,
    plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 5 * 60 })],
  })
);

// Fotos de produto/parceiro (Cloudinary) e demais imagens — cache first,
// depois de publicada uma foto não muda mais.
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'iubmais-imagens',
    plugins: [new ExpirationPlugin({ maxEntries: 150, maxAgeSeconds: 30 * 24 * 60 * 60, purgeOnQuotaError: true })],
  })
);

// Push notification — base preparada, nada no backend dispara isso ainda
// (fica pronto pra quando integrarmos OneSignal/Firebase).
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data;
  try { data = event.data.json(); } catch { return; }

  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'iubmais',
    data: { url: data.url || '/marketplace' },
  };
  event.waitUntil(self.registration.showNotification(data.title || 'IUB MAIS', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/marketplace';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      const aberta = janelas.find((j) => j.url.includes(url));
      if (aberta) return aberta.focus();
      return self.clients.openWindow(url);
    })
  );
});
