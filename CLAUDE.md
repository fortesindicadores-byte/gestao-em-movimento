# Gestão em Movimento — Guia para o Claude

> **`PADROES.md` é o estado atual do portal, organizado por assunto** (casca, filtros, gráficos, tabelas, fontes, banco, robôs, acessos, publicação), gerado por varredura do código em 10/09/2026. Este arquivo continua sendo o diário de decisões e dos porquês. Em dúvida sobre "como é hoje", ler o `PADROES.md` primeiro; o inventário dos painéis sai de `node scripts/padroes-inventario.mjs`.

## Visão geral

Repositório central de todos os painéis de BI da empresa (Fortes Indicadores), em substituição ao Looker Studio.
Cada painel é um arquivo `index.html` autocontido — sem framework, sem backend, sem build step.

- **Repositório GitHub:** `fortesindicadores-byte/gestao-em-movimento` _(foi renomeado de `Projeto-BI-App`)_
- **GitHub Pages:** `https://fortesindicadores-byte.github.io/gestao-em-movimento/`
- **Hub principal:** `index.html` na raiz — contém autenticação Supabase + lista de painéis

> **Git push:** Hoje `git push origin main` **funciona** normalmente (deploy automático no GitHub Pages). _(Nota histórica: o repo foi renomeado de `Projeto-BI-App`; numa época o proxy local rejeitava o push e era preciso usar `mcp__github__push_files` — não é mais o caso.)_

> **TUDO QUE O RENAN VAI RODAR VEM COLADO NO CHAT** (regra dele, 04/09/2026:
> *"Traga sempre, mas absolutamente sempre, scripts, querys, tudo aqui para eu
> copiar e colar. A não ser que consiga fazer direto por mim. Senão aqui!"*).
> Vale para SQL do Supabase, query de banco, Apps Script, comando de terminal —
> qualquer coisa. **Apontar o caminho do arquivo no repositório NÃO conta**: ele
> não vai abrir o repositório para copiar. Versionar o arquivo continua certo,
> mas o conteúdo tem de aparecer no chat, inteiro, pronto para colar. A única
> dispensa é quando eu mesmo consigo executar — aí executo e não peço nada.
>
> **A query dos abastecimentos do ERP foi a TI que passou** para o Renan
> consultar o banco (`scripts/erp-abastecimentos-query.sql`). Não perguntar de
> novo de onde ela veio.

---

## Estrutura de pastas

```
gestao-em-movimento/
├── index.html              → Hub principal + Auth (Supabase) ← ATIVO
├── visao-financeira/       → Painel DRE Consolidado ← ATIVO, referência de layout
├── painel-km/              → Painel KM ← ATIVO
├── combustivel/
│   ├── arvore-combustivel/ → Árvore de Combustível ← ATIVO
│   ├── eficiencia-kml/     → (vazio)
│   ├── preco-litro/        → (vazio)
│   └── consumo-co2/        → (vazio)
├── financeiro-pessoal/     → Controle Financeiro Renan & Tati ← ATIVO (não aparece no hub)
├── eficiencia-ativacao/    → (vazio)
├── rs-por-km/              → (vazio)
├── disponibilidade/        → (vazio)
├── reuniao-mensal/         → (vazio)
├── auditorias/             → (vazio)
├── fca/                    → (vazio)
└── painel-metas/           → (vazio)
```

Pastas vazias têm `.gitkeep`. Ao criar um novo painel, substituir por `index.html`.

---

## Hub principal (`index.html`) — Autenticação + Navegação

O `index.html` raiz é o hub central. Tem duas telas:
- **Auth screen** (`#auth-screen`): login / cadastro / esqueci senha / redefinir senha
- **Hub screen** (`#hub-screen`): grid de cards com os painéis, organizado por clusters

### Supabase (autenticação)
```javascript
const SUPABASE_URL = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ggKEEebc5zjgQDVsF92Upw_6uoLmKe9';
// CDN: https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
```

**Configurações no Supabase Dashboard:**
- Site URL: `https://fortesindicadores-byte.github.io/gestao-em-movimento/`
- SMTP customizado: Resend (smtp.resend.com:465, user=resend, senha=API key da Resend)
- Email confirmation: ativado

**Fluxos implementados:**
1. Login com e-mail + senha (`sb.auth.signInWithPassword`)
2. Cadastro (`sb.auth.signUp`) — requer confirmação por e-mail
3. Esqueci senha (`sb.auth.resetPasswordForEmail`) — envia link via Resend
4. Redefinir senha (`sb.auth.updateUser({ password })`) — ativado pelo evento `PASSWORD_RECOVERY`
5. Logout (`sb.auth.signOut`)

**Erros traduzidos para PT-BR via `traduzirErro(msg)`:**
```javascript
function traduzirErro(msg) {
  if (!msg) return 'Erro desconhecido.';
  const m = msg.toLowerCase();
  if (m.includes('invalid login') || m.includes('invalid credentials')) return 'E-mail ou senha incorretos.';
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  if (m.includes('user already registered')) return 'Este e-mail já está cadastrado.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  if (m.includes('user not found')) return 'E-mail não encontrado.';
  if (m.includes('weak password') || m.includes('should be at least')) return 'Senha muito fraca. Use pelo menos 6 caracteres.';
  if (m.includes('network') || m.includes('fetch')) return 'Erro de conexão. Verifique sua internet.';
  return msg;
}
```

**Eye toggle (mostrar/ocultar senha):**
```javascript
function togglePass(id, btn) {
  const inp = document.getElementById(id);
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  btn.innerHTML = show ? _eyeOff : _eyeOn;
}
```

**onAuthStateChange — eventos relevantes:**
```javascript
sb.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' && session) showHub(session.user);
  if (event === 'SIGNED_OUT') showAuth();
  if (event === 'PASSWORD_RECOVERY') {
    // mostra form-recovery, esconde form-login e form-forgot
  }
});
```

### Clusters do hub (ordem e conteúdo)

```
FINANCEIRO
  ├── Visão Financeira  → /visao-financeira/   (ATIVO)
  ├── Painel KM         → /painel-km/          (ATIVO)
  └── R$/KM             → /rs-por-km/          (Em breve)

OPERACIONAL
  ├── Ativação de Frota → /eficiencia-ativacao/ (Em breve)
  ├── Disponibilidade   → /disponibilidade/     (Em breve)
  └── Combustível       → /combustivel/arvore-combustivel/ (ATIVO — terá sub-hub quando múltiplos painéis prontos)

PROCESSOS
  ├── Gerot             → (Em breve)
  ├── Auditorias        → /auditorias/          (Em breve)
  └── FCA               → /fca/                 (Em breve)

RESULTADOS
  ├── Prog. Reconhecimento → (Em breve)
  ├── Aderência ao FCA     → (Em breve)
  └── Painel de Metas      → /painel-metas/     (Em breve)
```

**Financeiro Pessoal (`/financeiro-pessoal/`) NÃO aparece no hub** — é acesso direto pela URL.

### Layout do hub
```css
.hub-main { padding: 36px 32px 80px; margin: 0; }  /* sem max-width, alinhado à esquerda */
.category-header { display:flex; align-items:center; margin-bottom:16px; gap:0; }
.category-title { font-size:10px; font-weight:700; color:var(--text3); text-transform:uppercase; letter-spacing:1.8px; white-space:nowrap; padding-right:14px; }
.category-line { height:1px; background:rgba(255,255,255,.05); flex:0 0 auto; }
.cards-grid { display:grid; grid-template-columns:repeat(3,minmax(200px,300px)); gap:14px; }
```

**Linha separadora** tem largura igual ao grid de cards — calculada via JS:
```javascript
function syncCategoryLines() {
  document.querySelectorAll('.category').forEach(cat => {
    const grid = cat.querySelector('.cards-grid');
    const line = cat.querySelector('.category-line');
    if (grid && line) line.style.width = grid.offsetWidth + 'px';
  });
}
window.addEventListener('resize', syncCategoryLines);
setTimeout(syncCategoryLines, 100);
```

---

## 1. Paleta de cores e fundo

```css
:root {
  --bg:      #0C1017;  /* fundo principal do body */
  --card:    #141B26;  /* cards */
  --card2:   #1A2335;  /* cards secundários */
  --border:  #1E2D40;  /* bordas */
  --orange:  #F97316;  /* cor primária — destaques, títulos, botões */
  --blue:    #38BDF8;  /* cor secundária — linhas remunerado */
  --text:    #F1F5F9;  /* texto principal */
  --text2:   #94A3B8;  /* texto secundário */
  --text3:   #475569;  /* texto terciário */
  --green:   #3BB33B;  /* positivo / favorável */
  --red:     #FF6666;  /* negativo / desfavorável */
}
```

**Body background** — gradiente sutil laranja + azul sobre `--bg`:
```css
body {
  background:
    radial-gradient(ellipse at 10% 25%, rgba(249,115,22,.06) 0%, transparent 50%),
    radial-gradient(ellipse at 90% 75%, rgba(56,189,248,.05) 0%, transparent 50%),
    var(--bg);
  color: var(--text);
  font-family: 'Montserrat', -apple-system, sans-serif;
  font-size: 13px; min-height: 100vh;
}
```

---

## 2. Tipografia

- Fonte: **Montserrat** (Google Fonts) — pesos 400, 500, 600, 700, 800
- CDN: `<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">`
- Aplicar em todos os elementos Chart.js: `font:{family:'Montserrat'}`

| Elemento | Tamanho | Peso |
|---|---|---|
| Hero value | 52px | 800 |
| Título de tabela / seção | 16px | 800 |
| Título de card | 15px | 800 |
| Card value | 24px | 800 |
| Card label (nome) | 10px | 600 |
| Dados da tabela | 12px | 400–500 |
| Cabeçalho de coluna | 11px | 700 |
| Row total | 12px | 700 |
| Badges / hints | 9–10px | 400 |

---

## 3. Barra de título (header)

Fundo semi-transparente escuro, sticky, com blur — **não muda no modo claro**.

```css
.header {
  background: rgba(12,16,23,.75);
  border-bottom: 1px solid rgba(255,255,255,.07);
  padding: 10px 24px 12px;
  display: flex; flex-wrap: wrap; align-items: center;
  position: sticky; top: 0; z-index: 100;
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 2px 12px rgba(0,0,0,.3);
}
.brand h1 { font-size: 16px; font-weight: 700; color: var(--orange); }
.brand p  { font-size: 10px; color: var(--text2); margin-top: 2px; }
```

**Header right** — botões e badges à direita:
```html
<div class="header-right">
  <button class="theme-btn" id="themeBtn" title="Modo claro/escuro"></button>
  <button class="refresh-btn" onclick="atualizar()" title="Atualizar dados">
    <!-- SVG de setas circulares -->
  </button>
  <span class="status-badge" id="status-badge">Carregando…</span>
  <span class="access-badge" id="access-badge" style="display:none"></span>
</div>
```

```css
.status-badge {
  font-size:10px; color:var(--text);
  background:rgba(249,115,22,.15); border:1px solid rgba(249,115,22,.3);
  border-radius:4px; padding:3px 10px; white-space:nowrap;
}
.access-badge {
  font-size:10px; color:var(--text2);
  background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1);
  border-radius:4px; padding:3px 10px; white-space:nowrap;
}
.refresh-btn {
  background:rgba(249,115,22,.15); border:1px solid rgba(249,115,22,.3);
  border-radius:4px; padding:5px 9px; cursor:pointer; color:var(--orange);
  display:flex; align-items:center;
}
.refresh-btn:hover { background:rgba(249,115,22,.32); }
```

**Mobile** — compactar badges e filtros, manter header escuro:
```css
@media(max-width:768px){
  .header-right { flex-direction:row; align-items:center; gap:4px; flex-wrap:wrap; justify-content:flex-end; }
  .header-right .refresh-btn { display:none; }
  .status-badge, .access-badge { font-size:8px; padding:2px 6px; }
  .theme-btn { padding:3px 5px; }
  .theme-btn svg { width:13px; height:13px; }
  .filter-hint { display:none; }
}
```

---

## 4. Modelo inicial do painel — Hero + Cards

**Regra:** o KPI principal fica **fora de card**, grande, no topo. Os demais ficam em cards.

```html
<!-- HERO: número sem card -->
<div class="hero">
  <div class="hero-main">
    <div class="hero-label">RECEITA LÍQUIDA</div>
    <div class="hero-value" id="hero-val">—</div>
    <div class="hero-deltas">
      <div class="hero-delta"><span>Δ Orç. %</span><b id="d-orc" class="cg">—</b></div>
      <div class="hero-delta"><span>Δ Rem. %</span><b id="d-rem" class="cg">—</b></div>
      <div class="hero-delta"><span>YoY %</span>  <b id="d-yoy" class="cg">—</b></div>
    </div>
  </div>
</div>

<!-- CARDS: grid 5 colunas -->
<div class="cards-row">
  <div class="kpi-card">
    <div class="card-label">Orçado</div>
    <div class="card-value" id="c-orc">—</div>
    <div class="card-meta"><div class="card-meta-item">YoY: <b id="c-orc-yoy">—</b></div></div>
  </div>
  <!-- ... -->
</div>
```

```css
/* Hero */
.hero-label     { font-size:10px; font-weight:600; color:var(--text2); text-transform:uppercase; letter-spacing:1px; }
.hero-value     { font-size:52px; font-weight:800; color:var(--text); line-height:1; }
.hero-delta     { font-size:10px; color:var(--text2); }
.hero-delta b   { font-size:14px; font-weight:700; display:block; margin-top:2px; }

/* Cards grid */
.cards-row { display:grid; grid-template-columns:repeat(5,1fr); gap:12px; margin-bottom:12px; }
.kpi-card  {
  background:rgba(20,27,38,.55); border:1px solid rgba(255,255,255,.07); border-radius:8px;
  padding:14px 16px; display:flex; flex-direction:column; gap:3px;
  backdrop-filter:blur(16px); box-shadow:0 2px 12px rgba(0,0,0,.25);
}
.card-label   { font-size:10px; font-weight:600; color:var(--text2); text-transform:uppercase; letter-spacing:.5px; }
.card-value   { font-size:24px; font-weight:800; color:var(--text); line-height:1.1; margin-top:2px; }
.card-delta-v { font-size:20px; font-weight:800; margin-top:2px; color:var(--text); }
.card-delta-p { font-size:12px; font-weight:600; margin-top:1px; color:var(--text); }
.card-imp     { font-size:10px; color:var(--text2); margin-top:4px; }
```

**Layout dos painéis — sem max-width:** todos os painéis usam `.main{padding:20px 24px;}` sem `max-width` nem `margin:0 auto`, igual ao `visao-financeira`.

---

## 5. Filtros multi-select (flags)

Cada filtro é um dropdown com checkbox "Todos" + opções individuais — vários podem estar selecionados simultaneamente. O botão mostra o label + badge com contagem quando há seleção.

```css
.ms-btn {
  display:flex; align-items:center; gap:8px;
  background:#0a0f18; color:var(--text);
  border:1px solid #2a3a50; border-radius:4px;
  font-family:'Montserrat',sans-serif; font-size:11px; font-weight:700;
  padding:6px 12px; cursor:pointer; text-transform:uppercase;
  letter-spacing:.5px; white-space:nowrap; min-width:110px;
}
.ms-btn:hover { border-color:var(--orange); }
.ms-cnt { background:var(--orange); color:#000; border-radius:10px; padding:1px 6px; font-size:9px; font-weight:800; display:none; }
.ms-panel { display:none; flex-direction:column; position:absolute; top:calc(100% + 4px); left:0; z-index:500;
  background:#0f1824; border:1px solid #2a3a50; border-radius:4px; min-width:230px; max-height:300px; box-shadow:0 8px 24px rgba(0,0,0,.7); }
.ms-panel.open { display:flex; }
.ms-opt { display:flex; align-items:center; gap:8px; padding:7px 12px; cursor:pointer; font-size:11px; color:var(--text2); }
.ms-opt:hover { background:rgba(255,255,255,.05); color:var(--text); }
.ms-opt.all-opt { border-bottom:1px solid #1e2d40; color:var(--text); font-weight:700; }
.ms-opt input[type=checkbox] { accent-color:var(--orange); cursor:pointer; width:14px; height:14px; }
```

**Filtro Ano** — obrigatório, sempre o primeiro, populado a partir dos dados:
```javascript
// Formato Date:   [...new Set(vigs.map(d => String(d.getFullYear())))].sort().reverse()
// Formato MM/YYYY: [...new Set(vigs.map(v => v.slice(-4)))].sort().reverse()
buildMsFilter('ms-ano', anos);
```

**Mobile** — 3 filtros por linha (visao-financeira com 6), 2 por linha (4 filtros), lado a lado (2 filtros):
```css
@media(max-width:768px){
  .header-filters { gap:5px; }
  .filter-group { flex:0 0 calc(33.333% - 4px); } /* ajustar % conforme nº de filtros */
  .ms-wrap { width:100%; }
  .ms-btn { width:100%; min-width:0; font-size:8px; padding:3px 6px; }
}
```

---

## 6. Atualização automática e botão de refresh

```javascript
async function atualizar() {
  set('status-badge', 'Carregando…');
  try {
    await fetchData();
    const now = new Date();
    set('status-badge', `Atualizado ${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`);
  } catch(e) {
    set('status-badge', 'Erro ao carregar dados');
  }
}

document.addEventListener('DOMContentLoaded', () => { initAccessLog(); atualizar(); });
```

O botão de refresh fica oculto no mobile (`display:none`) — o painel atualiza apenas ao abrir.

---

## 7. Último acesso (localStorage)

```javascript
function initAccessLog() {
  let name = localStorage.getItem('bi_user_name');
  if (!name) {
    name = prompt('Qual é o seu nome?') || 'Desconhecido';
    localStorage.setItem('bi_user_name', name);
  }
  const lastRaw = localStorage.getItem('bi_last_access');
  if (lastRaw) {
    const d = new Date(lastRaw);
    const lastUser = localStorage.getItem('bi_last_user') || name;
    const badge = document.getElementById('access-badge');
    if (badge) {
      badge.textContent = `Último acesso: ${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})} · ${lastUser}`;
      badge.style.display = '';
    }
  }
  localStorage.setItem('bi_last_access', new Date().toISOString());
  localStorage.setItem('bi_last_user', name);
}
```

**localStorage keys:** `bi_user_name` · `bi_last_access` · `bi_last_user` · `bi_theme`

---

## 8. Modo claro / escuro

Botão lua/sol no `.header-right`. Header e filtros permanecem sempre escuros.

### CSS (após `.refresh-btn:hover`)
```css
.theme-btn { background:rgba(249,115,22,.15); border:1px solid rgba(249,115,22,.3); border-radius:4px; padding:5px 7px; cursor:pointer; color:var(--orange); display:flex; align-items:center; }
.theme-btn:hover { background:rgba(249,115,22,.25); }

body.light-mode .main { background:#F0F0F0; --text:#1a1a1a; --text2:#444444; --text3:#666666; }

body.light-mode .card,
body.light-mode .kpi-card { background:#FFFFFF!important; border-color:transparent!important; box-shadow:0 2px 12px rgba(0,0,0,.10)!important; --text:#1a1a1a; --text2:#444444; --text3:#555555; }

body.light-mode .chart-card,
body.light-mode .tbl-section { background:#FFFFFF!important; border-color:transparent!important; box-shadow:0 2px 12px rgba(0,0,0,.10)!important; --text:#1a1a1a; --text2:#444444; --text3:#555555; }

body.light-mode .card td { color:var(--text); }
```

### JS (ao final do `<script>`)
```javascript
const _sun=`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
const _moon=`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
function applyTheme(t){
  document.body.classList.toggle('light-mode', t==='light');
  localStorage.setItem('bi_theme', t);
  const b = document.getElementById('themeBtn');
  if(b) b.innerHTML = t==='light' ? _moon : _sun;
  if(typeof lastF !== 'undefined' && lastF) renderCharts(lastF); // visao-financeira
  // if(M.length) renderAll();                                    // financeiro-pessoal
}
(function(){
  const t = localStorage.getItem('bi_theme') || 'dark';
  applyTheme(t);
  document.getElementById('themeBtn').addEventListener('click',
    () => applyTheme(document.body.classList.contains('light-mode') ? 'dark' : 'light'));
})();
```

---

## 9. Modelos de gráficos (Chart.js 4.4.0)

CDN: `<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>`
Datalabels: `<script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0"></script>` + `Chart.register(ChartDataLabels)`

### Cores dinâmicas (tema-aware) — OBRIGATÓRIO
```javascript
const getGrid = () => ({color: document.body.classList.contains('light-mode') ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.06)'});
const getTick = (sz=10) => ({color: document.body.classList.contains('light-mode') ? '#444444' : '#94A3B8', font:{family:'Montserrat',size:sz}});
```
**Atenção:** `isLight` deve ser declarada ANTES de qualquer uso dentro da função render (erro de `const` antes da inicialização).

### Gráfico de linha (referência)
```javascript
const isLight = document.body.classList.contains('light-mode');
const orcC  = isLight ? '#999999' : '#F1F5F9';
const legend = {labels:{color: isLight?'#1a1a1a':'#F1F5F9', font:{family:'Montserrat',size:10}, boxWidth:14}};
const tooltip = {backgroundColor:'#141B26', titleColor:'#F97316', bodyColor:'#F1F5F9', borderColor:'#1E2D40', borderWidth:1, titleFont:{family:'Montserrat'}, bodyFont:{family:'Montserrat'}};

// Dataset Realizado (laranja sólido):
{label:'REALIZADO', data, borderColor:'#F97316', borderWidth:3, tension:.3, fill:false}
// Dataset Remunerado (azul tracejado):
{label:'REMUNERADO', data, borderColor:'#38BDF8', borderWidth:2, tension:.3, fill:false, borderDash:[5,3]}
// Dataset Orçado (branco/cinza tracejado):
{label:'ORÇADO', data, borderColor:orcC, borderWidth:2, tension:.3, fill:false, borderDash:[5,3]}
```

### Pontos destacados (mês selecionado)
```javascript
pointRadius:      data.map((_, i) => highlighted.includes(i) ? 6 : 3),
pointBackgroundColor: data.map((_, i) => highlighted.includes(i) ? '#fff' : cor),
pointBorderWidth: data.map((_, i) => highlighted.includes(i) ? 3 : 0),
pointHoverRadius: 8,
```

---

## 10. Condicional de cores para custos

```javascript
// Para custos (ex: Realizado vs Remunerado):
const delta = rem - real;   // positivo = gastou mais = ruim
const bad   = delta > 0;
element.className = bad ? 'cr' : 'cg';

// Para receita (oposto):
const deltaRec = real - ref;
const badRec   = deltaRec < 0;  // receita menor que referência = ruim
```

```css
.cr   { color:var(--red)   !important; font-weight:700; }
.cg   { color:var(--green) !important; font-weight:700; }
.bad  { color:var(--red)   !important; }
.good { color:var(--green) !important; }
```

---

## 11. Formatação de números

```javascript
const numFmt = v => {
  const a = Math.abs(v), s = v < 0 ? '-' : '';
  if(a >= 1e9) return s + Math.round(a/1e9) + ' bi';
  if(a >= 1e6) return s + Math.round(a/1e6) + ' mi';
  if(a >= 1e5) return s + Math.round(a/1e3) + 'k';
  return s + Math.round(a).toLocaleString('pt-BR');
};
const fmt    = v => numFmt(v);
const pctInt = v => (v >= 0 ? '+' : '') + Math.round(v) + '%';
const pctR   = (a, b) => b ? ((a/b-1)*100).toFixed(1)+'%' : '—';
const pp     = v => v.toFixed(2) + ' pp';
```

---

## 12. Tabelas — padrão clean

```css
.tbl-section {
  background:rgba(20,27,38,.55); border:1px solid rgba(255,255,255,.07); border-radius:8px;
  padding:18px 20px 16px; margin-bottom:16px;
  backdrop-filter:blur(16px); box-shadow:0 2px 12px rgba(0,0,0,.25);
}
.tbl-title { font-size:16px; font-weight:800; color:var(--text); margin-bottom:3px; }
.tbl-sub   { font-size:10px; color:var(--text2); margin-bottom:16px; }

table { width:100%; border-collapse:collapse; font-size:12px; }

thead th {
  background:transparent; color:var(--text); font-size:11px; font-weight:700;
  padding:8px 8px 12px; border-bottom:1px solid rgba(255,255,255,.10);
  text-transform:uppercase; letter-spacing:.5px; white-space:nowrap;
}

td { padding:13px 8px; border:none; color:var(--text); white-space:nowrap; }
tbody tr:hover { background:rgba(255,255,255,.035); }

tr.total td {
  color:var(--text); font-weight:700; font-size:12px;
  border-top:2px solid rgba(255,255,255,.12);
  padding-top:14px; padding-bottom:8px;
}
tr.total td.conta { font-weight:800; }
td.num { text-align:right; }
```

**Mobile:**
```css
@media(max-width:768px){
  table { table-layout:fixed; width:100%; font-size:1.6vmin; }
  thead th { font-size:1.6vmin; padding:4px 2px; letter-spacing:0; }
  tr.total td { font-size:1.6vmin; padding-top:6px; padding-bottom:4px; }
}
```

---

## Layout Laranja Moderno — referência visual (Renan, 15/08/2026)

Referência de layout que o Renan escolheu para usarmos: **`docs/layout-laranja-moderno.webp`** (abrir a imagem antes de desenhar qualquer tela nesse estilo). Quando ele disser *"faz no layout laranja moderno"*, é isso aqui.

**O que define o estilo:**

- **Fundo quente, não azulado.** A página é um marrom-escuro alaranjado (~`#1B1113`) com um brilho radial laranja discreto nos cantos — a mesma ideia do nosso `body`, mas puxando para o quente em vez do azul.
- **Shell de app**: rail estreito à esquerda **só com ícones** (logo laranja no topo, item ativo = círculo laranja preenchido, os demais em `--text3`), busca em **pílula full-width** no topo e, à direita, ícones em círculo (engrenagem, sino) + avatar.
- **Cards** `border-radius:18–20px`, fundo um degrau mais claro que a página com leve tinta quente, borda de 1px em `rgba(255,255,255,.06)`, sem sombra dura. **Cards dentro de cards** (o "Activity manager" tem sub-cards) — o interno é mais escuro que o externo, nunca mais claro.
- **Números grandes** (32–40px, peso 800) com o **delta pequeno em laranja logo ao lado**, na mesma linha da base — não embaixo.
- **Botões**: pílula 100% redonda. Ação principal = laranja preenchido; secundária = contorno em `rgba(255,255,255,.12)` com o texto claro. Ícones de ação (`+`, refresh, export, `⋮`) viram **círculos ghost** no canto superior direito do card.
- **Barras com gradiente vertical laranja → roxo** (`#F97316` no topo → `#7C3AED` embaixo), topo e base arredondados, valores negativos descendo abaixo do zero com o gradiente invertido. A barra em foco ganha um **ponto branco com anel** e um **tooltip-card flutuante** (fundo escuro, cantos 12px, uma bolinha colorida por série).
- **Donut** com o arco em laranja sobre trilho cinza-escuro e o valor no centro.
- **Sparkline** em área com o mesmo gradiente laranja→roxo e um ponto branco marcando o último valor.
- **Toggle de par** (ex.: "Top performance" / "Worst performance"): duas pílulas lado a lado, a ativa laranja preenchida.

**Como isso conversa com o que já temos:** o laranja é o mesmo `--orange:#F97316`; o roxo `#7C3AED` entra **só como fim de gradiente** em gráfico, não vira cor de dado. Tipografia continua Montserrat. Regra de cor de resultado (verde/vermelho) não muda.

---

## Layout 2 Moderno — referência visual (Renan, 15/08/2026)

Segunda referência escolhida pelo Renan (dashboard "Fintrixity"): **`docs/layout-2-moderno.png`**. Quando ele disser *"faz no layout 2 moderno"*, é este. **Não confundir com o "Layout Laranja Moderno"** — os dois usam laranja, mas a base é oposta.

**O que define o estilo:**

- **Preto neutro, não quente.** Fundo quase preto (~`#0D0D0D`), sem tinta marrom nem brilho radial. O laranja aparece **pontualmente**, como destaque, não como clima da tela.
- **Sidebar COM rótulo** (não é rail de ícones): painel arredondado um degrau acima do fundo, marca no topo (quadrado laranja arredondado + nome), busca com dica `⌘K`, seções nomeadas em caixa alta (`FEATURES`), **badge de contagem** em pílula escura à direita do item, item ativo = retângulo arredondado mais claro. No rodapé, um **card de destaque** ("Upgrade Pro!") com botão laranja.
- **Topo:** setas voltar/avançar, **breadcrumb** (`Fintrixity › Dashboard`), e à direita ícones em círculo (ajuda, e-mail, sino) + avatar + **botão laranja de ação** ("Share").
- **Cabeçalho de conteúdo:** título + subtítulo à esquerda, e à direita pílulas fantasma de controle ("This Month ⌄", "↻ Reset Data").
- **Fila de KPIs com UM card laranja.** Três cards lado a lado: o principal é **laranja preenchido com texto branco**, os outros ficam escuros. Cada um tem ícone em quadrado arredondado, título + subtítulo, valor grande, **chip de delta** (`+1.5% ↑`) e um **rodapé clicável** ("See details" / "View summary") com botão-seta circular na ponta.
- **Sub-cards em grade 2×2** dentro de um card (as carteiras), cada um com ícone, valor, linha fina de limite e **status como texto colorido** (verde = ativo, laranja-vermelho = inativo) + `⋮`.
- **Gráfico cinza com um único destaque laranja:** todas as barras em cinza-escuro e **só a barra em foco** ganha gradiente laranja→branco, ponto branco no topo e **tooltip-card flutuante** com as linhas do valor. É o oposto do Layout Laranja Moderno, onde todas as barras são coloridas.
- **Toggle de período** (Monthly/Yearly) em pílula escura com a opção ativa em laranja.
- **Tabela** com coluna de checkbox, busca e "Filter" no cabeçalho do card, ícone redondo ao lado do nome, **status em pílula** com bolinha (verde = concluído) e `⋮` no fim da linha.

**Resumo da diferença:** Layout Laranja Moderno = tela inteira quente, gráficos coloridos em gradiente laranja→roxo. Layout 2 Moderno = tela preta neutra e sóbria, com o laranja reservado para **um** card, **uma** barra e os botões de ação.

---

## Layout 3 Moderno — referência visual (Renan, 15/08/2026)

Terceira referência escolhida pelo Renan (dashboard "Metric Flow"): **`docs/layout-3-moderno.png`**. É o mais **analítico** dos três — o que mais se parece com um painel de BI de verdade.

**O que define o estilo:**

- **Grafite neutro** (~`#141518`), com a sidebar num painel arredondado à parte e todo o app dentro de um container de cantos arredondados. Laranja só no logo, no item ativo e nos dados.
- **Sidebar com rótulo**, item ativo = pílula escura com **ícone e texto laranja** e borda fina; no rodapé, `Settings` e `Help Center` separados do menu principal.
- **Topo:** busca em pílula larga à esquerda; à direita **seletor de período com ícone de calendário** ("Wed, 29 May 2024"), sino com bolinha vermelha e avatar.
- **Fila de 4 KPIs iguais** (nenhum card colorido, ao contrário do Layout 2): rótulo à esquerda, **chip de variação no canto superior direito** — verde `↗ +12.5%` / vermelho `↘ -4.3%`, com fundo tingido —, valor grande e, abaixo de um filete, a **legenda do período** em texto apagado ("From Jun 01,2024 To Jun 29, 2024").
- **Heatmap "Orders by time"**: grade de quadradinhos arredondados, linhas = horas, colunas = dias da semana, intensidade em degraus de laranja, **legenda de faixas com bolinhas** no topo do card (`200+ · 500+ · 1.000+ · 2.000+`) e células vazias com **textura hachurada** em vez de cor chapada.
- **Gráfico de linha com crosshair**: duas séries suaves (laranja = Real, azul = Meta), legenda com tracinhos no canto superior direito, **linha vertical tracejada** no ponto em foco com um ponto em cada série e um **tooltip-card flutuante** listando as duas com suas bolinhas.
- **Mini-cards em grade** ("Sales by Country"): bandeira, nome e valor grande com a unidade pequena embaixo; cabeçalho do card com link **"View All"** à direita.
- **Tabela limpa**: cabeçalho em caixa alta apagada, valores alinhados, e a coluna de variação com **seta + cor** (verde sobe, vermelho desce).

**Quando usar qual:** Laranja Moderno = vitrine, tela quente e colorida. Layout 2 = app sóbrio com um destaque só. **Layout 3 = painel denso de números** — é o que mais serve para os nossos (KPIs com chip de variação, heatmap, linha Real × Meta, tabela).

---

# ⭐ LAYOUT PADRÃO DO PORTAL (Renan, 15/08/2026) — usar em TUDO daqui pra frente

Decisão do Renan em 15/08/2026, vendo a `visao-financeira-app`: **"essa visão ficou sensacional, quero que seja o nosso novo padrão. Vamos aplicar em todos os painéis que já existem."** Referências vivas: **`visao-financeira/index.html`** (painel completo: menu lateral, filtros, cards, gráficos, tabelas, forecast editável) e **`index.html` da raiz** (a mesma casca **sem** menu lateral, com os clusters em lista/colunas). Os dois entraram no ar em 15/08/2026, substituindo o hub e o painel antigos. O `disponibilidade-preenchimento` foi onde a linguagem nasceu.

## A casca (app shell)

```css
body{background:var(--fundo);overflow:hidden;font-family:'Montserrat';font-size:13px;}
.app{position:fixed;inset:12px;display:flex;overflow:hidden;
  background:var(--app);border:1px solid var(--card-brd);border-radius:16px;
  box-shadow:0 24px 60px rgba(0,0,0,.45);}
.app::before{content:'';position:absolute;inset:0;pointer-events:none;z-index:0;
  background:radial-gradient(ellipse at 12% 0%,rgba(249,115,22,.07),transparent 55%),
             radial-gradient(ellipse at 92% 100%,rgba(46,144,232,.06),transparent 55%);}
.app>*{position:relative;z-index:1;}
```
A página **não rola** — o app ocupa a tela e cada área resolve o próprio espaço com flex. O brilho laranja/azul é da moldura (`::before`), não do body.

## Tokens (substituem a paleta antiga nos painéis novos)

```css
:root{                                   /* escuro */
  --fundo:  radial-gradient(80% 60% at 90% 0%, rgba(255,244,232,.045), transparent 60%),
            linear-gradient(45deg,#202022 0%,#202022 100%);   /* UNIFORME, ver nota abaixo */
  --luz:      inset 0 1px 0 rgba(255,255,255,.09);
  --luz-card: inset 0 1px 0 rgba(255,255,255,.08);
  --app:      rgba(30,40,60,.34);   --side:  rgba(30,30,30,.50);
  --card:     rgba(44,44,46,.78);   --linha: rgba(255,255,255,.06);
  --card-brd: rgba(255,255,255,.07);
  --brilho:   linear-gradient(180deg,rgba(255,255,255,.022) 0%,rgba(255,255,255,0) 46%);
  --txt:#EEF2FA; --txt2:#B2BCD2; --txt3:#676F83; --txt4:#4C505C;
  --hover:rgba(255,255,255,.06); --cabec:#2B2B30;
  --azul:#2E90E8; --verde:#3BB33B; --vermelho:#FF5252; --laranja:#F97316; --ambar:#F4A100;
}
body.claro{                              /* claro */
  --fundo:  radial-gradient(80% 60% at 90% 0%, rgba(255,255,255,.35), transparent 60%),
            linear-gradient(45deg,#E1E2E5 0%,#E1E2E5 100%);
  --luz:      inset 0 1px 0 rgba(255,255,255,.9);
  --luz-card: inset 0 1px 0 rgba(255,255,255,1);
  --app:      rgba(255,255,255,.34);  --side:  rgba(255,255,255,.50);
  --card:     rgba(255,255,255,.74);  --linha: rgba(15,23,42,.10);
  --card-brd: rgba(15,23,42,.10);
  --brilho:   linear-gradient(180deg,rgba(255,255,255,.6) 0%,rgba(255,255,255,0) 46%);
  --txt:#161D2B; --txt2:#4A5568; --txt3:#737D91; --txt4:#8B94A6;
  --hover:rgba(15,23,42,.05); --cabec:#DCDFE6;
  --azul:#1B6FC4; --verde:#00B300; --vermelho:#FF0000; --ambar:#E9A400;
}
```
**Tema claro é classe `body.claro`** (não `light-mode`), chave `bi_theme`, botão sol/lua no topo. Cards usam `background:var(--side)` — o mesmo tom do menu lateral (regra do Renan). Tudo que é "um degrau acima" (painéis, chips, inputs) usa `--side`; nada de `rgba` chapado. **Não mexer no valor de `--side` para ganhar contraste** — já tentei e quebrou a regra; o contraste vem do fundo uniforme e da sombra do card.

**Menus suspensos são OPACOS** — token `--pop` (`#26262B` escuro / `#FFFFFF` claro). Filtro (`.ms-panel`), seletor de unidades do Gerenciar Acessos (`.farol-panel`) e a dica da lateral usam `--pop` com sombra em duas camadas. Com fundo translúcido dá para ler o card de baixo através do menu — foi exatamente o que aconteceu.

**São cores TRANSLÚCIDAS de propósito** — é o empilhamento `--fundo` → `.app` (com `backdrop-filter:blur(20px)`) → `--side`/`--card` (com blur próprio e `--luz-card`) que dá o vidro. Trocar por hex chapado mata o efeito (já aconteceu). A moldura leva `.app{position:absolute;inset:34px;border-radius:22px;box-shadow:0 28px 70px rgba(0,0,0,.55), var(--luz)}` — **a sombra forte vale nos dois temas**, não suavizar no claro — e o `body::after` com a textura de grão fica por cima do fundo.

## Menu lateral (painéis)

`.side{width:206px}` · `.side.mini{width:56px}` (chave `<painel>_mini`), com:
- `.s-top` — ícone + nome do painel + botão de recolher;
- `.s-sec` — rótulo de seção em caixa alta (`Visões`, `Atalhos`);
- `.s-item` — item com ícone 14px + rótulo; ativo = fundo `--hover` + texto `--txt`;
- `.s-user` no rodapé — avatar circular + nome + sair. **`.av` precisa de `.s-user .av`** para não virar elipse (o `.s-user div{flex:1}` vence pela especificidade);
- **dica ao passar o mouse quando recolhido**: um `.dica` `position:fixed` posicionado por JS no `mouseenter`.

## Topo e filtros

Barra fina com título + subtítulo à esquerda (`JUL/26 · atualizado …`) e, à direita, os filtros multi-select como **botões-texto fantasma** (`.ms-btn`) que abrem `.ms-panel` com busca e "Todos". Contagem em pílula laranja (`.ms-cnt`). Botão de tema no fim.

## Conteúdo

- `.vw` — uma seção por visão, `display:none` / `.on` visível; a navegação é `setVw(v)` + `TIT[v]` no título.
- **Cards de KPI**: `.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}` + `.kpi{padding:19px 16px;border-radius:11px;background:var(--side);border:1px solid var(--card-brd)}`, rótulo 9.5px caixa alta, valor 25px/800, meta 10.5px.
- **Gráficos**: `.card.gcard` com título, subtítulo, legenda própria (`.gleg`) e `.gcv` com o canvas. Sem grade, barras coladas, rótulo de dados no topo. **Série condicional (vermelho/verde) tem legenda NEUTRA** — o quadradinho só diz "isso é a barra".
- **Tabelas** (`table.dre`): cabeçalho sticky em `--cabec`, `td` 9px 12px, `.sep-l` separando blocos, drill de pacote → contas (`tr.pac-row` / `tr.sub-row.show`). **Totalizadores (Total, EBITDA) levam `background:var(--cabec)`** — mesmo tom do cabeçalho, nos dois temas. Δ em BRL **e** em % ficam em negrito.
- **Cores de resultado**: `table.dre td.cr,.cr{color:var(--vermelho)!important;font-weight:700}` (idem `cg`, `cr-t`, `cg-t`) — **o `!important` é obrigatório**, senão `table.dre td{color:…}` vence pela especificidade.
- **Célula editável** (forecast): `td.edit` com fundo laranja 7%, borda tracejada, foco com anel; `td.edit.changed` em laranja. Ao focar troca para o número cru; ao sair, `parseNum` aceita `-2,87 mi`, `566k` e pt-BR.

## Gerenciar Acessos (dentro do hub)

Mesma moldura do hub, com o botão **← Hub** no topo. A lista de usuários é uma **grade** (`repeat(auto-fill,minmax(430px,1fr))`) — em tela cheia dá três colunas, em vez de uma linha por usuário com meia tela vazia entre o nome e os botões. O card segue a regra dos outros: fundo `--side`, borda `--card-brd` e a sombra em duas camadas. **Remover/Bloquear ficam absolutos no canto superior direito** e as linhas de texto levam `padding-right`, para os seletores de Acesso FCA e Recebe Farol usarem a largura inteira do card sem quebrar linha.

## Hub sem menu lateral (`index.html` da raiz)

Mesma casca, **sem `.side`**: topo com marca + busca de painel + tema + usuário, e o miolo em `.board`. **Dois arranjos para o mesmo conteúdo**, alternados pelo botão `#btModo` no topo (chave `gem_hub_modo`):

- **LISTA (padrão)** — clusters empilhados. O cluster **não é um card**: é só a barra de título (rótulo em caixa alta + filete + contagem) com o **"+" que vira "−"**. Ao abrir, mostra os **cards inteiros**, do tamanho normal e com o resumo em até 3 linhas. A primeira visita abre todos (`gem_hub_abertos` ausente ⇒ todos) e, quando não couber, **quem rola é o `.board`, nunca a página** — por isso `.board.lista .clu{flex:0 0 auto}`, senão o flex column comprime os clusters e corta os cards em vez de rolar.
- **COLUNAS** — um cluster por coluna (`grid-template-columns:repeat(N,minmax(0,1fr))`, N = clusters visíveis). Tudo aberto numa tela só, sem rolagem — validado de 1280×720 a 1920×1080, com a densidade caindo por altura de tela (descrição em 3 linhas acima de 940px, 2 abaixo; paddings menores abaixo de 800px).

A busca do topo filtra os cards e esconde cluster vazio; no modo lista ela **abre sozinha** o cluster que tem resultado e devolve o estado do usuário ao limpar. Cluster **Administração** e o card **Planner Corporativo** só aparecem para admin. Os cards saem de um array `CLUSTERS` no JS, não são HTML solto.

## Regras que não se negociam

1. **Nada de rolagem em desktop** — se não coube, encolhe fonte/padding ou divide em mais visões (foi o que levou o YTG + TGT e o Forecast a virarem "Bridge / Cenário 1 / Cenário 2").
2. **Celular**: `@media(max-width:860px)` desliga o flex de altura (`display:block`), devolve `overflow:auto` no body, transforma o menu lateral numa fileira horizontal e dá altura explícita a gráfico e tabela — senão eles colapsam para 0.
3. Todo painel inclui `assets/mobile.js`, `assets/sortable-table.js` e `assets/excel-export.js` (o exportador já entende `.tab-wrap`, `.tsec`, `.rtit` e `.gcard`). **PNG no layout de vidro:** o exportador ACHATA as camadas translúcidas (fundo uniforme → `.app::before` → card) compondo o alfa nó a nó (`effOf` no excel-export.js) — sem isso o html2canvas pinta cada `rgba` sobre o fundo errado e o PNG sai azul-marinho com cards cinza (bug real, 15/08/2026). O achatamento só é exato porque o fundo é uniforme — mais um motivo para não voltar o degradê.
4. Nomes de visão em português curto e sem jargão de arquivo: *Análise Nominal · AH e AV · YTG + TGT · Bridge/Cenário 1/Cenário 2 · Forecast · Cenário 1/Cenário 2*. **A primeira visão de TODO painel chama-se "Resumo Gerencial"** (Renan, 16/08/2026) — nunca só "Resumo".
5. **NADA DE FUNÇÃO QUE SOME NA RECONSTRUÇÃO** (Renan, 16/08/2026): Excel, PNG, PDF, ordenação, mobile — tudo que o painel antigo tinha continua no novo. Antes de promover um clone, comparar a lista de `<script src>` do arquivo antigo (`git show <commit>^:<pasta>/index.html | grep "script src"`) com a do novo e explicar cada ausência. Foi assim que o PDF do Acessos ficou de fora.

6. **NÃO INVENTAR — NUNCA, ABSOLUTAMENTE NUNCA** (Renan, 17/08/2026): o padrão já está definido; migrar um painel é **trocar a apresentação pela do padrão**, não redesenhar. Nada de elemento novo que não existia no painel antigo e não está no padrão — foi o caso da barrinha de progresso que inventei na coluna Aderência do Ranking, que ele viu e perguntou "isso aqui você inventou?". Se algo parece faltar, **perguntar antes**; se algo do padrão não cabe, dizer no chat — mas não criar componente por conta própria. Vale em dobro depois de o padrão estar fechado.

**A PÁGINA é mais escura que o PAINEL** (15/08/2026): é essa diferença que faz o app flutuar. No escuro a página é `#121214` e a camada do `.app` **clareia** (`rgba(255,255,255,.045)` → miolo ~`#1d1d1f`); no claro a página é `#E1E2E5` e o `.app` é `rgba(255,255,255,.34)` (miolo ~`#eaebed`). Quando uniformizei o fundo mantendo o `--app` escuro, os dois ficaram no mesmo tom e o painel virou um buraco — o efeito de painel flutuante vinha do degradê, que colocava a moldura sobre a ponta clara. Ao mexer, medir os DOIS pixels: página e miolo.

**Fundo é UNIFORME, não degradê** (Renan, 15/08/2026): o degradê diagonal clareava para o canto superior direito e os cards de lá sumiam. Os dois temas param no tom do MEIO do degradê antigo — `#E1E2E5` no claro, `#202022` no escuro —, que é o que reproduz o miolo do painel (`#eeeef0` / `#1c1c1e` medidos no pixel). Ao mexer nisso, **medir o pixel do miolo nas duas telas**, não confiar no olho.

**Roteiro de aplicação:** hub e Visão Financeira migrados em 15/08/2026; **Acessos** e **Scorecard** em 16/08/2026. Faltam os demais painéis.

**DIRETO NO OFICIAL E PUBLICADO NA HORA** (Renan, 16/08/2026): o padrão já está definido, então não há mais etapa de validação antes de subir. Mexer no painel oficial, **fazer o merge no `main`** e **avisar no chat que publicou** — nada de PR parado em rascunho esperando "ok". Ele já olhou duas vezes uma tela velha porque a mudança estava num PR não publicado; se a mudança não está no `main`, ela não existe. Ao publicar, subir também o `<meta name="build">` para o `build-check` derrubar o HTML em cache.

**A migração é DIRETO NO PAINEL OFICIAL** (Renan, 16/08/2026) — acabou a etapa do clone `<painel>-novo/`. O método continua o mesmo (casca extraída por script, lógica de dados colada inteira, só a apresentação trocada), e o git é a rede de segurança: o painel antigo está no histórico e volta com um `git show <commit>^:<pasta>/index.html`.

## Gráfico de barra: o padrão universal foi REVERTIDO (09/09/2026)

O Renan comparou o Painel KM com a Visão Financeira, escolheu o desenho do KM e pediu um padrão universal. Foi feito como `assets/grafico-barra.js` (arquivo único, incluído depois do Chart.js nos 37 painéis com barra) e **revertido no mesmo dia**: *"volte uma versão antes, ficou tudo bugado"*.

**Não refazer no mesmo formato.** Um arquivo global que envelopa o construtor do Chart mexe em 37 painéis de uma vez e não dá para conferir tela a tela — foi exatamente o que deu errado. Se o padrão voltar, que seja **painel por painel, com o Renan olhando cada tela**, começando por um só.

O que ficou aprendido e continua valendo (caso alguém tente de novo): um **plugin do Chart.js não serve** para "preencher só o que o painel não declarou", porque no `beforeInit` o Chart.js já mesclou os defaults dele no config e `scales.y.grid.display` chega `true` mesmo sem ninguém pedir; e mexer no `chart.options` (um resolvedor com proxies) não vale nada e **estoura a pilha** se for copiado com `Object.assign`.

## Exportações no layout novo (Excel · PNG · PDF) — 16/08/2026

Os três exportadores funcionam no layout padrão; o painel só precisa incluir os scripts **nesta ordem** (`excel-export.js` ANTES do `pdf-export.js`, que reaproveita o preparo dele):

```html
<script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js"></script>   <!-- no <head> -->
...
<script src="../assets/mobile.js"></script>
<script src="../assets/sortable-table.js"></script>
<script src="../assets/excel-export.js"></script>
<script src="../assets/pdf-export.js"></script>
<script>initPdfExport({ btnContainer:'#pdf-slot', btnClass:'s-item', btnAoFim:true,
  title:'Acessos', subtitle:()=>document.getElementById('titSub').textContent, fileBase:'acessos',
  main:()=>document.querySelector('.vw.on'),
  views:()=>Object.keys(TIT).map(k=>({label:TIT[k], ativar:()=>setVw(k)})),
  viewAtual:()=>VW, irPara:setVw,
  isLight:()=>document.body.classList.contains('claro'), setTheme:aplicaTema });</script>
<script src="../assets/build-check.js?v=AAAAMMDDHHMM"></script>   <!-- + <meta name="build"> no <head> -->
```

- **O "Gerar PDF" fica em ATALHOS, na lateral** (Renan, 16/08/2026) — não no topo e não junto das visões. O painel só põe um `<div id="pdf-slot"></div>` dentro do bloco `Atalhos` e passa `btnClass:'s-item'`; a lateral recolhida já reduz o item a ícone sozinha. **O menu suspenso mora no `<body>`**, não no wrap: dentro do `.app` (que tem `backdrop-filter`) um `position:fixed` se ancora no `.app` e não na tela, e o menu aparecia 34px fora do lugar.
- **UM SLIDE POR VISÃO** (Renan, 16/08/2026): como as visões já são do tamanho da página, cada slide é o **painel inteiro, com o menu lateral recolhido** — o PDF fica igual à tela. O fundo do slide é o tom uniforme da página do portal (`H2CPrep.fundoDe(body)`), e as camadas translúcidas são ACHATADAS na captura (sem isso, no tema claro o card branco sobre fundo branco some). Página 1 é a capa (título, subtítulo, filtros aplicados, data). Acessos = 5 páginas, Visão Financeira = 9.
- **Tabela que não coube gera uma página extra** com ela inteira (`tabelasCortadas()` detecta `scrollHeight > clientHeight`), para o relatório não perder linhas silenciosamente.
- **`filters-toggle.js` NÃO entra**: só age sobre `.header-filters`/`.dim-toggle`, que não existem no layout novo. É o único script do painel antigo que não volta.

**Duas armadilhas do html2canvas 1.4.1 (bugs reais, achados em 16/08/2026 e corrigidos no `assets/excel-export.js`, que expõe `window.H2CPrep` p/ os dois exportadores):**

1. **`color-mix()` ABORTA a captura.** O Chromium computa `color-mix(in srgb, …)` como `color(srgb r g b / a)`, e o html2canvas morre com *"Attempting to parse an unsupported color function"* — o PNG/PDF inteiro falha, não é degradação. Usamos `color-mix` no calor do calendário, no farol e nas linhas tingidas. O `normCor()` converte `color(srgb …)` → `rgba()` (é a mesma base, conversão exata) e o valor entra no clone via `data-h2c-*`.
2. **`box-shadow: inset` vira um bloco chapado.** O filete de luz dos cards (`--luz-card: inset 0 1px 0 rgba(255,255,255,.08)`) era pintado como uma faixa clara cobrindo metade do card. O `semInset()` remove só as camadas `inset` e mantém as de fora.

**Como migrar um painel (método validado no Acessos):** clonar a pasta, **extrair a casca do CSS da `visao-financeira` por script** (do `<style>` até `/* ── YTG + TGT ──` mais o bloco `@media(max-width:860px)`) em vez de reescrever de memória, colar a lógica de dados do painel antigo e trocar só a apresentação: `shell()` sai (o HTML passa a ser estático), `gate()` escreve em `#cols`, `light-mode` vira `claro`, tabelas ganham `class="dre"`, o status vai para `titSub` e entram `setVw`/`trocaMini`/`dica`/`aplicaTema` (chave **`bi_theme`**, a mesma do hub). Depois o Renan valida o clone e só então ele substitui o oficial.

**A sobra de altura é DIVIDIDA — nunca `max-height:none` no `.gr2`** (Renan cobrou 3×): o `.gr2` da casca trava em `44vh` porque lá embaixo há tabela; numa visão em que o gráfico é o miolo dá vontade de tirar o teto, e aí TODA a sobra vai para o gráfico e os cards ficam achatados. O certo é dar altura própria à fileira de cards (`min-height:clamp(112px,16.5vh,170px)` + `justify-content:center` no `.kpi`) e **manter um teto no gráfico** (`max-height:56vh`). Em 1600×900 isso dá ~150px de card e ~480px de gráfico; em 1366×768, ~127 e ~377.

**Regras que saíram da validação do Acessos:** cabeçalho de tabela **sempre alinhado com o conteúdo** (texto à esquerda, número à direita — a casca alinha tudo à direita, o que só serve para tabela numérica) · **nunca barra de rolagem horizontal** (a tabela se ajusta; coluna que estoura vira dica na linha) · fileiras de baixo usam **a mesma grade e o mesmo gap dos cards**, para as bordas baterem · a sobra de altura é **dividida** entre cards e gráficos, nunca despejada num só · eixo Y **justo ao pico** (`suggestedMax` ≈ pico × 1,12), senão o gráfico parece alto e vazio.

---

## Como criar um novo painel

1. Copiar `visao-financeira/index.html` como base (painel de referência)
2. Atualizar `<title>`, `.brand h1`, `.brand p`
3. Definir `SHEET_ID` e `SHEET_TAB` com a aba do Google Sheets
4. Implementar `fetchData()`, `populateFilters()`, `atualizar()`
5. `.main` sem `max-width` nem `margin:0 auto` — layout full-width igual ao visao-financeira
6. Fazer push via `mcp__github__push_files` (ver nota no topo sobre git push)

**URL resultante:** `https://fortesindicadores-byte.github.io/gestao-em-movimento/{pasta}/`

---

## Árvore de Combustível — origem de cada card (meta: eliminar a aba `Árvore Comb.`)

Objetivo: montar a Árvore (`/combustivel/arvore-combustivel/`) puxando dados **direto das abas-fonte de cada painel**, para o usuário parar de manter a aba consolidada `Árvore Comb.`. Mapeamento definido pelo usuário (10/07/2026):

| Card na árvore | Origem (o que alimenta) |
|---|---|
| **Custo Combustível** (Rem/Real) | vem do **DRE** → mesma fonte da **Visão Financeira** |
| **KM Rodado** (Rem/Real) | vem do **Painel KM** |
| **R$/km** (Rem/Real) | **calculado**: apenas Custo Combustível ÷ KM Rodado (não tem fonte própria) |
| **R$/Litro** (Rem/Real) | vem do painel **R$/L** (`/combustivel/preco-litro/`) |
| **KM/L** (Rem/Real) | **já vem** do painel **Km/L** (`/combustivel/eficiencia-kml/`, aba `Km/L`) |
| **Decomposição · KM Rodado** (1ª Viagem, Recs, Noturnas, Virados) | aba **`Dispersão de km`** (base do Painel KM) — são **contagens de viagens**, não km |

**Decomposição — colunas e fórmula (aba `Dispersão de km`):** os quatro números são contagens de viagens.
- **Recs** = `Viagens Rec. Real` (col. Z)
- **Noturnas** = `Viagens Noturnas Real` (col. AC)
- **Virados** = `Viagens Mapa Aberto` (col. AM)
- **1ª Viagem** = `Viagens - Real` (col. W) − Recs − Noturnas − Virados

**Abas-fonte no workbook `Base Dispersão de km`** (mesmo `GV_ID`, tabs no rodapé): `De-Para · Dispersão de km · Consumo · Árvore Comb. · R$/L · Unidocs · Trechos sem KM · Ativos · Resumo Timeline CTEs`. `Dispersão de km` está nesse workbook (`GV_ID`) — puxa de lá. Na `Dispersão de km`: `Km Rem. TT` (AF) e `Km Rodado TT` (AG) alimentam o card KM Rodado (Rem/Real).

> **⚠️ ARMADILHA (bug real, corrigido 03/08/2026):** a aba `R$/L` do workbook `GV_ID` (Base Dispersão de km) é uma **cópia velha/incompleta** — só ~14-17 "Unidade Benner" cobertas, nunca teve GRL, NFR, ROTA-FLP em nenhum mês testado. A fonte CORRETA do preço remunerado é a aba `R$/L` do workbook **`KML_ID`** (`1ZZdvG_RK5cTBLdPl3TWCbNeqw-Y4fTYwWsQV4w-e__A`, mesmo do `Km/L`) — é o que o painel oficial `/combustivel/preco-litro/` sempre usou. A Árvore de Combustível apontava pro `GV_ID` por engano (corrigido: `gvFetchSheet(KML_ID,'R$/L')`). **NUNCA usar `gviz(GV_ID,'R$/L')` de novo** — só o `KML_ID`. A aba `R$/L` da Base Dispersão de km era um IMPORTRANGE da do Consumo e **foi excluída pelo Renan em 08/09/2026**; Eficiência Km/L e Consumo Km/L Análise (os dois últimos que a liam, para o preço remunerado do impacto) passaram a ler `KML_ID` na mesma data. VAN não tem preço remunerado em nenhum workbook (confirmado pelo Renan: proposital, sem preço médio por projeto).

**Custo Combustível (DRE / Visão Financeira):** workbook `1qcTy2ppLCGBKKqZCxCYWCTL9kTAuWfHBMyBfWJOyih8`, aba **`Frota`** (colunas `orc`=0, `rem`=1, `real`=2, `kmRem`=5, `kmReal`=6, `vig`=9, `uni`=10, `nv3`=11, `cta`=12). Custo Combustível = soma de `rem`/`real` das contas que caem no pacote **"Combustíveis"** (ver `PACOTES_MAP` no `visao-financeira/index.html`: Combustíveis Veículos e Equipamentos, Estorno de ICMS não Aproveitado, Fluídos (Arla), Arla, ICMS Crédito Presumido).

**Situação em 08/09/2026: a aba `Árvore Comb.` NÃO é mais lida por ninguém** — a Árvore monta tudo das abas-fonte (Frota da Visão Financeira, `Dispersão de km` do `GV_ID`, `Km/L` e `R$/L` do `KML_ID`); a constante legada saiu do painel e a aba saiu dos `ALVOS` do gviz-robot. O Renan pode excluí-la. Do workbook Base Dispersão de km ficam em uso a aba `Dispersão de km` (10 painéis) e a **`Balanço de Massa`** (Painel KM e Árvore, abaixo).

**BALANÇO DE MASSA — recomposição do km remunerado das EMPURRADAS (Renan, 08/09/2026):** aba **`Balanço de Massa`** (`Unidade | Vigência | Valor | Valor 85%`) no workbook Base Dispersão de km (`GV_ID`). São viagens que não emitiram CTE e foram cobradas depois; **o que vira km é a coluna `Valor 85%`** (D, `=C×85%`; Renan, 10/09/2026: *"considera a coluna D para calcular o km rem a devolver, não mais a C"*) — os três leitores (Painel KM, Árvore, Balanco Massa Check) acham a coluna pelo rótulo `valor`+`85` e só caem na `Valor` crua, com aviso no console, se a de 85% sumir. O valor **volta ao km remunerado** da Dispersão de km nas três empurradas (CUIABA EMPURRADA → `EMPURRADA|CBA`, PIRAI EMPURRADA → `EMPURRADA|PIR`, MACACU EMPURRADA → `EMPURRADA|MCC`; a vigência da aba vem como `mmm/aa` ou `MM/AAAA`). Regra: **km recomposto = Valor ÷ R$/km remunerado da chave**, com R$/km = Σ remunerado de **TODAS as contas dos pacotes Combustíveis + Manutenções + Pneus** (aba `Frota` do DRE, chave vigência|projeto|unidade — o MESMO R$/km do Painel KM; começou com as cinco contas variáveis e o Renan trocou na hora: *"pode pegar de todas as contas, acho que ficou irreal"*) ÷ **km remunerado ORIGINAL** da chave — a taxa é calculada ANTES de somar o recomposto, senão vira circular. O km recomposto é rateado entre as linhas da chave proporcionalmente ao remunerado original (`rem0`, `recomp`, `bmValor`, `bmTaxa` nas linhas do `painel-km`); o R$/km do impacto (3 pacotes) continua sobre o km original. **Só o Painel KM e a Árvore de Combustível aplicam** — os outros 8 leitores da `Dispersão de km` (Seara, Gerot, Termômetro…) seguem com o km bruto. No Painel KM aparece no hero (`Balanço de massa: +X km · R$ Y`); na Árvore a **caixinha "Recomposição · Balanço de Massa"** (Valor R$ · R$/km rem. · Km no Rem) desce do card Km Rodado Remunerado com uma seta, para mostrar quanto do remunerado veio da recomposição (o remunerado já a inclui). Auditoria: workflow **Balanco Massa Check** (`scripts/balanco-massa-check.mjs`), que imprime antes × depois por unidade e por mês — foi dele que saiu `docs/balanco-massa-comparativo.pdf` (jan→jul/2026: R$ 3,93 mi → +831 mil km, 22,9% do km remunerado; em Piraí é 25% e o Δ km inverte de perda para ganho). A aba está nos `ALVOS` do gviz-robot. Chave sem km remunerado ou sem custo variável na Frota é ignorada e listada no console (`bmSem`).

**Como implementar com segurança:** os números precisam continuar batendo com a `Árvore Comb.` atual. Antes de trocar a fonte, inspecionar as abas reais (`Dispersão de km`, `R$/L`, `Frota`) via GitHub Actions (o sandbox não alcança docs.google), reproduzir os totais atuais e só então trocar.

---

## FCA & unidades — regras vigentes (ago/2026)

- **Unidades com tier:** CBA → `CBA T1` (Empurrada) · `CBA T1 WH` (Apoio/Empilhadeiras) · `CBA T2` (CDD); MCC → `MCC T1` (Empurrada) · `MCC T2` (CDI). Tier derivado do projeto: EMPURRADA→T1 · APOIO→T1 WH (só CBA) · demais→T2. A **RPM também é separada por tier**: a Base RPM vem por unidade do Gerot (`CUIABA EMPURRADA`/`CUIABA`/`CDD CUIABA`/`MACACU EMPURRADA`/`CDI MACACU`) e cai no recorte certo via `RPM_UNIT_MAP` do fca-preenchimento.
- **Acesso FCA multi-unidade:** `fca_profiles.unidade` é lista separada por vírgula (ex.: `CBA T1,MCC T1`); RLS via `fca_has_unit()` (scripts/split-cba-mcc.sql). Gestão por flags no Gerenciar Acessos do hub.
- **TODA tabela nova com `unidade` usa `fca_has_unit()`, NUNCA `= fca_my_unit()`** (bug real, 24/08/2026): a `carta_custos` tinha ficado com a regra de unidade única, que compara a unidade da linha com a STRING INTEIRA do perfil (`'MCC T1' = 'MCC T1,MCC T2'` → false). Sintoma: quem tem UMA unidade lança normal, quem tem DUAS não consegue (e, se o SELECT também estiver assim, nem enxerga os lançamentos). Eram 7 perfis afetados, não um. Corrigido por `scripts/carta-custos-rls.sql` (recria as 4 policies, inclusive a de SELECT — o `split-cba-mcc.sql` só trocava as de escrita, e só se a tabela já existisse na época). Auditoria: workflow **Carta RLS Check**. A TELA não tem culpa nesse tipo de caso — validado com um perfil `MCC T1,MCC T2`: a carta abre, escolhe a 1ª unidade e manda o insert certo; quem barra é o banco.
- **Custos por PACOTE (fca-preenchimento):** o fato gerado é o **pacote líquido** que estourou vs remunerado. **As CONTAS ficam DENTRO DO FATO** (Renan, 14/08/2026): `Pacote Combustíveis` + `Desvio: ▲ R$ X · ▲ -Y%` + `Contas:` + uma linha por conta, do maior desvio ao maior saving — ▲ estouro (vermelho) · ▼ saving (verde) via helper `tri()`. A **CAUSA nasce VAZIA**, para a unidade escrever o porquê. Saíram os drivers de Combustíveis (Dispersão de km, Km/L com bottom 3 placas, R$/L) e o custo/placa ativa de Manutenções/Pneus — viravam miscelânea; o driver fica no painel do indicador (por isso a geração não baixa mais `Dispersão de km` nem `Km/L`). O `fato_desvio` passou a ter **várias linhas**: `stripTags` converte `<br>`→`\n` e preserva as quebras, e as telas renderizam `\n`→`<br>`. **Estorno de ICMS não Aproveitado e ICMS Crédito Presumido NÃO são do pacote Combustíveis** — vão para `ICMS`, como na Visão Financeira (o `EXCL` do pushDRE tinha a chave sem o "DE" e nunca casava, por isso o Estorno aparecia).
- **Desvios da RPM = os INDICADORES DO GEROT abaixo da meta (Renan, 14/08/2026):** o botão "Desvios da RPM" NÃO lê mais a aba `Base RPM` do Sheets (ficou sem apuração de jul/2026 em diante — 546 linhas/mês com `% de Ating.` vazio — e por isso não gerava nada). A fonte é a MESMA do painel Gerot: `assets/gerot-base.js` → `elite_snapshot`. Regra: **qualquer indicador com `atgMeta` < 100% vira FCA** (chave e adicionais), na **última vigência com dados** (ou `?sync=rpm&vig=YYYY-MM`), unidade/projeto pelo `RPM_UNIT_MAP`, fato = nome do indicador, `fato_desvio` = `Meta: X | Real: Y | Ating: Z%` no formato do indicador (%, contagem, hh:mm, mm, km/L), causa vazia. Aditivo pela chave vig+RPM+projeto+fato: rodar todo mês acumula.
- **Combustível NÃO gera FCA de RPM** (Renan, 14/08/2026): é tratado no pacote Combustíveis dos Custos. O `field==='comb'` é pulado no `desviosDoGerot`.
- **Filtro Indicador/Conta** (fca-preenchimento e fca-consolidado): lista as CONTAS que aparecem nas linhas `- Conta: ▲ …` dentro do fato (Custos) e o nome do indicador (RPM) — dá para achar todo FCA que tem Arla estourando, por exemplo.
- **Admin edita o FATO:** no modal do fca-consolidado (Kanban/Gantt) o Fato e o desvio são campos editáveis, como já eram na visão Tabela.
- **Kanban primeiro:** fca-preenchimento, fca-consolidado E o **planner-corporativo** abrem no **Kanban** (botões Fatos/Tabela ao lado, padrão Planner); FCAs automáticos (sem ação) no topo das colunas, depois por vencimento; cards mostram prazo + badge de status + dias p/ vencer ou "vencida há Xd". Status inicial dos automáticos: `Não iniciada`.
- **Visão Gantt (04/08/2026):** botão **Gantt** no planner-corporativo, fca-preenchimento e fca-consolidado — componente compartilhado `assets/gantt-view.js` (`GanttView.html(items)`; item = `{id,label,tag,resp,status,start,end}`). Barra = criação (`created_at`) → prazo, cor do status (mesmas do Kanban), rastro vermelho tracejado = atraso (prazo→hoje), barra tracejada = sem prazo, linha "hoje". Clique na linha (`.gv-row[data-id]`) abre o modal do painel (delegação própria de cada painel). Alternância: Gantt ⇄ Kanban.
- **Farol · chip "Saída OS Crítica" (04/08/2026):** o hero dos faróis (renderHeroDots/unitStats em `farol-core.js`, stat `ck`) mostra o Checklist como binário — 0 saídas com OS crítica no mês de referência (regra do 3º dia útil) = **100%** verde; ≥1 = **0%** vermelho; sem coleta do robô = cinza. NÃO entra na média do hero (que segue sv/se/cf/pv/al/os/dp).
- **"(INATIVO)" nunca aparece:** mesclado na unidade/projeto base — dados via `scripts/limpar-inativo.sql`, telas via vassoura global no `assets/mobile.js`.
- **Mobile tipo app:** `assets/mobile.js` incluído em TODAS as páginas (zoom travado + tabela larga vira "+ Detalhar" no mobile). Páginas novas devem incluir o script.

## Fundo dos painéis (`assets/fundo.css`)

**DESLIGADO hoje (Renan, 10/08/2026): nenhuma página inclui o arquivo** — o hub voltou ao fundo liso de gradiente. O `<link>` está comentado no `index.html` da raiz; para religar, basta devolver a linha. O arquivo e a imagem continuam no repositório.

O CSS controla o **modo escuro**: `--gem-foto` (a imagem) + `--gem-scrim` (o escurecedor por cima). Quem quiser o fundo inclui `<link rel="stylesheet" href="assets/fundo.css">`. Os painéis ficam sem imagem de propósito (Renan, 08/2026), porque tela de número pede fundo liso. A URL da imagem é **relativa ao CSS** (`url('img/…')`), por isso serve igual em `/gerot/` e em `/combustivel/seara/arvore/`. Só mexe no escuro — `body.light-mode` fica intacto. Usa `!important` porque cada painel declara o próprio `body{background}` inline. Cards NÃO são tocados de propósito (cada painel tem o seu). A imagem é `assets/img/fundo-conlog.jpg` (caminhão de neon da CONLOG na estrada). **Imagem colada no chat não vira arquivo em disco** — o diretório de uploads só recebe anexos; quando precisar dos bytes de uma imagem colada, extraia do transcript da sessão (`/root/.claude/projects/<projeto>/<sessao>.jsonl`, blocos `{"type":"image","source":{"type":"base64"}}` nas mensagens do usuário).

**FILTRO NA ABA DO SHEETS ESCONDE DADO DO PAINEL (24/08/2026):** se alguém deixa um filtro aplicado na aba, o gviz devolve **só as linhas visíveis** — sem erro, sem aviso. Sintoma: cards zerados para todo recorte que "sumiu". Foi o caso da Árvore de Combustível, em que KM/L e R$/L vieram 0,00 enquanto Custo e KM Rodado traziam valor: a aba `Km/L` estava filtrada e o gviz entregou 32 linhas (só `ROTA - MCC` de jul/2026) das milhares que existem. **Antes de caçar bug no código, conferir se a aba está filtrada.** O workflow **KmL Aba Inspect** (`scripts/kml-aba-inspect.mjs`) mostra em segundos quantas linhas, vigências e projetos a aba está entregando; o **Arvore Comb Inspect** compara os rótulos de projeto das três fontes da Árvore.

**A VISÃO FINANCEIRA SAIU DO GVIZ (18/09/2026) — o passo 4 voltou a andar.** Renan: *"Mas cara, jogamos tudo pro banco. Isso foi falado diversas vezes"*. Ele estava certo e o número mostra onde parou: **26 abas já viravam tabela `sh_*` de hora em hora, mas 16 painéis liam o workbook do DRE direto do Sheets** e só o Eficiência Km/L tinha sido trocado (10/09). O dado foi para o banco; os painéis é que ficaram bebendo da planilha.

- **A 3ª aba não existia.** A Visão Financeira lê `Frota`, `EBITDA` **e `Receita Líquida`** — as duas primeiras tinham tabela, a terceira não estava nem na lista de bases. Migrar só duas deixaria a porta aberta de sempre. Entrou como `dre_receita` (16.290 linhas), SQL gerado pelo **Sheets DDL** (nunca escrito à mão).
- **Conferido antes de trocar** (workflow **DRE Banco Check**): os dois lados batem **centavo a centavo** nas três abas — Frota 17.810 linhas / orç −239.711.557,39 · EBITDA 1.672 · Receita 16.290 / orç 1.260.486.590,56 —, com **0 divergências** por vigência (72/36/72 chaves) e por unidade (13/12/12). O check avisa quando o lado da PLANILHA vem menor que 60% do banco: aí a aba está filtrada e quem erra é a planilha.
- **A troca é só no `fetchTab`**: o painel mapeia coluna por RÓTULO (`ebIdx`/`mapTab`), então o adaptador devolve `{header, rows}` com os rótulos da aba e nada mais no painel sabe a diferença. `fetchTabGviz` continua como reserva, e o **selo do subtítulo** diz de onde veio (`· banco` / `· planilha` / `· banco + planilha`).
- **A VIGÊNCIA VOLTA COMO A STRING `"Date(2026,7,1)"`, não como Date nem `'AAAA-MM-DD'`** — e isso não é preciosismo, são as duas armadilhas que o Km/L já pagou: `new Date('2026-08-01')` é meia-noite **UTC**, que no Brasil cai em 31/07 e joga a vigência para o mês anterior; e as linhas do EBITDA vão **cruas** para o `localStorage` (`bi_cache_vf_v8`), onde o `JSON.stringify` transforma Date em ISO — formato que o `parseVig` não conhece, então **na segunda carga da página todo o EBITDA perderia a vigência**, sem erro nenhum. Sendo a mesma string que o gviz entrega, o `parseVig` já sabe lê-la e o cache não a estraga.
- **A FONTE VAI JUNTO NO CACHE.** O `init()` usa o `localStorage` por até 1h **sem refazer a leitura** — nesse caminho o `FONTE_TAB` fica vazio e o selo emudece, que é justamente o que ele existe para evitar. Foi o próprio teste que pegou isso: o cenário "1ª carga" não era 1ª carga nenhuma, porque a página anterior tinha deixado cache.
- **Validação** (`scripts/vf-banco-teste.mjs`, Chromium com o painel real): 18 checagens em 4 cenários — banco na 1ª carga · **2ª carga lendo do cache** (a armadilha da vigência) · banco com erro · **tabela vazia**, que é o que o anon sem sessão do hub recebe em vez de 401 e por isso conta como falha. Nos quatro, o número na tela é o mesmo.

**A GUARDA CONTRA ABA FILTRADA AGORA EXISTE NOS DOIS ROBÔS (18/09/2026).** O Renan filtrou a aba `Frota` do DRE (811 de 17.810 linhas, projeto INSUMOS - PIR) e perguntou: *"eu ainda filtro na planilha e afeta o painel? Não estava resolvido isso?"*. **Não estava** — e vale saber exatamente o que estava e o que não estava:

- A guarda de 40% que eu tinha feito vive no **`sheets-robot`**, que alimenta as tabelas tipadas `sh_*` — e **só UM painel lê de lá** (Eficiência Km/L). **38 painéis leem o gviz direto**, inclusive a Visão Financeira. Ou seja, a proteção existia do lado que quase ninguém usa.
- O **`gviz-robot` não tinha guarda nenhuma**: comparava o md5 e, se mudou, gravava. A foto filtrada viraria "a verdade", e o shim a serve por **12 h** (`MAX_IDADE`, subido de 3h para 12h em 05/09) — não por 1h.
- **E o robô não roda de hora em hora na prática:** em 18/09 as duas rodadas ficaram a **5h15** uma da outra (05:49 e 11:04 UTC). É o mesmo atraso do agendador do GitHub já documentado no Ginfo. Uma foto contaminada duraria o dia.
- **O sintoma engana porque é PARCIAL:** Receita Líquida e EBITDA vieram cheias (abas não filtradas) e só os custos desabaram — a tela parecia funcionando, com o filtro de Unidade oferecendo uma unidade só.
- **Medido na hora:** a rodada das 08:04 BRT disse `30 ok (30 sem mudança)`, então a foto do DRE Frota **não** chegou a ser contaminada; o filtro entrou depois dela. O que a tela mostrou veio da leitura **ao vivo** — o snapshot só vale nos **primeiros 15 s** da página, e o botão "Atualizar dados" vai sempre direto ao Google.

O `gviz-robot` passou a **recusar a foto que encolher mais de 40%** e a manter a anterior, com `::error::` e saída 1 (recusa é alarme, o job fica vermelho para alguém olhar). A régua é o **tamanho em bytes**, não o nº de linhas: o `bytes` da foto anterior já é uma coluna gravada, então comparar não custa baixar o corpo de MBs de volta. Validação: `gviz-guarda.mjs` roda o **próprio** `scripts/gviz-robot.mjs` com o fetch dublado em cinco cenários (filtrada -95% · normal -10% · exatamente -40% · sem foto anterior · md5 igual), 16 checagens. **Duas armadilhas foram do TESTE, não da guarda**, e as duas fingiam defeito no código: o corpo sintético errava por 36 bytes e fazia o cenário "no limite" cair a -40,004% (recusado com razão), e `new Response('', {status:204})` **lança** — 204 não aceita corpo —, o que virava "30 falhas" que pareciam da aba.

**O que a guarda NÃO resolve:** a leitura ao vivo. Depois dos 15 s iniciais, e sempre no "Atualizar dados", o painel vai direto ao Google e enxerga o filtro. O conserto definitivo continua sendo o passo 4 do roteiro (painel lendo `sh_*` em vez do gviz), que só o Km/L fez.

## NENHUM PAINEL LÊ MAIS O GOOGLE SHEETS — o corte pelo shim (Renan, 18/09/2026)

*"NÃO QUERO MAIS A MERDA DE NENHUM PAINEL LENDO DO GOOGLE SHEETS!!!"*. Migrar 38 painéis um a um levaria semanas e cada um pediria o seu comparador; o caminho que resolve todos de uma vez **sem tocar em painel nenhum** é o `assets/gviz-cache.js`, que já está no `<head>` de todas as páginas e já intercepta fetch e JSONP. Ele deixou de ser "acelerador de abertura" e passou a **reconstruir o payload do gviz a partir das tabelas `sh_<slug>`**: `cols` com label/type de `sh_base.colunas`, `rows` com `{v}`, data como a string `"Date(y,m,d)"`. O painel recebe exatamente o que o Google devolveria — `detectCols`, `parseVigCell`, `cellText`, tudo continua funcionando sem saber da troca.

- **Acabou a janela de 15 s.** O botão "Atualizar dados" e os `setInterval` também leem do banco — que era justamente o buraco por onde o filtro da aba entrava. Ordem: **banco → snapshot cru → Google**, e a ida ao Google conta em `GvizCache.google` com aviso no console. `GvizCache.fontes[chave]` diz de onde cada aba veio naquela página.
- **A reconstrução mora em `window.GvizRebuild`**, e o **Sheets Gviz Check** (`scripts/sheets-gviz-check.mjs`) roda **esse mesmo código** em `node:vm` contra o banco real, comparando com a foto crua do `gviz_snapshot` célula a célula. Conferir com uma segunda cópia mediria a diferença entre duas cópias, não entre o banco e o gviz.
- **Medido em 18/09/2026: 27 bases idênticas**, incluindo `dre_frota` (17.810 linhas × 11 colunas), `seara_ctes` (57.679) e `manutencao` (25.441). O `f` (valor formatado) difere em muitas células e **isso é esperado**: os painéis leem `v`, e quem lê `f` (`parseVigCell`, `cellText`) já trata `Date(` antes.
- **O inventário do que cada painel pede é MEDIDO, não grepado** (`scripts/gviz-inventario.mjs`): abre os 38 painéis no Chromium com fetch e JSONP interceptados e anota cada chave. Foi ele que achou as **11 chaves sem tabela** que o grep não pegaria, porque a URL é montada em runtime — as consultas AGREGADAS da Seara (`select A, sum(D) group by A`, `count(A) group by …`), a `Base Remunerado Modelo`, a `Abertura`, a `Regras` do termômetro (`headers=0`), as três abas do painel antigo de Disponibilidade e a `Frota` com `headers=1`.
- **Consulta agregada vira TABELA PRÓPRIA.** O `sum`/`count`/`group by` do `tq` é calculado pelo Google; para sair do Sheets, cada consulta é uma base com o resultado já somado, nos MESMOS parâmetros que o painel manda (é o desenho que a `seara_ctes` já usava). A chave é exata, byte a byte.
- **Mesma aba pedida com parâmetros diferentes = APELIDO, não tabela nova:** a Árvore da Seara pede a `Frota` com `headers=1` e o `rs-por-km` pede o Remunerado agregado com `headers=1`. Uma tabela só.
- **Foto sobrando não é problema; chave pedida sem tabela é.** A primeira versão do check reprovava a foto da `Árvore Comb.` como "painel que vai ao Google" — painel nenhum a pede desde 08/09. A régua agora é o `docs/gviz-inventario.json`.
- **Tabela no banco sem foto no snapshot = nada com que comparar**, e era o caso dos 6 gids do Painel de Metas do Diretor e da aba `Custos` do Farol: tinham carga, nunca tiveram foto. Entraram nos `ALVOS` do gviz-robot.
- **Foto e carga têm de ser do MESMO instante.** O `term_wh_t2_acum` apareceu divergindo (gviz 29 colunas × banco 26, Total Pontos 73 × 71, Ranking 46º × 54º) com foto de 14:57 e carga de 16:32 — é uma aba que estava sendo editada no meio, não a reconstrução errada. Ao ver divergência, **olhar as duas datas antes de caçar bug**; a conferência é refazer as duas juntas.
- **A leitura manda o JWT da sessão do hub** (o `supabase-js` guarda no `localStorage` da mesma origem), porque as `sh_*` têm RLS `to authenticated`; sem sessão cai na chave pública. Anon sem policy recebe `[]`, não 401 — por isso tabela vazia conta como falha e o pedido segue para o snapshot/Google.
- **Teste de mecânica** (`scripts/gviz-banco-teste.mjs`): abre os 37 painéis no Chromium com o **Google bloqueado** e o banco dublado, e reprova se qualquer pedido escapar para o `docs.google`. Foi ele que achou as três fugas abaixo — nenhuma delas aparece no grep.
- **APELIDO QUE FALTA NO SHIM manda o painel ao Google em SILÊNCIO.** O `apelidos` do `sheets-bases.mjs` e o `APELIDOS` do `gviz-cache.js` são listas **separadas** (o shim é `.js` de browser, sem `import`), e as duas se desencontraram: a Árvore da Seara pede a `Frota` com `headers=1` e o `rs-por-km` pede o Remunerado agregado com `headers=1`. O teste agora reprova quando elas divergem — sem isso, o próximo apelido repete a história.
- **`/export?format=csv` NÃO É `/gviz/tq`.** Scorecard, Diagnóstico e Resumo Executivo leem a Base RPM como **CSV** ("porque o gviz trunca abas grandes"), num caminho que o shim não interceptava. Hoje ele atende esse caminho montando CSV de verdade (rótulos na 1ª linha, data em `AAAA-MM-DD`, campo com vírgula/aspas escapado), e a reserva do snapshot converte o payload gviz em CSV para nem ela precisar do Google.
- **RÓTULO VAI CRU, sem `trim`.** A aba `Custos` do Farol tem uma coluna chamada `"Δ FCT "`, com espaço no fim — o mesmo fenômeno do `"Parada? "` e do `"Desconto "` dos exports do Ginfo. Aparado, o shim devolvia um rótulo **diferente** do que o Google devolve, e painel que casa coluna pelo nome exato não a acharia. O `trim` vale só para o nome da coluna no Postgres.

**ABA QUE GANHA COLUNA CONGELA A TABELA E SERVE DADO VELHO (18/09/2026) — a armadilha mais perigosa do corte.** O `term_wh_t2_acum` divergia e eu errei a explicação **duas vezes** antes de medir: disse que era aba sendo editada (foto e carga eram do **mesmo minuto**) e depois que era aba instável (o **Gviz Instavel Check** novo leu 8 abas 3× cada: **todas estáveis**). A causa real estava no log da carga:

```
PGRST204: Could not find the 'col_26' column of 'sh_term_wh_t2_acum'
```

A aba passou de **26 para 29 colunas** e a tabela só tinha até `col_25`, porque o `bases-manuais.sql` foi gerado quando ela tinha 26. A carga morre, **a tabela congela no conteúdo antigo** e o job fecha **VERDE** (`7 carregada · 2 falha`, exit 0 porque `carregadas+iguais > 0`). Antes do corte isso era inofensivo — o painel lia o Google. Depois do corte, o banco passaria a servir `Total Pontos 71` onde a planilha já dizia `73`: **número errado com cara de certo**.

- **Coluna nova na aba exige regerar o SQL** (Sheets DDL da base) e rodar. Enquanto não rodar, a base fica parada no passado.
- **O prefixo do `sh_base.erro` separa os dois casos, e a diferença importa:** `RECUSADA:` é a guarda da aba filtrada, e ali a tabela guarda o último bom **de propósito** — deve continuar sendo servida, senão o painel volta a ver o filtro do Google; `FALHOU:` é carga que nem aconteceu, e aí o shim **não serve** a base. É o próprio banco dizendo em quem não confiar, e cobre qualquer aba que ganhe coluna daqui pra frente.
- **Depois do SQL rodado:** `45 carregada(s) · 0 falha(s) · 190.279 linhas`, com o `term_wh_t2_acum` gravando as 29 colunas.

**PRÓXIMO PASSO — SHEETS PARA O SUPABASE (Renan, 07/09/2026: "vamos fazer amanhã algo para jogar tudo para o Supabase"):** o filtro na aba `Km/L` voltou a esconder o dado (586 linhas, só jan./2026, confirmado pelo KmL Aba Inspect) e derrubou o remunerado da Condução Econômica, o Eficiência Km/L e a meta de combustível do Gerot. Decisão (Renan, 07/09/2026, à noite: "amanhã quero guardar tudo no Supabase, de todos os painéis"): parar de ler abas por gviz em TODOS os painéis e ter o robô gravando cada aba numa tabela do Supabase (linhas tipadas, não o texto cru do `gviz_snapshot`), com os painéis lendo de lá. Roteiro: (1) inventariar as abas que cada painel lê (a lista `ALVOS` do `scripts/gviz-robot.mjs` já cobre ~30, mais as que os painéis pedem com `tq`); (2) uma tabela por aba, colunas pelo cabeçalho, chave por linha, `vigencia` normalizada; (3) o robô do Sheets grava por vigência e só regrava o que mudou; (4) trocar o `fetch`/JSONP dos painéis por `sbClient().from(tabela)` um painel por vez, conferindo os totais contra o gviz antes de trocar; (5) o snapshot cru vira fallback e depois sai. Começar pela `Km/L` do workbook Consumo. O remunerado da Condução Econômica (linha pontilhada + condicionais, código no histórico do PR #1044) volta quando essa base existir. O filtro da aba foi removido em 07/09/2026 à noite (3.680 linhas, jan→jul), mas a regra é não depender mais disso.

## Bases manuais no Supabase — a migração do Sheets (Renan, 09/09/2026)

Pedido dele de madrugada: *"conseguimos fazer isso essa madrugada enquanto eu durmo, você buscar as informações das bases de dados que a gente utiliza hoje que são manuais, todas, e criar um esquema que sempre que essas bases manuais sejam atualizadas os dados vão para o banco no Supabase"*. É o passo que estava previsto na seção do snapshot do gviz, agora com linhas TIPADAS em vez do texto cru.

**A lista canônica é `scripts/sheets-bases.mjs`** — 33 bases (as 30 do `gviz-robot` + as 6 do Painel de Metas do Diretor, menos duas duplicatas). Cada uma tem um **slug estável**, que é o nome da tabela: `sh_<slug>`. Os parâmetros (`sheet`/`gid`/`tq`/`headers`) são os mesmos que os painéis mandam, **byte a byte**, senão a chave do `gviz-cache` não casa.

- **Duas abas eram a mesma coisa** (conferido byte a byte em 09/09/2026): `gid 0` do workbook da RPM É a `Base RPM` (6.551 linhas, 1.522.526 bytes) e o `gid 216663799` do workbook do termômetro É a `FCA Total` (414 linhas, 225.221 bytes). Viraram `apelidos` da base principal — uma tabela só.
- **`scripts/bases-manuais.sql`** é GERADO (`sheets-ddl.mjs`), nunca escrito à mão: o tipo de cada coluna vem do que o próprio Sheets declara. 34 tabelas, 572 colunas, 27 índices de vigência. **Reexecutável**: a tabela nasce só com as colunas de controle e todo dado entra por `add column if not exists` — coluna nova na aba é só regerar e colar.
- **`sheets-robot.mjs`** (workflow de hora em hora, :25) grava as linhas e **só quando o md5 da aba mudou**. Upsert por `linha` e depois apaga o excedente — a tabela nunca fica vazia no meio da carga, que é quando alguém abriria o painel e o veria zerado.
- **O porteiro contra aba filtrada:** aba filtrada no Sheets faz o gviz devolver só as linhas visíveis, **sem erro nenhum** (foi o que zerou o Km/L duas vezes). O robô **recusa** carga que encolha mais de 40% em relação à anterior, guarda o motivo em `sh_base.erro` e mantém o que já estava lá.
- **`sheets-check.mjs`** (workflow diário 08:10 BRT) confere base a base: planilha × `sh_base` × tabela, mais carga velha e erro registrado.

**O BOTÃO "ATUALIZAR AGORA" NO HUB (Renan, 09/09/2026):** card **Bases do Sheets** no cluster Administração (só admin) → janelinha com o estado de cada aba (linhas, quando carregou, aviso de carga recusada) e o botão. **O botão não chama o GitHub** — o hub é HTML público e não pode guardar token; ele grava um pedido em **`sh_pedido`** (`scripts/bases-pedido.sql`: insert só de `fca_is_admin()`, status só a service_role muda) e o workflow **Sheets Pedido** (`scripts/sheets-pedido.mjs`, varredura `*/5`) pega o pedido, roda o mesmo `sheets-robot.mjs` e devolve o rodapé do log na linha do pedido — que é o que a janelinha mostra enquanto espera (poll de 10s). Os dois workflows de carga compartilham `concurrency: sheets-carga`, para o pedido e a carga da hora não escreverem juntos nas mesmas tabelas.

**O clique virou INSTANTÂNEO (09/09/2026):** `scripts/pedido-instantaneo.sql` põe um gatilho `after insert` em `sh_pedido` que chama o `workflow_dispatch` do GitHub por **`pg_net`**. O token mora em **`portal_segredo`** (RLS ligada, **nenhuma policy** — só a service_role e o `security definer` enxergam), nunca no HTML. A varredura `*/5` continua como rede: se o dispatch falhar, o pedido é atendido na varredura seguinte. Duas armadilhas da instalação: **não colar o token com "replace all"** (ele foi parar na linha de guarda em vez do UPDATE, e o pg_net respondeu `401 Bad credentials`; a guarda hoje é `length(tok) < 30`, não comparação com o texto de exemplo) e conferir a resposta em `select * from net._http_response order by id desc limit 5`.

**O BOTÃO REFAZ TAMBÉM A FOTO DO GVIZ (Renan, 10/09/2026):** ele colou agosto na aba `Km/L`, apertou "Atualizar agora" e o painel de Eficiência Km/L continuou em julho. **A causa não era a aba** (4.165 linhas, 8 vigências, agosto com 485 — conferido no KmL Aba Inspect): o botão carregava só as tabelas tipadas `sh_*`, **que painel nenhum lê ainda**, enquanto o painel lia a foto do `gviz_snapshot`, tirada às 09h36, antes da colagem. Agora o `sheets-pedido.mjs` roda o `sheets-robot.mjs` **e depois o `gviz-robot.mjs`**, e a janelinha mostra o rodapé dos dois. Enquanto o passo 4 do roteiro não terminar, **as duas bases têm de ser atualizadas juntas** — senão o botão atualiza uma base que ninguém lê.

**Três armadilhas achadas na construção, todas já corrigidas:**
1. **A vírgula não pode vir depois do comentário.** `add column x numeric   -- rótulo,` faz o `--` comentar a vírgula e o `alter table` inteiro vira erro de sintaxe. A vírgula vem antes do `--`.
2. **`datetime` é `timestamp` SEM fuso.** MTTR e MTBF chegam como hora sobre a data-base do Sheets (1899-12-30); em `timestamptz` o Postgres converteria o fuso e a duração mudaria sozinha na leitura. Conferido: `mttr::time` devolve `04:30:00`.
3. **Vigência: busca exata antes da parcial.** A aba de Perdas Operacionais tem `Vigência LY` ANTES de `Vigência`, e a busca parcial jogava o ano inteiro para 2025. Aba sem coluna de vigência usa a primeira data (Manutenção pela `DATA`, Seara CTEs pela emissão, Pneus pelo `Período`).

**Como foi validado:** as 33 abas leram sem falha (**129.458 linhas, 33 MB**), a carga em modo seco montou **122.493 linhas** com as conversões conferidas, e o SQL rodou **duas vezes num Postgres 16 de verdade** (zero erro, idempotente), com as linhas do teste seco entrando por `jsonb_populate_record`, que é o caminho do PostgREST.

**PASSO 4 COMEÇOU — o 1º painel lendo do banco é o Eficiência Km/L (Renan, 10/09/2026: "vamos começar pelo combustível para ler do banco").** O painel lê `sh_consumo_km_litro` e **cai para a planilha** se a leitura falhar; o selo do topo diz de onde veio (`Dados de 10/09 16:10 · banco`). O adaptador devolve `{cols, rows}` com os **RÓTULOS da aba**, na ordem da aba, então `detectCols` e todo o resto do painel não sabem a diferença — trocar a fonte não mexeu em uma linha de cálculo.

- **Conferir ANTES de trocar** é o workflow **KmL Banco Check** (`scripts/kml-banco-check.mjs`): lê os dois lados e compara linhas, Σkm, Σlitros e km/L **por vigência e por unidade**. Em 10/09/2026 bateu casa a casa — 4.165 linhas, 11.077.805 km, 4.403.947 L, 2,52 km/L, agosto com 485/485. Fazer o mesmo em cada painel que for migrado.
- **Duas armadilhas do adaptador**, as duas já resolvidas: (1) `vigencia_orig` chega `'AAAA-MM-DD'` e `new Date('2026-08-01')` é meia-noite **UTC**, que no Brasil cai em 31/07 e joga a vigência para o mês anterior — a data é montada por partes (`new Date(+a,+m-1,1)`); (2) o cache de sessão passa por `JSON.stringify`, que transforma o `Date` em ISO, e o `parseVig` não conhecia esse formato: **na segunda carga da página TODA linha viraria vigência nula e sumiria**. O `parseVig` ganhou o ramo ISO. Os quatro formatos foram testados (`date` do banco, ISO do cache, `Date` vivo, texto `MM/AAAA`) e caem todos no mesmo mês.
- **Anon não dá erro, dá lista vazia:** com RLS `to authenticated` e sem sessão do hub, o PostgREST devolve `[]` em vez de 401. Por isso o adaptador trata **tabela vazia como falha** e cai para a planilha — senão o painel abriria zerado para quem não estivesse logado.
- O mapeamento coluna→índice é conferido sem browser: um script roda o `MAPA_KML` e o `detectCols` **do próprio arquivo** em `node:vm` e confere os 13 índices que a tela usa.

**O que falta:** os demais painéis, um por vez, com o mesmo comparador antes de cada troca. No próprio Km/L, as abas `R$/L` e `Base Remunerado Modelo` continuam no gviz — a segunda nem tem tabela `sh_*`.

## Snapshot do gviz (abertura rápida de TODOS os painéis) — 19/08/2026

Renan aprovou ("pode fazer todos"): a abertura dos painéis não espera mais o gviz do Google (1–4s/aba). Três peças:

- **`gviz_snapshot`** (scripts/gviz-snapshot.sql): tabela com o TEXTO CRU da resposta gviz por chave `"<sheet_id>|s=<aba>|g=<gid>|q=<tq>|h=<headers>"`. Leitura aberta (anon+auth — é o mesmo dado que o gviz já serve público); escrita só service_role.
- **Robô** (`scripts/gviz-robot.mjs` + workflow **Gviz Robot**, cron de hora em hora): baixa a lista `ALVOS` (~30 abas: DRE Frota/EBITDA, Dispersão de km, Árvore Comb., Km/L, R$/L, DPO/Demarco/FCA Total, Base RPM/ICs, tiers do Termômetro ×2, Seara ×3, Pneus do Elite, Manutenção, Base da Tendência) e faz upsert. Falha parcial não derruba o job (o shim cai p/ o Google). **Só regrava quando o conteúdo MUDOU** (21/08/2026, depois do aviso de Disk IO Budget do Nano no dashboard): o robô compara o md5 com a coluna `hash` e, se igual, faz só um PATCH no `updated_at` (o corpo de MBs fica intacto — poupa o WAL/TOAST); sem a coluna `hash` no banco, cai no upsert de sempre. **522 em massa = o PROJETO Supabase fora do ar** (visto em 21/08/2026: incidente do Supabase + projeto Unhealthy) — o robô vira o termômetro: run verde de novo = voltou.
- **`assets/gviz-cache.js`** (incluído no `<head>` de todas as páginas, como o mobile.js): intercepta fetch **e JSONP** (`responseHandler`) do docs.google.com e responde do snapshot em ~200ms. Regras: só age nos **primeiros 15s** da página (o botão "Atualizar dados" e os setInterval vão DIRETO ao Google — dado colado agora aparece no refresh manual); snapshot >3h, Supabase lento (>1,2s), chave fora da lista ou qualquer erro → o pedido segue ao Google como sempre. `window.GvizCache.{hits,misses}` p/ conferir no console.

**Como adicionar um alvo novo:** entrada em `ALVOS` do gviz-robot.mjs com os MESMOS parâmetros que o painel manda (sheet/gid/tq/headers têm de casar byte a byte — a chave é exata). **financeiro-pessoal fica FORA de propósito** (dados pessoais não entram no snapshot compartilhado — a página nem inclui o shim). Validado com Playwright: painel-km renderiza 100% do snapshot com o Google bloqueado (fetch e JSONP), números conferidos na mão.

## Robô Ginfo (Power BI → Farol) — em construção (ago/2026)

Automatiza a coleta dos dados que hoje são copiados manualmente do BI do Ginfo (`bi.ginfo.app.br`, Power BI homologado pela Ambev) para as abas que alimentam o Farol.

**Decisões fechadas com o Renan (02/08/2026):**
- Login: **usuário + senha simples** (sem MFA) — validar com o modo `login` do workflow. Tela: `https://bi.ginfo.app.br/login`, com **3 campos: Empresa (dropdown pesquisável = CONLOG) + E-mail + Senha** e botão "Entrar".
- Destino: **Supabase** (projeto do portal), tabela `ginfo_snapshot` (`scripts/ginfo-supabase.sql`) — leitura para logados, escrita só service_role.
- Escopo: **aba a aba** — o Renan vai mostrando cada aba do Ginfo e o mapeamento entra em `ABAS` no `scripts/ginfo-robot.mjs`.
- **Regra geral (02/08/2026): todo export vai SÓ para o Supabase** — o robô grava em `ginfo_snapshot` e apaga o xlsx; nada mais é colado no Sheets. Painéis/Farol passarão a ler essas bases do Supabase conforme cada aba for migrada. 1ª aba plugada: **`ativos`** (Detalhes Veículos do 1.1 DOCUMENTOS).

**Peças:** `scripts/ginfo-robot.mjs` (Playwright: login → menu "..." do visual → Exportar dados → xlsx → Supabase) · `.github/workflows/ginfo-robot.yml` (dispatch com modo login/run; **cron diário 7:00 BRT = `0 10 * * *` UTC, modo run** — mapeamento das 7 abas concluído em 02/08/2026; screenshots nos artifacts) · Secrets: `GINFO_USER`, `GINFO_PASS`, `GINFO_URL` (opcional), `GEM_SUPABASE_SERVICE_KEY`.

**QUEM DÁ A HORA DO GINFO É O pg_cron, NÃO O GITHUB (Renan, 14/09/2026: "Ideal é ser sempre antes das 6:00 da manhã. Assim unidades conseguem realmente programar o que vão fazer"):** o cron declarado no YAML é `0 10 * * *` UTC (07:00 BRT), mas o **agendador do GitHub atrasa** — os runs de setembro nasceram 13:27, 14:09, 14:10, 14:11 UTC, ou seja **~4 h depois**, e a exportação chegava ao Gestão à Vista perto do meio-dia. Não é fila de runner nem o `concurrency`: o `created_at` é igual ao `run_started_at`, então o run **nem foi criado** na hora. `workflow_dispatch` não tem esse atraso (o disparo de teste em 14/09 criou o run em 15:54:18 UTC, na hora). Por isso o relógio virou o **pg_cron do Supabase**, chamando o `workflow_dispatch` por `pg_net` com o token de `portal_segredo` — o mesmo desenho do `scripts/pedido-instantaneo.sql`: função `public.ginfo_dispara()` + job **`ginfo-4h`** em `0 7 * * *` UTC = **04:00 BRT**. O cron do YAML **fica como rede** (se o pg_cron falhar, o robô ainda roda mais tarde).
- **A ARMADILHA É O `default: "login"`**: o `workflow_dispatch` aplica os **defaults** dos inputs, e o `modo` do ginfo-robot.yml tem `default: "login"` (que só tira print e não coleta nada). O corpo do dispatch **tem de mandar `inputs: {"modo":"run"}`** — sem isso o robô "roda" todo dia sem gravar uma linha, e o log fica verde.
- **Cabe no horário:** o run completo leva ~22 min (os slicers de Mês da Blitz e do Checklist sozinhos tomam 11 min), então 04:00 → pronto ~04:25. Validado em 14/09/2026: 9 abas gravadas (civf 439 · preventivas 693 · alinhamentos 469 · os-em-aberto 208 · checklist-031120 4 · blitz-seguranca 586 …).
- **Risco a observar:** se a coleta das 04:00 vier **idêntica à do dia anterior**, é o próprio Ginfo que só recalcula mais tarde — aí o horário sobe, não adianta insistir às 04:00.

**O que é o Stress Test (contexto de negócio, 02/08/2026):** Frota = todo caminhão precisa rodar **pelo menos 1x por mês**. Empilhadeiras = toda empilhadeira precisa rodar **1x por quinzena, durante 24h, nos 3 turnos, com os checklists realizados**. Por isso a regra de período: **do dia 01 ao 10, sempre Mês = mês anterior** (Stress Tests e CIVF — avaliações do mês fechado); do dia 11 em diante fica o padrão da página (mês atual). Regra CONFIRMADA pelo Renan.

**Fluxo real hoje:** Ginfo (Power BI) → Renan copia manualmente → planilha **"Farol Semanal"** (Sheets, `FAROL_SHEET_ID`) → Farol lê as abas. O robô substitui o passo manual, aba a aba. Abas no rodapé da planilha: `De-para · Custos · Indisponibilidade · Disponibilidade · Ativos · Stress Test Veículos · Stress Test Empilhadeiras · CIFV · Preventivas · Alinhamentos · OS em Aberto`.

**PORTAL NOVO — "GINFO Analytics" (27/08/2026):** o Ginfo trocou a casca em 20/08 e o robô ficou **7 dias sem coletar** (20 a 26/08), com o Farol e o Gestão à Vista parados em "última exportação: 19/08". Três coisas mudaram, e só a navegação: **os painéis continuam idênticos** (mesmos cards, tabelas, slicers e colunas de export — confirmado no run de 27/08).
1. **A URL é SEMPRE `/bi/inicio`** — virou SPA. Os deep-links `bi.ginfo.app.br/bi/<guid>?autoAuth=true&ctid=…` **não existem mais** e davam `ERR_CONNECTION_TIMED_OUT`. A navegação é sempre pelo MENU (que funciona).
2. **Cada relatório abre numa ABA** no topo (com X para fechar), e o Power BI carrega em `app.powerbi.com/reportEmbed?reportId=<guid>` — **o guid é o MESMO dos antigos deep-links**, então virou o campo `reportId` de cada aba em `ABAS`.
3. **As abas anteriores FICAM VIVAS no DOM** — com duas abertas, os dois iframes coexistem, cada um com suas tabelas. Varrer `page.frames()` faria o robô exportar **a tabela da ABA ERRADA**, sem erro nenhum, gravando dado trocado por cima do bom. Por isso `framesDaAba()` restringe toda busca ao relatório da aba (pelo `reportId`, ou o último iframe aberto).

Quando o portal mudar de novo, rodar o workflow em **modo `mapa`**: ele não exporta nada — fotografa a home, lista os itens da lateral, diz onde o Power BI renderiza, quais abas ficaram abertas e qual `reportId` cada uma tem. Foi ele que resolveu este caso em uma rodada.

**O AVISO DE FALHA FALHAVA EM SILÊNCIO (27/08/2026):** os 7 dias passaram despercebidos porque o e-mail de alerta era recusado pela Resend todo dia (403, sem domínio verificado, `vars.MAIL_TO` vazia) e o `curl` devolvia 0 — o passo passava como se tivesse enviado. Agora a resposta é impressa e o passo emite `::error::` quando a Resend recusa. **Falta configurar `vars.MAIL_TO`** com o e-mail dono da conta Resend (ou verificar um domínio), senão o alarme continua sem tocar.

**Navegação no portal do Ginfo:** após o login cai em `/bi/inicio`; menu lateral esquerdo com seções expansíveis: **FROTA** (`1.1 - DOCUMENTOS · 1.2 - ADERÊNCIA CONFORMIDADE · 1.3 - ADERÊNCIA FROTA-031120 / FROTA-2ART / ARMAZÉM / APOIO / EMPURRADA · 1.4 - RESÍDUOS · 2.1 - INDISP. MANUT. VEÍCULOS · 2.1 - DISP. EMPILHADEIRA · 2.2 - PREVENTIVAS · …`), **STRESS TEST** (→ **STRESS TEST FROTA** e **STRESS TEST EMPILHADEIRA**, os dois relatórios usados no Farol), **CIVF** e **SEGURANÇA**. Os relatórios são Power BI embutidos com URL própria (`/bi/<guid>?autoAuth=true&ctid=…` — deep-link funciona); alguns dados exigem **drill-through** (botão direito num card → Drill-through → página de detalhe) antes de exportar.

**Receitas de coleta no Ginfo (conforme o Renan mostra):**
- **1.1 - DOCUMENTOS → Detalhes Veículos**: abrir pelo menu → botão direito no NÚMERO do card **VEÍCULOS** → Drill-through → **"Detalhes Veículos"**. A página de detalhe tem URL própria (`bi.ginfo.app.br/bi/99029b42-f690-451b-95b1-9fad2c9b670d?autoAuth=true&ctid=c16300de-7070-4b58-80c8-af99af1e1f65`) — robô tenta o deep-link direto; drill-through é o plano B. Na tabela (Filial | Projeto | Placa | Marca | Modelo | Tipo Veículo | Estado | Ano Fabricação — MESMAS colunas da aba **Ativos**), passar o mouse → botão **"..."** no canto do visual → Exportar dados. Cards da página: Total Veículos, Idade Média. Destino provável: base **Ativos** do Consolidado Geral (a confirmar com o Renan).

- **STRESS TEST FROTA** (menu STRESS TEST; URL provável `bi/ce4f37f8-1c4c-499f-a80c-3a3ce80594cb` — a confirmar): filtros Empresa/Regional/Filial/Tier/Projeto/Veículo/Ano/Mês/Quinzena/Placa. **Regra de período: até o dia 10 de qualquer mês** (antes das avaliações), selecionar no slicer **Mês = mês anterior** (ex.: Jul-26 no início de ago) e **Quinzena = Segunda** — o padrão "Mês Atual + Primeira" vem zerado no começo do mês. (Do dia 11 em diante: padrão da página, mês atual — confirmado.) Página tem cards (Veículos Freightech, Com/Sem Saídas, Stress Test %, Desconto…), tabela por Transportador, tabela por Filial e a tabela detalhada por placa (Período|Empresa|Filial Freightech|Placa|Projeto|Pallets|…|Justificativa|Status|Desconto) que alimenta a aba `Stress Test Veículos` do Farol.

- **STRESS TEST EMPILHADEIRA** (menu STRESS TEST; URL `bi/d1cead3d-e28a-487b-a1bd-8b72cdd6da55`): filtros Empresa/Regional/Filial/Tier/Contratada/Ano/**Mês**/Placa/Chassis Freightech — **sem slicer de Quinzena** (1ª e 2ª QZ são colunas). **Regra: até o dia 10, selecionar só Mês = mês anterior.** Exportar a tabela detalhada **"Análise Descontos"** (Prop. FT | Empresa FT | Filial FT | Filial GINFO | Filial FT x GINFO | Marca | Perfil | Placa Ginfo | Chassis | Contratada | Parada?/Status Just./Motivo/Desconto por quinzena | Desc. Total; o robô a acha pela coluna **"Chassis"**, única dela na página) → chave `stress-test-empilhadeira`, alimenta a aba `Stress Test Empilhadeiras` do Farol. SÓ essa tabela — confirmar antes de exportar qualquer outra desta página.

- **CIVF** (menu CIVF → CIVF; URL `bi/5bd5e3ac-7ebc-4c7b-963e-1c3d20ba4acd`): filtros Empresa/Regional/Filial/Tier/Status/Placa/Ano/**Mês**. **Regra: até o dia 10, Mês = mês anterior.** Exportar a **última tabela** da página (detalhada por veículo: Transportador | Filial Freightech | Veículo | Projeto | Data CIVF | Status | Manutenção | Lavação | Desconto Manutenção | Desconto Lavagem | Desconto Total) → alimenta a aba `CIFV` do Farol.

- **PREVENTIVAS** (menu FROTA → **2.2 - PREVENTIVAS**): exportar a **3ª tabela** da página (ordem visual, de cima p/ baixo), sem filtro — "..." → Exportar dados → alimenta a aba `Preventivas` do Farol (colunas E–U da planilha). As colunas A–D são fórmulas que o LEITOR recalcula: Placa Mercosul/Projeto/Unidade = PROCV na base `ativos` pela placa; **Aderência = regra da coluna A (confirmar a fórmula exata com o Renan quando plugar o painel)**.

- **ALINHAMENTOS** (menu FROTA → **3.4 - PNEUS**; URL `bi/3ab8927b-b1c5-4f10-8f36-dad6bb8a8a22`): exportar a tabela de alinhamentos (Filial | Placa | Próx. Even. | Status | Dias | Documento — tem o botão "Detalhes Alinhamentos" no rodapé; o robô a identifica pela coluna **"Documento"**, única da página) → aba `Alinhamentos` do Farol.

- **CHECKLIST / ADERÊNCIA 031120** (menu FROTA → **1.3 - ADERÊNCIA FROTA - 031120**; URL `bi/76e82774-d5d4-4cda-bb13-65a1a64387ef`; página "ADERÊNCIA FROTA" com Tipo=Saida + Origem=031120): botão direito no card **"SAÍDAS COM OS CRÍTICA"** → Drill-through → **"Detalhes Saídas Com OS Crítica"** → na página de detalhe, slicer **Mês** = nome COMPLETO minúsculo ("julho"; **até o 3º DIA ÚTIL do mês = mês anterior, depois = mês atual** — regra própria do Checklist, 03/08/2026; as demais abas seguem o dia 01–10) → "..." → Exportar dados. Colunas: Mapa | Data do mapa | Data OS | Início/Fim técnico | Problema | Nº OS | Tipo Checklist (Saída/Retorno) | Status | Filial | Motorista | Placa | Tipo Veículo | Projeto → chave `checklist-031120`. (NÃO usar a tabela da página principal — a coluna 'Motorista' acha o resumo Motorista×Aderência.) Alimenta o farol **"Checklist"**: card **"Saída com OS Crítica"** = linhas com Tipo Checklist = "Saída" no mês de referência (mesma regra dia 01–10) + tabela (Data | Motorista | Placa | Tipo Veículo | Projeto | Tipo Checklist | Status | Problema) — `loadChecklist()`/`renderChk()` no `farol-core.js`.

- **OS EM ABERTO** (menu FROTA → **2.4 - ORDEM SERVIÇO**; URL `bi/81e8f48c-09f2-4bc7-a84e-0718378732c9`): botão direito no card **"NÃO EXECUTADAS"** → Drill-through → **"Detalhes Ordem Serviço"** → exportar a tabela (Nº OS | Data | Status | Filial | Origem | Tipo | Criticidade | SLA Atendimento | SLA Serviço | Segmento | Fornecedor | Mecânico | Motorista | Placa) → aba `OS em Aberto` do Farol. A coluna A da planilha (**"Dias em Aberto"**) é fórmula `AGORA() − Data` (negativo → 0) — o leitor recalcula na exibição; o robô não grava.

- **BLITZ DE SEGURANÇA** (menu **SEGURANÇA → BLITZ DE SEGURANÇA**, 09/09/2026 · refeita em 10/09/2026): **botão direito no card "ADERÊNCIA OK" → Drill-through → "Detalhes Aderência"**, com os slicers **Ano** e **Mês** aplicados ANTES do drill (eles ficam na página principal e o detalhe herda o filtro) → chave `blitz-seguranca`. Colunas: `Nº Check · Período · Filial · Placa · Tipo · Status · Colaborador · Função · Data/Hora Início e Fim Checklist · Tempo Medio · **Última Blitz** · **Limite Proxima Blitz** · OS Nº · OS Status · OS Início/Fim · Início/Fim Operação` — uma linha por CHECK. Validado em 10/09/2026: `Mês é setembro | Ano 2026 | ds_empresa é CONLOG`, 583 checks, 9 filiais (No Prazo 457 · Dentro Prazo 111 · Fora Prazo 14 · Não Realizado 1).
  - **A tabela da página principal NÃO serve** (foi a 1ª versão, de 09/09): ela dá as cinco contagens por placa mas **sem filial e sem data**, e sem filtro de mês vinha o ANO INTEIRO (555 blitz para 44 placas em Balneário). As sete tabelas da página são Filial · Regional · Placa×contagens · Colaborador · Função · Placa×realizado · Item — **nenhuma tem vencimento**.
  - **ORDEM DO SLICER É POR ABA** (bug real, 10/09/2026): o robô aplicava slicer sempre DEPOIS do drill, porque no `checklist-031120` o Mês está na página de detalhe. Na Blitz é o contrário, e aplicar depois procurava um slicer inexistente e abortava a coleta **com o drill já tendo funcionado**. Daí o `slicersAntes: true`.
  - **O modo `tabelas`** do robô (`GINFO_MODE=tabelas` + `GINFO_ABA=<chave>`) lista as tabelas de uma página com as colunas de cada uma e os slicers — é ele que evita chutar qual visual exportar. **Ele não vê todos os slicers**: na Blitz listou só Empresa/Regional/Filial e eu concluí errado que não havia mês; o Renan mostrou o print com Ano e Mês. Slicer que não aparece no modo `tabelas` **não prova que não existe**.
  - **Leitor:** `DATA.blitz` no `farol-core.js` agrupa por placa (contagens por Status, `Limite Proxima Blitz` mais distante, `Última Blitz`, `dias` até o limite) — a unidade vem da coluna **Filial** da própria linha, não precisa mais do join com `ativos`. A visão **Blitz de Segurança** do Gestão à Vista (`renderBlitz`) ordena **por dias para vencer**, do mais vencido para o mais folgado, com a célula `15d · OK` (verde) / `35d atrás · NOK` (vermelho) / amarelo até 7 dias — formato pedido pelo Renan em 10/09/2026. Aderência = (Realizado Dentro Prazo + No Prazo) ÷ total, a mesma régua da Conformidade, poolando as placas.
  - A aba é **`opcional:true`** — falha dela não derruba as outras sete do run diário.

## Saúde do Ecossistema — o painel que vigia os robôs (Renan, 11/09/2026)

Pedido dele: *"mais um painel no cluster administrador… uma visão geral dos painéis, robôs, etc., mais focado em automatizações. Taxa de falha geral, por robô, por painel. Como está a saúde do ecossistema"*. Nasceu da varredura de 10/09, em que **cinco robôs estavam quebrados e nenhum avisou ninguém**.

**`/saude/`** (casca padrão, só admin, cluster Administração) com quatro visões: **Resumo Gerencial** (taxa de sucesso da janela, execuções por dia em barras empilhadas, onde estão as falhas), **Robôs**, **Bases de Dados** e **Painéis**. Janela de 7/15/30/90 dias (`.dimb`, chave `saude_jan`) e filtros de Tipo e Estado.

- **O painel NÃO chama o GitHub** — o HTML é público e não pode guardar token. Quem coleta é `scripts/saude-robot.mjs` (workflow **Saude Robot**, cron `40 0,6,12,18 * * *`, `permissions: actions: read`), que lê a API do Actions, o estado das bases no próprio banco e varre os `index.html`. Tabelas: `saude_wf` · `saude_dia` · `saude_base` · `saude_painel` · `saude_coleta` (`scripts/saude-supabase.sql`).
- **Agregado por DIA, não execução a execução**: o Sheets Pedido roda a cada 5 minutos (288 linhas/dia) e o PostgREST devolve no máximo 1.000 linhas por leitura. `saude_dia` tem uma linha por workflow × dia (em BRT).
- **Atraso é medido contra o CRON declarado**, não contra um prazo fixo: `limiteCron()` separa "a cada poucos minutos" (1h de folga), "de hora em hora" (3h), "a cada N horas" (9h), diário (30h) e semanal (8d). Um robô que só roda sob demanda nunca aparece como atrasado.
- **Idade esperada por fonte de dado** (`LIM_BASE`): Sheets 6h · Ginfo 30h · Frota de Elite 45 dias · tabelas de aplicativo são informativas (não têm ritmo próprio). Acima do limite = "Atrasada"; 4× o limite = "Parada".
- **Carga × auditoria é LISTA EXPLÍCITA** no robô (`CARGA`), não heurística: "usa a service key" erra, porque auditorias como o Carta RLS Check também usam só para ler.
- **A coluna "Avisa" da tabela de robôs é a lacuna que o painel existe para mostrar**: na 1ª coleta, **9 dos 12 robôs de carga agendados não têm aviso de falha** (só elite, ginfo e profrotas chamam o `avisa-falha.sh`) — e o `vars.MAIL_TO` continua vazio desde 27/08, então nem esses três tocam o alarme.
- **A API do Actions entrega no MÁXIMO 1.000 execuções por consulta** (bug real, 11/09/2026): a página 11 volta **vazia**, sem erro nenhum. Com ~45 execuções por dia, a 1ª carga de 30 dias parou nos 14 dias mais recentes e os anteriores não existiam — a taxa de falha de 30 e de 90 dias valeria só as duas últimas semanas, e nada na tela diria isso. Denunciou o `execuções lidas: 1.000`, o teto exato. A leitura é **por fatia de data** (`created=ini..fim`): a fatia que bate no teto é partida ao meio e relida até caber, e as repetidas da borda saem pelo id. O log imprime a **cobertura** (1º e último dia com execução) — é por ela que se enxerga truncamento.
- Primeira carga real (30 dias, 11/09/2026): **1.349 execuções · 1.216 ok · 123 falhas · 90,1% de sucesso**, cobertura 12/08→11/09 (31 dias), 0 robôs falhando no momento, 99 bases monitoradas (6 com mais de 48h, 3 com erro registrado), 73 painéis (23 na casca padrão).
- Validação sem browser: 29 regras de estado rodadas em `node:vm` (atraso por cron, idade por fonte, falhas seguidas, agregação) e a varredura local conferida contra o inventário manual dos 74 workflows.

## Correlações — cruzar tudo que está no banco (Renan, 23/09/2026)

Pedido dele: *"criar um painel que cruzasse todas as informações que a gente tem hoje no banco… e criasse correlações, causalidades, análises estatísticas, gráficos de dispersão… análises mais criteriosas, mais robustas"*, no cluster Administração, só admin. **`/correlacoes/`**, casca padrão, cinco visões: **Resumo Gerencial** (pares analisados, achados, fontes), **Matriz** (r de Pearson célula a célula, clique abre a dispersão), **Dispersão** (X × Y com reta, faixa de 95%, r/R²/ρ/n/p e os pontos mais longe da reta), **Regressão** (Y a partir de até 5 X, β padronizado e p por variável) e **Defasagem** (X de k meses antes contra Y, dentro da mesma entidade).

- **Nenhuma fonte nova.** A tabela-fato é montada no navegador com as MESMAS leituras dos painéis: DRE Frota por **rótulo** (cidade acentuada → código, tier pelo prefixo do Nível 3, como o fca-preenchimento), Dispersão de km por índice (col 14 `PROJ - COD`), Frota de Elite/Gerot pelo próprio `assets/gerot-base.js` (`load` + `FIL2COD`; registros `snapshot` ficam de fora), `fca`, `disp_resumo`, `custo_vigencia_mv` (+ `ginfo_snapshot` para a idade e `indisponibilidade` para os dias parado) e `ce_scores_mensais`. **Três grãos**, escolhidos no topo: unidade × mês (13 unidades × 8 meses ≈ 100 pontos), placa × mês e motorista × mês (milhares de linhas — é onde a estatística tem força).
- **Fonte com erro não derruba o painel**: cada leitura é um `Promise.allSettled`, a tela avisa qual falhou e a tabela Fontes mostra linhas e estado. Tabela vazia conta como "vazia", não como sucesso.
- **As regras contra achado falso moram no painel, não na cabeça de quem lê:** par só entra com **n ≥ 8** pontos completos (`Estat.N_MIN`; abaixo vira "·" na matriz e "Poucos pontos" na dispersão); o p-valor de cada célula é ajustado por **Benjamini-Hochberg** (com 30 variáveis são 435 pares, e uns 20 sairiam "significativos" por acaso); a leitura de cada visão diz **"correlação não é causa"**; a regressão avisa quando há menos de dez pontos por variável e recusa colinearidade; a defasagem só aponta antecedência quando o pico sai do k = 0. Variáveis com armadilha conhecida levam **nota** na tela (conformidade mudou de régua em ago/26; km remunerado da Dispersão é bruto, sem balanço de massa; disp do app tem histórico de planilha antes de 14/08).
- **O motor é `assets/estatistica.js`**, funções puras (Pearson, Spearman com empates, reta com faixa de confiança, mínimos quadrados múltiplos com erro-padrão e p, beta incompleta regularizada para a t de Student, BH, defasagens). **Conferido contra biblioteca independente antes de ir para a tela**: `scripts/estatistica-teste.mjs` (47 checagens) guarda os valores de referência do simple-statistics 7.12 e do jStat 1.9.6 — rodar uma cópia da fórmula mediria a cópia.
- **Validação da tela**: `scripts/correlacoes-teste.mjs` (Chromium, 47 checagens, `CDN_DIR` aponta para o Chart.js real ou cai num dublê) com todas as fontes dubladas e relações **plantadas** nos dados: desvio de Combustíveis ≈ dispersão de km (r ≈ 1) aparece na matriz, nos achados e na regressão (β sustenta, o ruído "pode ser acaso"); preventivas de t−1 → manutenções de t sai com o pico em k = 1; par com 3 pontos fica fora; fonte com erro vira aviso e o resto segue; sem admin cai no gate. `SHOT_DIR` salva um print por visão.
- **O que ele guardou para depois:** (1) as hipóteses que quer testar primeiro — o painel nasceu exploratório, a lista de perguntas dele é que vai dizer o que vira visão fixa; (2) **pergunta livre em português sobre os indicadores** ("modelo de pesquisa para as unidades") — possível, mas pergunta livre exige um modelo de linguagem com chave guardada numa Edge Function (o HTML é público), e ele vai tratar isso **com a TI**; o caminho sem custo é um catálogo de perguntas prontas com parâmetros.

## Contrato de Manutenção no Gestão à Vista (Renan, 10/09/2026)

Visão **Contrato**: ranking de placas do **mês de km que está correndo**, que é a fatura do mês SEGUINTE (`vig_cobranca = vig_km + 1`, regra do Renan em 05/09: *"o de setembro que estamos rodando é que vai compor outubro"*). Gestão à Vista é o agora, então **não tem seletor de mês** — o mês fechado fica na Carta de Custos.

- Fonte: **`custo_vigencia_mv`** (a mesma materializada que a Carta lê), com queda para a view `custo_vigencia`. Só a mv tem `grant select to authenticated`.
- **Variável e fixo não se misturam** (pílulas, como na Carta): o fixo paga o mesmo rode ou não rode, e somar os dois faz o km parecer explicar um valor que não depende dele.
- **A visão aparece SEMPRE** (não tem `temDado`): sumir do menu quando a leitura falha esconde a diferença entre "não há contrato", "o ERP não recebeu carga do mês" e "o banco recusou a leitura". A tela diz qual dos três é, com a mensagem do erro.
- Conferência: workflow **Contrato Agora Inspect** (`scripts/contrato-agora-inspect.mjs`). Em 10/09/2026: 360 linhas, todas prévia, km de 2026-09 → fatura de 2026-10 — variável 265 placas / 68.188 km / R$ 43.265 · fixo 95 placas / 129.059 km / R$ 199.635 (Piraí sozinha, R$ 113 mil no fixo).

## Conferência de Locação — a importação só grava o que ela sabe rotear

`/conferencia-locacao/` (admin) confere o que a Vamos fatura contra o que o Freightech remunera. Os arquivos entram por arrastar e o **tipo sai do NOME** (`Prévia - Mensal - MM_AAAA`, `Faturamento Vamos - MM_AAAA`, `WH/Empurrada/AS/Rota/Van/Lata - MM_AAAA`, `Benner`). O mês fica em `locacao_conferencia`, uma linha por vigência (`AAAA-MM`), com as linhas inteiras em JSON.

**O MESMO BUG APARECEU TRÊS VEZES: leva que o `recebeArquivos` não sabe rotear é lida e NÃO é gravada** — os cartões ficam verdes com as linhas contadas, nenhuma mensagem aparece e o banco não muda. Aconteceu com o **faturamento sozinho** (31/08/2026) e com o **Freightech sozinho** (15/09/2026, a analista subiu os seis arquivos de 09/2026 e o mês continuou com zero remuneração). O roteamento hoje cobre os quatro casos: prévia (recalcula tudo), faturamento (`mesclaFaturamento`), FT (`mesclaFT`) e Benner (grava direto). **Ao criar um tipo novo de arquivo, criar junto o ramo que grava** — senão o quarto caso repete a história.

**A regra de vigência do FT não é óbvia:** a prévia **Mensal** é paga pela remuneração do mês **ANTERIOR** e a **Provisão** pela do próprio mês (`ftDoMes` sobre `PERIODO.ant` e `PERIODO`). Um arquivo do FT de 09/2026 precisa trazer as vigências de agosto também, senão a etapa mensal fica sem remuneração — o `mesclaFT` conta quantos ficaram e diz de qual mês falta.

**F5 não grava nada.** Deploy novo troca o código; os dados só mudam quando alguém solta os arquivos de novo. Para conferir qual build está na tela: `document.querySelector('meta[name=build]').content + ' · mesclaFT: ' + typeof mesclaFT` no console.

Auditoria: workflow **Locacao Inspect** (`scripts/locacao-inspect.mjs`) — por mês, quantos ativos têm prévia, FT e faturado, as somas e **quais arquivos entraram**. É o que separa "o arquivo não entrou" de "entrou e não casou" de "o dado ainda não existe" (o faturamento do mês corrente não existe mesmo: a Vamos fatura depois de fechar).

**Farol lê do SUPABASE (02/08/2026) — Sheets é só FALLBACK:** `farolLoad()` busca `ginfo_snapshot` e converte cada base com um adaptador (`GADAPT`) que renomeia as colunas do export p/ os nomes que os leitores já usavam e recalcula as colunas de fórmula da planilha (regras confirmadas pelo Renan): **Preventivas** Aderência = Status "Vencido"→0 senão 1, Projeto = join com base `ativos` pela placa · **CIFV** Aderência = Desconto Total≠0→0 senão 1 · **Stress Test (V e E)** aderência = desconto 0→1 senão 0 (`stressVPct` mudou de COM SAÍDA p/ sem-desconto) · **OS** Dias em Aberto = hoje−Data (mín 0). Se uma base faltar/vier vazia → cai p/ a aba do Sheets. Datas de xlsx = serial do Excel → `parseFlex()`. Cada seção do Farol mostra na legenda a **"última exportação do Ginfo"** (updated_at da chave; `DATA.fonte` + `fx()` no renderFarol) ou "planilha (fallback)".

**Colunas reais dos exports (log do robô, 02/08/2026):**
- `ativos`: Filial | Projeto | Placa | Marca | Modelo | Tipo Veículo | Estado | Ano Fabricação
- `stress-test-frota`: Período | Empresa | Filial Freightech | Placa Freightech | Projeto | Pallets | Freightech | Última Saída | Origem | Destino | Saída | Saída na FIlial | **Viagens** (planilha: Total Viagens) | Justificativa | Status | Desconto
- `stress-test-empilhadeira`: Prop. FT | Empresa FT | Filial FT | Filial GINFO | Filial FT x GINFO | Marca | Perfil | Placa Ginfo | Chassis | Contratada | Parada? | Status Just. | Motivo | Desconto | "Parada? " | Status Just._1 | Motivo_1 | "Desconto " | Desc. Total (1ª/2ª quinzena = colunas duplicadas; a 2ª vem com sufixo/espaço)
- `civf`: Transportador | Filial Freightech | Veículo | Projeto | Data CIVF | Status | Manutenção | Lavação | Desconto Manutenção | Desconto Lavagem | Desconto Total
- `preventivas`: Placa | Marca | Modelo | Último Ciclo | Próximo Ciclo | Km/Hr Intervalo | Dias Intervalo | Última | Próxima | Km/Hr Última | Km/Hr Próxima | Km/Hr Atual | **Dias Próxima** | **Km/Hr Próxima_1** (= KM/HR P/ Próxima) | Status | OS Aberta | Filial (SEM Projeto/Unidade — join com `ativos`)
- `alinhamentos`: Filial | Placa | Próx. Evento | Status | Dias | Documento
- `os-em-aberto`: Nº OS | Data | Status | Filial | Origem | Tipo | Criticidade | SLA Atendimento | SLA Serviço | Segmento | Fornecedor | Mecânico | Motorista | Placa | Tipo Veículo | Data Início | Data Fim | Tempo OS | Observação | NPS | Avaliador | Valor Total
- `checklist-031120`: Mapa | Data do mapa | Data OS | Início técnico | Fim técnico | Problema | Nº OS | Tipo Checklist | Status | Filial | Motorista | Placa | Tipo Veículo | Projeto — via drill-through do card "SAÍDAS COM OS CRÍTICA" + slicer Mês. A tabela da página PRINCIPAL não serve (coluna Motorista acha o resumo Motorista×Aderência). **A "validação de 03/08: 23 linhas de julho" era FALSA** (28/08/2026): aquele run foi às 08:59 e o commit que faz o robô ABORTAR quando o slicer não aplica só entrou às 14:41 do mesmo dia — o filtro de mês falhou calado e vieram as linhas do ANO INTEIRO. O indicador é magro mesmo: julho fechou com 2 saídas e agosto com 0 (conferido na tela pelo Renan). **O que o painel mostrava a mais era o RODAPÉ do Power BI**: todo export termina com uma linha "Filtros aplicados: …" na 1ª coluna, que era gravada no `ginfo_snapshot` como registro — no checklist de agosto era a ÚNICA linha, e o Farol contava 1 saída onde não havia nenhuma (nas outras chaves, uma linha fantasma em cada contagem). O `xlsxParaLinhas` descarta essa linha e loga os filtros que o visual estava usando — é por ali que se enxerga a régua da tela sem precisar de print.

**Painel Ativos (`/ativos/`, cluster Visão Geral, 02/08/2026):** composição da frota lendo `ginfo_snapshot['ativos']` (precisa login do hub) — Qtde, Idade Média, faixas de idade, por unidade/tipo/modelo, tabelão do mais antigo p/ o mais novo. Estilo Disponibilidade.

**Abas mapeadas (conforme o Renan mostra):**
- **Custos** — FORA do escopo do robô: vem do DRE (manual) e será substituída pela **Carta de Custos** no futuro. Não mexer por enquanto. (Colunas: Δ ORÇ. | Δ FCT | Vigência | ESTRUTURA | UNIDADE | NÍVEL 3 | CONTA GERENCIAL | MÊS | ANO | ORÇADO | REMUNERADO | REALIZADO.)
- **Ativos** — automática (IMPORTRANGE do **Consolidado Geral**, mesmo workbook da Disponibilidade/`DISP_SHEET_ID`; colunas: Placa Mercosul | Filial | Projeto | Placa | Marca | Modelo | Tipo Veículo | Estado | Ano Fabricação). Papel: **base de-para por placa** — a aba Preventivas usa PROCV nela p/ preencher Projeto/Unidade, que o relatório do Ginfo NÃO traz → quando o robô exportar Preventivas, precisa reproduzir esse join (placa → Filial/Projeto via Ativos). Desejo futuro: **painel "Ativos/Frota"** no cluster Visão Geral (idade da frota, ativos por unidade/tipo/modelo).
- **Indisponibilidade** e **Disponibilidade** — em MIGRAÇÃO para o Supabase (ver seção "Disponibilidade no Supabase" abaixo). O fluxo antigo (planilhas por unidade + Apps Script no "Consolidado Geral") segue rodando em paralelo até os números serem conferidos.

Em paralelo: perguntar ao Ginfo se existe API/export oficial (trocaria o RPA por consulta estável).

## Footprint Goiânia — REMOVIDO (Renan, 21/09/2026: "pode excluir esse painel. BI e banco")

O painel, o card do hub, o workflow **Footprint Check**, o script e o SQL saíram do repositório em 21/09/2026 (voltam com `git show <commit>^:footprint-goiania/index.html`); a tabela `footprint_check` foi derrubada por SQL colado no chat. O que segue é o registro de como era.

### Como era (08/09/2026)

Visão **temporária** no cluster **Administração** (`/footprint-goiania/`, só admin) para conferir o footprint da operação de Goiânia enquanto ela entra: **uma linha por placa, uma coluna por check**, célula **OK · NOK · N/A**. Nasceu de um modelo em planilha que o Renan mandou — a tela reproduz aquele desenho, nada mais.

- **14 placas** das planilhas que ele anexou (`AS_Caminhão`: 12 · `ARMAZEM_Empilhadeiras`: 2 — a máquina de limpeza ficou de fora, como no modelo). Placas e checks moram no **HTML**, não no banco: é conferência de entrada, não cadastro.
- **16 checks em 8 grupos**, nesta ordem: **Checklist** (Físico · Vamos) · **Benner** (Preventivas · Nº de Fogo · ANTT · CRLV · Crono · Alvará Sanitário · Laudo Plataforma) · **Ginfo** (Transf. Titularidade) · **Veltec** (idem) · **Frota Legal** (idem) · **Tag Pedágio** (Tag Instalada) · **Pró-Frotas** (Cadastro) · **Freightech** (Validar Cadastro · Transf. Titularidade).
- **Aderência por placa = OK ÷ (OK + NOK)**: **N/A sai da conta** e **célula em branco conta como NOK** (a placa começa em 0% e sobe conforme preenchem). Faixas de cor do modelo: ≥75% verde · ≥40% verde-claro · ≥15% amarelo · abaixo, vermelho.
- **`footprint_check`** (`scripts/footprint-goiania.sql`): PK `(placa, chave)`, `status` com CHECK em OK/NOK/NA, `updated_by`/`updated_nome`/`updated_at` (a dica da célula mostra quem marcou e quando). Leitura para logados, escrita só `fca_is_admin()`. Sem linha = não preenchido; escolher "—" **apaga** a linha.
- Auditoria: workflow **Footprint Check** (`scripts/footprint-check.mjs`) — tabela, escrita da service key, CHECK do status, RLS do anon e o preenchimento até aqui.
- Tabela com `table-layout:fixed` e as 16 colunas dividindo a sobra: **sem barra horizontal** em desktop (validado em 1366×768 e 1600×900); os rótulos longos quebram por hífen macio (`&shy;`). No celular a tabela rola de lado.

## Disponibilidade no Supabase — substitui o Apps Script (14/08/2026)

Decisão do Renan (14/08/2026): tirar a Disponibilidade/Indisponibilidade do Apps Script do "Consolidado Geral" e rodar tudo no banco, com as unidades preenchendo num app do portal (estilo FCA) e auditoria de quem atualiza. **Sem fluxo de validação de admin.** Diagnóstico que motivou: o Apps Script encadeava 4 funções num trigger; `atualizarDisponibilidade` reescrevia a aba inteira (~316k linhas) todo dia e estourava o tempo, deixando a Disponibilidade 1 dia atrás da Indisponibilidade (e com janela destrutiva entre clearContent e setValues).

**Modelo (scripts/disponibilidade-supabase.sql, rodado em 14/08/2026):**
- `indisponibilidade` — EVENTOS vivos, 1 linha por parada; a unidade abre quando o veículo para e fecha com `data_retorno` quando volta. Sem evento aberto = disponível. RLS: leitura p/ logados; escrita via `fca_has_unit()`/admin (mesmos acessos do FCA).
- `disp_checkins` — botão "Confirmar frota do dia" (auditoria de quem atualizou; INSERT only, nem admin apaga).
- `indisp_snapshot` / `disp_snapshot` — fotos diárias (histórico migrado do Sheets com `fonte='sheet'`; o dia a dia entra com `fonte='app'`). APPEND-ONLY: dias anteriores nunca são tocados.
- `unidade_depara` + `disp_unit_cod(nome, projeto)` — nome de filial → código do portal, com refino de tier CBA/MCC pelo projeto (inclui ANHANGUERA→ANG).
- `disp_snapshot_diario()` — pg_cron diário às 09h BRT (`0 12 * * *` UTC, job 'disp-snapshot-diario'): fotografa eventos abertos e agrega Ativos (ginfo_snapshot['ativos'], casando indisponível↔ativo pela placa) × indisponíveis. Idempotente no dia. Testada manualmente em 14/08 — OK.

**Páginas:** `/disponibilidade-preenchimento/` (app da unidade: frota do Ginfo, abrir/editar/fechar evento, busca, histórico, check-in; card "Indisponibilidade" no cluster Processos do hub) · `/disponibilidade-migracao/` (admin; importa o histórico das abas Disponibilidade e Indisponibilidade do Consolidado Geral; reimportável — apaga só `fonte='sheet'`).

**Ativos:** vêm do robô Ginfo (`ginfo_snapshot`, chave 'ativos', diário 7h BRT) — NÃO criar coletor novo.

**MIGRAÇÃO CONCLUÍDA E VALIDADA (14/08/2026):** workflow **Disp Migracao** (`scripts/disp-migracao.mjs`, dispatch no Actions, gviz→Supabase com a service key) rodou: `disp_snapshot` 16.939 linhas fonte=sheet (19/02→12/08/2026 — a base real é ~17k, não "316k") · `indisp_snapshot` 11.675 (17/02→13/08) · último dia da aba virou os EVENTOS ABERTOS (ANG=13 conferido linha a linha com a planilha). Reimportável: apaga só fonte='sheet' e pula placas com evento aberto.

**Decisões do Renan na construção (14/08/2026):** SEM Kanban (não é plano de ação) — app no shell do Planner com lateral (resumo + unidades + atalhos, menu recolhível) e miolo em LISTA · SEM check-in manual ("preencheu, confirmou" — auditoria = updated_by/updated_at dos eventos; `disp_checkins` existe mas está sem uso) · retorno SEMPRE por campo de data (mini-modal, entre a parada e hoje) · datalist de placa só com a placa · **FRETEIRO fora** de tudo · **ANG/Anhanguera não existe no Ginfo**: tabela `ativos_manual` (RLS por unidade) com 51 veículos do xlsx (Filial SEARA·ROTA, `scripts/ativos-manual.sql`), botão "+ Veículo" no template Ginfo SÓ na ANG, foto diária soma Ginfo+manuais (manual prioriza por placa) · visão **Resumo** = o painel de disponibilidade dentro do app (view `disp_resumo` dia×unidade; hero, % por dia, % por unidade, tabela hoje vs média 30d) — o Renan ainda vai detalhar o formato final espelhando o `/disponibilidade/` antigo.

**Pendências:** aposentado em 19/09/2026 (o `/disponibilidade/` virou página de aviso) · painel de aderência (quem atualiza/quem não, via updated_at dos eventos) · detalhar a visão Resumo com o Renan.

### O GESTÃO À VISTA FICOU 36 DIAS LENDO A PLANILHA ENQUANTO AS UNIDADES LANÇAVAM NO APP (19/09/2026)

O coordenador da Frota do GRL escreveu sobre a tabela **Placas Indisponíveis**: *"Aqui tem coisa errada. RUR5G13, CUG0645, FVI8A72, GJJ1G62, RUR5G08 não estão lançadas na indisponibilidade e falta placas que realmente estão lançadas. Não devem estar cruzando informações."* Renan: *"Estamos com a disponibilidade nova a quanto tempo?"* — **36 dias** (app em 14/08, isto em 19/09).

**Não era cruzamento de informação: eram DUAS BASES.** O `farol-core.js` (`loadDisp`/`loadInd`) lia as abas `Disponibilidade` e `Indisponibilidade` do Consolidado Geral (Apps Script) enquanto as unidades lançavam na tabela `indisponibilidade`. A tela mostrava uma e a unidade escrevia na outra, e **nada na tela dizia qual das duas era** — é por isso que passou um mês.

**Medido antes de trocar** (workflow **Disp Fonte Check**, `scripts/disp-fonte-check.mjs`, que roda o **mesmo** de-para do farol-core — comparar com outro de-para mediria a diferença entre dois de-paras): **59 placas na planilha × 61 eventos abertos no banco, SEIS em comum.** As **12 unidades** lançam no app (PIR 97 eventos, CBA T1 42, ANG 37, GRL 32…). As cinco placas que ele citou estão todas do lado "só na planilha"; as que faltavam (`CIS7492`, `DEU6I16`, `RUR5G11`, `RUR5G14`) estão no banco. Ele estava certo em cada palavra.

**Três armadilhas que só apareceram na medição:**
- **A planilha "mercosuliza" o que não é placa.** O identificador das empilhadeiras vira placa Mercosul pela regra do 5º caractere dígito→letra: `EMP0857`→`EMP0I57`, `EMP1593`→`EMP1F93`. O MESMO veículo não casava entre os dois lados.
- **ANG nunca apareceu nesta visão.** A planilha manda `ANHANGUERA`, que não está no de-para do farol-core, então `codDe` devolve null e a linha era **descartada em silêncio** — 13 placas paradas invisíveis. No banco a unidade já vem como código (`ANG`) e aparece.
- **O hero somava a frota uma vez por dia do mês.** O `vigDe` da aba devolvia `ano*100+mês` e a aba tem **uma linha por dia**, então o "último recorte" pegava os 19 dias de setembro: **13.702 ativos e 564 indisponíveis** para uma frota de ~975. O percentual saía plausível porque numerador e denominador inflavam junto — foi assim que ninguém viu. A chave passou a ser o dia.

**Como ficou:** ordem **banco → planilha**. `DATA.dispInd` são os **eventos abertos** (`data_retorno is null`); os **ativos** do hero saem da foto diária do `disp_snapshot` (o pg_cron cruza o robô Ginfo com os eventos) e os **indisponíveis são contados dos eventos de agora** — senão o hero e a tabela logo abaixo dele mostram números diferentes, que é o mesmo defeito por outro caminho. **Tabela vazia conta como FALHA** (anon sem sessão do hub recebe `[]`, não 401). E a tela **diz de qual base está falando**, com a legenda da planilha em âmbar avisando que é a base antiga.

**Validação** (`scripts/disp-fonte-teste.mjs`, Chromium com o `farol-core.js` de verdade): **27 checagens em 5 cenários** — banco respondendo · banco vazio · banco recusando · só a foto de ativos falhando · os dois lados fora. Roda **os dois lados**, como o teste do Frota de Elite: é a reserva que decide se o painel abre zerado. **Duas armadilhas foram do TESTE:** o dublê do gviz sem `status:'ok'` faz o `gvizAny` rejeitar (6 falhas que pareciam da troca), e `window.DATA` é `undefined` porque `const DATA={}` no topo do farol-core é ligação léxica — quem a enxerga é um script no mesmo escopo global.

**O que NÃO foi feito:** o painel `/disponibilidade/` antigo continua no gviz (é outra página, `aposentar` já era pendência) e o trigger do Apps Script segue ligado — desligá-lo é decisão do Renan, e agora ele alimenta só a reserva.

### O APPS SCRIPT FOI DESLIGADO E O PAINEL ANTIGO APOSENTADO (Renan, 19/09/2026: "pode desligar o trigger do Apps Script e aposentar o painel antigo")

- **O trigger é do Apps Script e eu não o alcanço** — foi colado no chat como duas funções: `listarGatilhos()` (imprime função, tipo e id de cada gatilho **antes** de apagar nada) e `desligarGatilhos()`, que remove **só** as funções da lista `ALVOS`. Apagar tudo com `getProjectTriggers()` numa varredura cega derrubaria qualquer outro gatilho que o mesmo projeto tenha para outra aba — e ninguém saberia qual.
- **`/disponibilidade/` virou uma PÁGINA DE AVISO**, não um 404: **nenhum lugar do portal linka para ele** (o card do hub aponta para o `disponibilidade-preenchimento/` desde sempre), então quem chega ao endereço digitou ou tem favorito. Apagar deixaria essa pessoa sem saber para onde ir. A página diz por que saiu e manda para os dois lugares que cobrem o que ele fazia: o hero de disponibilidade estava no `hero-label">Disponibilidade Total` e hoje é o **Resumo · Disponibilidade** do app (lê `disp_snapshot`); a tabela `Indisponibilidade · Cenário Atual` é a visão **Disponibilidade** do Gestão à Vista. O painel antigo volta com `git show 3daea6e^:disponibilidade/index.html`.
- **O link NÃO leva à visão certa por parâmetro** — o app não lê `URLSearchParams` nem `location.search` (conferido), então `?v=resumo` abriria na visão padrão e o rótulo prometeria o que não acontece. O caminho vai escrito no botão em vez de eu mexer no app que as unidades usam.
- **As abas `Disponibilidade`/`Indisponibilidade` FICAM nos `ALVOS` do gviz-robot e no `sheets-bases.mjs`**, porque são a reserva do Gestão à Vista quando o banco não responde. Tirá-las faria a reserva ir ao Google, mais lenta e pelo caminho que o corte de 18/09 fechou.
- **Congelar não acende alarme falso no painel de Saúde**, e o motivo é o `carregado_em`: o `sheets-robot` o atualiza **mesmo quando o md5 é igual** (e o `gviz-robot` faz PATCH no `updated_at`), então as duas abas seguem "Em dia" — o que congelou é o conteúdo, não a leitura. O outro lado disso é que **o painel de Saúde também não vai avisar** que a planilha parou; quem denuncia é a data na legenda âmbar do Gestão à Vista, e só quando a reserva entrar em cena.

### O ALARME DE BASE PARADA JÁ EXISTIA E MEDIA A COISA ERRADA (19/09/2026)

Renan, ao ler o parágrafo acima: *"É meio lógico isso. Já havíamos criado"*. Ele está certo nas duas partes, e eu tinha escrito como se faltasse a peça: **o detector existe desde o 1º dia** — `velhas > 48h` no `saude-robot.mjs` e `estadoBase()` com `Atrasada`/`Parada` no painel. O que ele mede é que estava errado.

**`atualizado_em` é a idade da LEITURA, não a do DADO.** Nas bases do Sheets ele é o `carregado_em`, que o `sheets-robot` reescreve **mesmo quando o md5 é igual** (o ramo `sem mudança` grava `carregado_em: now()`); nas fotos do gviz é o `updated_at`, que o `gviz-robot` PATCHa quando o hash não mudou. Medido na coleta: **75 das 99 bases** (45 `sh_*` + ~30 fotos + o Ginfo) ficariam **"Em dia" para sempre**, congeladas ou não. É o mesmo engano do "Atualizado" no topo do Gestão à Vista que ele pegou em 10/09 — e não valia só para as duas abas da Disponibilidade: qualquer aba que alguém pare de atualizar, ou cujo IMPORTRANGE quebre, passaria em branco.

- **A régua virou a IMPRESSÃO do conteúdo.** A base carrega `impressao` (o `hash` que o `sh_base` e o `gviz_snapshot` já guardam; `bytes` quando não há hash) e o robô compara com a que **ele mesmo** gravou na coleta anterior: igual preserva o `mudou_em`, diferente carimba agora. `elite` e `app` não entram nisso — ali o `atualizado_em` já é a data do próprio dado.
- **O Ginfo não tem coluna de hash**, e pedir o `data` a cada coleta baixaria MBs só para saber se mudou. Entrou a view **`ginfo_impressao`** (`md5(data::text)` + `jsonb_array_length`), calculada no Postgres, com `security_invoker = on` — sem isso a view rodaria com os direitos do owner e furaria a RLS da tabela.
- **1ª coleta deixa `mudou_em` NULO de propósito** e a tela diz **"Aguardando 2ª coleta"** em cinza. Chutar "mudou agora" faria toda base congelada **nascer "Em dia"**, que é exatamente o defeito que a mudança existe para tirar.
- **A tabela ganhou "Dado novo em" ao lado de "Lida em"** — sem as duas datas a tela se contradiz: base marcada "Parada" com "Última carga: hoje 12:00" parece bug da tela. A "Idade" agora é a do dado.
- **SQL**: `scripts/saude-conteudo.sql` (as duas colunas em `saude_base` + a view), colado no chat.
- **Validação** (`scripts/saude-estado-teste.mjs`, `node:vm` rodando o `estadoBase` **do próprio painel** — extrair as regras para o teste mediria a minha cópia): **14 checagens**, e a que importa roda **os dois lados** — a aba lida há 30 min com conteúdo de 5 dias dá `Parada` pela régua nova e `Em dia` pela antiga.
- **O que NÃO mudou:** os limites por fonte (Sheets 6h · Ginfo 30h · Elite 45 dias) e o aviso por e-mail, que segue sem tocar porque o `vars.MAIL_TO` continua vazio desde 27/08. **O painel enxerga; o e-mail ainda não sai.**

## Robô Frota de Elite (Ginfo → Supabase, por vigência) — em construção (05/08/2026)

Automatiza a planilha **Frota de Elite** (`1DXmjzj2KRrTdQxmvXRclGxhBeDMwoIoLvORqbh3GG6M`, hoje preenchida à mão a partir do Ginfo). Mesmo desenho do robô do Farol, com **duas diferenças**: coleta **mês a mês** e também o **acumulado do ano** (jan → mês de referência, ponderado pelo BI — não é média das médias).

**Peças:** `scripts/elite-robot.mjs` (Playwright) · `.github/workflows/elite-robot.yml` (dispatch `login`/`mes`/`backfill` + cron diário 7:30 BRT) · `scripts/elite-supabase.sql` → tabela **`elite_snapshot`** com PK `(indicador, vigencia, escopo)`, `escopo` ∈ `mes`|`ano`.

**Regras (Renan, 05/08/2026):**
- **Nomenclatura:** acabam "IV"/"IC" — tudo é **indicador**. Os ICs atuais são os únicos do Frota de Elite; os novos (Amplitude, MTBF/MTTR, OS Vencida, Blitz de Segurança, % Calibragem OK) entram **só no Gerot**, para gerar ação.
- **Atingimento = a própria aderência** em todos. O robô NÃO carimba meta — a estrutura de pesos do painel já está pronta.
- **Calendário:** roda todo dia do **dia 01 ao 15** gravando o **mês anterior fechado** + o acumulado do ano até ele; depois do 15 para e volta no dia 01. (≠ regra do dia 10 do Farol.)
- **Backfill a partir de 01/2026** (2025 não entra). Filtro de ano só no ano que vem.
- **MTBF e MTTR saem do mesmo relatório da Disponibilidade** (`2.4 - MTBF E MTTR`) — uma coleta, três indicadores.
- **API Prolog** (Amplitude, % Calibragem OK) já roda — reaproveitar.

**Mapa indicador → relatório (todos por Filial):**
| Indicador | Menu Ginfo | Período | Coluna |
|---|---|---|---|
| disponibilidade | FROTA → 2.4 - MTBF E MTTR | dropdown Ano+Mês | Disponibilidade Veículos (+ MTTR/MTBF) |
| preventivas | FROTA → 2.2 - PREVENTIVAS | datas "Data de Execução" (bloco VISÃO HISTÓRICA) | Aderência |
| pneus | FROTA → 3.4 - PNEUS | tiles ano+mês no rodapé (ctrl+clique p/ o ano) | Aderência Aferição |
| checklist-t2 | FROTA → 1.3 - ADERÊNCIA FROTA - 031120 | datas "Data" | Aderência |
| checklist-t1 | FROTA → 1.3 - ADERÊNCIA EMPURRADA | datas "Data" | **Aderência Saída** |
| checklist-wh | FROTA → 1.3 - ADERÊNCIA ARMAZÉM (**só EMPILHADEIRA**) | datas "Data" | **Aderência** (não a Aderência Ponto) |
| conformidade | FROTA → 1.2 - ADERÊNCIA CONFORMIDADE | dropdown Ano+Mês | Mensal ou Bimestral (regra abaixo) |
| stress-test-frota / -empilhadeira / civf | mesmas telas do Farol | dropdown Mês | aderência = desconto 0 → 1, senão 0 |
| sla-manutencao | FROTA → 2.4 - ORDEM SERVIÇO | datas "Data" | SLA Atendimento |

**CONFORMIDADE — O CORTE DE AGOSTO/2026 (Renan, 11/08/2026):** o Ginfo trocou a régua no meio do ano, então **2026 tem duas metades e cada uma é medida com a régua da sua época** — senão a mudança premiaria ou puniria unidade sem que nada tivesse mudado na operação. **jan→jul/2026** vale o que o robô coletou ANTES da mudança (Mensal/Bimestral); **ago→dez/2026** vale a régua nova (contagens por status de prazo). Quando a janela cruza o corte, a conformidade é a **média simples das duas metades** — no fechamento do ano, `(aderência jan→jul + aderência ago→dez) ÷ 2`. No `gerot-base` isso é `CONF_CORTE='2026-08'` + `confRegraNova()` + `confMetade()`/`confAcum()`; o registro acumulado leva `metades:2` quando veio da média. Dentro de cada metade a conta é a de sempre: contagens poolam (régua nova), percentuais usam o escopo `ano` do Ginfo ou a média mensal (régua antiga). **O robô pula chave já gravada** — não rodar com `refazer` em jan→jul, ou os valores da régua antiga se perdem.

**A ADERÊNCIA NOVA CONFERE (validado 11/08/2026):** com os KPIs da tela (Aderência 82,02% · Nunca Realizado 59 · Não Realizado 353 · Realizado Fora Prazo 896), a fórmula `(Dentro Prazo + No Prazo) ÷ soma das cinco` exige 5.967 no numerador — bate com os "5 Mil + 1 Mil" arredondados da tela, e devolve exatamente 82,02%.

**CONFORMIDADE — REGRA NOVA DO GINFO (08/2026), substitui tudo abaixo:** o BI passou a medir a aderência pelo **prazo de vencimento** de cada equipamento (**WH** = Armazém/Apoio, 30 dias · **DU** = demais projetos, 60 dias), acabando com a queda artificial para ~50% no 1º mês do bimestre. Com isso **acabou a distinção Mensal × Bimestral** — a periodicidade já está embutida no status. A tela `1.2 - ADERÊNCIA CONFORMIDADE` agora traz a tabela por Filial com **cinco contagens**: `Nunca Realizado · Não Realizado · Realizado Fora Prazo · Realizado Dentro Prazo · No Prazo`, e **Aderência = (Dentro Prazo + No Prazo) ÷ soma das cinco** (conferido contra a tela: CUIABA 39,62%, PELOTAS 67,36%, NOVA FRIBURGO 67,50%, CDD RIO 67,98%, FLORIPA 68,52%, total 73,33%). Como são contagens, **somar os meses dá o acumulado exato** → `conf` entra no `POOL_FIELDS` e o **`conformidade-mar` foi aposentado** (coletor removido; o leitor mantém o caminho antigo só como fallback para o histórico ainda não recoletado). O robô continua achando a tabela pelo header `Filial`; o drill "Detalhes Aderência Mensal" não abre pelo CARD (testado em 5 posições), mas **ABRE pela CÉLULA da tabela** — ver "Conformidade por placa" abaixo. A regra das **empurradas só de abr/2026** (`confVale`) segue valendo, por ser decisão de negócio.

**CONFORMIDADE POR PLACA (`conformidade-detalhe`, 22/08/2026)** — a "placa mais vencida" que o Renan pediu no Gestão à Vista. Descobertas que mudaram o jogo: o drill-through da tela 1.2 **abre pelo botão direito na CÉLULA da tabela por Filial** (no card nunca respondeu — eram 5 offsets à toa) e o submenu tem DOIS destinos: **"Detalhes Aderência Mensal"** (uma linha por placa × competência: `Competência · Filial · Placa · Projeto · Tipo Veículo · Tipo Aderência WH/DU · Prazo · Início da Cobrança · Vencimento Vigente · Checklist Realizado em · Status · Próximo Vencimento · Realizações no Mês…`) e **"Detalhes NOK"** (item a item de checklist por placa — ainda sem uso). O drill **herda o filtro da linha clicada**, então a coleta é filial a filial; o ano inteiro vem de uma vez (filtro "Ano é <ano>") e as linhas são agrupadas por Competência (serial de xlsx → MM/AAAA) e gravadas em `elite_snapshot` como `conformidade-detalhe`/escopo `mes`. Peças: modo `conf-detalhe` no `scripts/elite-robot.mjs` + workflow **Conf Detalhe** (diário 8:00 BRT + dispatch) + auditoria **Conf Detalhe Check**. Três armadilhas REAIS já corrigidas: (1) na página de detalhe o export pegava o **card vizinho** ("No Prazo/341") — o "..." dele era o mais perto do canto e nem `minY` nem achar o botão pelo DOM resolveram (o do DOM é um placeholder interceptado); o que funciona é **esconder os visuais baixinhos** (`display:none` nos grids com <100px de altura) antes do export; (2) rodada parcial (Ginfo instável) **sobrescrevia a vigência inteira** — o salvar faz **MERGE por filial** (substitui só o que a rodada coletou); (3) alguns exports vêm com filtro de **regional** em vez de filial (a 1ª rodada inflou CDD CUIABA p/ 1794 linhas) — as linhas carregam a própria coluna Filial, então o merge por filial também saneia isso. Validado 22/08/2026: 8 vigências × 13/13 filiais, ~900–1.000 placas/mês, duplicatas exatas 2–4% (provável cobrança dupla legítima do ciclo WH — observar). O leitor está no Gestão à Vista (`loadConfDet`/`confPlacas`): tabela "Placas pendentes — da mais vencida para a menos" na visão Conformidade (pendente = Nunca/Não Realizado, ordenado por Vencimento Vigente; datas chegam como serial).

**Conformidade — regra ANTIGA (só para o histórico não recoletado):** PIRAI EMPURRADA, MACACU EMPURRADA, CUIABA EMPURRADA e CDD RIO DE JANEIRO usam **Aderência Bimestral** de **jan a jun**; as demais, **Mensal**. **De julho em diante, todas bimestral.** **As três empurradas só contam de ABR/2026 em diante** (Renan, 18/08/2026 — antes era mar/2026): **jan, fev E MAR** ficam sem valor no mensal, no acumulado e nos adicionais de conformidade (`confVale` + `CONF_EMP_INI` no gerot-base). Sem valor **não é zero**: o peso do indicador é redistribuído entre os que a unidade tem. **Acumulado das empurradas ≠ escopo `ano`** (o jan→M do Ginfo inclui os meses que não contam) — sai da **média dos meses que valem** (abr em diante), marcada como `approx`. O indicador **`conformidade-mar`** (janela mar→M, escopo `ano`) **saiu de cena de vez**: com março fora da regra aquela janela ficou contaminada; o coletor já tinha sido removido e agora o leitor também não busca mais. Se o acumulado exato das empurradas voltar a ser necessário, é coletar a mesma tela com Mês=abr→M. **A regra é da FILIAL, não da unidade unida** (bug real, 18/08/2026): com `fundir:true` o `canonUnit` renomeia a linha da MACACU EMPURRADA para MACACU **antes** do `confVale`, e mar/2026 continuava entrando com 47,8% na unidade unida. O `unitCru(filial,proj)` devolve o nome de origem sem fusão e é ele que manda no `confVale` e na escolha Mensal × Bimestral; o acerto do acumulado usa `fundido(CONF_EMP)`.

**Três mecânicas de filtro** (o robô do Farol só tinha a primeira): `dropdown` (slicer Ano/Mês, com ctrl+clique para somar meses no acumulado) · `datas` (par de campos dd/mm/aaaa — escolhe o par mais próximo do rótulo, porque Preventivas tem dois pares) · `botoes` (tiles de ano/mês no rodapé dos Pneus, com seta "‹" para revelar meses fora da faixa). Período que não aplica **aborta a coleta** — nunca grava a tela no filtro errado por cima do dado bom.

**Iterar barato:** `ELITE_IND=disponibilidade` roda um indicador só; `ELITE_DE`/`ELITE_ATE` limitam o backfill; `ELITE_FORCAR=1` ignora a janela do dia 15; `refazer=true` (input do workflow, `ELITE_REFAZER=1`) recoleta o que já está gravado — sem ele o robô **pula** toda chave já existente em `elite_snapshot`.

**NADA DE "IV"/"IC" — é tudo INDICADOR (07/08/2026):** o leitor expõe **`GerotBase.INDICADORES`** (os indicadores-chave, iguais nas DUAS bases, lidos da MESMA fonte) e **`GerotBase.INDICADORES_GEROT`** (os adicionais, que só aparecem no Gerot e não pontuam no Frota de Elite). No painel do Gerot é **uma tabela só**, todas as linhas no mesmo estilo, com Meta / Real / % de Ating. / % Ating. YTD — sem seção separada e sem pílula "OK/Atenção". Campos sem prefixo `iv_` (`mttr`, `osVenc`, `blitz`, `prevFora`…), registros dos adicionais marcados com `soGerot:true` e `atg` = `meta/real` ('lower') ou `real/meta` ('higher'), via `atgDe()`.

**Isenções do Stress Test de empilhadeira (Renan, 07/08/2026):** erro de cadastro ENTRE UNIDADES gerou desconto indevido — **EMP2024 (CDD Florianópolis)** e **EMP 2026 (CDD Pelotas)** contam **sem desconto de jan a mai/2026** (com isso Pelotas fica 100%). No `gerot-base` é a lista `ST_EMP_ISENTOS` + `stEmpIsento()`, casada pelo identificador (`Placa Ginfo`/`Chassis`, ignorando espaços) e pela vigência — **não pela unidade**, que é justamente o que estava errado. Vale no mensal e no acumulado, nos dois painéis.

**METAS dos indicadores-chave (Renan, 07/08/2026) — é delas que saem os FCAs da RPM:** Disponibilidade **95%** · Preventivas **100%** · Pneus **100%** · Checklist T1/T2 **95%** · Conformidade **100%** · Stress Test (Veíc. e Emp.) **100%** · CIVF **100%** · SLA **75%**. Checklist WH: **95%** (mesma regra de checklist do termômetro, que vale para ARM) — confirmado pelo Renan em 07/08/2026. Combustível continua com meta própria (km/L remunerado por unidade/vigência). No `gerot-base` isso é o mapa `METAS` + `recChave()`: cada registro leva `meta` e **`atgMeta` = real ÷ meta (cap 100)**, que é o que o **Gerot** mostra na coluna % de Ating.; o campo **`atg` continua sendo a própria aderência**, porque é ele que o **Frota de Elite** pontua (os pesos do programa já estão montados assim). Não trocar um pelo outro.

**O Gerot = os indicadores do Frota de Elite + 7 adicionais (6 do plano do PPTX, 07/08/2026, + Saída com OS Crítica, 14/08/2026):** `INDICADORES_GEROT`, nesta ordem — **Amplitude** (API Prolog, meta 5mm do painel Milimetragem) · **MTBF** e **MTTR** (valores do relatório "MTBF E MTTR" do Ginfo, meta = regra do termômetro: **melhor que o 3º quartil** das unidades na vigência, `metaMode:'quartil'`) · **OS Vencida** (planilha do Termômetro `10LRn3jrXEemqFiFAMbO8_bOLk98xrWTVXVUNDeQqLac`, col Q dos 4 tiers, somada Frota+Armazém por unidade; meta da regra: < 10) · **Saída com OS Crítica** (coluna "Saídas com OS Crítica" do export MENSAL do `checklist-t2` no elite_snapshot — a tela ADERÊNCIA FROTA 031120; validado 14/08/2026: soma jan→jul = 125, igual ao acumulado da tela do Ginfo. Meta ZERO, atingimento binário 0→100% / ≥1→0%; no Gerot a janela/YTD SOMA os meses (contagem, não média). Cobre CDDs/CDI; empurradas T1 e WH não têm a coluna → sem valor) · **Blitz de Segurança** (col M do Transportes T2, só CDDs; meta 100%) · **% Calibragem OK** (API Prolog, meta ≥ 98% do painel Calibragem, ±10% da ideal). Os dois do termômetro vêm por vigência `MM_Q`, valendo a Q2 do mês (senão Q1), via `loadTermometro()`; de-para: Transportes T1 = MACACU/CUIABA/PIRAI (→ empurradas), WH T1 = CUIABA (→ CBA T1 WH), T2/WH T2 = nomes canônicos. **NÃO inventar diagnósticos extras** (fora do prazo, sem anexo, tempo de checklist, conformidade Seg./Quali., SLA executada, MM média foram removidos — não estavam no pedido).

**CORTINA DA APURAÇÃO no Frota de Elite (Renan, 28/08/2026):** o resultado pode ficar **fechado até a divulgação**, para o suspense. Chave `frota_elite_visivel` na tabela **`portal_flags`** (`scripts/portal-flags.sql`): leitura aberta (o painel monta a tela antes de saber quem está olhando; a flag não é dado sensível), escrita só `fca_is_admin()`. Com a chave desligada, quem abre o `/programa-reconhecimento/` vê o card **"Estamos em período de apuração"** e o painel **nem carrega os dados** (`initData()` não roda); o **admin continua vendo os números**, com uma faixa amarela avisando que está oculto e o botão **Ocultar/Liberar resultado** no topo. Erro de rede não estraga o suspense nem tranca o painel: vale o **último estado conhecido** (`bi_elite_cortina` no localStorage). A coluna `mensagem` da tabela troca o texto do aviso sem mexer no HTML. **Aba já aberta não muda sozinha** — a unidade vê a virada no próximo carregamento (nada de realtime).

**MACACU UNIFICADO no Frota de Elite (Renan, 14/08/2026):** `CDI MACACU` + `MACACU EMPURRADA` viram **uma unidade só, `MACACU`**, no programa-reconhecimento — `GerotBase.load({fundir:true})`. É **opt-in**: Gerot, painel-metas e os FCAs da RPM continuam com os dois tiers separados (lá o `RPM_UNIT_MAP` depende dos nomes originais). A fusão acontece na ORIGEM (`canonUnit`), então **cada indicador é combinado pela sua própria régua, sem média de médias**: contagens poolam sozinhas (conformidade, pneus, stress, CIVF) e o combustível poola por **litros** (ver abaixo); os que só dão % ganham o **denominador da tela** como peso — disponibilidade pelas **horas reconstruídas** (`Tempo Indisponível ÷ (1 − disp)`, porque a tela não expõe o total), preventivas por `Preventivas Realizadas`, SLA por `Executadas`, checklist por `Viagens` (com T1 e T2 valendo juntos na mesma unidade), WH por `Realizados`. Validado contra jul/2026: disp 97,597% · SLA 84,434% · checklist 98,952% · conformidade 100% · CIVF 96,875%. Sem denominador em alguma linha, cai para média simples e avisa no console (`approx`). Nome/avatar da unidade unida ficam em `NOMES`/`AVATARES` do programa-reconhecimento.

**COMBUSTÍVEL NA FUSÃO É POOL DE LITROS, NUNCA Σkm ÷ Σlitros (bug real, 18/08/2026):** empurrada roda a ~2 km/L e CDI/rota a ~3,5 km/L — são **alvos diferentes**. Somar os km e os litros das duas e comparar contra a **média das metas** mistura frotas incomparáveis e derruba o atingimento da unidade unida para **abaixo dos dois lados**: em jul/2026 o MACACU dava 94,6% (CDI) e 103,1% (Empurrada) separados e **73,4%** unido — e como o combustível pesa 10, a pontuação da unidade caía ~3 pontos (98,0 → 95,1) em **todas** as vigências. O certo é cobrar cada filial contra a **própria** meta e ponderar pelo que ela gastou: `Σ(litros esperados) ÷ Σ(litros gastos) = Σ(atg_i × lit_i) ÷ Σlit_i` — que é o atingimento exato da unidade inteira e sempre cai entre os dois. No `gerot-base` isso é `combUm()` (por filial, como sempre foi) + `combFunde()` (o pool), com o `COMB` guardado **por filial de origem**; o `meta` da linha unida é derivado (`real ÷ atg`) para o trio meta/real/atg ficar coerente. Conferir com o workflow **Macacu Fusao Check** (`scripts/macacu-fusao-check.mjs`), que marca todo indicador que cai fora do intervalo dos dois lados — é assim que este bug apareceu.

**LEITOR PLUGADO (06/08/2026):** `assets/gerot-base.js` lê o **elite_snapshot** (a planilha Frota de Elite saiu de cena; só o Combustível segue no Km/L via gviz). Contrato `records` mantido; `meta=null` e `atg = a própria aderência` (Renan: robô não carimba meta). Novo `GerotBase.acumFor(vigs)`: % por filial usa escopo `ano` quando a janela é jan→M (senão média mensal aproximada, com warn); stress/civf/pneus poolam as linhas mensais; comb Σkm/Σlitros. Consumidores: gerot (colunas de valor + YTD em acumulado), programa-reconhecimento (hero/cards/ranking/pódio em acumulado quando multi-vig; gráfico temporal segue mensal; cache v7 + hidratação em background), painel-metas (só ganhou o CDN do supabase; sua agregação própria de pontuação ficou como estava). De-para de filial dos exports = FIL2COD/refineCodG (cópia do farol-core); checklist-t1 força tier EMPURRADA (filial "CUIABA" na tela Empurrada é CBA T1, NÃO Armazém); checkWH usa a coluna `Aderência` exata (não `Aderência Ponto`).

**`r.unit` É O NOME DA UNIDADE, NUNCA O CÓDIGO (bug real, 17/08/2026):** o `canonUnit` do gerot-base já resolve código → nome antes de devolver, então `records[].unit` vem `CDD CUIABA`, `CUIABA EMPURRADA`… Passar isso por `COD2UNIT` de novo devolve `undefined` em **todas** as linhas — foi o que o `icsDoElite()` do Scorecard fazia: o `elite_snapshot` parecia vazio, o painel caía no fallback da aba **Base RPM** (que parou de ser apurada em jul/2026, com `% de Ating.` em branco) e, como a lista de vigências nasce dos ICs, o Scorecard inteiro ficou travado em junho. O `COD2UNIT` exportado serve só para quem tem código na mão. **Os painéis de IC são TRÊS, não um:** `scorecard`, `diagnostico` e `resumo-executivo` — os dois últimos liam a Base RPM direto e foram migrados na mesma leva. Para conferir sem chutar: workflow **Scorecard ICs Check** (`scripts/scorecard-ics-check.mjs`) roda o **próprio `assets/gerot-base.js`** contra o Supabase real (dando a ele `window`/`document`/`supabase` mínimos em `node:vm`) e imprime as vigências e a pontuação por unidade — em 17/08/2026: 0 linhas pelo caminho antigo × 854 pelo corrigido, vigências 01→07/2026.

**Pneus — fonte = aba `Pneus` do Sheets Frota de Elite (07/08/2026):** o Renan cola o export "detalhes" do Ginfo (CALIBRAGEM) na aba `Pneus` do workbook `1DXmjzj2KRrTdQxmvXRclGxhBeDMwoIoLvORqbh3GG6M`: `Filial | Evento | Placa | Projeto | Período | Última Leitura | Status`. Cada linha = uma placa na vigência (coluna Período, "janeiro de 2026"); `Status = "Não Realizado"` → 0, senão 1. **Sem filtro de Evento** — a aba tem CALIBRAGEM e MILIMETRAGEM e as duas contam, como o Renan definiu ("todas as placas"). O leitor (`loadPneusSheet` no gerot-base) poola Σok/Σn por filial — mês e QUALQUER janela acumulada exatos, batendo com o Ginfo. Fallback: contagens da API no `elite_snapshot` (o robô continua coletando `pneus` como rede de segurança). IVs de pneus (amplitude/calibragem, Prolog) não mudaram.

**FICA MANUAL — NÃO TENTAR AUTOMATIZAR DE NOVO (Renan, 07/08/2026):** o export do drill traz o ANO INTEIRO de uma vez (conferido: 9.011 linhas, jan→jul, ~1.290/mês, 13 filiais), então o Renan cola o arquivo e pronto — não é trabalho mensal. Cheguei a propor o robô coletar esse drill; ele vetou porque **é a mesma tela 3.4 - PNEUS, com os mesmos filtros que já travaram a automação** (os tiles de mês / seta de "próximo nível", cinco abordagens sem sucesso). Para conferir a aba depois de colar: workflow **Pneus Aba Inspect** (`scripts/pneus-aba-inspect.mjs`) — lista períodos presentes, status, eventos e a aderência por filial do último período, na mesma conta do leitor.

**BACKFILL CONCLUÍDO (06/08/2026):** `elite_snapshot` tem 01→07/2026 completo nos dois escopos.
- **`mes`** — 11 indicadores × 7 vigências = **77/77**.
- **`ano`** — 9 indicadores × 7 vigências = **63/63**. Ficam de fora `pneus` (API: o leitor calcula qualquer janela) e `stress-test-empilhadeira` (a tela não acumula) — os dois com `semAcumulado:true`.

**O acumulado do ano é OBRIGATÓRIO e não se deriva** (Renan, 06/08): quando o painel filtra várias vigências, o número que vale é o acumulado. Para Disponibilidade, Preventivas, Conformidade, Checklists e SLA o valor mensal já é um percentual por filial — **média de médias ≠ acumulado ponderado**, que é o que o Ginfo calcula na tela quando se multisseleciona jan→mês. Só Stress Test e CIVF (linhas 1/0 por placa) e Pneus (API) é que o leitor pode somar sozinho. Por isso o escopo `ano` é gravado **por vigência**: filtrar jan→abr exige o acumulado até abril.

**Instabilidade conhecida do Ginfo:** ~8% das coletas falham por portal sem menu lateral, aba interna não encontrada ou campo de data ausente. O robô tenta 3× e aborta sem gravar. Para tapar buracos, redisparar o mesmo intervalo **sem** `refazer` — ele pula o que existe e refaz só o que falta.

**Fila do Actions:** em horário de pico o job pode ficar 15 min na fila sem runner e ser cancelado (`runner_id: 0`, sem log). Não é erro do robô nem cota (o repo é público) — é só redisparar.

## "Por que não aparece agosto no Frota de Elite?" — a lista ficou no cache (19/09/2026)

Pergunta dele, e o instinto errado seria caçar o robô. **Medido antes de
mexer:** o `elite_snapshot` TEM agosto (13 indicadores com `08/2026`, civf 444
linhas, stress-test-frota 603, gravados entre 01 e 15/09 — Elite Vigencias
Inspect) e o LEITOR entrega agosto (Scorecard ICs Check rodando o próprio
`assets/gerot-base.js` contra o banco: `vigências dos ICs: 2026-01 … 2026-08`,
com as 13 unidades pontuadas). Banco certo, leitor certo — o buraco era a tela.

O `initData()` do `/programa-reconhecimento/` pinta do cache e hidrata em
background:

```js
GerotBase.load({fundir:true}).then(recs=>{ RAW=buildEliteRows(recs); renderAll(); })
```

**`renderAll` redesenha os NÚMEROS; quem monta a LISTA de vigências é o
`populateFilters`** — que não era chamado. Então o cache gravado antes de agosto
entrar no banco deixava o seletor **congelado em julho para sempre**, enquanto os
números por trás já eram os de agosto. "Antes aparecia" é literal: enquanto o
último mês era julho, cache e banco concordavam.

- **O `.catch(()=>{})` mudo** garantia que qualquer falha da hidratação não
  tivesse sintoma nenhum — a tela ficava com o cache velho parecendo atual.
  Agora loga e escreve no badge.
- **A chave do cache subiu para `v17`**: é o que tem efeito IMEDIATO. Sem isso,
  quem já tem o cache velho continuaria com a lista antiga até ele vencer.
- **A seleção do usuário sobrevive** a refazer a lista: `populateFilters` só
  reconstrói o HTML, o `selVig` não é tocado e o `updateMsBtn` remarca os
  checkboxes a partir dele — conferido no teste.
- **Validação** (`scripts/elite-vigencia-teste.mjs`, Chromium): **9 checagens
  rodando os DOIS LADOS** — com a correção e sem ela. O lado "antes" reproduz o
  defeito (agosto fora do seletor mesmo com o dado em memória); o lado "depois"
  mostra agosto entrando sozinho, sem F5. Um teste que só roda o lado consertado
  não prova que ele conserta coisa alguma.
- **Duas armadilhas foram do TESTE**, as duas fazendo a correção parecer inútil:
  o dublê do `GerotBase` no `addInitScript` era **sobrescrito** pelo
  `assets/gerot-base.js` que o painel carrega depois (o certo é rotear o próprio
  arquivo), e o `buildEliteRows` **descarta unidade fora do `NOMES`** — com
  `fundir:true` é `MACACU`, não `CDI MACACU`, então o RAW saía vazio.

**Vale para qualquer painel com cache + hidratação:** redesenhar sem repovoar os
filtros deixa a tela mostrando um recorte que não existe mais. Hoje este é o
único (`grep` por `GerotBase.load(.*).then` acha só ele).

## Robôs falhando em silêncio — a varredura de 10/09/2026

O Renan viu "Atualizado 10/09 08:52" no topo do Gestão à Vista e perguntou se
era a hora em que o robô leu o Ginfo. **Não era** — aquilo é o carregamento da
tela. A pergunta destampou **cinco robôs quebrados**, cada um por um motivo
diferente, e **nenhum tinha avisado ninguém** (o `vars.MAIL_TO` continua vazio,
o mesmo buraco de 27/08).

| Robô | Causa raiz | Situação |
|---|---|---|
| Conf Detalhe | **rótulo cortado no menu** — a lateral mostra `1.2 - ADERÊNCIA CONFORMID…` e a busca por substring procurava um texto MAIOR do que o que está no DOM | corrigido (prefixo com match único); voltou a gravar 933 (ago) + 898 (set) linhas |
| Ginfo · empilhadeira | abria o **dropdown errado** do campo Mês (itens `["1ª QZ Stress Test"]`) e concluía que `Ago-26` não existia | corrigido: tenta todos os candidatos e fica com o que tem o valor |
| Ginfo · OS em Aberto | card `NÃO EXECUTADAS` não encontrado p/ o drill | **NÃO é renome**: o modo `tabelas` listou os cards e ele está lá. É intermitência de renderização |
| Elite Robot | **não passou do login** (`continuamos na tela de login`) e as 13 coletas caíram em cascata | momentâneo: rodada de 10/09 passou verde sem tocar em nada |
| CE Coletor | `ValueError: Invalid isoformat string: ''` — o workflow passa sempre o input `dia`, vazio no agendamento | corrigido (argumento em branco = ausente) |

**O CE Coletor era DUPLICADO e foi desagendado (10/09/2026).** `etl/conducao-economica/coletor.py` é o protótipo em Python; quem alimenta o painel é o `scripts/conducao-robot.mjs`, que roda verde todo dia e escreve **na mesma tabela** (`ce_scores_mensais`). Com os dois no automático, o dia em que o protótipo ganhasse credencial passaria por cima do mensal do outro, com conta diferente e sem aviso. Ele também não coletava nada — `GEOTAB_PASSWORD` vazio, `0 leituras diárias`. O `schedule` está comentado no `ce-coletor.yml`; o disparo manual continua.

**Lições que valem para o próximo:**
1. **"Atualizado" no topo do painel não é idade do dado.** Agora diz **"Tela carregada"**, e a hora da COLETA fica no subtítulo de cada indicador. A conformidade mostrava 07/09 no rodapé enquanto o topo dizia 10/09 — ninguém olha o rodapé.
2. **O modo `tabelas` não lista todos os slicers.** Ele mostrou só Empresa/Regional/Filial na Blitz e eu afirmei que não havia filtro de mês; o print do Renan mostrou Ano e Mês. Slicer que não aparece **não prova ausência**.
3. **Sucesso parcial fecha o job em vermelho.** O Conf Detalhe de 10/09 gravou tudo e ainda assim é `failure`, porque 2 de 13 filiais não responderam. Ler só o status engana nos dois sentidos.

## Robô Volks|Total (VW → contrato de manutenção por km) — 15/09/2026

Substitui o que é digitado à mão na planilha **"Contratos Man."**: por contrato e por mês, uma linha por chassi com km anterior, km atual, km rodado e o valor cobrado. Peças: `scripts/volkstotal-robot.mjs` (Playwright) · workflow **Volkstotal Robot** (`sonda` · `teste` · `gravar`, com recorte por contrato/vigência/ano) · `scripts/volkstotal-supabase.sql` → tabela **`vw_contrato_km`** (PK `contrato, vigencia, chassi`) · Secrets `VOLKSTOTAL_USER` / `VOLKSTOTAL_PASS`.

**O portal é alcançável pelo Actions** (HTTP 302 em 577 ms) — ao contrário do Qlik, que ficou parqueado por isso. **43 contratos** no seletor (o log mostra 86 checkboxes porque o portal repete a lista na versão mobile, e um 44º que é o `swal2-checkbox` do próprio modal).

**O caminho:** `Login.aspx` → **Acesso Clientes** → `LoginCliente.aspx` (`txtUsuario` · `txtSenha` · `btnLogin`) → navegar para `ConsultaValorNotaFiscal.aspx` → marcar o contrato → digitar o Mês/Ano → `btnPesquisar` → **Gerar Relatório** → xlsx.

**As sete armadilhas, cada uma custou uma rodada:**
1. **O login IGNORA a `ReturnUrl`** e cai em `Index.aspx`. E a home **também** tem o seletor de contratos — a 1ª sonda fotografou a página errada e o dump saiu plausível, com os 43 contratos. A navegação para a consulta é explícita e a URL é conferida.
2. **A tela abre com um contrato JÁ na sessão** (`txtContrato` vem preenchido num carregamento novo). Conferir "o campo não está vazio" não prova nada: o robô teria consultado o contrato errado achando que marcou o certo, e a nota de um entraria no nome do outro. A conferência é **por igualdade**, nunca por "contém" — com dois marcados o campo traz os dois e um `includes` passaria, somando dois contratos numa consulta só.
3. **Os checkboxes moram num dropdown FECHADO.** `check({force:true})` marca o elemento mas o clique real não chega nele, e o handler do site — que é quem escreve o código em `txtContrato` — não roda. O evento é disparado no próprio elemento (`click` + `change`), o que funciona com o dropdown fechado; e o robô desmarca o que estava antes de marcar o seu.
4. **`networkidle` não serve aqui:** o portal tem chamada periódica, a rede nunca fica ociosa e a espera ia até o teto — 90 s desperdiçados **por consulta**, quase 12 h nas 390 buscas. O que decide é o que aparecer primeiro: o modal de "sem dados" ou o "Gerar Relatório".
5. **O botão tem de ser o `:visible`.** Sem isso `input[value*="Relat"]` casa também com um elemento escondido, o `.first()` escolhe esse, e o clique fica 30 s esperando algo que nunca fica clicável.
6. **O cabeçalho do relatório NÃO é a 1ª linha** — o xlsx abre com títulos, e `sheet_to_json` sem `header` usa a 1ª linha como nome das colunas, então **nenhuma** é encontrada. O parser acha a linha que tem "Chassi"/"Placa". E as colunas úteis estão espalhadas entre **40 colunas** (`col0 | Chassi | col2 … col10 | Km Anterior | … | col20 | Km Atual`), com mescladas no meio: ler por posição jamais funcionaria.
7. **A linha "Total" do rodapé NÃO é um veículo.** "Total" cai no campo Chassi, e um filtro de "tem chassi ou placa" a manteria — entrando no banco como um veículo cujo valor é a soma de todos, **dobrando o mês**. Mesmo fantasma do "Filtros aplicados" do Ginfo. A régua é a **forma da chave** (chassi de 8+ alfanuméricos, placa com formato de placa) e o descartado aparece no log.

**O campo do Mês/Ano tem máscara:** `fill()` escreve de uma vez sem disparar o keypress que a máscara escuta. Digitar caractere a caractere (`092026`, a barra entra sozinha) é o que funciona, e o robô confere se o campo ficou `MM/AAAA` antes de pesquisar.

**O Valor Total da nota é a conferência:** a soma das linhas tem de bater, com folga de **um centavo por linha** (não fixa). Validado em B7007A/09-2026: 5 linhas, 8.035 km, R$ 6.060,01 contra o total de R$ 6.060,00 — igual ao que o Renan tinha na tela.

**Grava a FOTO CRUA, não a Carta** (Renan, 15/09/2026: *"antes de mudar algo na carta de custos, vamos comparar vigência a vigência o que subiu e o que o robô buscou de km e valores. Depois eu dou ok para subir"*). O comparador é o workflow **Volkstotal Check** (`scripts/volkstotal-check.mjs`): por vigência, placas/Σkm/Σvalor no portal × na planilha, mais as placas só de um lado e as que divergem em valor. A planilha é lida com o **mesmo código do `contratos-robot`** — ler de outro jeito mediria a diferença entre duas leituras, não entre duas fontes.

**Erro meu que vale lembrar:** `let` declarado no rodapé do arquivo fica na **zona morta** enquanto o `await` de topo de módulo executa (`function` é içada, `let` não). A leitura morria com *"Cannot access '_cabLogado' before initialization"*, um erro sem relação com o portal. `node --check` não pega TDZ — a conferência virou posicional no teste.

### A FAIXA é a ultrapassagem, e cada contrato tem preço próprio nela

O mesmo chassi aparece duas vezes no mesmo contrato e mês quando o km atravessa a faixa: são duas cobranças com preços diferentes. Por isso a faixa está na **chave primária** de `vw_contrato_km` e no `on_conflict` — colapsar destruiria o que interessa ver. Validado em agosto: 11 chaves duplicadas, **todas** separadas pela faixa, nenhuma repetindo. Exemplo: `V1673W|2026-08|9536B8TDXTR014470` → faixa 1 com 798 km (R$ 340,59) e faixa 2 com 2.057 km (R$ 597,76), somando os 2.855 km do mês.

**Ultrapassar NÃO é bom nem ruim por si — depende do contrato** (medido em 15/09/2026 com `valor ÷ km_rodado` de cada linha de faixa; **não existe view para isso** — eu cheguei a citar aqui uma `vw_contrato_faixa_preco` que nunca foi criada): no **V1673W** o km excedente é 29% mais BARATO (R$ 0,2844 contra R$ 0,3980); no **H6764M** é 26% mais CARO (R$ 0,4660 contra R$ 0,3709). São os únicos dois contratos com mais de uma faixa. `vw_contrato_faixa` responde quem foi cobrado em duas faixas no mês (`avancou_no_mes`) e quem subiu em relação ao mês anterior (`mudou_de_faixa`).

### O que a comparação com a planilha apurou (15/09/2026)

**Março e junho batem centavo a centavo** (R$ 422.096,79 e R$ 347.608,55 nos dois lados) — a leitura do portal reproduz a planilha quando ela está bem preenchida. O que sobra de diferença é sempre **falha de preenchimento da planilha**, nunca do portal:
- **maio**: 42 placas com a linha criada e **valor zero** — R$ 46.995,79 não lançados;
- **julho e agosto**: a **faixa 2 não é lançada**. O Δ de cada placa é exatamente o valor da segunda faixa (`UGE6A30`: portal R$ 938,35 = planilha R$ 340,59 + R$ 597,76). São R$ 1.746,56 e R$ 5.799,39;
- **erros de digitação de placa**: `RYM0B07` × `RYM0B87` (jun) e `GAM8I76` × `GAM8B76` — um caractere, dinheiro no veículo errado.

**Duas armadilhas do comparador, as duas já corrigidas e as duas do mesmo tipo — comparar coisas que não são comparáveis:**
1. **O portal só tem os 43 contratos da VW; a planilha tem TODOS os veículos em contrato.** Comparando os dois lados inteiros, o balde "só na planilha" misturava contrato fixo, outro fornecedor e placa VW faltando — 99 placas e R$ 201 mil em agosto, sem saber quanto de cada. Recortando só a VW, cai para 8 placas. A coluna de contrato da planilha é achada **casando com a lista real dos 43** (um regex de "cara de nº de contrato" não reconhece os que começam com dígito, `620079`, `62A358` — metade da lista).
2. **O portal nem sempre preenche a Placa** — em alguns meses vem só o chassi, e o cruzamento por placa fazia a MESMA linha aparecer dos dois lados como exclusiva de cada um (portal `953557TPXNR050136` R$ 774,00 ↔ planilha `RHU8F38` R$ 774,00). O de-para sai do próprio portal, que preenche a placa desse chassi em outros meses.

**JANEIRO/2026 É UM BURACO NO PORTAL, e não sei por quê.** Cheguei a dizer que era "janela de 8 meses" e que "o robô precisa rodar todo mês senão o portal esquece" — **as duas coisas são falsas**, e eu as apresentei como constatação. O contrato `620079` tem 2025 inteiro no portal (ago R$ 9.908,17 · set R$ 9.555,57 · out R$ 10.134,85 · nov R$ 12.417,97 · dez R$ 11.362,50), **não tem janeiro**, e tem fevereiro (R$ 17.336,26). Ou seja: não é janela de tempo nem início de contrato. Fevereiro veio maior que os vizinhos (20.836 km contra 13.500 em dez), o que é *compatível* com a nota de janeiro ter saído junto na virada do ano — mas isso é leitura de um contrato só, não conclusão. **Como o histórico de 2025 existe, dá para coletar para trás** (`VT_ANO=2025`).

**MEDIDO NOS 43 CONTRATOS (16/09/2026), e o buraco continua sem explicação.** A coleta de `2026-01` varreu os 43 e voltou com **1 linha** (`P7768G`, R$ 2.661,60) — **42 contratos sem dado**. Já **2025 inteiro veio completo**: 2.666 linhas, **R$ 4.243.224,50**, jan→dez, com **janeiro de 2025 trazendo 217 linhas em 30 contratos** (532.936 km, R$ 337.783,01). Ou seja, não é "o portal não guarda janeiro" nem comportamento de virada de ano — é **janeiro de 2026, especificamente**. O `VW_INI='2026-02'` da Carta segue certo e não vira "tem dado ou não" por causa dessa 1 linha. Duas falhas na rodada de 2025 (`I1125X 2025-01` e `620001 2025-06`) são erro do próprio portal (`SqlParameterCollection only accepts non-null SqlParameter`), não do robô; redisparar o par resolve. 139 pares sem dado = contrato que não cobre o mês, o que é esperado.

### A Carta passa a cobrar pelo portal, e ganha os DOIS hodômetros (15/09/2026)

Com a comparação feita, o Renan liberou: *"E pode subir já o contrato do site, à partir de fevereiro"*. `scripts/contrato-portal.sql` faz a troca e as colunas novas de uma vez.

- **A precedência é portal → planilha → cálculo**, e mora no painel (`loadContratos`), junto da sobreposição da planilha que já existia. **Fevereiro é um corte EXPLÍCITO** (`VW_INI='2026-02'`), não um "tem dado ou não": janeiro não existe no portal e a causa é desconhecida, então uma coleta parcial de janeiro no futuro não passa por cima da planilha sozinha. O portal só tem os 43 contratos da VW — o resto da frota (fixo, outros fornecedores) segue como sempre.
- **O que a troca conserta na prática:** as 42 placas de maio com a linha criada e valor zero, e a 2ª faixa não lançada em julho e agosto. O subtítulo da visão diz quantas placas do recorte vieram da nota da VW — com a fonte trocada, "a VW cobrou" e "alguém digitou" não podem parecer a mesma coisa na tela.
- **Os DOIS hodômetros** (pedido do Renan no mesmo dia): o **do contrato** é a leitura com que a VW fechou a nota (`vw_contrato_km.km_atual`; cai no `ultimo_km_informado` da planilha quando a placa não está no portal), o **do abastecimento** é a maior que o ERP viu no mês (`km_vigencia.hodo_fim`). É da distância entre os dois que sai o controle — quando um anda e o outro não, o veículo roda sem ser declarado (ou o contrário).
- **Os dois são ARRASTADOS** (*"é mensal, então quando vira o mês considera o último do mês que passou"*): mês sem leitura herda a última conhecida. Vazio no dia 1º não quer dizer "não rodou", quer dizer "ainda não mediram". Em SQL isso é o truque das duas janelas (`count() over` numera os blocos, `max() over` devolve o valor que abriu cada um) — o Postgres não tem `last_value ignore nulls`.
- **`vw_contrato_placa_mes`** soma as faixas do mês (a nota é uma só) e guarda `faixas` para dizer quem atravessou. Ela também **acha a placa pelo chassi** quando o portal manda a linha sem placa, com o de-para tirado do próprio portal — senão a linha ficava órfã e a placa aparecia sem contrato.
- **A leitura do painel desce em DEGRAUS** (tudo → só `contrato` → mínimo): pedir coluna que não existe faz o PostgREST devolver 400, e a Carta ficaria sem contrato NENHUM na tela, não só sem a coluna. Cada degrau liga ou desliga o que a tela mostra (`CONTR_NUM`/`CONTR_VW`).
- Conferido num Postgres 16 de verdade (o script roda duas vezes, `refresh concurrently` continua valendo) e no Chromium com o painel real em três cenários de banco — 27 checagens, incluindo o rodapé da tabela batendo com o cabeçalho em cada combinação de coluna condicional.
#### O que a troca mudou de verdade (medido em 16/09/2026, depois do SQL rodado)

**Δ do ano: +R$ 142.824,64** — mas o número sozinho mente, e eu quase o apresentei errado duas vezes. **O sinal só tem sentido junto da BASE que ele está substituindo**, e são duas bases diferentes:

| vigência | base antiga | Δ | placas que mudaram | o que isso é |
|---|---|---|---|---|
| 2026-02 | **cálculo** | +108.481,73 | 203 de 204 | estimativa → nota real |
| 2026-03 | planilha | **0,00** | 0 | bate centavo a centavo |
| 2026-04 | planilha | +13.979,89 | 7 | correções pontuais |
| 2026-05 | planilha | +37.635,82 | 43 | as placas lançadas com valor ZERO |
| 2026-06 | planilha | **0,00** | 2 | bate centavo a centavo |
| 2026-07 | planilha | +9.074,47 | 12 | a 2ª faixa não lançada |
| 2026-08 | planilha | +11.817,31 | 18 | idem |
| 2026-09 | **cálculo** | −38.164,58 | 234 de 257 | estimativa → nota real |
| 2026-10 | cálculo | 0 | 0 | prévia, o portal ainda não emitiu |

- **A Carta só tem lançamento de planilha de MAR a AGO.** Fevereiro e setembro saíam do **cálculo** (km do ERP × taxa), então ali o Δ **não é dinheiro que faltava** — é a régua trocada. Nos seis meses em que a planilha cobre, o Δ é +R$ 72.507,49 e **dois deles batem centavo a centavo**, que é a melhor prova de que a leitura do portal reproduz a planilha quando ela está bem preenchida.
- **"203 de 204 placas mudaram" é a assinatura de base = cálculo**, não de erro: uma estimativa nunca bate uma nota ao centavo. Onde a base é a planilha, mudam 2 a 43.
- **SETEMBRO NÃO ESTÁ PARCIAL — e a data não prova isso** (erro meu, pego no meio do caminho): vi a última leitura em 11/09 com a coleta em 15/09 e quase concluí que a nota estava em formação. **O ciclo de leitura da VW termina no meio do mês em TODOS os meses** (fev fecha em 14/02, mar em 24/03, ago em 15/08), então a data não separa nada. Quem separa é o **km**: setembro cobrou **mediana de 98,8% do km que a MESMA placa rodou em agosto** (Σ 94%, 147 de 254 placas acima de 90%), com o mês anterior como controle em 106,4%. Nota fechada. Como o ciclo fecha no meio do mês, **coletar o portal a partir do dia ~15 já traz o mês completo**.
- **10 placas cobradas com ~1 km em setembro** (CUK9G80 R$ 0,29, EEP2380 R$ 0,74, RYM0A67 R$ 1,37) contra milhares de reais na estimativa. São a cauda, não a história — mas valem uma olhada da unidade.
- **`hodo_contrato` na prévia: 260 placas pela nota da VW, 9 pelo Km Informado, 91 sem nenhum** (as de contrato fixo, que não estão no portal da VW). Abastecimento preenchido em 352 de 360.
- **O mesmo hodômetro em 6 placas do V1673W (12.253) NÃO é bug do de-para**: a planilha tem 12.252 para as seis e o portal 12.253 para as seis — **os dois lados concordam**, então é como a VW reporta esse grupo, não erro de leitura nosso. O que significa é pergunta para a VW.
- **Auditoria: workflow `Carta Hodometro Check`** (`scripts/carta-hodo-check.mjs`), que roda DEPOIS do SQL e responde o que a tela não responde: (1) quanto o dinheiro mudou mês a mês, **repetindo a precedência do painel** — se os dois não baterem, um deles está errado; (2) se o `hodo_contrato` veio da nota da VW ou do `ultimo_km_informado` (uma coluna que parece cheia mas é metade plano B conta outra história); (3) **por que duas placas aparecem com o mesmo hodômetro** — pode ser o plano B repetindo, o portal mandando igual ou o de-para de chassi juntando o que não devia, e só a terceira seria bug. O ranking de descolamento traz **o mês de cada leitura ao lado**: na vigência em prévia os dois hodômetros são de datas diferentes por construção, então o sinal de uma linha isolada não quer dizer nada — o que vale é o descolamento grande.

### A coluna FAIXA na tabela (Renan, 17/09/2026)

*"Deixe só a faixa, sem sinalizar km. Se rodar mais que o usual foi de faixa 1 para 2 e vice versa"*. UMA coluna em Placas Contrato, logo depois do R$/km — que é a taxa que a faixa decide. `scripts/contrato-faixa-coluna.sql` leva o rótulo da `vw_contrato_km` até a `custo_vigencia` (+ mv recriada).

- **SEM km de corte, por decisão dele e porque a fonte não afirma esse número.** A nota da VW diz em QUAL faixa o veículo está, não onde ela começa. Eu tinha uma hipótese (o `km_atual` da linha de faixa 1 seria o ponto de virada) e ela **não foi medida nem usada** — mostrar um limite derivado seria apresentar como fato uma conta minha. A direção se lê do próprio par, que é o que ele descreveu.
- **`1 → 2` é a placa que ATRAVESSOU no mês:** ela vem em duas linhas na nota, uma por faixa, com preços diferentes — por isso a faixa está na chave de `vw_contrato_km`. As duas viram um rótulo só; uma faixa só vira `1`; sem rótulo vira travessão.
- **A coluna some** quando o banco ainda não tem `faixa_vw` (degrau novo na leitura em degraus), no contrato **fixo** (não está no portal da VW) e quando nenhuma placa do recorte tem rótulo — para não virar uma fileira de "—".
- **O teste existe para pegar o rodapé desalinhado:** coluna condicional nova sem a célula vazia correspondente desloca os totais uma casa, e no olho isso passa. 14 checagens em 3 cenários no Chromium com o painel real, conferindo que o total do km cai sob "Km do mês" em cada combinação. Ele pegou um defeito de verdade: o travessão vazio estava sendo **escapado** e aparecia como `<span class="dash">` na tela — `esc()` vale para o valor, não para o `D`.
- SQL conferido num Postgres 16 de verdade (roda 3×, idempotente) com uma placa atravessando em agosto, uma fixa na faixa 1 e uma sem rótulo.
- **A SETA ▲/▼ ao lado da faixa** (Renan, 17/09/2026: *"se foi ▲ (verde) ou ▼ (vermelho) a troca de faixa"*) compara com a **última vez em que a VW cobrou a mesma placa**, não com o mês de calendário anterior: mês sem nota criaria uma seta do nada e o mês em prévia faria todo mundo "descer" no dia 1º. **Sem SQL novo** — o painel já carrega todas as vigências, então a conta é local (`fxNum`/`fxAnt`/`setaFx`).
- **A COR NÃO É DE CUSTO.** Verde = subiu de faixa = rodou mais que o usual, que é como ele descreveu a leitura. No **H6764M** o km da faixa 2 é 26% mais CARO e no **V1673W** é 29% mais BARATO — então ▲ verde ali quer dizer "rodou mais", nunca "gastou menos". Vale lembrar que isso **inverte a convenção do `tri()` do FCA** (▲ vermelho = estouro), e foi pedido assim de propósito.
- **A conferência olha a CLASSE, não o caractere:** testar só se o ▲ apareceu deixaria passar verde e vermelho trocados. O teste afirma `{"▲":"cg","▼":"cr"}`.
- **Medido no banco em 17/09/2026** (Carta Faixa Check): 1.906 placas com nota da VW, **1.906 com rótulo** — cobertura total. 19 placa-mês cobradas em duas faixas (jun 1 · jul 5 · ago 11 · set 2), 16 delas com km do mês ACIMA da média da própria placa, o que confirma a leitura dele. As **3 exceções** (`UDA8D53` 2.001 contra 2.509 de média, `UFQ6I87`, `UDW5I70`) mostram que a faixa **não depende só do km do mês** — quem está perto do limite atravessa mesmo rodando pouco. Mais um motivo para NÃO derivar o km de corte.

### Roda TODO DIA sozinho (Renan, 16/09/2026: "rodar todo dia melhor")

Cron `0 9 * * *` (06:00 BRT) no `volkstotal-robot.yml`, coletando **o mês corrente E o anterior**, em modo `gravar`.

- **Dois meses, não um:** a nota de um mês só fecha **no meio do mês seguinte** (o ciclo de leitura da VW termina em 14/02, 24/03, 15/08, 11/09…), então o mês corrente passa dias incompleto e a rodada do dia seguinte o completa sozinha pelo upsert. O mês anterior entra junto para a linha lançada em atraso não ficar de fora para sempre.
- **Mês que o portal não emitiu não gera linha**, e a Carta cai sozinha no cálculo por km — a precedência dela já é portal → planilha → cálculo, então o *"se não achar nada mantém o cálculo pelo km"* não precisou de código novo.
- **A ARMADILHA É A MESMA DO GINFO:** no `schedule` **não existe `inputs`**, então o `|| 'teste'` valeria e o robô rodaria todo dia **sem gravar**, log verde e zero linha. O agendado força `gravar` e a 1ª linha do log imprime modo + vigências resolvidas — é o que denuncia a regressão na hora.
- **O mês é calculado em BRT:** às 09:00 UTC do dia 1º o UTC já virou e o Brasil não (`01/10 00:30 UTC` = `30/09` aqui). A conta ancora no dia 01 antes de subtrair o mês, senão o dia 31 vira "31 de fevereiro". Testada na virada do ano e no dia 31.
- Ganhou o aviso de falha (`avisa-falha.sh`) e entrou na lista `CARGA` do Saude Robot — sem isso o painel de saúde classificaria como auditoria um robô que grava em produção.
- **Backfill de 2025 e de jan/2026** disparado em 16/09/2026 (`ano=2025` e `vig=2026-01`, os dois em `gravar`).

## Check de Metas — o deck da diretoria sai do portal (Renan, 18/09/2026)

Pedido dele: *"Vou te mandar como base o ppt que sempre gero para apresentação
da diretoria. Queria um botão de gerar PDF e Gerar PPT no administração para eu
gerar pronto. É tudo informação do painel."* Mandou o `2026_06 - Check de
Metas.pptx` (37 slides) e o roteiro: *"Começa trazendo Scorecard e resumo
executivo. Depois visão financeira acumulado ano e mês (sempre mês anterior pois
estamos falando de fechamento). Aí vai trazendo abertura de custos, km e R$/km,
dispersão etc. Quero nos custos a gente foque em pacotes, e se desviaram os
fcas… Aí divide nos pacotes pneus, manutenções e combustíveis trazendo unidades
que mais desviaram. Unidades que desviaram vem o FCA delas após isso. Em
combustíveis vem árvore e FCA. Se tiver mais de um prijeto, mais de uma
árvore."* E depois: *"pode fazer umas capas legais usando o tema Conlog"*.

**`/check-metas/`** (casca padrão, cluster Administração, só admin), com **Gerar
PDF** e **Gerar PPT** na lateral. Cada slide é um **print de um painel do
portal** — nada é remontado na tela nova, então o número do slide é o número que
o painel mostra.

- **NENHUM DOS 11 PAINÉIS FOI TOCADO.** O motor abre cada um num **iframe de
  mesma origem**, aplica a visão e os filtros daquele slide e fotografa. O
  contrato já existia e é o mesmo de todo painel do padrão: `setVw(v)` para a
  visão e, no filtro, `wrap._sel` + `wrap._render('')` + o redesenho do painel
  (`atualizar` na Visão Financeira, `run` no fca-consolidado, `onFilterChange` na
  Árvore). **Nenhum painel lê parâmetro de URL** — procurei `URLSearchParams` e
  `location.search` nos onze e não há —, então o iframe é o caminho.
- **`let` e `const` de topo NÃO ficam no `window`.** `win.allRows` é `undefined`
  mesmo com a variável declarada no topo do script do painel; quem enxerga as
  ligações léxicas globais é o `win.eval(...)` (eval indireto, roda no escopo
  global daquela janela). Por isso o `prep` de cada slide é uma **string
  avaliada dentro do iframe**, não uma função do lado de fora.
- **Filtro que não casa é ALARME, nunca um slide bonito e errado.** O
  `__cm.sel(id, alvos)` casa por **rótulo visível** ou por `data-v` (aceita
  alternativas separadas por `|`: `'jun/26|2026-06|JUN/26'`, porque cada painel
  escreve a vigência de um jeito) e, quando não acha, **não marca nada** e
  devolve o que faltou — o slide fica "atenção" em vermelho no Roteiro, com a
  mensagem. Slide com o filtro de outro mês é justamente o defeito que passa no
  olho de quem confere.
- **O painel está pronto quando o DOM PARA DE MUDAR.** São 11 painéis, cada um
  com o seu jeito de dizer "carreguei"; medir estabilidade (texto + nº de
  canvas/linhas, 3 leituras iguais) serve para todos. Painel que responde com
  `.gate` (login/admin) vira **falha com o motivo**, não slide em branco.
- **A captura usa o `H2CPrep` do próprio painel** (`assets/excel-export.js`) —
  o mesmo preparo do PNG e do PDF, que achata as camadas translúcidas e converte
  o `color-mix()`. Sem ele o vidro do layout sai com a cor errada. O
  `html2canvas` é injetado no iframe quando o painel ainda não o carregou.
- **As unidades dos slides de pacote NÃO são lista fixa: saem da tabela `fca`**
  (`origem='Custos'`), que é onde o fca-preenchimento grava o pacote que
  estourou vs remunerado. Para cada pacote (Pneus · Manutenções · Combustíveis)
  entram as unidades com desvio, **da maior para a menor** (o R$ sai do
  `fato_desvio`), até 8. Em Combustíveis cada linha é unidade **+ projeto**, e
  gera **dois** slides — o FCA e a Árvore daquele recorte —, que é o *"se tiver
  mais de um projeto, mais de uma árvore"*.
- **Fechamento = mês anterior**, sempre. Se ele ainda não tem FCA de custos, cai
  no mês mais recente que tem e **o subtítulo diz isso** em vez de fingir.
- **Capa e divisórias no tema Conlog**, desenhadas em **canvas** (não
  html2canvas): o caminhão de neon do `assets/img/fundo-conlog.jpg` com brilho
  levantado — a foto é uma estrada à noite e, sem isso, o neon some atrás do
  escurecedor —, escurecedor com **platô à esquerda** (o título fica sobre o baú,
  onde o logo da CONLOG está aceso) abrindo à direita para a cabine aparecer,
  filete laranja no rodapé. Divisória com a palavra no `#F6B26B`, o mesmo laranja
  das divisórias do PPT dele.
- **PDF e PPT saem do MESMO desenho**: 16:9 de 13,333 × 7,5 pol, a medida do PPT
  dele; capa e divisórias de página inteira; slide de painel com título +
  subtítulo e a imagem encaixada. **Duas imagens ficam EMPILHADAS**, como no
  arquivo dele (medido no XML: y 1.191.394 e 4.063.251 EMU), com o rótulo em
  laranja acima de cada uma ("Vs Remunerado" / "Vs Orçado").
- **Validação** (`scripts/check-metas-teste.mjs`, Chromium): **55 checagens em 6
  cenários**, com os 11 painéis **dublados** (o sandbox não alcança o Supabase) —
  o roteiro montado a partir da `fca`, cada slide saindo na visão e no filtro que
  o roteiro pediu, o filtro que não casa virando alarme, o painel que recusa
  virando falha (e o PDF saindo com os slides que deram certo, não com um em
  branco), as capas e o PPT. **O que o teste NÃO cobre são os dados** — isso só
  o deck de verdade mostra.
**A 1ª GERAÇÃO REAL ACHOU DOIS DEFEITOS — e os dois eram do tipo que o alarme existe para pegar (18/09/2026).** O Renan gerou o deck de ago/2026 (54 slides) e apareceram três avisos `⚠ Dispersão de Km: ms-vig: não achei "ago/26"`. A causa não era o dado: **cada painel escreve a vigência de um jeito**, e a minha lista de grafias só tinha três.

| painel | valor (`data-v`) | rótulo visível |
|---|---|---|
| visao-financeira · rs-por-km | `2026-08` | `AGO/26` |
| scorecard · resumo-executivo · painel-metas · fca-consolidado | `ago/26` | `ago/26` |
| **painel-km · seara-km** | `08/2026` | **`ago/2026`** (ano com 4 dígitos) |
| **arvore-combustivel** | `08/2026` | `08/2026` |

O helper `grafias(k)` passou a gerar as **cinco** formas (`2026-08 \| ago/26 \| AGO/26 \| ago/2026 \| 08/2026`). **O slide provavelmente saía certo por acaso** — sem casar, o `__cm.sel` não marca nada e o painel fica com o padrão dele, que costuma ser o último mês com dado —, e é exatamente por isso que o aviso importa: "saiu certo por acaso" e "saiu certo" não podem parecer a mesma coisa.

**O segundo defeito nem tinha chegado na tela ainda:** o filtro de projeto da **Árvore de Combustível lista só o PREFIXO do nível 3** (`ROTA`), enquanto o `fca-consolidado` usa o nível 3 inteiro (`ROTA - CGR`) — que é o que a tabela `fca` guarda. Os slides de Árvore vêm depois dos de Pneus no roteiro, então o Renan parou de gerar antes de chegar lá. Os dois painéis levam o recorte no formato de cada um.

**O teste agora fala os quatro dialetos.** Antes o dublê usava um formato só, então validava um mundo que não é o do portal — e por isso passou com 55 ok enquanto o defeito existia. Com os dialetos reais e o `ms-nv3` listando prefixos, são **59 checagens**.

- **Duas armadilhas foram do TESTE, não do motor** (as duas fingiam defeito):
  `[].slice.call(Set)` devolve `[]` (Set não é array-like), o que fez parecer que
  filtro nenhum era aplicado; e medir o escurecedor da capa comparando dois
  pedaços da imagem mede **o conteúdo da foto**, não o degradê — a régua virou o
  desvio-padrão da luminância, que é o que denuncia capa chapada.

## Catálogo de aplicação — o que pedir para cada modelo e placa (Renan, 17–18/09/2026)

Pedido: *"gere um catálogo… guia na hora de pedir… VW 17.190 2021, precisa saber qual óleo… a pesquisa pode criar um agente, robô, o que for, mas precisa ser ULTRA completa"* · *"quero que todas as placas e modelos vinculem a suas peças e itens"* · *"um painel novo chamado catálogo, já na visão nova… o usuário filtra uma peça, placa ou modelo de ativo e traz sugestões de como ele fará a observação da compra no nosso ERP. Pense que ele vai ter só um item genérico (óleo sintético), e precisa saber qual pedir"* · *"pode ter ano também no filtro"*. O `catalogo-pecas/` antigo (por TIPO, 4–16 itens por modelo, sem placa) fica como estava; o novo é **`/catalogo/`**, card **Catálogo** no cluster Operacional.

**Três camadas, e a placa NÃO mora no banco:** `cat_item` (a LISTA: item genérico + NCM, 1.191) · `cat_aplicacao` (a FICHA: item × modelo × faixa de ano → especificação, quantidade, intervalo, referência, status, fonte) · `cat_modelo` (o cadastro como está no Ginfo, com a nota de erro de cadastro). O painel lê as placas de `ginfo_snapshot['ativos']` + `ativos_manual` e casa placa → (marca | modelo, ano) → ficha; o ano da placa recorta a faixa da ficha (26.260 de 2022 é EGR sem Arla, 2023+ é SCR com Arla — mesmo modelo, consumível diferente). `cat_sinonimo` faz "Racor" achar "Filtro separador de água". `cat_placa` (exceções por placa) nasce vazia. SQL em `scripts/catalogo-supabase.sql` (colado no chat; leitura para logados, escrita admin).

- **O JSON do repositório é a FONTE; o banco é a cópia.** `docs/catalogo/aplicacoes.json` sai de `scripts/catalogo-consolida.mjs` (lê `docs/catalogo/pesquisa/raw/*.json`), `itens.json` de `scripts/catalogo-itens.mjs` (lê a planilha da Frota). O workflow **Catalogo Carga** (`scripts/catalogo-carga.mjs`, dispatch + push em `docs/catalogo/`) sobe tudo; o painel lê o banco primeiro e **cai para o JSON** se as tabelas não existirem ou vierem vazias (anon recebe `[]`, não 401) — o selo do subtítulo diz de onde veio. Assim o painel funcionou antes de o SQL rodar, e o Renan lê a pesquisa de casa pelo repositório (`docs/catalogo/README.md` explica cada arquivo).
- **A observação da compra é gerada, não digitada:** `Item: especificação · qtd un · troca: intervalo · ref. códigos · aplic.: MARCA MODELO ano · placa XXX · ⚠ inferido — conferir antes de comprar`, com botão Copiar. **O código de referência fica em coluna própria**, fora do texto principal — o item do Benner continua genérico (Política v1.2), a especificação vai na observação (Parecer: o que muda imposto separa item, o resto é observação).
- **A pesquisa foi feita por agentes só com WebSearch** — o proxy de egresso bloqueia WebFetch em TODOS os domínios (403), e a cota de buscas é **por sessão (200), compartilhada**: a 1ª rodada (6 agentes, 17/09) gastou quase tudo e a 2ª (5 agentes, 18/09) rodou com ~30–40 buscas cada. Resultado em 18/09 (com a frente VW/MAN): **1.494 fichas em 76 dos 90 modelos · 335 confirmadas · 595 inferidas · 526 não encontradas** · 828 dos 941 ativos com pelo menos uma ficha confirmada. `nao_encontrado` É informação: a visão **Lacunas** ordena por nº de ativos e diz onde achar (manual, plaqueta, concessionária). Os 14 modelos sem pesquisa nenhuma são sopradores, cavaletes, macacos e máquinas de limpeza sem modelo.
- **Status vale como está escrito:** `confirmado` = fabricante/manual/catálogo de aplicação com URL (ou ≥2 fontes independentes); `inferido` = família do motor ou fonte única de varejo; nunca promover. Onde duas fontes conflitam, as duas ficam na nota (volume do cárter do D0836: ~26 L MAN × 18,5 L blog; Master 8,0 × 8,9 L; Yale 50MX pneu; Heli CPD25 pneu).
- **Achados que mudam compra (todos no `docs/catalogo/modelos-notas.json`, que o painel mostra no card):** ARLA corta a frota VW ao meio (17.190/23.230/30.280 EGR sem Arla; 26.260 2023+, CRM, 30.320, 18.210 SCR com Arla); Accelo 1316 (228.3/228.5) e 1317 (228.51, DPF) têm o mesmo motor e óleos diferentes; Constellation 19.330 é Cummins ISL, não MAN; **filtro de ar do ISF 3.8 (65 ativos) é Tecfil ARS9847 = Mann C37480 = Fleetguard AF27840 — o PSC706 da 1ª rodada estava errado**; filtro de óleo do MAN D08 mudou em 2018 (07W115436C = Mann HU 8171 / Tecfil PEL2016; o A é até 2017) e o separador de água é outro no Euro 6 (Racor RES2003W); OM 926 LA = 29,3 L de cárter / 37 L de arrefecimento e OM 924 LA = 15,8 / 27 L (tabela MB); vela do Toyota 4Y é NGK BPR2ES (a W9EXR-U é do Mazda); Heli CPD38 é lítio 80 V com freio multidisco úmido (não existe lona nem DOT para comprar); "TOLEDO TM2500" é Paletrans (32 ativos na marca errada); "YALE 75VX" = GP075VX; "NILFISK SC600" e "VW 18.310" não existem; ATEGO 2425 é OM 906 LA e o ano 2018 não bate (VIN antes de comprar peça de motor).
- **Regras da Política/Parecer entram como ALERTA, não como correção** (`scripts/catalogo-itens.mjs`): óleo dito sintético em 2710.19 (base PAO/éster/PAG cai em 3403.19, 9,75%; Grupo III continua 2710.19.32 — conferir a base na NF-e, não o rótulo); filtro ar do motor 8421.31 ≠ óleo/combustível 8421.23 ≠ cabine 8421.39; fixador de nylon 3926.90; **porta de baú: 8708.29 (3,25%) sobre CAMINHÃO, 8716.90 no SEMIRREBOQUE, nunca 7610.10 (esquadria de edifício)**; unidade de medida fora do nome. Na lista de 1.191 ficaram **9 alertas** (6 óleos sintéticos em 2710, 3 peças de porta Roll-Up) para o Fiscal. Carrocerias: exceto empurrada, são baú de bebidas Ambev; frigoríficas Frigoking na Seara/Anhanguera (Renan, 18/09).
- **"Existem catálogos completos pagos?" — não, um só não existe** (`docs/catalogo/pesquisa/catalogos-de-mercado.json`, 49 catálogos): o único vendido como completo e com API é o **TecDoc** (TecAlliance; Catalogue Brasil Premium R$ 400/licença/ano com placa e chassi; Web Service e TecDoc Data por cotação), mas cobre aftermarket, a cobertura de pesados nacionais não foi confirmada e empilhadeira/implemento/frio ficam fora. O genuíno por chassi são os **EPCs das montadoras** via concessionária (WebParts MB, Impact Volvo, Multi Scania, ePER Iveco, Dialogys Renault, Hyster/Yale Parts Portal); exceção gratuita e direta: **Cummins QuickServe Online**. Mann, Tecfil, Fleetguard, Wega, Fras-le, Nakata, Sabó, Gates/Dayco, Moura/Heliar e os seletores de lubrificante (Shell LubeMatch, Ipiranga, Petronas) são gratuitos, por tela/app/PDF, nenhum com API ou CSV. Autodata/ALLDATA/Mitchell não cobrem caminhão brasileiro.
- **Validação:** `catalogo-ui.mjs` (Chromium, frota real de 940 ativos no formato do Ginfo + o JSON consolidado) em dois cenários — tabelas `cat_*` inexistentes (fallback) e banco respondendo — com 13 checagens cada: fonte no subtítulo, cobertura ordenada por ativos, filtro de modelo, o ARS9847 confirmado na linha do 13.180, a observação gerada com item/ref./aplicação, a placa entrando na observação, "racor" achando o separador por sinônimo, "(sem ano)" no filtro, 1.191 itens, lacunas e 941 placas.
- **Próximos passos:** rodar o SQL → Catalogo Carga; fechar as lacunas com os PDFs apontados nas notas (manuais VWCO/MB/Cummins, catálogo Mann pesada, PSI 2.4L doc 7610002, plaquetas de 35 paleteiras BYG/Alldeals); parte 2 da lista (serviços, unidade de medida, de-para do Ginfo).

### A LISTA ERA PEQUENA PORQUE NASCEU DO HISTÓRICO DE COMPRA (Renan, 18/09/2026: "Catálogo tem 1495 linhas? Está de sacanagem?")

Ele estava certo e o número diz por quê: **1.494 fichas = 172 itens × 76 modelos, média de 19,7 por modelo**. Vinte itens por caminhão é lista de revisão, não catálogo. E a causa não era a pesquisa ter sido curta: **a lista de 1.191 saiu do que o Benner COMPROU em 12 meses**, e peça coberta por garantia ou contrato nunca foi comprada — então nunca apareceu. A frota tem **14 famílias de motor** (MAN D08 4 e 6 cil, D26, Cummins ISF 3.8 e ISL, OM 924/926/460/651, Renault M9T, FPT F1A, NEF, Volvo D13C, Scania DC13) e a lista **não tinha um virabrequim**: só polia, retentor, sensor de rotação — e um "virabrequim de compressor de oficina". Serviços: **zero**, com 542 em uso no Benner.

A lista nova é montada da **ANATOMIA** do equipamento (sistema → conjunto → peça), com o contrato em `docs/catalogo/pesquisa/anatomia-spec.md` e uma frente por arquivo `docs/catalogo/pesquisa/raw/r3-*.json`: motor 521 · trem de força/freios/suspensão/direção 587 · cabine/elétrica/eletrônica 976 · implementos (baú Ambev, frigorífico Frigoking, semirreboque) 826 · equipamentos de armazém 782 · serviços + consumíveis 818 · lacunas 25. **4.484 itens após dedup — 4.015 peças + 469 serviços**, contra 1.191: **3,8×**.

**A RÉGUA DO CRUZAMENTO CUSTOU TRÊS TENTATIVAS, e as duas primeiras mediam a coisa errada** — vale lembrar porque é o tipo de erro que produz número bonito e falso:
1. **por FAMÍLIA**: deu "família Filtros sem destino" com a lista **cheia** de filtros, porque na lista a família se chama Motor/Injeção/Admissão. Media o meu mapeamento, não a cobertura.
2. **por 2 TOKENS do nome**: punia exatamente o que a lista faz de propósito — não carregar modelo nem medida no nome. "FILTRO DE AR MBB ATEGO 1719" ficava fora. Esse número **existe e é outro** (92,0% do uso), mas responde outra pergunta: "tem o item COM esse detalhe?".
3. **por TOKEN-CABEÇA, com grafia e stem**: a lista é de item **genérico**, então a pergunta certa é se o TIPO existe. Sem stem, `presilhas` não achava `presilha`; sem normalizar grafia, `parabrisa` não achava `para-brisa` (idem paralama, parachoque, desingripante, arrebite, nipel, hecile).

**Medido em 18/09/2026** (`scripts/catalogo-anatomia.mjs`, contra os 5.531 itens do Benner com uso ou estoque): **99,8% dos itens acham o tipo · 100,0% do uso em 12 meses coberto** · DE_PARA 4.964 de 4.985 destinos achando lugar. As **38 lacunas com uso** viraram 25 itens (`r3-lacunas.json`), cada um nascido de compra real: balão de suspensão do semirreboque (uso 43), pisante do estribo (34), hubodômetro (25), anteparo por metro (25), peneira antifurto do tanque, insert de tubo pneumático, cotovelo/redutora/adaptador/espigão, mangote, esfrega-mola, peito de pomba, óleo hidráulico ISO VG 32, governor da empilhadeira, kit de vedação do cilindro de elevação, letreiro adesivo. **NCM fica VAZIO nos 6 sem convicção**, em vez de chutado.

**Os 10 que ainda não acham são NOME do cadastro velho, não item faltando:** marca (`SHELL TELLUS S2 M 32`), abreviação (`KIT VED. CIL. ELEV.`), typo (`CONDENSADO` por condensador), embalagem (`BARRICA D'AGUA 25 LTS`). Isso é trabalho do de-para, não da lista — e é a diferença entre "a lista não cobre" e "o cadastro está sujo".

## Seara — VariavelDeFrete por placa: o km REMUNERADO vem de planilha mensal (Renan, 16/09/2026)

Pedido: *"Tenho essas planilhas… Quero poder imputar elas que nem na locação Vamos para trazer o km remunerado por placa da Seara. Por enquanto vou criar uma aba nova lá na Seara. Depois usamos o input delas para remunerado, e o km rodado do powershell para o realizado. Vamos fazer a parte 1"*.

- **Os arquivos:** `VariavelDeFrete_PorPlaca_<UNIDADE>_MM-AAAA.xlsx`, **um por mês** (ele mostrou 01→08/2026 de ANHANGUERA), aba **`Variavel de Frete`**. Colunas: `Placa · CT-e · KM · Diesel · Arla · Manutenção · Lubrificante · Pneu · Recapagem · Lavagem · Total`.
- **É o mesmo conteúdo do `ReaisPorKm` da Base Remunerado da Seara** (coluna O = diesel + arla + manutenção + pneu + recapagem + lubrificante + lavagem), agora **por placa e por mês**, com o **KM remunerado** na própria linha. O `Total` é a soma dos sete.
- **Parte 1 (esta):** tela de importação por ARRASTAR, nos moldes da `/conferencia-locacao/` — o tipo e a vigência saem do **NOME do arquivo**. **Parte 2 (depois):** o remunerado passa a sair daí e o realizado do km rodado do PowerShell.
- **A LIÇÃO DA LOCAÇÃO VALE EM DOBRO AQUI:** lá o mesmo bug apareceu **três vezes** — arquivo que o `recebeArquivos` não sabe rotear é lido, os cartões ficam verdes com as linhas contadas, nenhuma mensagem aparece e **o banco não muda**. Ao criar o tipo novo, **criar junto o ramo que grava**.
- Status em 16/09/2026: aguardando o Renan mandar os arquivos para o parser ser conferido contra o real, não contra a reconstrução do print.

## Robô Qlik (DRE → Custos) — EM ESPERA (03/08/2026)

**Status: PARQUEADO — decisão do Renan 03/08/2026.** O robô está 100% codificado (receita dos 5 passos abaixo), mas o Qlik Sense da Conlog **não é acessível pela internet**: `bi.conlogsa.com.br` público serve só o **GLPI** (chamados) — `/sense` dá 404 e a porta 4244 não responde de fora (split DNS: o Renan acessa pela rede interna/VPN). O GitHub Actions não alcança. Opções mapeadas: (1) TI publicar o Qlik externamente · (2) self-hosted runner na rede da Conlog · (3) script agendado no PC do Renan · (4) **ler direto do BANCO DE DADOS fonte do DRE — caminho que o Renan quer explorar no futuro**. Até lá: **aba Custos segue manual**. NÃO religar sem resolver a rede.

Substitui a aba **Custos** do Farol Semanal (única que ainda era manual, colada do DRE). Mesmo desenho do robô Ginfo: `scripts/qlik-robot.mjs` + `.github/workflows/qlik-robot.yml` (dispatch modo login/run) → grava em `ginfo_snapshot` (chave prevista: `custos-qlik`) → Farol/painéis leem de lá.

- **Servidor:** Qlik Sense Enterprise próprio da Conlog — `bi.conlogsa.com.br` (IP público 187.85.144.84; a porta 4244 aparece no gerenciador de senhas; auth com `qlikTicket` na URL). Login: conta de serviço formato `dominio\usuario` (Secrets `QLIK_USER`/`QLIK_PASS`; senha passou pelo chat em 03/08 → sugerir troca depois). `httpCredentials` no Playwright cobre NTLM; form de login coberto também.
- **Painel:** App **DRE Conlog I Oficial** → pasta **"ANALISE CONTAS FROTA - VIEW 2 - (FONTE DE DADOS RENAN)"** — URL `sense/app/2a9d3451-ce57-4a87-999d-df23c17c2a03/sheet/9b39dd9c-4c4b-48f7-817b-0d6b67c47e09`.
- **Receita (conforme o Renan mostra, em andamento):** a tabela só aparece após aplicar os filtros. Filtros no topo: ANO | MÊS | NÍVEL 1 | NÍVEL 2 | NÍVEL 3 | EMPRESA. Mecânica de seleção do Qlik: abrir o filterpane → clicar no valor → confirmar no **✓ verde**. Passo 1: **ANO** = ano do mês de referência. Passo 2: **MÊS** (valores "jan"…"dez" minúsculos) — **até o dia 10 = mês anterior, depois = mês atual**. Passo 3: **NÍVEL 1 = "1.3.1. OPERAÇÕES DEDICADAS AMBEV"** (texto truncado na tela → casar por "contém OPERAÇÕES DEDICADAS"). Passo 4: **Cód. Estrutura** — seleção múltipla pela **LUPA do cabeçalho da coluna** na tabela (digita o número, clica no valor exato, repete, ✓ verde): **ESTRUTURAS FROTA = 170, 171, 173, 174, 176, 177, 178, 180, 181, 183, 185, 186, 398, 572** (Nível 4; barra mostra "ESTRUTURA 14 de 366"; campo real do NÍVEL 1 = `desc_ope`). Passo 5 (export): **botão direito na tabela → "Exportar dados" → submenu (Voltar/como imagem/para PDF/dados) → "Exportar dados" de novo → caixinha "Exportação concluída" → clicar no hiperlink azul** ("Clique aqui para baixar seu arquivo de dados") → xlsx. Chave no Supabase: `custos-qlik`. Retry limpa TODAS as seleções antes (clique em valor já selecionado DES-seleciona no Qlik). A tabela tem as colunas: Cód. Estrutura | Unidade | … | NÍVEL 3 | CONTA GERENCIAL | MÊS | ANO | ORÇADO | REMUNERADO | REALIZADO. **Sem REMUNERADO no mês** → o LEITOR aplica a lógica de TENDÊNCIA da Carta de Custos (nota do Renan 03/08). _(Falta: qual visual exporta e por qual menu — aguardando print.)_
- Alvo: reproduzir as colunas da aba Custos (`Δ ORÇ. | Δ FCT | Vigência | ESTRUTURA | UNIDADE | NÍVEL 3 | CONTA GERENCIAL | MÊS | ANO | ORÇADO | REMUNERADO | REALIZADO`) — confirmar quais são fórmulas da planilha p/ recalcular na leitura.

## Seara — workbook único, 3 abas (regra vigente 12/08/2026)

Workbook `1Rlwc0MZiupQI38gSN8VyBq_zMADgX9R_ZbfygNP-OXE`, abas no rodapé: **Base Remunerado** (`gid=0`) · **Base CTEs** (`gid=1672208132`) · **Combustível** (`gid=1982300845`). Alimenta `/seara-km/` e os painéis de `/combustivel/seara/`.

| o quê | de onde |
|---|---|
| **KM realizado** | aba **Combustível** — E placa · F mês (texto) · G ano · H modelo · J tipo de veículo · **K km rodado**. É a raiz das linhas do painel. |
| **KM remunerado** | aba **Base CTEs** — **coluna J** (`QT_QUILOMETROS_VIAGEM`), contada **UMA VEZ por `CD_VIAGEM_TRANSPORTE` (col B)**. C = placa, D = data. |
| **R$/km remunerado** | aba **Base Remunerado** — **coluna O (`ReaisPorKm`)**, por **placa (D) + vigência (A)**. É o custo variável inteiro do km. |

**A DEDUPLICAÇÃO POR VIAGEM É OBRIGATÓRIA.** A mesma viagem gera vários CTEs (normal, complementar, descarga, pernoite, CPL) e **todos repetem o km da viagem na coluna J**. Medido em 12/08/2026: 65.773 linhas para 4.078 viagens; `sum(J)` linha a linha dá **12.962.995 km** contra **552.868 km** reais — infla **23×**. O gviz não faz count-distinct: puxar `select B, C, D, J` e deduplicar no cliente.

**A COLUNA Z (`KM Rodado`) NÃO EXISTE MAIS** — a aba foi reestruturada e `select sum(Z)` devolve erro do gviz. O painel lia essa coluna e passou a ler a J/viagem, que **reproduz o mesmo número** (78.946 km em 06/2026, idêntico ao que a Z dava). Nada de voltar para a Z.

**A ENXUGADA FOI DESFEITA (Renan, 14/08/2026):** a versão larga das abas foi restaurada — `KmPorLitro` e `PrecoDiesel` voltaram à Base Remunerado e os painéis de combustível da Seara voltaram a usá-los como benchmark (a variante "tudo por J+O" de 13/08 foi revertida). **Fluxo do fechamento do mês:** o Renan cola o mês novo primeiro na aba **Combustível**; Base Remunerado e Base CTEs chegam depois. Enquanto o mês não existe nelas, os painéis usam o **mês anterior da mesma placa** para as TAXAS (KmPorLitro, PrecoDiesel e o peso de viagens) — nos painéis de combustível a quantidade (km remunerado da J) NÃO cai no mês anterior, fica vazia até o mês ser colado. **EXCEÇÃO — /seara-km/ (Renan, 20/08/2026):** no Painel KM da Seara a QUANTIDADE também cai no mês anterior: vigência que ainda não tem NENHUM CTE usa o km remunerado da última vigência anterior de cada placa (senão o Δ vira o realizado inteiro e o impacto explode), com aviso no card Km Remunerado ("⚠ jul/26 sem Base CTEs — usando o mês anterior"); quando a aba for colada, o valor real substitui sozinho (`remDe`/`mesesCTE` + flag `remFb` nas linhas). As colunas da Base Remunerado são achadas pelo **nome do cabeçalho** (fallback nos índices largos 15/17), e a data da Base CTEs é detectada entre **D** (layout enxuto) e **E** (layout largo) pelo que parseia como data — os painéis aguentam os dois layouts.

**KM/L REMUNERADO NÃO DEPENDE DA BASE CTEs (Renan, 11/09/2026: "a aba Combustível tem os parâmetros de km/L, a Base Remunerado tem o rem km/L"):** o Km/L · Seara e o card Km/L da Árvore Seara ponderavam o `KmPorLitro` (Base Remunerado, col P) pelo **nº de viagens da Base CTEs** — e a Base CTEs chega **dois meses** depois da Combustível. Em ago/2026 a coluna P estava preenchida (50/50 placas, conferido pelo Seara Abas Inspect), mas com zero viagens todo mundo tinha peso zero e o painel mostrava "—" no remunerado, Δ e impacto, com o gráfico de impacto vazio. Agora o peso é o **km rodado da própria Combustível**: `Km/L rem = Σkm ÷ Σ(km ÷ KmPorLitro)` (litros que o remunerado previa para o km rodado — a mesma conta do impacto). O Km/L · Seara **não lê mais a Base CTEs**; a Árvore continua lendo, só para o km remunerado (quantidade). Comparador: workflow **Seara KmL Peso Check** (`scripts/seara-kml-peso-check.mjs`), viagens × km mês a mês — em 11/09/2026 deu ago/2026 = 3,76 km/L rem (45/46 placas), com o código novo lendo o Sheets ao vivo. **REGRA (Renan, 11/09/2026: "Base CTEs usarei apenas para a Dispersão de Km"):** a Base CTEs alimenta SÓ o km remunerado (Painel KM · Seara e o card Km Rodado da Árvore Seara, que é o mesmo número). Km/L, R$/L e qualquer benchmark de combustível saem da Combustível + Base Remunerado, nunca da CTEs. **Tela com "—" depois do deploy = HTML velho:** o botão "Atualizar dados" e o timer de 30 min só rebaixam os DADOS; o código só troca com F5 (o `build-check` cuida da navegação seguinte, não da aba que já estava aberta). Pendência: `rs-por-km`, `arvore-frota` e `visao-financeira-arvore` ainda mandam `select sum(Z)` para a Base CTEs — a coluna Z não existe mais (o gviz devolve erro) — e precisam passar a ler a J por viagem, como o `seara-km`.

**R$/km — coluna O, não a N nem a T.** A **O** é a soma dos sete componentes variáveis (diesel + arla + manutenção + pneu + recapagem + lubrificante + lavagem); a **N (`TotalReaisPorKm`)** inclui o custo fixo rateado, que se paga rodando ou parado e **não** entra no impacto de um km a mais; a **T** é só o diesel. Conferido: os seis componentes não-combustível batem entre Base CTEs e Base Remunerado em todas as vigências (< 0,2%). Cobertura em 01→06/2026: **100%** das placas do painel acham o seu R$/km.

**Placa — chave canônica só para cruzar as abas.** Formato antigo `LLLNNNN` vira Mercosul `LLLNLNN` trocando o 5º caractere pelo dígito→letra (0=A … 9=J); quem já é Mercosul fica igual. **Na tela aparece a placa como está na origem.** Hoje as três abas estão 100% em Mercosul — a conversão é para o dia em que uma emplacar antes da outra.

**Ferramentas de conferência** (Actions, porque o sandbox não alcança o `docs.google`): `seara-km-viagem` (km por viagem × coluna Z, formato das placas, cobertura) · `seara-rskm-decomp` (decompõe o R$/km componente a componente) · `seara-rskm-inspect` (cabeçalhos das abas e comparação placa a placa).

**Achado em aberto (12/08/2026):** em **06/2026** o preço do diesel troca de lugar entre as duas bases — o da Base Remunerado cai de ~2,00 para 1,665 e o da CTE sobe de ~1,70 para 2,010, cada um indo exatamente para o nível do outro. Não afeta o painel (usa a coluna O), mas tem cara de preenchimento invertido no mês. Pendente de conferência do Renan.

### O KM REMUNERADO SAIU DA BASE CTEs — agora é a aba `Remunerado` (Renan, 16/09/2026)

*"Km remunerado agora está aqui"* + *"troque o que tem hoje por esse"*. A aba **`Remunerado`** do workbook da Seara é colada das planilhas `VariavelDeFrete_PorPlaca` e traz o km **pronto por placa e mês**: `A vigência (texto MM/AAAA) · B placa · C CT-e · D KM · E→K os sete custos · L total`.

- **Conferido ANTES de trocar** (workflow **Seara Remunerado Inspect**, `scripts/seara-remunerado-inspect.mjs`): 361 linhas, jan→ago/2026, 43–48 placas/mês, todas em Mercosul. **jan→jun bate CASA A CASA** com o que a Base CTEs entregava — Δ **0,0%** nas seis vigências e **0 de 361 chaves** divergindo. **Jul e ago**, que a Base CTEs ainda não tinha, passam a ter 87.057 e 88.070 km em vez do remunerado emprestado do mês anterior.
- **Acabou a deduplicação por viagem.** A Base CTEs repetia o km em cada CTE da mesma viagem (o inspect mediu: 11.411.372 km linha a linha × 465.811 km por viagem, ~24×) e obrigava a contar uma vez por `CD_VIAGEM_TRANSPORTE`. A aba nova já vem somada.
- **Trocaram cinco painéis:** `seara-km` · `combustivel/seara/arvore` · `arvore-frota` · `rs-por-km` · `visao-financeira-arvore`. Os **três últimos estavam QUEBRADOS** mandando `select sum(Z)` para a Base CTEs — coluna que não existe mais —, então o km remunerado da Seara vinha **zerado neles, sem erro na tela**. A troca conserta isso de brinde.
- **A aba é lida pelo NOME (`sheet=Remunerado`), não por gid:** ela é nova e um gid decorado quebraria se alguém a recriasse.
- **A vigência é TEXTO "MM/AAAA"** — o `_vigDeData` do `seara-km` não conhecia esse formato e `new Date('07/2026')` dá inválido, o que faria **toda linha da aba virar vigência vazia e sumir**. O ramo novo entrou antes da troca.
- **A Base CTEs continua em uso para a CONTAGEM DE VIAGENS** (`frotaReal` no `arvore-frota` e na `visao-financeira-arvore`): a coluna `CT-e` da aba nova conta CTEs, não viagens — a mesma viagem gera vários.
- **A rede do "mês anterior" continua valendo**, só mudou a fonte: vigência que ainda não existe na aba faz cada placa usar o remunerado da última vigência anterior dela, com o aviso no card (`mesesRem`/`remFb`).
- Validação: **`scripts/seara-troca-check.mjs`** roda os cinco painéis no Chromium com o gviz dublado (fetch **e** JSONP) e confere que o número da aba é o que chega na tela — no `seara-km` saiu exatamente `2028 · 2010 · 2129 · 2724`, Σ 8.891, com `remFb` falso em todas. **Duas armadilhas do próprio teste:** o painel **redireciona para o hub** sem `sessionStorage.gem_hub` (sem isso nada roda e o teste passa vazio), e o `ChartDataLabels` vem de CDN — com o stub vazio o painel morre antes do `fetchData`.

### A entrada das planilhas: `/combustivel/seara/remunerado/` (16/09/2026)

*"Quero criar dentro do Hub da Seara uma forma de imputar as planilhas de remuneração"*. Card **Remuneração por placa** no hub da Seara, **só para admin**, com a tela de importação por arrastar — é a **parte 1**; na parte 2 os painéis passam a ler daqui em vez da aba do Sheets, com o realizado vindo do km do ERP.

- **O NOME DO ARQUIVO É O ROTEADOR:** `VariavelDeFrete_PorPlaca_<UNIDADE>_MM-AAAA`, de onde saem a unidade (de-para `ANHANGUERA→ANG`) e a vigência. Unidade fora do de-para grava com o nome cru e o cartão fica **âmbar** avisando — inventar um código seria gravar a unidade errada em silêncio.
- **A LIÇÃO DA LOCAÇÃO É O DESENHO DA TELA** (lá o mesmo bug apareceu três vezes): nome fora do padrão é **cartão vermelho** com o exemplo do nome certo e **nenhum upsert é tentado**; o cartão verde diz o que o **banco confirmou** (`.select('placa')` no upsert), não quantas linhas o arquivo tinha; e a tabela de baixo relê o banco depois de cada carga.
- **O cabeçalho NÃO é a 1ª linha** (o arquivo abre com títulos, como o relatório da VW) — acha-se a linha que tem "Placa", e as colunas saem do **rótulo**, nunca da posição. **O rodapé "Total" não é um veículo**: a régua é a **forma** da placa, senão ele entraria como um veículo cujo valor é a soma de todos e **dobraria o mês** (o mesmo fantasma do "Filtros aplicados" do Ginfo).
- **A mesma chave duas vezes no mesmo lote** faz o Postgres recusar o batch inteiro (`cannot affect row a second time`) — a carga deduplica antes de enviar. E **a leitura do resumo pagina de 1.000 em 1.000**: com ~45 placas/mês o teto do PostgREST estoura no 2º ano e a tabela mostraria menos km do que tem no banco, parecendo dado faltando.
- **`seara_remunerado`** (`scripts/seara-remunerado-supabase.sql`): chave `unidade × vigência × placa`, reexecutável, leitura para logados e escrita só `fca_is_admin()`. Subir o mesmo mês de novo **corrige**, não duplica. A `placa` é a chave Mercosul e a `placa_origem` é como veio no arquivo — guardar só uma obrigaria a escolher entre cruzar errado e mostrar errado.
- Validado no Chromium com o **SheetJS de verdade** e planilhas sintéticas no formato real, entrando pelo `<input type=file>`: 24 checagens em 6 cenários (bom, nome fora do padrão, aba sem KM, mesmo arquivo duas vezes, lote misto, usuário sem ser admin), mais o gate do card nos dois estados.

**ACHADO À PARTE, ANTERIOR À TROCA:** na **`visao-financeira-arvore`** a função **`gvizFetch` NÃO EXISTE** — é chamada em 4 lugares e não está definida no arquivo nem nos assets. O `arvCarregaFontes()` lança `ReferenceError` na primeira linha, o `catch` engole, e **a visão Árvore dela nunca carregou a Seara**. Não é regressão desta troca (o `sum(Z)` de antes nem chegava a ser enviado) e **não foi consertada por conta própria** — está reportada para o Renan decidir.

## Automação do Combustível — contextualização em andamento (13/08/2026)

O Renan quer automatizar o combustível **em partes**, ele contextualizando aba a aba (mesmo método do robô Ginfo). **Nada implementado — aguardar ele mandar fazer.**

**Parte 1 · Km/L (alimenta `/combustivel/eficiencia-kml/`).** A aba `Km/L` fica no workbook **`1ZZdvG_RK5cTBLdPl3TWCbNeqw-Y4fTYwWsQV4w-e__A`** (é o `KML_ID` que a Árvore de Combustível e o painel de Eficiência já leem; nome do arquivo: **Consumo**). Abas no rodapé: `Km/L · R$/L · De-Para · Base CO² · Base Remunerado Modelo`.

A aba `Km/L` já vem **consolidada** — uma linha por recorte, com três blocos de colunas:
- **R$/km** — Remunerado · Realizado · Δ
- **Km/L** — Remunerado Médio · Remunerado Modelo · Realizado · Δ
- **R$/L** — Remunerado · Realizado · Δ

Recorte das linhas: **Operação · Empresa · Projeto · Unidade**, mais uma coluna **`Ativo`** com **três** valores — `VERDADEIRO`, `FALSO` e **`Fora FT`** (não é booleano; não tratar como tal).

**O ponto do Renan:** *"tenho essa aba que vem de uma planilha complexa"* — ou seja, o que o painel lê hoje é o **produto final** de uma cadeia de cálculo que mora fora daqui. Automatizar o Km/L significa reproduzir essa cadeia (ou achar a fonte a montante), não só copiar a aba consolidada. Esperar o Renan abrir a planilha de origem antes de propor desenho.

## Próximas automações — Frota de Elite e RPM (anotado 04/08/2026, aguardando detalhes)

O Renan vai automatizar as bases **Frota de Elite** (programa-reconhecimento, hoje workbook `1DXmjzj2KRrTdQxmvXRclGxhBeDMwoIoLvORqbh3GG6M` via GerotBase) e **RPM** (Base RPM do Gerot que alimenta o fca-preenchimento). Ele estava decidindo por qual começar porque **um indicador de um aparece no outro** (sobreposição entre as duas bases). Ele vai explicar aba a aba, como fez no robô Ginfo — ir salvando o mapeamento aqui conforme ele mostrar. Nada implementado ainda.

## Roadmap

**Painéis ativos:** Visão Financeira, Painel KM, Árvore de Combustível, Financeiro Pessoal (acesso direto)

**A criar:**
- Eficiência Km/L (`/combustivel/eficiencia-kml/`)
- Preço R$/L (`/combustivel/preco-litro/`)
- Consumo CO² (`/combustivel/consumo-co2/`)
- Sub-hub Combustível (`/combustivel/`) — quando múltiplos painéis prontos
- R$/KM (`/rs-por-km/`)
- Ativação de Frota (`/eficiencia-ativacao/`)
- Disponibilidade (`/disponibilidade/`)
- Gerot, Auditorias, FCA
- Programa de Reconhecimento, Aderência ao FCA, Painel de Metas
- Sub-hubs para clusters com múltiplos painéis

---

## Condução Econômica (gamificação do motorista) — visão de longo prazo

Painel em `/combustivel/conducao-economica/` (dentro do hub Combustível). **Clone do Frota de Elite** (`programa-reconhecimento/`) — mesma estrutura (hero "Pontuação Total Média", ranking, gráfico de evolução, tabela de Regras de Pontuação), mas **por MOTORISTA** e com indicadores de **condução econômica** no lugar dos do Gerot. **Sem pódio** (removido). Card no hub Combustível fica **visível só para admin** por enquanto (checa `fca_profiles.is_admin`). Hoje é **protótipo com dados de exemplo** (`generateRawRows()`), lendo só 2026.

**Pilares atuais (peso):** Faixa Verde de RPM 25 · Marcha Lenta/idle 20 · Aceleração 15 · Velocidade 15 · Freio Motor & Banguela 10 · Câmbio 5. **FREADA BRUSCA NÃO PONTUA** (Renan, 26/08/2026): *"frenagem não entra em score de condução econômica"* — mede condução SEGURA, e segurança é a Fase 4. O robô continua GRAVANDO `frea_100km` no `ce_diario` (nas duas fontes), então o dado não se perde e não precisará ser recoletado quando a Fase 4 chegar; ele só não entra no score. Os pesos somam 90 e o score normaliza pela soma dos presentes, então a escala segue 0–100 (conferido: todos os pilares em 80 → 80, com ou sem os pilares que só a vFleets entrega). Score = média ponderada (0–100), redistribuindo o peso dos pilares ausentes. Freio Motor e Câmbio **só existem na vFleets** (Geotab não entrega → ficam ausentes). Cada célula mostra **pontos (grande) + resultado medido (pequeno)**, estilo termômetro. Pesos/indicadores só serão fechados **quando lermos a telemetria de verdade**.

**Duas telemetrias (cada motorista usa só UMA):**
- **Geotab MyGeotab** — JSON-RPC `POST /apiv1` (Authenticate → sessão 2 sem.; Get/GetFeed). **A credencial é o próprio login e senha do MyGeotab** (confirmado pelo time de tech em 26/08/2026, via Argus); **database = `ambev`** (default do robô). Coleta implementada em `geotabDia()`: **`Trip`** dá `distance` (km), `drivingDuration`, `idlingDuration` e `speedRange1/2/3Duration` — daí saem km, marcha lenta e velocidade; **`ExceptionEvent`** dá aceleração e freada bruscas, e por isso **se a regra estiver desligada na conta o pilar fica vazio sem erro nenhum** (a sonda lista as `Rule` da conta e avisa qual pilar ficou sem regra). Evento sem motorista é casado pelo `device` dentro da janela da viagem; viagem com `NoDriverId` é descartada. **RPM em faixa verde, freio motor e câmbio NÃO existem no Geotab** → ficam nulos e o painel redistribui o peso. Chave do motorista = CPF/CNH do cadastro (`licenseNumber`/`employeeNo`), o que permite casar a mesma pessoa com a vFleets; sem documento, `gt:<id>`.
**GEOTAB — ACESSO BLOQUEADO PELO CLEARANCE (26/08/2026, investigado a fundo):** a conta `renan.fortes@conlogsa.com.br` autentica no database `ambev` (servidor `ThisServer`, MyGeotab 11.139.534) e tem os **grupos de dados certos** — 19 grupos, incluindo `TRS_CONLOG` e as unidades (`UNI_EMP MACACU`, `UNI_EMP PIRAI`, `UNI_EMP CUIABA`, `UNI_AS CDD CUIABA`…), 43 grupos visíveis. Mesmo assim **toda consulta de dado volta VAZIA**: `Device` (inclusive filtrando grupo a grupo), `LogRecord`, `StatusData`, `FaultData`, `Trip`, `ExceptionEvent` e `DriverChange`, em três datas diferentes. **Sem erro nenhum** — o MyGeotab devolve lista vazia em vez de recusar, e é por isso que parecia "não tem dado". A causa é o **clearance `b2B23 — "Usuário Ambev"`**, que não libera leitura via API: grupo de dados diz QUAIS veículos, clearance diz O QUE a conta pode fazer. A prova definitiva: a conta lê **110 `Rule` e 193 `ReportTemplate`** — inclusive o `Speeding Violations` que ela recebe por e-mail diário —, ou seja, o clearance libera **objetos de CONFIGURAÇÃO** e bloqueia **objetos de DADOS**. Ler regra e template mas não ler veículo é a assinatura do problema. O caminho pelos relatórios não substitui a API: `Report` não responde a `Get` e o Geotab entrega relatório como arquivo por e-mail. Pedido aberto na Argus: clearance de leitura para `Device`/`Trip`/`ExceptionEvent`/`LogRecord`, de preferência num usuário de serviço só leitura. **Pendente confirmar se a operação usa identificação de motorista** (crachá/NFC/iButton): sem isso as viagens voltam com `NoDriverId` e só dá para medir por veículo, o que muda o desenho do painel.

**UNIDADES NO PROGRAMA (Renan, 06/09/2026: "por enquanto deixe só Piraí... ou uma opção de eu liberar unidades"):** `ce_app_regras.unidades text[]` (null/vazio = todas; começa com `{EMP PIRAI}`), seção 13 do `scripts/app-motorista.sql`. `ce_app_unidade_ativa(unidade)` é checada no login, no criar PIN, no autocadastro e na lista de unidades do autocadastro — motorista de unidade desligada vê "O DriverPro ainda não chegou na sua unidade". O admin liga/desliga pelos chips "Unidades no programa" da tela "Selecione o motorista" (`ce_app_unidades` / `ce_app_unidade_set`). **Só Piraí por enquanto** (Renan, 06/09/2026): as outras unidades têm mais Trimble e pouco Veltec/Geotab, então ficam fora até a telemetria cobrir todo mundo. **Top 15 fixo só corta em Piraí** (ago/2026: 59 acima de 1.000 km → 15; nas outras unidades todo mundo que passa de 1.000 km recebe, 3 delas com 1 elegível só). **CRITÉRIOS POR UNIDADE E GRUPO "PIRAÍ" (Renan, 06/09/2026: "Lata 5, Empurrada 15, olhados juntos como unidade Piraí; Lata elegibilidade 500 km")**, seção 14 do `scripts/app-motorista.sql`: tabela `ce_app_unidade_cfg(unidade, grupo, top_n, km_min, qlp)` — campo nulo cai na regra geral de `ce_app_regras` (e o `top_n`, na regra `top_pct% × qlp` mín. `top_min` se o QLP estiver informado). **Grupo = UM ranking e UM pódio** para todas as unidades do grupo; a cota (`top_n`) e o km mínimo continuam sendo os da unidade de cada motorista (`pos_uni` no `ce_app_dados`, `posicao_unidade` no JSON). Semente: `EMP PIRAI` (PIRAI, 15, 1.000 km) e `INS LATA PIRAI` (PIRAI, 5, 500 km). O admin edita tudo tocando no rótulo dentro do chip da unidade (`ce_app_unidade_cfg_set`). `ce_app_criterios()` é aberto (anon) e é de lá que o **painel** `/combustivel/conducao-economica/` lê km mínimo e cota por unidade (`critDe`), em vez das constantes `KM_MIN_ELEG`/`TOP_ELEG` de antes. O `ce_app_dados` devolve `unidade` = grupo (PIRAI) e `unidade_real`; `regras.top_n`/`km_min` já vêm resolvidos para a unidade. Custo de Piraí em ago/2026 com essa regra: R$ 3.860 (carteiras 2.481,87 + 828,27 + um pódio 550), teto R$ 4.550/mês. Cópia do app em **Montserrat** para comparação: `app-motorista-5/` (idêntica à 4, só a fonte; cache `driverpro-mont-v1`).

**O RANKING É ENTRE QUEM DISPUTA, NÃO ENTRE TODO MUNDO (bug real, Renan em 10/09/2026: "William está em 26º, mas dentre os elegíveis está em primeiro"):** o `row_number` do `ce_app_dados` corria sobre **todos** os motoristas com nota no mês, então 25 motoristas de pouco km empurravam para fora da cota quem tinha rodado. O William, com 1.180 km e a melhor nota entre os que bateram os 1.000 km, aparecia em **26º** e **não recebia nada** — nem a carteira nem o pódio. "Os 15 melhores" sempre quis dizer os 15 melhores **de quem compete** (é o que a conta de custo de Piraí já assumia: *59 acima de 1.000 km → 15*). Agora o `pos`/`pos_uni` só numera quem bate os mínimos da **própria** unidade (`ce_app_km_min(x.unidade)` por linha — Lata 500 km, Empurrada 1.000 km), e a posição contando todo mundo vai junto no JSON (`posicao_geral`, `posicao_unidade_geral`, `disputa`). **A mudança só ADICIONA gente** — tirar do ranking quem não compete nunca empurra ninguém para baixo —, então o custo sobe até o teto que já estava previsto e ninguém perde mês fechado. No app: o número grande é a posição na disputa e a geral vira o recado embaixo (`26º contando todo mundo`); quem ainda não disputa vê a geral com "entre quem disputa você ainda não entra", e no Ranking aparece depois dos que disputam, com "fora da disputa". Conferido num Postgres 16 de verdade com o caso montado (25 de 300 km na frente + William com 1.180): **1º na disputa · 26º no geral · elegível · R$ 156 + R$ 300 de pódio**; e o inverso (1º no geral, 300 km) sai **sem posição na disputa e sem carteira**.

**O NÚMERO GRANDE É O TOTAL; A BARRA É SÓ A CARTEIRA (Renan, 10/09/2026: "o total precisa aparecer em cima, mas deve ter a meta da carteira e embaixo o +300"):** o topo do DriverPro mostra **carteira + pódio** (R$ 455,40 para quem tem R$ 155,40 de carteira e R$ 300 de pódio), a **barra "Meta do mês" continua medindo só a carteira** contra os R$ 200 (somar o pódio ali daria 227%) e o prêmio vira uma **linha dentro do card da meta**, abaixo do filete: `Prêmio do pódio · 1º lugar — + R$ 300,00`. Junto veio o conserto de uma incoerência: na aba **Ganhos**, mês fechado sempre contou `carteira + pódio` e o **mês em andamento contava só a carteira** — o prêmio do mês corrente não aparecia como dinheiro em lugar nenhum. Validado com o Chromium do sandbox (`?demo=1`, dados do William injetados no `DEMO_DADOS`): topo R$ 455,40 · barra 78% · `R$ 155,40 / R$ 200,00` · linha do pódio visível.

**PESOS EM BASE 100 — 50 / 30 / 20 (Renan, 07/09/2026: "não deveria ser 100? eu também aumentaria o peso da faixa verde"):** faixa verde 50, motor ligado sem rodar 30, acelerações 20. Antes era 25/20/15 (soma 60, resto do desenho de seis pilares). Os pesos moram em QUATRO lugares e têm de bater: `PESOS` no `scripts/conducao-robot.mjs` (o score gravado em `ce_scores_mensais`; os modos `carteira`/`programa` usam o mesmo objeto), `ce_app_regras.peso_*` (o app calcula as perdas por pilar com eles), `PILAR[*].peso` no painel `/combustivel/conducao-economica/` e a demo do app. Mudou o peso → rodar **`recalc`** no ano (feito em 07/09/2026: 1.431 linhas). O painel ganhou a visão **Carteira em R$** (`renderCarteira`): a mesma conta do app — saldo × nota ÷ 100 para elegíveis pela regra da unidade (`critDe`), pódio para os 3 primeiros do grupo, somando as vigências do recorte.

**A CARTEIRA É UMA RAMPA A PARTIR DA NOTA 60 — R$ 5 POR PONTO (Renan, 14/09/2026: "já pode cortar para R$5/ponto").** Era `saldo × nota/100`, uma rampa que começa no ZERO: cada ponto valia R$ 2 e dirigir bem quase não se distinguia de dirigir mal no bolso — nota 55 levava R$ 135 dos R$ 200 (ele: *"deveriam ter mais amplitude"*). Agora paga da nota 60 até 100, e os R$ 200 se espalham pelos 40 pontos que sobram. Entre os dois motoristas dos prints a distância foi de R$ 39 para R$ 99,50. **O piso é um NÚMERO NO BANCO** (`ce_app_regras.piso_nota`, default 60) e a conta vive numa função só, **`ce_app_carteira(nota, saldo, piso)`** — antes a fórmula estava repetida em três lugares do mesmo arquivo. Mudar a régua é `update ce_app_regras set piso_nota = X`, não deploy; com 0 volta a regra antiga.

- **A ATRIBUIÇÃO POR PILAR TEVE DE SER REFEITA**, senão os três cards de "onde o dinheiro foi" param de somar o total: cada ponto que falta custa `saldo/(100−piso)` e não `saldo/100`, e **quando a nota fica ABAIXO do piso a soma estoura o saldo** (nota 50 com piso 60 "perderia" R$ 250 de R$ 200) — nesse caso as perdas são rateadas proporcionalmente. Conferido rodando `carteiraDe()` e `perdas()` **do próprio app** em seis casos (os dois motoristas reais, nota cheia, exatamente no piso, abaixo do piso, e com um pilar sem medição): carteira + os três cards fecham em R$ 200,00 nos seis.
- **A RÉGUA TEM DE ESTAR NA CARA DO MOTORISTA** (Renan: *"o fato de cada ponto valer R$ 5 deve estar claro para o motorista. Devem estar no app, na apresentação executiva e na apresentação para os motoristas"*): linha embaixo da barra da Meta do mês e passo 2 da aba Regras, **derivados** do saldo e do piso do banco — muda o piso, muda o texto sozinho. Nos dois decks o exemplo do Marcio estava na régua velha e viraria mentira: nota 89,5 dava R$ 179,00 e passa a dar R$ 147,50 (R$ 447,50 com o pódio de 1º). **Mudou a régua ⇒ refazer os dois PDFs** (`render.mjs`, que aceita `PW_CHROME` para achar o Chromium).
- **A conta mexe em QUATRO lugares, como os pesos:** `ce_app_carteira` no banco (as três montagens de `ce_app_dados` a chamam), `carteiraDe`/`perdas` no app (cópias 4 e 5), `renderCarteira` no painel e o texto dos decks. O `ce_app_criterios` expõe `piso_nota` para o painel.
- **Onde ela aperta:** no topo quase nada (nota 99,1 perde R$ 2,70), na faixa dos 90 uns R$ 25, e abaixo de 60 zera. Nota média de Piraí em 2026 = 69,2.
- **Ficou de fora, por decisão dele:** o mês de sombra. Não precisou — *"ninguém está vendo ainda, programa começará em outubro"*.
- **A elegibilidade NÃO mudou** (cota de 15/5 e km mínimo seguem). Ele quis decidir isso à parte. A conta que embasa: em ago/2026, com a cota, Piraí paga ~R$ 3,3 mil; pagando TODO MUNDO na régua de hoje seriam R$ 15 mil, e mesmo no piso 60 seriam R$ 7 mil. **Abrir o programa é a alavanca cara, não o R$ por ponto.**

**LITROS DA TELEMETRIA — visão "Consumo" (Renan, 07/09/2026: "você lê hoje o consumo também da telemetria? Legal ter também… mais uma visão"):** o Geotab entrega o combustível consumido em cada viagem (`FuelUsed`: `device`, `dateTime` = fim da viagem, `totalFuelUsed` em litros). O `geotabDia` baixa o `FuelUsed` junto com `Trip`/`ExceptionEvent`, casa cada registro com a viagem do mesmo veículo cuja janela o contém (folga de 1 min antes e 3 min depois do fim) e soma no motorista da viagem (ou no `semlogin:` da unidade) → coluna **`ce_diario.litros`**; o mensal soma os dias com leitura → **`ce_scores_mensais.litros`** (null = nenhum dia com FuelUsed). Falha no `FuelUsed` não derruba a coleta: os litros só ficam vazios e o log diz `FuelUsed FALHOU`. **Modo `litros`** do Conducao Robot (de/ate) preenche o histórico nas linhas que JÁ existem, sem tocar no RPM, e avisa (sem gravar) se a coluna ainda não existe no banco. O painel lê `litros` e ganhou a visão **Consumo**: KPIs (Km/L do recorte, litros, km com combustível e % do km, motoristas com litros), km/L por mês (mesmo desenho da Evolução Temporal) e tabela por motorista. **Km/L = Σ km ÷ Σ litros SÓ DAS VIAGENS COM LITROS (bug real, 07/09/2026: "médias irreais", 700 km/L):** o veículo reporta combustível só em parte das viagens; dividir o km do mês inteiro pelos litros de poucas viagens explode a conta. O robô guarda o km das viagens casadas em `bruto.kmLitros` (diário) e `ce_scores_mensais.km_litros` (mensal), e **descarta a viagem acima de 12 km/L** (leitura ruim, contada em `bruto.litRuim`). O painel usa `km_litros` como numerador e mês sem `km_litros` não entra. Resultado no ano: 2,21 km/L com 85% do km coberto. **São DUAS visões** (Renan, 07/09/2026: "um Km/L gerencial e um de ranking"): `Km/L Gerencial` (hero sem card + gráfico do ano com teto de altura — sozinho ele tomava a tela) e `Ranking Km/L` (motorista, modelo mais dirigido, unidade, projeto, km com combustível, litros, km/L). Modelo e projeto = placa mais rodada do mês (`ce_scores_mensais.placa`, do `bruto.placas` por dia) × base Ativos do Ginfo (`ginfo_snapshot['ativos']`, placa normalizada para Mercosul). Sem Login aparece na tabela (é combustível queimado de verdade). **O modo `litros` PULA o dia em que o FuelUsed falha** — senão grava vazio por cima do que a coleta diária trouxe (aconteceu em 06/09/2026).

**ACESSOS DO DRIVERPRO NO PAINEL (Renan, 07/09/2026: "uma visão de acessos, gerencial como o painel de Acessos, e um ranking por motorista"):** tabela `ce_app_log` (seção 15 do `scripts/app-motorista.sql`), um evento por linha — `senha` (gatilho no insert de `ce_app_acesso`), `login` (gatilho no insert de `ce_app_sessao`, só quando `chave` não é nula: admin não conta) e `abertura` (o app chama `ce_app_ping(p_token)` no `carrega()`; sessão de admin devolve ok:false e não grava). Leitura para `authenticated` (o painel lê com o login do hub). O painel `/combustivel/conducao-economica/` ganhou **Acessos** (hero total/logins/aberturas/motoristas/média-dia, cards com senha/hoje/7 dias, acessos por mês e calendário do mês — cópia do desenho do `/acessos/`) e **Ranking de Acessos** (motorista, unidade, senha criada em, último acesso, 7 dias, dias com acesso, acessos). Filtros do topo valem: vigência = mês do acesso, unidade e motorista via `ce_motoristas`; Elegível não se aplica. `teste:` e `semlogin:` ficam fora. O histórico anterior à tabela foi importado de `ce_app_acesso` (senha, último acesso) e `ce_app_sessao` (sessões vivas) — logins de sessões já apagadas não existem mais.

**NOMES DOS PILARES NO DRIVERPRO (Renan, 05/09/2026):** *Uso da faixa verde (até 1.700 RPM)* · *Motor ligado sem rodar* · *Acelerações bruscas*. A faixa medida pelo robô continua 1.100–1.700 rpm (o Renan pediu "até 1.500" no nome, eu perguntei, ele manteve 1.700 e corrigiu o nome). Cada card explica a nota traduzindo-a de volta na medida, com a MESMA régua do robô (`REGUA` no app = `REGUA` no conducao-robot.mjs: rpm direto, idle zera em 25%, acel zera em 3/100 km) — se a régua do robô mudar, mudar no app também. **Domínio próprio:** o app vai para um subdomínio só dele (**`driverpro.onespot.com.br`**, DNS no Registro.br), servido do repositório separado `fortesindicadores-byte/driverpro` (criado e populado por mim em 06/09/2026 via `add_repo`, com `CNAME` commitado na raiz), que espelha `app-motorista-4/` **a cada 5 min** pelo workflow **DriverPro Site Sync** (cópia em `scripts/driverpro-site-sync.yml`; o `--exclude CNAME` preserva o domínio). **Ao publicar no app, disparar o Run workflow na hora** — o cron é só a rede de segurança; esperar o ciclo é deixar o motorista com a versão velha à toa.

**O APP SE ATUALIZA SOZINHO — e antes NÃO se atualizava (bug real, 11/09/2026).** O Renan viu a correção publicada e o celular continuou na tela velha; a saída era "feche o app duas vezes", que não é instrução que se dê a motorista. Eram três camadas, e a pior é a primeira: o service worker dizia **rede primeiro**, mas `fetch(e.request)` **passa pelo cache HTTP do navegador**, e o GitHub Pages manda `max-age` nas páginas — ele ia à "rede", recebia o HTML velho e não sabia. Hoje navegação e HTML/JSON vão com `cache:'no-store'` (imagem e ícone seguem no caminho normal); o registro usa `updateViaCache:'none'`, senão o **próprio** `sw.js` fica em cache e a versão nova nem é descoberta; e o app chama `reg.update()` ao abrir e ao voltar para a tela, recarregando **uma** vez no `controllerchange`. Vale nas três cópias (`app-motorista`, `-4`, `-5`). Conferido no Chromium com um servidor mandando `max-age=600` como o Pages: publica-se uma alteração e abre-se o app UMA vez — **antes** a 2ª abertura vinha antiga e nada recarregava; **agora** vem nova e recarrega sozinha. Rodar os dois lados do teste, senão o teste não prova nada. Falta só o Renan ligar Settings → Pages → Source main / root. O GitHub Pages aceita um domínio por repositório e o portal fica no github.io. Apresentações do programa (executiva e para os motoristas) em `docs/driverpro-apresentacao/` (HTML → PDF pelo `render.mjs`). **O link do deck abre o APP, não o navegador (Renan, 07/09/2026):** o manifesto registra o protocolo `web+driverpro` (`protocol_handlers`) e `launch_handler: focus-existing`; o botão do slide do app aponta para `web+driverpro://abrir`, que chama o app instalado (Chrome pede permissão uma vez). Exige o DriverPro instalado no computador da apresentação (Chrome → Instalar). O link https fica no rodapé como reserva. **Deck executivo (08/09/2026, versão que o Renan manteve):** os PDFs chamam **`Programa_DriverPro.pdf`** e **`Programa_DriverPro__Motoristas.pdf`** (nomes dele — não renomear). O executivo é a versão de 13 slides + o slide 14 do produto (a reescrita curta "uma linha por caixa" foi descartada). Fases do slide 13: 4 · Demais unidades **1H27** · 5 · **Validação do produto jun/27** (Condução segura saiu) · 6 · Ambev e RV **2H27**, com a **proposta à Ambev em ago/27**. Forma de pagamento sugerida = prêmio por desempenho em cartão de premiação pré-pago, fora do salário (CLT art. 457 §4º), a validar com jurídico/RH; a alternativa é crédito em folha como prêmio. Tem de ficar claro que a ideia é virar produto.

**O CPF DO MOTORISTA NO GEOTAB É O CAMPO `name` (Renan: "Impossível não ter isso", 05/09/2026):** o login do motorista no MyGeotab é o próprio CPF — 1.310 de 1.313 cadastros têm CPF válido ali (`licenseNumber`/`employeeNo` estão vazios em todos). O modo **`cpf`** do Conducao Robot varre o cadastro inteiro e preenche `ce_motoristas.cpf` onde está vazio (nunca sobrescreve); o `run` diário faz o mesmo para quem entrou depois (`gtPreencheCpf`). **A chave continua `gt:<id>`** — diário e mensal estão amarrados nela; o CPF serve só para o login do DriverPro (`ce_app_login`/`ce_app_criar_pin` acham a chave pelo CPF). Só CPF com dígitos verificadores certos conta (`cpfValido`), porque CNH também tem 11 dígitos. O CPF de teste `00000000191` mora no motorista sintético **`teste:driverpro`** (o DriverPro Check cria/mantém a linha com a service key; sem nota mensal, não entra em ranking) — nunca mais prender o CPF de teste a um motorista real (o `gt:b396` ficou um dia sem entrar por isso).

- **vFleets / PS Latam "Condução Detalhada – DaaS"** — `GET https://api.vfleets.com.br/integrationcore-conducao/conducoes/detalhada?dia=YYYY-MM-DD`, token no header `Authorization`; **1 req/5 min**; agregado diário por motorista/veículo (CPF/CNH), muitos campos prontos (RPM em faixas, motorOcioso, aceleracoes, frenagens, velocidade em faixas, freioMotor, banguela, batendoTransmissao…). Endpoint `/processamentos` avisa dias reprocessados.

**Arquitetura combinada:** HTML público não pode ter segredo → **coletor** roda em **GitHub Actions (cron diário)** ou **Supabase Edge Function**, grava normalizado no **Supabase**; o painel troca `generateRawRows()` por leitura da tabela. De-para motorista ↔ unidade ↔ fonte (casar CPF/CNH do vFleets com Driver do Geotab).

**MANUAL DaaS v1.8 LIDO (25/08/2026) — a API NÃO entrega percentual nenhum.** Ela entrega **contadores e tempos em segundos** por *registro de condução* (um registro por identificação de motorista; o mesmo motorista tem VÁRIOS no dia). Todo pilar do painel é derivado no coletor (`scripts/conducao-robot.mjs`, mapa `CAMPOS` + `derivaVF`), somando os contadores do dia **antes** de dividir — média de médias daria o mesmo peso a um trecho de 5 min e a um turno inteiro. Derivações:

| Pilar | Conta |
|---|---|
| Faixa Verde de RPM | `(rpmVerdeEconomicaTempo+rpmVerdePotenciaTempo) ÷ (rpmAbaixoVerde+rpmVerdeEconomica+rpmVerdePotencia+rpmAmarelo+rpmVermelho)` — **marcha lenta fica FORA do denominador**, porque ela é o pilar seguinte |
| Marcha Lenta | `motorOciosoTempo ÷ tempoDirecao` (sem `motorOcioso`, cai em `rpmMarchaLentaTempo`) |
| Aceleração | `aceleracoesQtd` por 100 km (a `frenagensQtd` é coletada e gravada, mas NÃO pontua) |
| Velocidade | `(via1 + 2×via2 + 3×via3) ÷ tempoMovimento` — faixa 1 = até 20% acima, 2 = 20–30%, 3 = >30%. Usa `velocidadeViaFaixa*` (limite **da via**); `velocidadeFaixa*` (limite configurado) é o fallback |
| Freio Motor & Banguela | `freioMotorTempo ÷ tempoMovimento`, **menos** `banguelaTempo ÷ tempoMovimento` (desconto 1:1, a calibrar) |
| Câmbio | `batendoTransmissaoTempo ÷ tempoMovimento` |

Outras regras do manual que viram código: **`kmCalculado=true` é obrigatório na chamada** — sem ele o registro "sem motorista" do dia repete km e a soma infla (seção *KM Inicial/Final e diferença entre KMs diários*); km vem em **metros**, como `kmInicial`/`kmFinal`. **`inicio`/`fim` nulos = período SEM motorista identificado** → a linha é descartada (não é de ninguém). **1 requisição a cada 5 minutos por token**, senão 429 — o `run` pausa 305 s entre dias (um mês ≈ 2h30, por isso `timeout-minutes: 350` no workflow). `GET /processamentos?inicio=&fim=` lista `{diaConducao, diaReprocessamento, veiculoId, veiculoUoId}` filtrando pela **data do reprocessamento** → modo `reproc` recoleta só os dias que mudaram. Chave do motorista = `cpf` → `cnh` → `documentoIdentificador`; a `uo` do motorista vem no JSON mas o **de-para UO → unidade do portal é do Renan** — o robô não inventa unidade, só lista as UOs vistas no fim do log.

**Roteiro em fases (definido pelo usuário):**
1. **Fase 1** — este painel de BI (ranking/score de condução econômica). ← em andamento
2. **Fase 2** — app do motorista: ele se cadastra e acompanha como está.
3. **Fase 3** — gamificação com dinheiro envolvido; app focado no motorista ver **quanto está deixando de ganhar**.
4. **Fase 4** — unir **condução segura + econômica** (aí entram os pilares de segurança: cinto, celular, colisão, fadiga…).
5. **Fase 5** — propor à **Ambev** usar o app e gamificar o **Brasil todo**, com piloto por **Geo**.
