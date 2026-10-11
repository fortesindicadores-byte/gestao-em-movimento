# Padrão visual "casca nova" — guia para aplicar em outra aplicação

Extraído do código em 11/10/2026. A referência viva é `visao-financeira/index.html` do Gestão em Movimento. Quando este guia e o código discordarem, vale o código.

Tudo aqui é HTML, CSS e JavaScript puros, sem framework e sem etapa de build. Os gráficos usam Chart.js 4.4.0.

---

## 1. O que define o padrão

- **App de vidro flutuando sobre um fundo liso.** A página é um tom uniforme e escuro. O app é uma moldura com cantos arredondados, sombra forte e camadas translúcidas com desfoque.
- **A página não rola no desktop.** O app ocupa a tela e cada área resolve o próprio espaço com flex. Se não coube, encolhe fonte e espaçamento ou divide em mais visões.
- **Lateral com as visões, topo com título e filtros, miolo com uma visão por vez.**
- **Dois temas.** O escuro é o padrão. O claro é a classe `body.claro`.
- **Laranja `#F97316` só como destaque:** contagem de filtro, avatar, item ativo no celular, título do tooltip. Verde e vermelho só para resultado bom e ruim.
- **Hierarquia por tamanho e peso**, não por cinza muito apagado.

---

## 2. Tokens

Os valores são translúcidos de propósito. O vidro nasce do empilhamento: fundo, depois a camada do `.app`, depois lateral e cards com desfoque próprio. Trocar por hex chapado mata o efeito.

```css
:root{                                   /* tema escuro (padrão) */
  --fundo:
    radial-gradient(80% 60% at 90% 0%, rgba(255,244,232,.035) 0%, transparent 60%),
    linear-gradient(45deg, #121214 0%, #121214 100%);   /* UNIFORME, nunca degradê */
  --luz:      inset 0 1px 0 rgba(255,255,255,.09);      /* filete de luz da moldura */
  --luz-card: inset 0 1px 0 rgba(255,255,255,.08);      /* filete de luz dos cards */
  --app:      rgba(150,185,255,.045);   /* a camada do app CLAREIA a página */
  --side:     rgba(30,30,30,.50);       /* lateral E cards usam o mesmo tom */
  --linha:    rgba(255,255,255,.06);    /* divisórias */
  --card:     rgba(44,44,46,.78);
  --brilho:   linear-gradient(180deg, rgba(255,255,255,.022) 0%, rgba(255,255,255,0) 46%);
  --card-brd: rgba(255,255,255,.07);    /* borda de card */
  --txt:      #EEF2FA;                  /* texto principal */
  --txt2:     #C9D0DD;                  /* texto secundário */
  --txt3:     #A9B1C0;                  /* rótulos, subtítulos */
  --txt4:     #7D8596;                  /* o mais apagado */
  --hover:    rgba(255,255,255,.06);
  --azul:     #2E90E8;
  --verde:    #3BB33B;
  --vermelho: #FF5252;
  --laranja:  #F97316;
  --ambar:    #F4A100;
  --cinza:    #5B657C;
  --cabec:    #2B2B30;                  /* cabeçalho de tabela e linhas de total */
  --pop:      #26262B;                  /* menus suspensos: OPACOS */
}
body.claro{                              /* tema claro */
  --fundo:
    radial-gradient(80% 60% at 90% 0%, rgba(255,255,255,.35) 0%, transparent 60%),
    linear-gradient(45deg, #E1E2E5 0%, #E1E2E5 100%);
  --luz:      inset 0 1px 0 rgba(255,255,255,.9);
  --luz-card: inset 0 1px 0 rgba(255,255,255,1);
  --app:      rgba(255,255,255,.20);
  --side:     rgba(255,255,255,.50);
  --linha:    rgba(15,23,42,.10);
  --card:     rgba(255,255,255,.74);
  --brilho:   linear-gradient(180deg, rgba(255,255,255,.6) 0%, rgba(255,255,255,0) 46%);
  --card-brd: rgba(15,23,42,.10);
  --txt:      #161D2B;
  --txt2:     #4A5568;
  --txt3:     #737D91;
  --txt4:     #8B94A6;
  --hover:    rgba(15,23,42,.05);
  --azul:     #1B6FC4;
  --verde:    #00B300;                  /* fortes no claro: o pastel some no branco */
  --vermelho: #FF0000;
  --ambar:    #E9A400;
  --cinza:    #939CAF;
  --cabec:    #DCDFE6;
  --pop:      #FFFFFF;
}
```

Regras dos tokens:

- **A página é mais escura que o app.** É essa diferença que faz o app flutuar. Ao mexer em `--fundo` ou `--app`, medir o pixel da página e o pixel do miolo nos dois temas.
- **O fundo é uniforme.** Um degradê diagonal clareia um canto e os cards daquele lado somem.
- **Cards usam `--side`**, o mesmo tom da lateral. Não mexer em `--side` para ganhar contraste.
- **Menus suspensos usam `--pop`**, opaco. Com fundo translúcido dá para ler o card de baixo através do menu.

**Tipografia:** Montserrat 400 a 800, pelo Google Fonts. Corpo em 13px.

```html
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

| Elemento | Tamanho | Peso |
|---|---|---|
| Título do topo | 21px | 600 |
| Subtítulo do topo | 11px | 600 |
| Número do hero | clamp(26px, 3.6vh, 40px) | 800 |
| Valor do card de KPI | 25px | 800 |
| Rótulo do card de KPI | 9.5px, caixa alta | 700 |
| Título do card de gráfico | 12px | 800 |
| Título de tabela | 14px | 800 |
| Cabeçalho de coluna | 9.5px, caixa alta | 700 |
| Dados da tabela | 11px | 400 a 600 |
| Item da lateral | 12.5px | 500, ativo 600 |
| Seção da lateral | 10px, caixa alta | 600 |

---

## 3. Base, moldura e textura

```css
*{margin:0;padding:0;box-sizing:border-box;}

/* barra de rolagem discreta, só para áreas internas */
@supports not selector(::-webkit-scrollbar){
  *{scrollbar-width:thin;scrollbar-color:color-mix(in srgb,var(--txt3) 42%,transparent) transparent;}
}
::-webkit-scrollbar{width:11px;height:11px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:color-mix(in srgb,var(--txt3) 42%,transparent);
  border:3px solid transparent;background-clip:content-box;border-radius:9px;}
::-webkit-scrollbar-thumb:hover{background:color-mix(in srgb,var(--txt3) 72%,transparent);background-clip:content-box;}
::-webkit-scrollbar-corner{background:transparent;}
::-webkit-scrollbar-button{display:none;width:0;height:0;}

/* textura de grão por cima do fundo */
body::after{content:'';position:fixed;inset:0;z-index:0;pointer-events:none;opacity:.5;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='.05'/%3E%3C/svg%3E");}

html,body{height:100%;overflow:hidden;}          /* a página NÃO rola */
body{font-family:'Montserrat',-apple-system,BlinkMacSystemFont,sans-serif;font-size:13px;
  color:var(--txt);background:var(--fundo);overflow:hidden;}

/* a moldura do app */
.app{position:absolute;inset:16px;display:flex;border-radius:10px;overflow:hidden;z-index:1;
  border:1px solid rgba(255,255,255,.10);box-shadow:0 28px 70px rgba(0,0,0,.55), var(--luz);}
.app::before{content:'';position:absolute;inset:0;background:var(--app);z-index:0;}
.side,.board{position:relative;z-index:1;}
```

A sombra forte da moldura vale nos dois temas. Não suavizar no claro.

---

## 4. Estrutura da página

```
body
└── .app                         moldura de vidro
    ├── aside.side               lateral
    │   ├── .s-top               ícone + nome do painel + botão recolher
    │   ├── .s-sec "Visões"      + button.s-item[data-vw] (um por visão)
    │   ├── .s-sec "Atalhos"     + exportar, atualizar dados
    │   ├── .s-volta             "Voltar ao Hub", sempre no rodapé
    │   └── .s-user              avatar + nome + subtítulo
    └── main.board
        ├── .top                 título + subtítulo à esquerda, filtros e tema à direita
        └── .cols
            └── section.vw#vw-<chave>   uma por visão; só a .on aparece
```

**A primeira visão de todo painel chama-se "Resumo Gerencial".** Os nomes de visão são curtos, em português e sem jargão.

---

## 5. Lateral

```css
.side{width:264px;flex:0 0 264px;display:flex;flex-direction:column;
  background:var(--side);border-right:1px solid var(--linha);padding:16px 10px 12px;
  backdrop-filter:blur(13px);-webkit-backdrop-filter:blur(13px);
  box-shadow:var(--luz), 8px 0 28px rgba(0,0,0,.25);overflow:auto;}
.s-top{display:flex;align-items:center;gap:9px;padding:2px 8px 14px;}
.s-top b{flex:1;font-size:13.5px;font-weight:600;}
.s-mini{display:flex;align-items:center;justify-content:center;width:24px;height:24px;flex:0 0 24px;
  background:transparent;border:0;border-radius:6px;color:var(--txt3);cursor:pointer;}
.s-mini:hover{background:var(--hover);color:var(--txt);}

/* recolhida: só ícones */
.side.mini{width:64px;flex:0 0 64px;padding:16px 8px 12px;}
.side.mini .s-top{justify-content:center;padding-bottom:12px;}
.side.mini .s-top b,.side.mini .s-top>svg{display:none;}
.side.mini .s-sec,.side.mini .s-item .n,.side.mini .s-user div{display:none;}
.side.mini .s-item{font-size:0;justify-content:center;padding:9px 0;gap:0;}
.side.mini .s-user{flex-wrap:wrap;gap:6px;justify-content:center;padding:12px 0 2px;}

.s-sec{display:flex;align-items:center;gap:6px;padding:14px 8px 8px;
  font-size:10px;font-weight:600;color:var(--txt3);text-transform:uppercase;letter-spacing:1.1px;}
.s-item{display:flex;align-items:center;gap:9px;width:100%;padding:7px 8px;border:0;border-radius:7px;
  background:transparent;color:var(--txt2);font-family:inherit;font-size:12.5px;font-weight:500;text-align:left;cursor:pointer;}
.s-item:hover{background:var(--hover);color:var(--txt);}
.s-item.on{background:var(--hover);color:var(--txt);font-weight:600;}
.s-item .n{margin-left:auto;font-size:11px;color:var(--txt3);font-weight:600;}   /* contagem à direita */

/* rodapé: "Voltar" colado no usuário */
.s-volta{margin-top:auto;padding-top:8px;display:flex;flex-direction:column;gap:2px;}
.s-volta+.s-user{margin-top:6px;}   /* senão as duas margens automáticas dividem a sobra */
.s-user{margin-top:auto;display:flex;align-items:center;gap:9px;padding:12px 8px 2px;border-top:1px solid var(--linha);}
.s-user div{flex:1;min-width:0;}
.s-user b{display:block;font-size:12px;font-weight:600;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.s-user i{display:block;font-size:9.5px;font-style:normal;color:var(--txt3);text-transform:uppercase;letter-spacing:.8px;margin-top:2px;}
.s-user .av{flex:0 0 24px;}          /* sem esta regra o avatar vira elipse */
.av{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-size:9px;font-weight:800;letter-spacing:.2px;color:#2A1405;background:#F97316;flex:0 0 24px;
  box-shadow:0 1px 4px rgba(0,0,0,.25);}

/* dica quando recolhida: mora no body, posicionada por JS */
.dica{position:fixed;z-index:9000;transform:translateY(-50%);pointer-events:none;opacity:0;
  background:var(--pop);color:var(--txt);border:1px solid var(--card-brd);border-radius:7px;
  padding:5px 9px;font-size:11.5px;font-weight:600;white-space:nowrap;
  box-shadow:0 8px 22px rgba(0,0,0,.45);transition:opacity .12s;}
.dica.on{opacity:1;}
```

Cada item leva um ícone SVG de 14px com `stroke="currentColor"`, que herda a cor do texto. Ícone do topo da lateral com 17px em laranja.

**"Voltar ao Hub" sempre no rodapé**, em todas as telas. Tela sem lateral põe o mesmo botão num rodapé à esquerda.

---

## 6. Topo e filtros

```css
.board{flex:1;min-width:0;display:flex;flex-direction:column;}
.top{display:flex;align-items:center;gap:6px;padding:12px 24px 10px;flex-wrap:wrap;}
.tit-wrap{flex:1;min-width:0;}
.top h1{font-size:21px;font-weight:600;letter-spacing:-.3px;}
.tit-sub{font-size:11px;color:var(--txt3);font-weight:600;margin-top:2px;letter-spacing:.2px;}
.tool{display:flex;align-items:center;gap:7px;background:transparent;border:0;border-radius:7px;
  padding:6px 10px;color:var(--txt2);font-family:inherit;font-size:12.5px;font-weight:500;cursor:pointer;}
.tool:hover{background:var(--hover);color:var(--txt);}
.tool.ico{padding:7px 9px;}
.filtros{display:flex;align-items:center;gap:4px;min-width:0;}
```

O subtítulo `.tit-sub` recebe o status da carga, por exemplo `JUL/26 · atualizado 10/10 08:52`. Não usar selo separado para isso.

### 6.1 Filtro multi-select

Cada filtro é um botão-texto fantasma que abre um painel opaco com busca, "Todos", caixas de seleção e o atalho "only".

```css
.ms-wrap{position:relative;}
.ms-btn{display:flex;align-items:center;gap:7px;background:transparent;border:0;border-radius:7px;
  padding:6px 10px;color:var(--txt2);font-family:inherit;font-size:12.5px;font-weight:500;cursor:pointer;white-space:nowrap;}
.ms-btn:hover{background:var(--hover);color:var(--txt);}
.ms-wrap.ativo .ms-btn{background:var(--hover);color:var(--txt);}
.ms-cnt{display:none;min-width:16px;height:16px;padding:0 5px;border-radius:9px;background:var(--laranja);
  color:#2A1405;font-size:9.5px;font-weight:800;line-height:16px;text-align:center;}
.ms-panel{display:none;position:absolute;top:calc(100% + 6px);right:0;z-index:60;min-width:236px;
  background:var(--pop);border:1px solid var(--card-brd);border-radius:10px;padding:6px;
  box-shadow:0 18px 44px rgba(0,0,0,.55), 0 3px 10px rgba(0,0,0,.35);}
body.claro .ms-panel{box-shadow:0 18px 44px rgba(15,23,42,.20), 0 3px 10px rgba(15,23,42,.10);}
.ms-panel.open{display:block;}
.ms-search{display:flex;align-items:center;gap:7px;padding:6px 8px;margin-bottom:4px;border-bottom:1px solid var(--linha);}
.ms-search input{flex:1;min-width:0;background:transparent;border:0;outline:0;font-family:inherit;font-size:12px;color:var(--txt);}
.ms-list{max-height:262px;overflow:auto;}
.ms-opt{display:flex;align-items:center;gap:9px;min-height:31px;padding:7px 9px;border-radius:7px;
  color:var(--txt);font-size:12.5px;cursor:pointer;white-space:nowrap;}
.ms-opt:hover{background:var(--hover);}
.ms-opt input[type=checkbox]{accent-color:var(--azul);width:14px;height:14px;flex:0 0 14px;cursor:pointer;}
.ms-opt.all-opt{font-weight:700;border-bottom:1px solid var(--linha);margin-bottom:4px;border-radius:0;}
.ms-only{margin-left:auto;font-size:9px;font-weight:700;color:var(--laranja);padding:1px 7px;border-radius:4px;opacity:0;flex:0 0 auto;}
.ms-opt:hover .ms-only{opacity:1;}
.ms-only:hover{background:rgba(249,115,22,.2);}
```

```html
<div class="ms-wrap" id="ms-uni">
  <button class="ms-btn" onclick="toggleMs('ms-uni')">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 21h18M5 21V7l7-4 7 4v14"/><path d="M10 21v-6h4v6"/></svg>
    Unidade<span class="ms-cnt"></span>
  </button>
  <div class="ms-panel">
    <div class="ms-search">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5 21 21"/></svg>
      <input type="text" placeholder="Pesquisar…">
    </div>
    <div class="ms-list"></div>
  </div>
</div>
```

A mecânica: a seleção mora num `Set` no próprio elemento. **`Set` vazio quer dizer "Todos".** Desmarcar uma opção com tudo marcado deixa "todos menos esta". Quando a seleção volta a ter todas as opções, o `Set` volta a vazio.

```js
const $ = id => document.getElementById(id);

function _buildMs(wrap, renderFn, getAllItemsFn){
  if(!(wrap._sel instanceof Set)) wrap._sel=new Set();
  const sel=wrap._sel;
  const list=wrap.querySelector('.ms-list');
  const srch=wrap.querySelector('.ms-search input');
  const render=(q)=>{ renderFn(list,sel, q!==undefined?q:(srch.value||'')); syncBadge(wrap); };
  wrap._render=render;
  if(!wrap._wired){
    wrap._wired=true;
    list.addEventListener('change',e=>{
      const box=e.target;
      if(box.classList.contains('ms-all')){ sel.clear(); }
      else if(sel.size===0){
        if(!box.checked){ (getAllItemsFn?getAllItemsFn():[]).forEach(v=>{ if(v!==box.dataset.v) sel.add(v); }); }
      } else {
        if(box.checked) sel.add(box.dataset.v); else sel.delete(box.dataset.v);
        if(getAllItemsFn){ const all=getAllItemsFn(); if(all.length>0&&all.every(v=>sel.has(v))) sel.clear(); }
      }
      render(srch.value); atualizar();
    });
    list.addEventListener('click',e=>{
      const only=e.target.closest('.ms-only'); if(!only) return;
      e.preventDefault(); e.stopPropagation();
      sel.clear(); sel.add(only.dataset.v);
      render(srch.value); atualizar();
    });
    srch.addEventListener('input',()=>render(srch.value));
    srch.addEventListener('click',e=>e.stopPropagation());
  }
  render();
}
function buildMsFilter(id, items){
  const wrap=$(id); if(!wrap) return;
  wrap._items=items;
  _buildMs(wrap,(list,sel,q)=>{
    const it=wrap._items||[], f=q.toLowerCase();
    const shown=it.filter(v=>v.toLowerCase().includes(f));
    const allChk=sel.size===0;
    list.innerHTML=(!q?`<label class="ms-opt all-opt"><input type="checkbox" class="ms-all" ${allChk?'checked':''}> Todos</label>`:'')+
      shown.map(v=>`<label class="ms-opt"><input type="checkbox" data-v="${v}" ${allChk||sel.has(v)?'checked':''}> ${v}<span class="ms-only" data-v="${v}">only</span></label>`).join('');
  }, ()=>wrap._items||[]);
}
function setMsOptions(id, items){              // troca as opções e mantém o que ainda existe
  const wrap=$(id); if(!wrap) return;
  wrap._items=items;
  if(wrap._sel&&wrap._sel.size){ [...wrap._sel].forEach(v=>{ if(!items.includes(v)) wrap._sel.delete(v); }); }
  if(wrap._render) wrap._render();
}
function syncBadge(wrap){
  const cnt=wrap.querySelector('.ms-cnt'), n=wrap._sel?wrap._sel.size:0;
  // 'inline-block', não '': '' devolve ao CSS (display:none) e a contagem nunca aparece
  if(cnt){ cnt.textContent=n; cnt.style.display=n?'inline-block':'none'; }
  wrap.classList.toggle('ativo', n>0);
}
function toggleMs(id){
  document.querySelectorAll('.ms-panel.open').forEach(p=>{ if(p.closest('.ms-wrap').id!==id) p.classList.remove('open'); });
  const panel=document.querySelector(`#${id} .ms-panel`);
  panel.classList.toggle('open');
  if(panel.classList.contains('open')){ const inp=panel.querySelector('input[type=text]'); if(inp) setTimeout(()=>inp.focus(),50); }
}
function getMsValues(id){ const w=$(id); return w&&w._sel?[...w._sel]:[]; }   // vazio = sem filtro
document.addEventListener('click',e=>{ if(!e.target.closest('.ms-wrap')) document.querySelectorAll('.ms-panel.open').forEach(p=>p.classList.remove('open')); });
```

`atualizar()` é a função da sua aplicação que refaz a tela com os filtros atuais.

Regras de conteúdo dos filtros:

- O filtro de período abre no **último mês com dado realizado** e lista do mais recente para o mais antigo.
- Rótulos em português, sem jargão de sistema.

---

## 7. Conteúdo

### 7.1 Visões e card

```css
.cols{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden;padding:0 24px 24px;}
.vw{display:none;flex:1;min-height:0;flex-direction:column;gap:12px;}
.vw.on{display:flex;overflow:auto;}
.card{border:1px solid var(--card-brd);border-radius:12px;background:var(--side);
  backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);box-shadow:var(--luz-card);}
```

### 7.2 Hero: o número principal, sem card

```css
.fin-hero{display:flex;align-items:flex-end;gap:20px;flex:0 0 auto;}
.heb{margin-left:auto;text-align:right;}            /* segundo hero na ponta direita */
.heb .hdel{justify-content:flex-end;}
.hlbl{font-size:9.5px;font-weight:700;color:var(--txt3);text-transform:uppercase;letter-spacing:.9px;}
.hval{font-size:clamp(26px,3.6vh,40px);font-weight:800;line-height:1;margin:4px 0 7px;color:var(--txt);}
.hdel{display:flex;gap:18px;flex-wrap:wrap;}
.hdel div{font-size:9px;font-weight:700;color:var(--txt3);text-transform:uppercase;letter-spacing:.7px;}
.hdel b{display:block;font-size:13px;font-weight:800;color:var(--txt);margin-top:2px;letter-spacing:0;text-transform:none;}
```

```html
<div class="fin-hero">
  <div>
    <div class="hlbl">Receita líquida</div>
    <div class="hval" id="hero-val">—</div>
    <div class="hdel">
      <div>Δ Orçado<b id="d-orc" class="cg">—</b></div>
      <div>Δ Remunerado<b id="d-rem" class="cr">—</b></div>
    </div>
  </div>
</div>
```

### 7.3 Cards de KPI

```css
.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;flex:0 0 auto;}
.kpi{padding:22px 16px;border:1px solid var(--card-brd);border-radius:11px;background:var(--side);
  backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);}
.kpi .kl{font-size:9.5px;font-weight:700;color:var(--txt3);text-transform:uppercase;letter-spacing:.8px;}
.kpi .kv{font-size:25px;font-weight:800;color:var(--txt);margin-top:7px;line-height:1.1;}
.kpi .km{font-size:10.5px;color:var(--txt3);margin-top:8px;font-weight:600;}
.kpi .km b{font-weight:800;}

/* tela baixa (notebook 1366×768): o card também encolhe */
@media(min-width:861px) and (max-height:820px){
  .kpi{padding:11px 14px;}
  .kpi .kv{font-size:21px;margin-top:5px;}
  .kpi .km{margin-top:5px;}
  .kpis{gap:8px;}
  .gr2{max-height:52vh;}
}
```

Fileira de quatro cards com altura própria e nome longo cortado com reticências:

```css
.kpis.k4{grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;flex:0 0 auto;min-height:clamp(112px,16.5vh,170px);}
.kpis.k4 .kpi{display:flex;flex-direction:column;justify-content:flex-start;padding:14px 16px;}
.kpis.k4 .kpi .kv{font-size:32px;margin-top:6px;}
.kpis.k4 .kpi .km{margin-top:auto;padding-top:8px;}
.kpi .kv.kvn{display:flex;align-items:baseline;gap:8px;min-width:0;}   /* nome + delta na mesma linha */
.kvn .kn{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;}
.kvn .kdel{flex:0 0 auto;}
@media(max-width:1100px){ .kpis.k4{grid-template-columns:repeat(2,1fr);} }
```

Use `minmax(0,1fr)` e não `1fr`. Com `1fr`, um nome comprido alarga o card.

**Quando o Resumo precisa de cards para distribuir a altura**, o modelo é: dois cards com os componentes do número do hero, mais "melhor" e "pior" contra a referência. Exemplo: o hero é Km/L, os cards são "Km rodado", "Litros consumidos", "Melhor unidade" e "Pior unidade". O nome vai grande, o Δ% colorido ao lado e a explicação embaixo.

### 7.4 Card de gráfico

```css
.gr2{flex:1 1 auto;min-height:190px;max-height:44vh;display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.gcard{min-height:0;min-width:0;display:flex;flex-direction:column;padding:12px 16px 10px;position:relative;}
.gtit{font-size:12px;font-weight:800;}
.gsub{font-size:10px;color:var(--txt3);margin:2px 0 6px;}
.gcv{flex:1;min-height:0;position:relative;}        /* o canvas mora aqui */
.gleg{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:4px;}
.gleg span{display:flex;align-items:center;gap:5px;font-size:9.5px;font-weight:700;color:var(--txt3);letter-spacing:.5px;}
.gleg i{width:14px;height:0;border-top:2px dashed currentColor;display:inline-block;}   /* tracinho = linha */
.gleg i.sq{width:9px;height:9px;border:0;border-radius:2px;background:currentColor;}     /* quadradinho = barra */
```

```html
<div class="card gcard">
  <div class="gtit">Custo · Mensal</div>
  <div class="gsub">Realizado contra o remunerado</div>
  <div class="gleg">
    <span style="color:var(--txt2)"><i class="sq"></i>Realizado</span>
    <span style="color:var(--azul)"><i></i>Remunerado</span>
  </div>
  <div class="gcv"><canvas id="ch-custo"></canvas></div>
</div>
```

`min-width:0` no `.gcard` é obrigatório. Sem ele o canvas do Chart.js segura a coluna quando a janela diminui e a grade sai da tela.

### 7.5 Botões de referência e de dimensão

```css
.rt{background:transparent;border:1px solid var(--card-brd);border-radius:20px;padding:3px 10px;cursor:pointer;
  font-family:inherit;font-size:9.5px;font-weight:800;color:var(--txt2);letter-spacing:.6px;white-space:nowrap;}
.rt:hover{background:var(--hover);color:var(--txt);}
.rt .l{color:var(--txt3);font-weight:600;}
.rt.abs{position:absolute;top:10px;right:12px;z-index:3;}   /* no canto do card */
.dims{display:flex;gap:4px;flex-wrap:wrap;}
.dimb{background:transparent;border:1px solid var(--card-brd);border-radius:7px;padding:4px 10px;cursor:pointer;
  font-family:inherit;font-size:10.5px;font-weight:700;color:var(--txt2);}
.dimb:hover{background:var(--hover);color:var(--txt);}
.dimb.on{background:var(--azul);border-color:transparent;color:#fff;}
```

`.rt` alterna a referência de um gráfico, por exemplo REM e ORÇ. `.dimb` alterna a dimensão de uma tabela, por exemplo Unidade e Projeto.

---

## 8. Tabelas

```css
.tsec{flex:1;min-height:0;display:flex;flex-direction:column;padding:14px 16px 12px;}   /* card da tabela */
.thead-row{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:2px;}
.thead-row > .dims{margin-left:auto;}
.ttit{font-size:14px;font-weight:800;}
.tsub{font-size:10px;color:var(--txt3);margin-bottom:8px;}
.twrap{flex:1;min-height:0;overflow:auto;border:1px solid var(--card-brd);border-radius:10px;background:var(--side);}

table.dre{width:100%;border-collapse:collapse;font-size:11px;}
table.dre thead th{position:sticky;top:0;z-index:2;background:var(--cabec);text-align:left;
  padding:10px 12px;font-size:9.5px;font-weight:700;color:var(--txt2);text-transform:uppercase;
  letter-spacing:.7px;border-bottom:1px solid var(--card-brd);white-space:nowrap;}
table.dre thead th .grp{display:block;font-size:8.5px;color:var(--txt3);letter-spacing:.6px;margin-bottom:1px;}  /* grupo acima da coluna */
table.dre td{padding:9px 12px;border-bottom:1px solid var(--linha);color:var(--txt2);white-space:nowrap;}
table.dre td.conta{color:var(--txt);font-weight:600;text-align:left;}
table.dre td.num{text-align:right;}
table.dre tbody tr:hover{background:var(--hover);}
table.dre tr.total td{font-weight:800;color:var(--txt);border-top:1px solid var(--card-brd);background:var(--cabec);}
table.dre .sep-l{border-left:1px solid var(--card-brd);}     /* separa blocos de colunas */

/* cor de resultado: o !important é OBRIGATÓRIO, senão "table.dre td{color}" vence */
table.dre td.cr,.cr{color:var(--vermelho)!important;font-weight:700;}
table.dre td.cg,.cg{color:var(--verde)!important;font-weight:700;}
```

```html
<div class="card tsec">
  <div class="thead-row">
    <div class="ttit" style="display:none">Detalhado</div>
    <div class="dims"><button class="dimb on">Unidade</button><button class="dimb">Projeto</button></div>
  </div>
  <div class="twrap">
    <table class="dre">
      <thead><tr><th>Unidade</th><th class="num">Realizado</th><th class="num sep-l">Δ R$</th><th class="num">Δ %</th></tr></thead>
      <tbody>…</tbody>
    </table>
  </div>
</div>
```

Regras das tabelas:

- **Cabeçalho alinhado com o conteúdo:** texto à esquerda, número à direita (`th.num`).
- **Nunca barra de rolagem horizontal no desktop.** A tabela se ajusta. Coluna que estoura vira dica na linha.
- **Linhas de total no tom do cabeçalho** (`--cabec`), nos dois temas.
- **Δ em valor e em % sempre em negrito**, com `cr`/`cg`.
- **O card atrás da tabela fica sempre**, mesmo sem título. Sem ele as bordas arredondadas da `.twrap` parecem cortadas.
- **Título que só repete o nome da visão fica escondido.** O topo já mostra o nome.

Drill de grupo para itens:

```css
tr.pac-row{cursor:pointer;}
tr.pac-row td.conta::before{content:'+';margin-right:6px;}
tr.pac-row.open td.conta::before{content:'−';}
tr.sub-row{display:none;}
tr.sub-row.show{display:table-row;}
tr.sub-row td.conta{padding-left:26px;}
```

**Regra de cor de resultado:**

- **Custo:** gastou mais que a referência é vermelho, gastou menos é verde.
- **Receita:** é o inverso.

---

## 9. Gráficos (Chart.js 4.4.0)

```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0"></script>
```

### 9.1 Cores por tema

Declarar dentro da função que desenha, antes de qualquer uso. Usar `isLight` antes da declaração quebra com erro de inicialização.

```js
const isLight = document.body.classList.contains('claro');
const isMobile = window.innerWidth < 768;
const tick = {color:isLight?'#4A5568':'#B2BCD2', font:{family:'Montserrat',size:isMobile?9:15}};
const dlColor = isLight?'#333333':'#F1F5F9';
const tooltip = {backgroundColor:isLight?'#FFFFFF':'#1B1B1E', titleColor:'#F97316',
  bodyColor:isLight?'#161D2B':'#EEF2FA', borderColor:isLight?'#d7dce4':'#33343A', borderWidth:1,
  titleFont:{family:'Montserrat'}, bodyFont:{family:'Montserrat'}};
const verde = '#3BB33B', vermelho = isLight?'#FF0000':'#FF5252';
const remC = isLight?'#161D2B':'#EEF2FA';    // linha de remunerado
const orcC = isLight?'#1B6FC4':'#2E90E8';    // linha de orçado
```

### 9.2 O padrão de barra

- Barra translúcida com contorno sólido de 1px e cantos de 3px.
- Cor condicional pela meta: verde se bateu, vermelho se não.
- Alfa da barra: 0,65 normal, 0,85 no mês em foco, 0,2 fora do foco quando há foco.
- Linha de meta ou referência tracejada `[5,3]`.
- Eixo Y escondido, sem grade, sem borda de eixo e sem a legenda do Chart.js. A legenda é a `.gleg` do card.
- Rótulo de dados no topo da barra, só nos meses em foco, 14px/700.

```js
const rgba = (hex,a) => `rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},${a})`;
const foco = idx => !hl.length || hl.includes(idx);          // hl = índices dos meses filtrados
const corDe = (v,i) => (v<=meta[i] ? verde : vermelho);      // custo: abaixo da meta é bom

new Chart(canvas, {
  type:'bar',
  data:{labels, datasets:[
    {type:'bar', label:'Realizado', data,
     backgroundColor:data.map((v,i)=>rgba(corDe(v,i), hl.length ? (foco(i)?.85:.2) : .65)),
     borderColor:data.map((v,i)=>corDe(v,i)), borderWidth:1, borderRadius:3,
     barPercentage:.9, categoryPercentage:.92, order:2},
    {type:'line', label:'Meta', data:meta, borderColor:orcC, borderWidth:2, tension:0,
     borderDash:[5,3], pointRadius:0, order:1}]},
  options:{responsive:true, maintainAspectRatio:false, animation:false,
    layout:{padding:{top:30}},
    plugins:{legend:{display:false}, tooltip,
      datalabels:{display:c=>c.datasetIndex===0 && c.dataset.data[c.dataIndex]!=null && foco(c.dataIndex),
        anchor:'end', align:'top', color:dlColor,
        font:{family:'Montserrat',size:isMobile?8:14,weight:'700'}, formatter:v=>fmt(v)}},
    scales:{x:{ticks:tick, grid:{display:false}, border:{display:false}},
            y:Object.assign({display:false, beginAtZero:false}, padBounds([data,meta],.12,.06))}},
  plugins:[ChartDataLabels]
});
```

### 9.3 Eixo justo aos dados

O eixo Y some, mas a janela continua justa. Começar do zero achata a diferença entre valores próximos.

```js
function padBounds(arrs, below, above){
  const vals=[]; arrs.forEach(a=>(a||[]).forEach(v=>{ if(v!=null&&isFinite(v)) vals.push(+v); }));
  if(!vals.length) return null;
  const mn=Math.min(...vals), mx=Math.max(...vals), r=(mx-mn)||Math.abs(mx)||1;
  let lo=mn-r*below, hi=mx+r*above;
  const raw=(hi-lo)/6, mag=Math.pow(10,Math.floor(Math.log10(raw))), n=raw/mag, step=(n>=5?5:n>=2?2:1)*mag;
  lo=Math.floor(lo/step)*step; hi=Math.ceil(hi/step)*step; if(mn>=0&&lo<0) lo=0;
  return {min:lo, max:hi};
}
```

Para barra de contagem que parte do zero: `y:{beginAtZero:true, suggestedMax:Math.ceil(pico*1.12)}`.

### 9.4 Faixas de aderência

Para percentuais de aderência, as faixas aprovadas são:

| Faixa | Cor |
|---|---|
| Abaixo de 70% | Vermelho, crítico |
| De 70% a 85% | Âmbar, atenção |
| A partir de 85% | Verde, adequado |

### 9.5 Regras dos gráficos

- Destruir antes de recriar: `if(ch) ch.destroy()`.
- Redesenhar ao trocar o tema, ao recolher a lateral e ao trocar de visão. O canvas precisa estar visível, então redesenhar com `setTimeout` de 30 ms.
- **Série condicional verde e vermelha tem legenda neutra.** O quadradinho só diz "isto é a barra".
- Rótulo de dados sempre acima da barra ou do ponto, nunca dentro.

---

## 10. JavaScript da casca

```js
let VW='resumo';
const TIT={resumo:'Resumo Gerencial', detalhado:'Detalhado'};   // chave da visão → título do topo

function setVw(v){
  VW=v;
  document.querySelectorAll('.s-item[data-vw]').forEach(b=>b.classList.toggle('on',b.dataset.vw===v));
  document.querySelectorAll('.vw').forEach(s=>s.classList.toggle('on', s.id==='vw-'+v));
  $('tit').textContent = TIT[v]||'';
  setTimeout(renderCharts,30);              // o canvas precisa estar visível
}
document.querySelectorAll('.s-item[data-vw]').forEach(b=>b.addEventListener('click',()=>setVw(b.dataset.vw)));

/* lateral recolhida + dica */
const DICA=document.createElement('div'); DICA.className='dica'; document.body.appendChild(DICA);
const escondeDica=()=>DICA.classList.remove('on');
function rotuloItem(b){
  const c=b.cloneNode(true); c.querySelectorAll('.n,svg').forEach(e=>e.remove());
  return c.textContent.replace(/\s+/g,' ').trim() || b.getAttribute('title') || '';
}
document.querySelectorAll('.side .s-item').forEach(b=>{
  b.addEventListener('mouseenter',()=>{
    if(!document.querySelector('.side').classList.contains('mini')) return;
    const t=rotuloItem(b); if(!t) return;
    DICA.textContent=t;
    const r=b.getBoundingClientRect();
    DICA.style.top=Math.round(r.top+r.height/2)+'px';
    DICA.style.left=Math.round(r.right+10)+'px';
    DICA.classList.add('on');
  });
  b.addEventListener('mouseleave',escondeDica);
  b.addEventListener('click',escondeDica);
});
function trocaMini(){
  escondeDica();
  const l=document.querySelector('.side').classList.toggle('mini');
  localStorage.setItem('app_mini', l?'1':'0');
  $('btMini').title = l?'Expandir menu':'Recolher menu';
  setTimeout(renderCharts,260);             // espera a animação da largura
}
if(localStorage.getItem('app_mini')==='1') document.querySelector('.side').classList.add('mini');

/* tema */
const _SOL=`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 1.5v2M12 20.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1.5 12h2M20.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>`;
const _LUA=`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
function aplicaTema(t){
  document.body.classList.toggle('claro', t==='light');
  localStorage.setItem('bi_theme', t);      // uma chave só para o tema seguir em todas as telas
  $('btTema').innerHTML = t==='light'?_LUA:_SOL;
  renderCharts();
}
function trocaTema(){ aplicaTema(document.body.classList.contains('claro')?'dark':'light'); }
aplicaTema(localStorage.getItem('bi_theme')||'dark');
```

Envolva as leituras de `localStorage` em `try/catch` se a aplicação puder rodar em janela anônima ou com armazenamento bloqueado.

**Menus flutuantes moram no `<body>`.** Dentro do `.app`, que tem `backdrop-filter`, um `position:fixed` se ancora no `.app` e não na tela, e o menu aparece fora do lugar.

---

## 11. Celular (até 860px)

No celular a página volta a rolar, a lateral vira uma fileira de pílulas e cada bloco ganha altura própria. Sem altura explícita, gráfico e tabela colapsam para zero.

```css
@media(max-width:860px){
  body{overflow:auto;}
  .app{position:static;inset:auto;min-height:100%;border-radius:0;flex-direction:column;box-shadow:none;border:0;}
  .app::before{position:fixed;inset:0;}
  .side{width:auto;flex:none;border-right:0;border-bottom:1px solid var(--linha);padding:8px 10px;overflow:visible;}
  .side.mini{width:auto;flex:none;padding:8px 10px;}
  .s-user,.s-top,.s-sec{display:none;}
  .s-volta{display:contents;}
  .side{display:flex;flex-direction:row;gap:6px;overflow-x:auto;scrollbar-width:none;}
  .side::-webkit-scrollbar{display:none;}
  .side .s-item{width:auto;flex:0 0 auto;white-space:nowrap;font-size:12px;padding:7px 11px;
    border:1px solid var(--card-brd);border-radius:20px;}
  .side.mini .s-item{font-size:12px;padding:7px 11px;gap:9px;}
  .side .s-item.on{background:var(--laranja);border-color:transparent;color:#2A1405;}
  .top{padding:12px 14px 8px;gap:4px;}
  .top h1{font-size:17px;}
  .filtros{order:3;flex:1 1 100%;overflow-x:auto;scrollbar-width:none;padding-bottom:2px;}
  .filtros::-webkit-scrollbar{display:none;}
  .filtros .ms-wrap{flex:0 0 auto;}
  .ms-btn{font-size:12px;padding:6px 9px;}
  .ms-panel{right:auto;left:0;min-width:210px;}
  .cols{overflow:visible;padding:0 14px 22px;}
  .vw.on{display:block;}
  .vw>*{margin-bottom:12px;}
  .fin-hero{gap:14px;flex-direction:column;align-items:flex-start;}
  .heb{margin-left:0;text-align:left;}
  .heb .hdel{justify-content:flex-start;}
  .kpis{grid-template-columns:repeat(2,1fr);}
  .gr2{display:block;height:auto;}
  .gcard{height:300px;margin-bottom:12px;}
  .tsec{display:block;padding:12px 12px 10px;}
  .twrap{max-height:none;overflow-x:auto;}
}
```

No celular, a tabela pode rolar de lado.

---

## 12. Regras de distribuição de altura

1. **Nada de rolagem no desktop.** Se não coube, encolhe ou divide a visão.
2. **A sobra de altura é dividida.** Cards de KPI com altura própria (`min-height:clamp(112px,16.5vh,170px)`). Gráfico com teto (`max-height:44vh` quando há tabela embaixo, `56vh` quando o gráfico é o miolo).
3. **Quando o gráfico é o último bloco da visão**, pode tirar o teto dele. Os cards não achatam porque `.kpis` é `flex:0 0 auto`.
4. **Nunca despejar toda a sobra num bloco só.** Gráfico gigante com cards espremidos é erro.
5. **Ao separar uma visão em duas, conferir de novo a altura do que ficou.**
6. **Fileiras de baixo usam a mesma grade e o mesmo espaçamento dos cards**, para as bordas baterem.
7. **Conferir em 1366×768, 1600×900 e 1920×1080, nos dois temas.**

---

## 13. Variação sem lateral

Para uma tela de entrada ou com uma visão só, use a mesma moldura sem `.side`:

- **Topo:** marca à esquerda, com um quadrado laranja de 34px, título de 21px e subtítulo de 11px. À direita, busca em pílula, tema e usuário.
- **Miolo:** `.hmio` com um título e uma grade de cards clicáveis.
- **Rodapé:** o "Voltar" fica à esquerda, no fim da moldura (`.pe-volta`).

No portal essa tela é outro arquivo, com `.app{flex-direction:column}` e sem `.side`. A grade também se chama `.board` lá. Aqui ela vai escopada como `.hmio>.board` para não brigar com o `.board` da seção 6 se as duas cascas dividirem o mesmo CSS.

```css
.hmio{flex:1;min-height:0;display:flex;flex-direction:column;padding:20px 24px 24px;gap:16px;overflow:hidden;}
.tit-pg h2{font-size:21px;font-weight:800;color:var(--txt);letter-spacing:-.2px;line-height:1.15;}
.tit-pg p{font-size:11.5px;color:var(--txt3);margin-top:4px;}
.hmio>.board{flex:1;min-height:0;display:grid;grid-template-columns:repeat(3,1fr);gap:14px;
  align-content:start;overflow:auto;padding:2px;}
.hcard{display:flex;flex-direction:column;gap:10px;padding:19px 20px;border-radius:13px;cursor:pointer;
  background:var(--side);border:1px solid var(--card-brd);box-shadow:var(--luz-card);min-height:176px;
  backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
  text-decoration:none;color:inherit;transition:border-color .15s,transform .1s;}
.hcard:hover{border-color:var(--laranja);transform:translateY(-2px);}
.hcard-top{display:flex;align-items:center;gap:10px;}
.hcard .ic{width:36px;height:36px;flex:0 0 36px;border-radius:11px;display:flex;align-items:center;justify-content:center;
  background:color-mix(in srgb,var(--laranja) 13%,transparent);
  border:1px solid color-mix(in srgb,var(--laranja) 22%,transparent);}
.hcard .ic svg{width:18px;height:18px;stroke:var(--laranja);fill:none;}
.hcard .tit{font-size:17px;font-weight:700;color:var(--txt);line-height:1.2;min-width:0;}
.hcard .dsc{font-size:13.5px;color:var(--txt3);line-height:1.55;}
.hcard .go{margin-top:auto;display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700;color:var(--txt3);}
.hcard:hover .go{color:var(--laranja);}
.pe-volta{flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:0 24px 14px;}
.pe-volta a{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--card-brd);border-radius:20px;padding:6px 13px;
  font-family:inherit;font-size:9.5px;font-weight:800;color:var(--txt2);letter-spacing:.6px;text-transform:uppercase;text-decoration:none;white-space:nowrap;}
.pe-volta a:hover{background:var(--hover);color:var(--txt);}
@media(max-width:900px){
  .hmio{padding:14px 16px 22px;overflow:visible;}
  .hmio>.board{grid-template-columns:1fr;overflow:visible;}
  .hcard{min-height:0;}
}
```

```html
<div class="hmio">
  <div class="tit-pg"><h2>Combustível</h2><p>Escolha um painel</p></div>
  <div class="board">
    <a class="hcard" href="eficiencia/">
      <div class="hcard-top">
        <div class="ic"><svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg></div>
        <div class="tit">Eficiência Km/L</div>
      </div>
      <div class="dsc">Km/L realizado contra o remunerado, por unidade e veículo.</div>
      <div class="go">Abrir →</div>
    </a>
  </div>
</div>
```

---

## 14. Esqueleto mínimo

Junte este HTML às seções 2, 3, 5, 6, 7, 8 e 11 dentro do `<style>`, e às seções 6.1 e 10 dentro do `<script>`.

```html
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nome do painel</title>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0"></script>
<style>/* seções 2, 3, 5, 6, 7, 8 e 11 */</style>
</head>
<body>
<div class="app">
  <aside class="side">
    <div class="s-top">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--laranja)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/></svg>
      <b>Nome do painel</b>
      <button class="s-mini" id="btMini" onclick="trocaMini()" title="Recolher menu">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></svg>
      </button>
    </div>

    <div class="s-sec">Visões</div>
    <button class="s-item on" data-vw="resumo">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>
      Resumo Gerencial
    </button>
    <button class="s-item" data-vw="detalhado">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>
      Detalhado
    </button>

    <div class="s-sec">Atalhos</div>
    <button class="s-item" onclick="atualizar()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
      Atualizar dados
    </button>

    <div class="s-volta">
      <a class="s-item" href="../" style="text-decoration:none" title="Voltar ao início">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>
        Voltar ao início
      </a>
    </div>

    <div class="s-user">
      <div class="av">AB</div>
      <div><b>Nome do usuário</b><i>Perfil</i></div>
    </div>
  </aside>

  <main class="board">
    <div class="top">
      <div class="tit-wrap"><h1 id="tit">Resumo Gerencial</h1><div class="tit-sub" id="titSub">Carregando…</div></div>
      <div class="filtros">
        <!-- um .ms-wrap por filtro (seção 6.1) -->
      </div>
      <button class="tool ico" id="btTema" onclick="trocaTema()" title="Tema"></button>
    </div>

    <div class="cols">
      <section class="vw on" id="vw-resumo">
        <div class="fin-hero">…</div>
        <div class="kpis k4">…</div>
        <div class="gr2">
          <div class="card gcard">…</div>
          <div class="card gcard">…</div>
        </div>
      </section>
      <section class="vw" id="vw-detalhado">
        <div class="card tsec">…</div>
      </section>
    </div>
  </main>
</div>
<script>/* seções 6.1 e 10, mais atualizar() e renderCharts() da sua aplicação */</script>
</body>
</html>
```

---

## 15. Checklist antes de publicar

- [ ] A página não rola em 1366×768, 1600×900 e 1920×1080.
- [ ] Os dois temas conferidos, com os gráficos redesenhados ao trocar.
- [ ] A primeira visão se chama "Resumo Gerencial".
- [ ] "Voltar" no rodapé da lateral, colado no usuário.
- [ ] Menus suspensos opacos e fora do `.app` quando são `position:fixed`.
- [ ] Contagem laranja do filtro aparece ao selecionar.
- [ ] Cabeçalho de tabela alinhado com o conteúdo e sem barra horizontal.
- [ ] Linhas de total no tom do cabeçalho.
- [ ] `cr`/`cg` com `!important`.
- [ ] Gráfico sem grade, sem eixo Y, rótulo no topo e eixo justo aos dados.
- [ ] Legenda própria no card, neutra para série condicional.
- [ ] Altura dividida entre cards e gráfico, sem bloco gigante nem faixa vazia.
- [ ] Celular abre com a lateral em pílulas e gráficos com altura.
- [ ] Nada inventado: todo componente novo está neste guia ou foi combinado antes.
