/* Service worker do DriverPro: é ele que faz a página virar APP — com ele e o
   manifest, o celular oferece "Adicionar à tela de início", e o app abre por
   ícone próprio, em tela cheia, sem barra de navegador.
   Estratégia: rede primeiro, cache como rede de segurança (pátio com sinal
   ruim mostra o último estado carregado). As chamadas ao Supabase NUNCA entram
   no cache — dado é sempre da rede. Ao publicar, trocar CACHE. */
const CACHE = 'driverpro-v20';
const ESSENCIAIS = ['./', './index.html', './manifest.json', './img/icone-192.png', './img/icone-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ESSENCIAIS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith(self.location.origin)) return;   // Supabase, fontes: direto na rede
  // "Rede primeiro" SÓ é de verdade com cache:'no-store'. Sem isso o fetch passa
  // pelo cache HTTP do navegador, e o GitHub Pages manda max-age nas páginas —
  // o motorista podia ficar minutos vendo a versão velha DEPOIS do deploy, com
  // o service worker achando que tinha ido à rede. Vale para a navegação e para
  // o HTML/JSON; imagem e ícone seguem no caminho normal.
  var u = new URL(e.request.url);
  var doc = e.request.mode === 'navigate' || u.pathname.endsWith('/') || /\.(html|json)$/.test(u.pathname);
  var pedido = doc ? new Request(e.request.url, { cache: 'no-store', credentials: 'same-origin' }) : e.request;
  e.respondWith(
    fetch(pedido).then(r => {
      if (r.ok) { const c2 = r.clone(); caches.open(CACHE).then(c => c.put(e.request, c2)); }
      return r;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
