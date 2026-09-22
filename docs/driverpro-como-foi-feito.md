# DriverPro — como o app foi feito (guia para reaproveitar em outro projeto)

> Escrito em 22/09/2026 a partir do código de verdade: `app-motorista-4/`
> (o app), `scripts/app-motorista.sql` (o backend), `scripts/conducao-robot.mjs`
> (quem alimenta o dado), `scripts/driverpro-check.mjs` (o teste de ponta a
> ponta) e `scripts/driverpro-site-sync.yml` (a publicação no domínio próprio).
> Onde um número é decisão de negócio (R$ 200, piso 60, top 15), está dito.

## 1. O que ele é, em uma frase

Um **PWA de um arquivo só** (`index.html` + `sw.js` + `manifest.json` + dois
ícones), sem framework e sem build, que fala com o **Supabase por RPC** usando a
chave pública, com **toda a segurança no banco** (funções `security definer`
que recebem um token de sessão) e **uma única chamada** que devolve tudo que as
telas mostram. Hospedado no GitHub Pages num subdomínio próprio.

```
celular ──► index.html (PWA)
               │  fetch POST /rest/v1/rpc/<função>   (chave anon)
               ▼
           Supabase ── ce_app_login / ce_app_criar_pin / ce_app_cadastro
                       ce_app_dados(token)  ← devolve JSON com tudo
                       ce_app_ping(token)   ← registra a abertura
                       ce_app_sair(token)
               ▲
   robô diário (GitHub Actions) ──► ce_diario → ce_scores_mensais
```

## 2. Os arquivos do app

| arquivo | papel |
|---|---|
| `index.html` (~830 linhas) | CSS + HTML das 3 telas (login, seleção, app com 5 abas) + JS. Tudo inline. |
| `sw.js` (33 linhas) | Service worker: é ele que faz o celular oferecer "Adicionar à tela de início". |
| `manifest.json` | Nome, ícones, `display: standalone`, cor da barra, protocolo `web+driverpro`. |
| `img/icone-192.png`, `img/icone-512.png` | Ícones `any maskable`. |

Regras que valeram a pena:

- **Sem framework, sem build.** O arquivo abre direto do GitHub Pages; publicar é
  `git push`. Reaproveitar é copiar a pasta.
- **`<meta name="build">`** no `<head>`, subido a cada publicação, para saber qual
  versão está na tela (`document.querySelector('meta[name=build]').content`).
- **Tudo em `var`/`function`** no JS do app, sem módulos: roda em WebView velho
  de celular barato.

## 3. O cabeçalho PWA (copiar como está)

```html
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">
<meta name="theme-color" content="#0F1A20">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="DriverPro">
<link rel="manifest" href="manifest.json">
<link rel="apple-touch-icon" href="img/icone-192.png">
```

```json
{
  "name": "DriverPro", "short_name": "DriverPro",
  "start_url": "./", "scope": "./",
  "display": "standalone", "orientation": "portrait",
  "background_color": "#0F1A20", "theme_color": "#0F1A20", "lang": "pt-BR",
  "icons": [
    { "src": "img/icone-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "img/icone-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ],
  "protocol_handlers": [{ "protocol": "web+driverpro", "url": "./?abrir=%s" }],
  "launch_handler": { "client_mode": "focus-existing" }
}
```

O `protocol_handlers` existe para um link numa apresentação (`web+driverpro://abrir`)
abrir o **app instalado**, não o navegador. Se não precisar disso, tire.

## 4. O service worker e a atualização automática

Este foi o bug mais caro do projeto: o app **não se atualizava** depois do
deploy, e a instrução virava "feche o app duas vezes". Eram três camadas, e as
três precisam existir.

**`sw.js`** — rede primeiro, cache como reserva, e o Supabase **nunca** entra no cache:

```js
const CACHE = 'driverpro-v22';   // trocar a cada publicação
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
  // "Rede primeiro" SÓ é de verdade com cache:'no-store' — sem isso o fetch passa
  // pelo cache HTTP do navegador, e o GitHub Pages manda max-age nas páginas.
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
```

**Registro no `index.html`** — as três blindagens:

```js
if ('serviceWorker' in navigator) window.addEventListener('load', function(){
  // 1) updateViaCache:'none' — senão o PRÓPRIO sw.js fica no cache HTTP e a versão nova nem é descoberta
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function(reg){
    reg.update();                                                       // 2) ao abrir…
    document.addEventListener('visibilitychange', function(){ if (!document.hidden) reg.update(); }); // …e ao voltar
  });
  var recarregou = false;
  navigator.serviceWorker.addEventListener('controllerchange', function(){   // 3) SW novo assumiu: recarrega UMA vez
    if (recarregou) return; recarregou = true; location.reload();
  });
});
```

Como foi provado: um servidor local mandando `max-age=600` como o Pages,
publica-se uma alteração e abre-se o app uma vez. Sem as três peças, a segunda
abertura vinha velha; com elas, vem nova e recarrega sozinha. **Rodar os dois
lados do teste**, senão o teste não prova nada.

**Botão "Instalar"**: no Android/Chrome e no Chrome de computador o navegador
entrega `beforeinstallprompt`; guarda-se o evento e chama-se `prompt()` no
clique. No iPhone não existe prompt: o botão abre um texto explicando
Compartilhar → Adicionar à Tela de Início. O botão some quando `appinstalled`
dispara ou quando o app já abre em `standalone`.

## 5. O modelo de segurança (a parte que mais vale copiar)

O HTML é público e usa a **chave anon**. Por isso:

- **Nenhuma tabela do app abre para o anon.** Todas têm RLS ligada e **nenhuma
  policy** (a de regras tem `select` só para `authenticated`, para o painel de BI).
- **Tudo passa por funções `security definer`** que recebem o **token da sessão**
  e devolvem só o que é daquele usuário. `revoke all … from public` +
  `grant execute … to anon, authenticated` em cada função.
- **Dado pessoal nunca sai do banco**: o CPF é coluna privada, o ranking devolve
  nomes **abreviados** (`ce_app_abrevia`: "Marcio A."), e o log do teste no
  Actions imprime unidade e contagens, nunca nome, CPF ou token.

### 5.1 Identidade e senha

- Login por **CPF + PIN de 4 dígitos**. O CPF já existia no cadastro de
  motoristas (vem do próprio sistema de telemetria), o PIN o motorista cria no
  primeiro acesso.
- PIN com **bcrypt** (`crypt(pin, gen_salt('bf'))`, extensão `pgcrypto`).
  Armadilha real: no Supabase o `pgcrypto` mora no schema `extensions`, então
  as funções precisam de `set search_path = public, extensions`.
- **5 erros → bloqueio de 15 min**, contado na própria tabela de acesso.
- Sessão = **token uuid** gerado no login, com validade de 90 dias, guardado
  no `localStorage` do celular. Sair apaga o token no banco.

```sql
create table if not exists public.ce_app_acesso (
  chave          text primary key references public.ce_motoristas (chave) on delete cascade,
  pin_hash       text not null,
  tentativas     int  not null default 0,
  bloqueado_ate  timestamptz,
  criado_em      timestamptz not null default now(),
  ultimo_acesso  timestamptz
);
create table if not exists public.ce_app_sessao (
  token       uuid primary key default gen_random_uuid(),
  chave       text references public.ce_motoristas (chave) on delete cascade,
  admin_cpf   text,                       -- sessão de administrador (chave nula)
  criado_em   timestamptz not null default now(),
  expira_em   timestamptz not null default now() + interval '90 days'
);
alter table public.ce_app_acesso enable row level security;   -- sem policy: só as funções chegam
alter table public.ce_app_sessao enable row level security;
```

O esqueleto do `ce_app_login` (o real tem mais ramos; a forma é esta):

```sql
create or replace function public.ce_app_login(p_cpf text, p_pin text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_cpf text := ce_app_so_digitos(p_cpf); v_pin text := ce_app_so_digitos(p_pin);
        m record; a record; v_token uuid;
begin
  select * into m from ce_motoristas where cpf = v_cpf and ativo;
  if m is null then return jsonb_build_object('ok', false, 'erro', 'CPF não está no programa.'); end if;
  select * into a from ce_app_acesso where chave = m.chave;
  if a is null then return jsonb_build_object('ok', false, 'erro', 'Primeira vez? Crie sua senha.', 'primeira_vez', true); end if;
  if a.bloqueado_ate is not null and a.bloqueado_ate > now() then
    return jsonb_build_object('ok', false, 'erro', 'Muitas tentativas. Espere ' ||
      ceil(extract(epoch from (a.bloqueado_ate - now())) / 60) || ' min.');
  end if;
  if a.pin_hash <> crypt(v_pin, a.pin_hash) then
    update ce_app_acesso set
      bloqueado_ate = case when tentativas + 1 >= 5 then now() + interval '15 minutes' else null end,
      tentativas    = case when tentativas + 1 >= 5 then 0 else tentativas + 1 end
      where chave = m.chave;
    return jsonb_build_object('ok', false, 'erro', 'Senha errada.');
  end if;
  update ce_app_acesso set tentativas = 0, bloqueado_ate = null, ultimo_acesso = now() where chave = m.chave;
  delete from ce_app_sessao where chave = m.chave and expira_em < now();
  insert into ce_app_sessao (chave) values (m.chave) returning token into v_token;
  return jsonb_build_object('ok', true, 'token', v_token, 'nome', m.nome, 'unidade', m.unidade);
end $$;
revoke all on function public.ce_app_login(text, text) from public;
grant execute on function public.ce_app_login(text, text) to anon, authenticated;
```

**Toda função devolve `jsonb` com `ok`** e, quando não ok, um `erro` já em
português pronto para a tela. O app nunca monta mensagem de erro; ele só mostra
o que veio. Com HTTP 200 sempre, o `fetch` do app fica trivial.

### 5.2 Os três caminhos de entrada

1. **Já tem PIN** → `ce_app_login` → token.
2. **Primeira vez** (CPF existe, sem PIN) → o login devolve `primeira_vez: true`,
   a tela vira "criar senha" → `ce_app_criar_pin(cpf, pin)` → token.
3. **CPF que o banco não conhece** → `ce_app_cadastro_lista(unidade)` devolve
   as unidades e os motoristas **ainda sem CPF**; a pessoa escolhe a unidade,
   toca no próprio nome, confirma, e `ce_app_cadastro(cpf, pin, chave)` amarra o
   CPF àquele cadastro. Quem já se cadastrou some da lista.

### 5.3 Administrador

Tabela `ce_app_admins (cpf, pin_hash, nome)`. O admin entra pelo **mesmo login**;
a sessão dele tem `admin_cpf` preenchido e `chave` nula. O `ce_app_dados` aceita
um `p_chave` opcional: **só a sessão de admin pode passá-lo**, e aí ele vê o app
exatamente como aquele motorista vê. A tela de seleção lista todos
(`ce_app_motoristas(token)`) com busca por nome ou unidade.

Também é pelo admin que se **liga e desliga unidades** no programa
(`ce_app_unidades` / `ce_app_unidade_set`) e se ajusta cota, km mínimo e grupo
por unidade (`ce_app_unidade_cfg_set`). Unidade desligada: o banco recusa login,
criação de PIN e autocadastro — a tela só repete o recado.

### 5.4 Uma chamada para todas as telas

`ce_app_dados(token)` devolve **tudo** que as cinco abas usam. Forma do JSON
(é a mesma que o modo demo do app carrega):

```js
{ ok:true, nome:'Marcio Andre', unidade:'PIRAI', unidade_real:'EMP PIRAI', vigente:'2026-09',
  posicao:7, posicao_geral:12,
  regras:{ saldo_inicial:200, km_min:1000, viagens_min:0, dias_min:0, score_min:0, top_n:15,
           podio:[300,150,100], piso_nota:60, pesos:{rpm:50,idle:30,acel:20} },
  ranking:[ { pos:1, pos_geral:3, disputa:true, nome:'Anderson M.', pontuacao:89.3, eu:false }, … ],
  meses:[ { competencia:'2026-09', nota:89.5, km:1240, posicao:7, posicao_unidade:7,
            posicao_geral:12, posicao_unidade_geral:12, disputa:true, elegivel:true,
            carteira:147.50, podio:0, rpm:85, idle:90, acel:100, motivo:null }, … ] }
```

Por que uma chamada só: o celular abre o app em pátio com sinal ruim; uma ida
ao servidor é o que dá para garantir. Tudo que é conta de tela (barra da meta,
perdas por pilar, tradução da nota em medida) é feito no JS a partir desse JSON.

O que a função faz por dentro (vale como receita para qualquer ranking com
elegibilidade):

- **Disputa ≠ ranking geral.** Quem não bate os mínimos (km, viagens, dias,
  nota) fica **fora da numeração** da disputa (`row_number()` particionado por
  `competencia, disputa`), mas recebe a posição geral ao lado. Sem isso, gente
  com pouco km empurrava para fora da cota quem tinha rodado.
- **Grupo de unidades** = um ranking e um pódio; cota e km mínimo continuam os
  da unidade de cada pessoa.
- **`motivo`** explica por que o mês não pagou ("não bateu os 1000 km", "fora
  dos 15 primeiros"). O app mostra o motivo, nunca só o zero.

### 5.5 Log de uso, sem esforço da tela

Tabela `ce_app_log (chave, evento, quando)` preenchida por **gatilhos**: criar
PIN grava `senha`, insert de sessão grava `login`, e o app chama
`ce_app_ping(token)` ao carregar, que grava `abertura`. Sessão de admin devolve
`ok:false` e não grava. É daí que sai a visão "Acessos" no painel de BI.

## 6. O JS do app (o essencial)

```js
var SUPABASE_URL = 'https://<projeto>.supabase.co';
var SUPABASE_KEY = '<chave publishable/anon>';
var DEMO = /[?&]demo=1/.test(location.search);   // dados de exemplo sem banco

function rpc(fn, args){
  return fetch(SUPABASE_URL + '/rest/v1/rpc/' + fn, { method:'POST',
    headers:{ 'Content-Type':'application/json', apikey:SUPABASE_KEY, Authorization:'Bearer ' + SUPABASE_KEY },
    body: JSON.stringify(args || {}) })
  .then(function(r){ return r.json().then(function(j){ if (!r.ok) throw new Error(j.message || ('HTTP ' + r.status)); return j; }); });
}

function entrar(){
  var cpf = $('cpf').value.replace(/\D/g, ''), pin = $('pin').value.replace(/\D/g, '');
  if (DEMO) { D = DEMO_DADOS; abre(); return; }
  rpc(MODO === 'criar' ? 'ce_app_criar_pin' : 'ce_app_login', { p_cpf: cpf, p_pin: pin }).then(function(r){
    if (!r.ok) { if (r.primeira_vez) modoLogin('criar'); return erroLogin(r.erro); }
    localStorage.setItem('app4_token', r.token);
    if (r.admin) escolheMotorista(); else carrega(r.token);
  }).catch(function(){ erroLogin('Sem conexão com o servidor. Tente de novo.'); });
}
function carrega(token, chave){
  rpc('ce_app_dados', chave ? { p_token: token, p_chave: chave } : { p_token: token }).then(function(r){
    if (!r.ok) { sair(); return erroLogin(r.erro); }
    D = r; abre();
    rpc('ce_app_ping', { p_token: token }).catch(function(){});
  });
}
// sessão guardada: entra direto
(function(){ var t = localStorage.getItem('app4_token'); if (t && !DEMO) carrega(t); })();
```

- **`?demo=1`** carrega `DEMO_DADOS` no **mesmo formato** do `ce_app_dados`. Serve
  para mostrar o app sem banco, para print de apresentação e para o teste de
  tela no Chromium. Manter o demo no formato real é o que impede as duas coisas
  de divergirem.
- **Cinco abas** por `data-v` (`inicio`, `ganhos`, `nota`, `ranking`, `regras`),
  uma `<section>` por aba, `irPara(v)` liga/desliga. Tema claro/escuro por
  classe no `body`, chave no `localStorage`.

### 6.1 A conta do dinheiro mora em UM lugar

Regras do programa (números de negócio, todos no banco em `ce_app_regras`):
saldo R$ 200 por mês; carteira = **rampa linear do piso (60) até 100**, ou seja
R$ 5 por ponto de nota e zero abaixo de 60; pódio R$ 300/150/100 para os 3
primeiros; cota top 15 por unidade; km mínimo 1.000.

A fórmula existe em **uma função no banco** (`ce_app_carteira(nota, saldo, piso)`)
e o app a repete para a tela:

```js
function pisoDe(R){ var v = +(R && R.piso_nota); return isFinite(v) && v > 0 && v < 100 ? v : 0; }
function carteiraDe(nota, R){
  var piso = pisoDe(R), n = Math.min(100, Math.max(0, +nota || 0));
  return Math.min(R.saldo_inicial, Math.max(0, n - piso) * R.saldo_inicial / (100 - piso));
}
```

E as **perdas por pilar** (os cards "onde o dinheiro foi") têm de fechar com a
carteira: cada ponto que falta custa `saldo/(100−piso)`, ponderado pelo peso do
pilar; quando a nota fica abaixo do piso a soma estouraria o saldo, então as
perdas são rateadas para somar exatamente o que saiu. Conferido rodando as
funções do próprio app em seis casos (dois motoristas reais, nota cheia, no
piso, abaixo do piso, um pilar sem medição).

Lição: **muda a régua → muda em quatro lugares** (função no banco, app, painel
de BI, texto das apresentações). Anotar isso no código, porque um esquece.

### 6.2 A nota explicada em medida

Cada pilar tem `nome`, `mede(nota)`, `regra` e `dica`. A régua do app é a
**mesma** do robô (`REGUA`: rpm direto; marcha lenta zera em 25% do tempo;
acelerações zeram em 3 por 100 km), então dá para traduzir a nota de volta:
"nota 88 = 3% do tempo parado com motor ligado". Se a régua do robô mudar,
mudar aqui também.

## 7. De onde vem o dado

O app **não calcula nota**; ele lê `ce_scores_mensais`, que um robô diário no
GitHub Actions (`scripts/conducao-robot.mjs`, cron 07:20 BRT) preenche a partir
da telemetria (Geotab hoje; vFleets previsto):

| tabela | o que é |
|---|---|
| `ce_motoristas` | de-para motorista → unidade → fonte, com `chave` estável e `cpf` (privado) |
| `ce_diario` | o bruto por dia e motorista (km, % na faixa verde, % marcha lenta, acelerações/100 km…) + o JSON cru para auditoria |
| `ce_scores_mensais` | uma linha por mês × motorista: km, dias, pontos por pilar e a `pontuacao` (média ponderada, pesos 50/30/20) |

Para outro projeto, o app só precisa de **uma tabela mensal por pessoa** com nota
e os campos de elegibilidade; a origem é indiferente.

## 8. Publicação num domínio próprio

O GitHub Pages aceita **um domínio por repositório**, e o portal já ocupa o
`github.io`. Solução: um repositório **separado** (`driverpro`) que **espelha a
pasta do app** a cada 5 minutos, com `CNAME` na raiz.

```yaml
name: DriverPro Site Sync
on: { schedule: [ { cron: '*/5 * * * *' } ], workflow_dispatch: }
permissions: { contents: write }
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          git clone --depth 1 --filter=blob:none --sparse https://github.com/<org>/<portal> /tmp/portal
          git -C /tmp/portal sparse-checkout set app-motorista-4
          rsync -a --delete --exclude .git --exclude .github --exclude CNAME --exclude README.md /tmp/portal/app-motorista-4/ ./
          touch .nojekyll
      - run: |
          git config user.name "driverpro-sync"; git config user.email "driverpro-sync@users.noreply.github.com"
          git add -A; git diff --cached --quiet && exit 0
          git commit -m "sync" && git push
```

Passos únicos: criar o repo público, colar o workflow, Settings → Pages →
branch `main` / root, Custom domain `driverpro.<domínio>` (isso cria o `CNAME`,
que o `--exclude CNAME` preserva), marcar Enforce HTTPS, e no DNS um
`CNAME driverpro → <org>.github.io`. Ao publicar algo no app, **disparar o Run
workflow na hora** — o cron é só a rede de segurança.

## 9. Como se testa sem celular

- **`scripts/driverpro-check.mjs`** (workflow no Actions): faz o que o app faz,
  com a chave anon — login errado recusado, criar PIN, entrar, ler os dados,
  sair. Usa um **motorista sintético** (`teste:driverpro`, CPF `00000000191`)
  criado com a service key, sem nota mensal, para nunca prender o CPF de teste a
  uma pessoa real (aconteceu; um motorista ficou um dia sem entrar).
- **Tela**: Chromium com `?demo=1` e os dados do caso injetados em `DEMO_DADOS`,
  conferindo número grande, barra e linha do pódio.
- **Atualização**: o teste do service worker com servidor local e `max-age`,
  rodando **antes e depois** da correção.

## 10. Checklist para levar a outro projeto

1. Copiar `index.html`, `sw.js`, `manifest.json`, `img/`. Trocar nome, cores,
   ícones, `SUPABASE_URL`/`SUPABASE_KEY` e o `CACHE` do SW.
2. No Supabase: `pgcrypto`; tabelas de acesso, sessão, regras, log (RLS ligada,
   sem policy); funções `security definer` com `set search_path = public,
   extensions`, `revoke all from public` e `grant execute to anon, authenticated`.
3. Uma tabela mensal por pessoa com a nota e os campos de elegibilidade, e um
   robô que a alimenta.
4. Uma função `…_dados(token)` que devolve **tudo** em um JSON; um `DEMO_DADOS`
   no mesmo formato.
5. A conta de dinheiro em **uma função no banco**, repetida no app só para a
   tela; anotar os lugares onde ela se repete.
6. Repositório espelho + `CNAME` + DNS, se quiser domínio próprio.
7. Teste de ponta a ponta no Actions com usuário sintético; nunca logar nome,
   documento ou token.

## 11. Armadilhas que custaram tempo (para não repetir)

- Service worker "rede primeiro" **sem** `cache:'no-store'` não é rede primeiro.
- `updateViaCache` padrão deixa o **próprio `sw.js`** em cache HTTP.
- `pgcrypto` no schema `extensions` → `search_path` nas funções.
- CPF de teste preso a pessoa real.
- Ranking numerando todo mundo: quem não disputa empurra quem disputa para fora
  da cota.
- Rampa de dinheiro começando no zero: dirigir bem e mal quase não se distingue
  no bolso.
- Régua repetida em vários lugares e ninguém sabendo quais.
- `ce_app_ping` também contando o admin: o log de uso inflava.
