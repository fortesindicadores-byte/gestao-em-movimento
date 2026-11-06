/* Service worker do app Gestão em Movimento (/app/): é ele que faz a página
   virar APP — com ele e o manifest, o celular oferece "Adicionar à tela de
   início" e o app abre por ícone próprio, em tela cheia.
   Estratégia: rede primeiro, cache como rede de segurança. As chamadas ao
   Supabase e os painéis (fora de /app/) NUNCA passam por aqui. Ao publicar,
   trocar CACHE. */
const CACHE = 'gem-app-v11';
const ESSENCIAIS = ['./', './index.html', './app.js', './catalogo.js', './manifest.json', './img/icone-192.png', './img/icone-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ESSENCIAIS).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  var u;
  try { u = new URL(e.request.url); } catch (_) { return; }
  if (u.origin !== self.location.origin) return;                       // Supabase, CDN, fontes: direto na rede
  var raiz = self.registration.scope;
  if (!e.request.url.startsWith(raiz)) return;                         // os painéis do portal não passam por aqui
  // "Rede primeiro" SÓ é de verdade com cache:'no-store' (o GitHub Pages manda max-age nas páginas)
  var doc = e.request.mode === 'navigate' || /\/$/.test(u.pathname) || /\.(html|json|js)$/.test(u.pathname);
  var pedido = doc ? new Request(e.request.url, { cache: 'no-store', credentials: 'same-origin' }) : e.request;
  e.respondWith(
    fetch(pedido).then(r => {
      if (r.ok) { const c2 = r.clone(); caches.open(CACHE).then(c => c.put(e.request, c2)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
  );
});
