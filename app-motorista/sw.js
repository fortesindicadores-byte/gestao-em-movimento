/* ============================================================
   Service worker do app do motorista.

   É ele que faz a página SE COMPORTAR COMO APP: com um service worker
   registrado e o manifest no lugar, o celular passa a oferecer "Adicionar à
   tela de início", e a partir daí o app abre por ícone próprio, em tela cheia,
   sem barra de navegador. Sem loja e sem download.

   ESTRATÉGIA: rede primeiro, cache como rede de segurança. O motorista abre no
   pátio, com sinal ruim — se a rede falhar, ele vê o último estado que
   carregou em vez de uma tela de erro. E como é rede primeiro, um dado novo
   nunca fica preso no cache.

   O CACHE TEM VERSÃO NO NOME: ao publicar uma versão nova, muda-se CACHE e o
   `activate` apaga as antigas. Sem isso o celular serviria a versão velha para
   sempre — é o erro clássico de PWA.
   ============================================================ */
const CACHE = 'conducao-v9';
const ESSENCIAIS = ['./', './index.html', './manifest.json',
                    './img/icone-192.png', './img/icone-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ESSENCIAIS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // "Rede primeiro" SÓ é de verdade com cache:'no-store'. Sem isso o fetch passa
  // pelo cache HTTP do navegador, e o GitHub Pages manda max-age nas páginas —
  // o motorista podia ficar minutos vendo a versão velha DEPOIS do deploy, com
  // o service worker achando que tinha ido à rede.
  const u = new URL(e.request.url);
  const doc = e.request.mode === 'navigate' || u.pathname.endsWith('/') || /\.(html|json)$/.test(u.pathname);
  const pedido = (doc && e.request.url.startsWith(self.location.origin))
    ? new Request(e.request.url, { cache: 'no-store', credentials: 'same-origin' }) : e.request;
  e.respondWith(
    fetch(pedido)
      .then(r => {
        // só guarda resposta boa e do próprio app; API de terceiro não entra
        if (r.ok && e.request.url.startsWith(self.location.origin)) {
          const copia = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, copia));
        }
        return r;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
