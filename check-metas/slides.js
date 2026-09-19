/* ============================================================================
   CHECK DE METAS · O SLIDE É DESENHADO NO PADRÃO DO PORTAL
   ----------------------------------------------------------------------------
   Renan, 19/09/2026: "criar mesmo algo novo, seguindo 100% nosso padrão visual
   novo, fonte, tabela, gráfico, pódios, gráficos de barras, cards etc" ·
   "NUNCA FUJA DO NOSSO PADRÃO" · "o fundo dos slides deve ficar inteiro
   conversando com cards, gráficos etc. Quero algo bonito".

   POR QUE ISTO EXISTE. O gerador antigo trabalhava de dois jeitos e o segundo
   estragava tudo: (1) foto do painel, que vinha com o tema junto — foi o que
   ele aprovou no Scorecard, no Resumo Executivo e na Evolução; (2) tabela
   redesenhada por mim direto no PDF, que perdia a fonte (virava Helvetica), o
   Δ virava aspas, o acento comia letra ("Combu tívei"), a coluna truncava com
   reticências e sumiam o fundo do cabeçalho e o da linha de Total. TODOS os
   slides que ele reprovou eram do segundo tipo.

   Aqui o slide é uma PÁGINA HTML de verdade, com os tokens do portal no tema
   claro e Montserrat — então tabela, card, gráfico e fundo são do mesmo sistema
   e não brigam. Os NÚMEROS continuam saindo do painel (o __cm.extrai lê o que
   está na tela, com a cor computada de cada célula): nada é recalculado aqui,
   só a apresentação é feita para caber na página.

   O que NÃO está aqui, de propósito: a capa e as divisórias do tema Conlog
   (Renan: "as capas ficaram bonitas, pode manter"), que continuam desenhadas
   em canvas no index.html.
   ========================================================================== */

/* ── medida do slide ───────────────────────────────────────────────────────
   1600×900 é 16:9 exato e é a medida do PPT dele (13,333 × 7,5 pol) a 120 dpi;
   a captura sai em 2× para o texto não serrilhar na impressão.             */
const SL = { W:1600, H:900, esc:2 };

/* ── tokens: o tema CLARO do portal, em cores OPACAS ───────────────────────
   No portal as camadas são translúcidas de propósito (é o empilhamento que dá
   o vidro). No slide não há `.app` com blur atrás, então guardo aqui o que
   cada camada VIRA depois de composta — medido sobre o fundo do tema claro.
   Trocar isto por cor chapada inventada é o que faz o card brigar com o fundo. */
const TK = {
  fundo:'#E1E2E5',     // a página do portal no claro
  card:'#F2F3F5',      // o branco translúcido do card, já composto sobre o fundo
  cardBrd:'rgba(15,23,42,.10)',
  linha:'rgba(15,23,42,.10)',
  cabec:'#DCDFE6',     // --cabec: cabeçalho de tabela E linha de total
  txt:'#161D2B', txt2:'#4A5568', txt3:'#737D91',
  laranja:'#F97316', verde:'#00B300', vermelho:'#FF0000', ambar:'#E9A400', azul:'#1B6FC4',
  grade:'rgba(15,23,42,.08)',
};

/* ── a folha de estilo do palco ────────────────────────────────────────────
   Injetada uma vez. Tudo escopado em .sl para não encostar na tela do painel
   de Check de Metas, que é escura.                                          */
const SL_CSS = `
.sl{position:relative;width:${SL.W}px;height:${SL.H}px;overflow:hidden;
  background:${TK.fundo};color:${TK.txt};
  font-family:'Montserrat',-apple-system,sans-serif;
  display:flex;flex-direction:column;box-sizing:border-box;}
.sl *{box-sizing:border-box;margin:0;padding:0;}

/* A LISTRA do padrão dele: topo, começando na metade e indo até a borda.
   Medida do print do PPT: ~50% da largura × ~2% da altura, encostada. */
.sl-listra{position:absolute;top:0;right:0;width:50%;height:18px;
  background:${TK.laranja};}

.sl-cab{flex:0 0 auto;padding:52px 64px 0;}
.sl-tit{font-size:40px;font-weight:800;letter-spacing:-.5px;line-height:1.1;color:${TK.txt};}
.sl-sub{font-size:17px;font-weight:500;color:${TK.txt3};margin-top:8px;}
.sl-mio{flex:1;min-height:0;padding:26px 64px 52px;display:flex;flex-direction:column;gap:18px;}
.sl-rot{flex:0 0 auto;font-size:15px;font-weight:800;color:${TK.laranja};
  text-transform:uppercase;letter-spacing:1.2px;}

/* ── cards de KPI (a fileira do Scorecard) ── */
.sl-kpis{flex:0 0 auto;display:grid;gap:14px;}
.sl-kpi{background:${TK.card};border:1px solid ${TK.cardBrd};border-radius:12px;
  padding:18px 20px;display:flex;flex-direction:column;justify-content:center;gap:4px;}
.sl-kpi .r{font-size:12px;font-weight:700;color:${TK.txt3};text-transform:uppercase;letter-spacing:.8px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.sl-kpi .v{font-size:34px;font-weight:800;line-height:1.05;}
.sl-kpi .m{font-size:12px;font-weight:500;color:${TK.txt3};}

/* ── hero (o número grande sem card) ── */
.sl-hero{flex:0 0 auto;display:flex;align-items:flex-end;gap:32px;
  padding-bottom:16px;border-bottom:1px solid ${TK.linha};}
.sl-hero .r{font-size:13px;font-weight:700;color:${TK.txt3};text-transform:uppercase;letter-spacing:1px;}
.sl-hero .v{font-size:64px;font-weight:800;line-height:1;}
.sl-hero .d{display:flex;gap:26px;padding-bottom:10px;}
.sl-hero .d div{font-size:12px;color:${TK.txt3};font-weight:600;text-transform:uppercase;letter-spacing:.6px;}
.sl-hero .d b{display:block;font-size:19px;font-weight:800;margin-top:3px;}

/* ── card que embrulha gráfico ── */
.sl-card{background:${TK.card};border:1px solid ${TK.cardBrd};border-radius:14px;
  padding:20px 22px;display:flex;flex-direction:column;min-height:0;}
.sl-card .ct{font-size:17px;font-weight:800;color:${TK.txt};}
.sl-card .cs{font-size:12px;color:${TK.txt3};margin-top:2px;}
.sl-cv{flex:1;min-height:0;position:relative;margin-top:12px;}

/* ── TABELA: o table.dre do portal ──
   cabeçalho e linha de total no --cabec, grade fina, número à direita. */
.sl-tw{flex:1;min-height:0;display:flex;flex-direction:column;}
table.sl-t{width:100%;border-collapse:collapse;table-layout:fixed;}
table.sl-t th{background:${TK.cabec};color:${TK.txt2};font-weight:800;
  text-transform:uppercase;letter-spacing:.6px;text-align:left;
  padding:12px 14px;border-bottom:1px solid ${TK.linha};}
table.sl-t th.n{text-align:right;}
table.sl-t td{padding:11px 14px;border-bottom:1px solid ${TK.linha};color:${TK.txt};
  vertical-align:top;word-break:break-word;}
table.sl-t td.n{text-align:right;white-space:nowrap;}
table.sl-t tr.tot td{background:${TK.cabec};font-weight:800;border-bottom:none;}
table.sl-t tr:nth-child(even):not(.tot) td{background:rgba(255,255,255,.45);}

/* ── FCA: o texto INTEIRO, como a visão Tabela do painel ──
   Renan, 19/09: o slide vinha com "- 18 k Rec…", "Michel Oli…", "Em anda…".
   Aqui nada é cortado: a célula quebra em quantas linhas precisar e, se a
   página encher, o resto vai para o slide seguinte. */
table.sl-t td .fato-t{font-weight:800;display:block;margin-bottom:3px;}
table.sl-t td .fato-d{color:${TK.txt2};display:block;}
.sl-pil{display:inline-block;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:800;
  background:rgba(0,179,0,.14);color:${TK.verde};white-space:nowrap;}
.sl-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:7px;
  vertical-align:middle;background:${TK.verde};}

/* ── pódio: escuro, o slide inteiro ── */
.sl.escuro{background:#141416;color:#EEF2FA;}
.sl.escuro .sl-tit{color:#FFF;}
.sl.escuro .sl-sub{color:#9AA3B2;}
.sl-pod{flex:1;display:flex;align-items:flex-end;justify-content:center;gap:26px;padding-bottom:26px;}
.sl-pod .p{background:#1E1E22;border:1px solid rgba(255,255,255,.08);border-radius:16px;
  width:300px;padding:26px 22px;text-align:center;display:flex;flex-direction:column;gap:8px;}
.sl-pod .p .lug{font-size:13px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:#8C93A3;}
.sl-pod .p .nm{font-size:30px;font-weight:800;color:#FFF;}
.sl-pod .p .un{font-size:13px;font-weight:600;letter-spacing:1px;color:#8C93A3;text-transform:uppercase;}
.sl-pod .p .pt{font-size:26px;font-weight:800;}
.sl-pod .p1{height:330px;border-top:3px solid #E8B923;}
.sl-pod .p1 .pt{color:#E8B923;}
.sl-pod .p2{height:280px;border-top:3px solid #B9BDC6;}
.sl-pod .p3{height:250px;border-top:3px solid #C08457;}

.sl-vazio{flex:1;display:flex;align-items:center;justify-content:center;
  font-size:18px;font-weight:600;color:${TK.txt3};}
`;

let _cssPosto = false;
function slGaranteCss(){
  if (_cssPosto) return;
  const s = document.createElement('style');
  s.id = 'sl-css'; s.textContent = SL_CSS;
  document.head.appendChild(s);
  _cssPosto = true;
}

/* ── o palco: fora da tela, mas LAYOUTADO ──────────────────────────────────
   display:none não serve — elemento escondido não tem medida e o Chart.js
   desenharia num canvas de 0px. Mesma armadilha do palco das capas.        */
function slPalco(){
  let p = document.getElementById('sl-palco');
  if (!p) {
    p = document.createElement('div');
    p.id = 'sl-palco';
    p.style.cssText = 'position:fixed;left:-30000px;top:0;z-index:-1;';
    document.body.appendChild(p);
  }
  return p;
}

/* ── a moldura: todo slide nasce daqui ─────────────────────────────────── */
function slNovo(tit, sub, escuro){
  slGaranteCss();
  const el = document.createElement('div');
  el.className = 'sl' + (escuro ? ' escuro' : '');
  el.innerHTML = `<div class="sl-listra"></div>
    <div class="sl-cab"><div class="sl-tit"></div>${sub ? '<div class="sl-sub"></div>' : ''}</div>
    <div class="sl-mio"></div>`;
  el.querySelector('.sl-tit').textContent = tit || '';
  if (sub) el.querySelector('.sl-sub').textContent = sub;
  slPalco().appendChild(el);
  return { el, mio: el.querySelector('.sl-mio') };
}

/* ── cor: a do painel, nunca uma minha ─────────────────────────────────────
   O extrai traz a cor computada de cada célula. Cinza de texto comum vira o
   --txt do slide; verde/vermelho/laranja passam como estão, porque são a
   regra de resultado do portal e não cabe a mim reinterpretar. */
function slCor(c){
  const m = String(c||'').match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (!m) return TK.txt;
  const [r,g,b] = [+m[1],+m[2],+m[3]];
  const cinza = Math.abs(r-g)<14 && Math.abs(g-b)<14;
  return cinza ? (((r+g+b)/3) > 140 ? TK.txt3 : TK.txt) : `rgb(${r},${g},${b})`;
}

/* ── MEDALHA VIRA POSIÇÃO COLORIDA ───────────────────────────────────────
   Renan, 19/09/2026: o ranking saiu com "Ø>ÝG", "Ø>ÝH", "Ø>ÝI" no lugar de
   🥇🥈🥉 — emoji não sobrevive à fonte do documento. Aqui a medalha vira o
   lugar (1º/2º/3º) na cor do metal, que é como o painel já marca o pódio. */
const MEDALHA = { '\u{1F947}':['1º','#B8860B'], '\u{1F948}':['2º','#8A8F98'], '\u{1F949}':['3º','#A0693F'] };
function slMedalha(t){
  const s = String(t||'');
  for (const k in MEDALHA) if (s.indexOf(k) >= 0) return MEDALHA[k];
  return null;
}

/* ── TABELA ────────────────────────────────────────────────────────────────
   Recebe o que o __cm.extrai devolveu e devolve UMA OU MAIS páginas, porque
   tabela que não cabe vira slide seguinte — nunca linha cortada em silêncio.
   A fonte cai por degraus até caber; abaixo do piso, pagina. */
function slTabela(tit, sub, dados, opt){
  opt = opt || {};
  const cab = dados.cab || [], linhas = dados.linhas || [];
  if (!linhas.length) return [];

  /* largura por coluna: a 1ª (rótulo) leva o dobro; as de número, o mínimo
     que couber o maior valor. Coluna estreita demais é o que truncava. */
  const nCol = cab.length;
  const larg = cab.map((c,i) => {
    if (opt.larg && opt.larg[i]) return opt.larg[i];
    const maior = Math.max(String(c).length,
      ...linhas.map(l => (l.cels[i] ? String(l.cels[i].t).length : 0)));
    return Math.max(i === 0 ? 2.1 : 1, Math.min(4, maior / 9));
  });
  const som = larg.reduce((a,b)=>a+b,0);

  const paginas = [];
  let corpo = linhas.slice(), pag = 0;
  while (corpo.length) {
    const { el, mio } = slNovo(tit, pag ? (sub ? sub + ' · continuação' : 'continuação') : sub);
    const rot = opt.rotulo && !pag;
    if (rot) { const r = document.createElement('div'); r.className='sl-rot'; r.textContent=opt.rotulo; mio.appendChild(r); }

    const wrap = document.createElement('div'); wrap.className = 'sl-tw'; mio.appendChild(wrap);
    const t = document.createElement('table'); t.className = 'sl-t'; wrap.appendChild(t);
    t.innerHTML = '<colgroup>' + larg.map(w=>`<col style="width:${(w/som*100).toFixed(2)}%">`).join('') + '</colgroup>'
      + '<thead><tr>' + cab.map((c,i)=>`<th class="${dados.dir&&dados.dir[i]?'n':''}"></th>`).join('') + '</tr></thead>'
      + '<tbody></tbody>';
    [...t.querySelectorAll('th')].forEach((th,i)=>{ th.textContent = cab[i]; });

    const tb = t.querySelector('tbody');
    const cabeH = 150 + (rot ? 34 : 0);      // moldura + título + rótulo
    const disp = SL.H - cabeH - 52;

    /* a fonte desce por degraus até a tabela caber; só então pagina */
    let fs = opt.fs || 17, entraram = 0;
    for (;;) {
      t.style.fontSize = fs + 'px';
      tb.innerHTML = ''; entraram = 0;
      for (const l of corpo) {
        const tr = document.createElement('tr');
        if (l.total) tr.className = 'tot';
        tr.innerHTML = l.cels.map((c,i)=>`<td class="${c.dir||(dados.dir&&dados.dir[i])?'n':''}"></td>`).join('');
        [...tr.children].forEach((td,i)=>{
          const c = l.cels[i]; if (!c) return;
          slCelula(td, c);
        });
        tb.appendChild(tr);
        if (wrap.scrollHeight > disp && entraram > 0) { tb.removeChild(tr); break; }
        entraram++;
      }
      if (entraram === corpo.length || fs <= 12) break;
      fs -= 1;
    }
    paginas.push(el);
    corpo = corpo.slice(entraram);
    pag++;
    if (pag > 12) break;                     // trava contra laço infinito
  }
  return paginas;
}

/* ── KPIs + gráfico (o desenho do Scorecard) ───────────────────────────── */
/* Pinta uma célula da tabela do slide.
   · medalha vira o LUGAR colorido — emoji não sobrevive à fonte do
     documento e virava "Ø>ÝG" no ranking (Renan, 19/09/2026);
   · a quebra de linha do Fato do FCA é preservada: achatada, virava um
     parágrafo ilegível no slide que ele chamou de "a maior merda que já vi". */
function slCelula(td, c){
  const med = slMedalha(c.t);
  if (med) { td.textContent = med[0]; td.style.color = med[1]; td.style.fontWeight = '800'; return; }
  td.textContent = c.t;
  if (/\n/.test(c.t)) td.style.whiteSpace = 'pre-line';
  td.style.color = slCor(c.cor);
  if (c.neg) td.style.fontWeight = '700';
}

function slKpis(mio, kpis, porLinha){
  const g = document.createElement('div'); g.className = 'sl-kpis';
  const n = porLinha || Math.min(5, Math.ceil(kpis.length / Math.ceil(kpis.length/5)));
  g.style.gridTemplateColumns = `repeat(${n},1fr)`;
  kpis.forEach(k => {
    const c = document.createElement('div'); c.className = 'sl-kpi';
    c.innerHTML = '<div class="r"></div><div class="v"></div>' + (k.meta ? '<div class="m"></div>' : '');
    c.querySelector('.r').textContent = k.rotulo || '';
    const v = c.querySelector('.v'); v.textContent = k.valor || '—'; v.style.color = slCor(k.cor);
    if (k.meta) c.querySelector('.m').textContent = k.meta;
    g.appendChild(c);
  });
  mio.appendChild(g);
  return g;
}

function slHero(mio, h){
  const d = document.createElement('div'); d.className = 'sl-hero';
  d.innerHTML = `<div><div class="r"></div><div class="v"></div></div><div class="d"></div>`;
  d.querySelector('.r').textContent = h.rotulo || '';
  const v = d.querySelector('.v'); v.textContent = h.valor || '—'; v.style.color = slCor(h.cor);
  const ds = d.querySelector('.d');
  (h.deltas||[]).forEach(x => {
    const e = document.createElement('div');
    e.innerHTML = '<span></span><b></b>';
    e.querySelector('span').textContent = x.rotulo;
    const b = e.querySelector('b'); b.textContent = x.valor; b.style.color = slCor(x.cor);
    ds.appendChild(e);
  });
  mio.appendChild(d);
  return d;
}

/* ── GRÁFICO: redesenhado com os dados do painel ───────────────────────────
   O gráfico vinha VAZIO no deck (Renan, 19/09: "Dispersão de km seara não
   saiu") porque a foto saía no meio da animação do Chart.js — pintar o canvas
   não muda o DOM, então a régua de "carregou" não via nada acontecendo.
   Aqui o gráfico é desenhado no slide com animation:false: quando o desenho
   volta, ele já está pronto. Não há corrida para perder.                   */
function slGrafico(mio, g){
  const card = document.createElement('div'); card.className = 'sl-card';
  card.innerHTML = `<div class="ct"></div>${g.sub?'<div class="cs"></div>':''}<div class="sl-cv"><canvas></canvas></div>`;
  card.querySelector('.ct').textContent = g.titulo || '';
  if (g.sub) card.querySelector('.cs').textContent = g.sub;
  card.style.flex = '1';
  mio.appendChild(card);

  const cv = card.querySelector('canvas');
  const Chart = window.Chart;
  if (!Chart) { card.querySelector('.sl-cv').innerHTML = '<div class="sl-vazio">gráfico indisponível</div>'; return card; }

  const fonte = { family:'Montserrat', size:13 };
  new Chart(cv.getContext('2d'), {
    type: g.tipo || 'bar',
    data: {
      labels: g.labels || [],
      datasets: (g.datasets||[]).map(d => Object.assign({
        borderWidth: d.tipo === 'line' ? 3 : 0,
        borderRadius: d.tipo === 'line' ? 0 : 4,
        tension: .3, pointRadius: 3,
      }, d, { type: d.tipo || undefined })),
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      animation:false,                       // ← é isto que tira a corrida
      layout:{ padding:{ top:18 } },
      plugins:{
        legend:{ display:(g.datasets||[]).length>1, position:'top', align:'end',
          labels:{ color:TK.txt2, font:fonte, boxWidth:14, usePointStyle:true } },
        tooltip:{ enabled:false },
        datalabels: window.ChartDataLabels ? {
          anchor:'end', align:'end', offset:2,
          color:TK.txt2, font:{ family:'Montserrat', size:12, weight:'700' },
          formatter:(v,c)=> (g.rotulo ? g.rotulo(v,c) : (v==null?'':v)),
          display:(c)=> g.semRotulo ? false : c.dataset.type !== 'line',
        } : undefined,
      },
      scales:{
        x:{ grid:{ display:false }, border:{ color:TK.linha },
            ticks:{ color:TK.txt3, font:fonte } },
        y:{ grid:{ color:TK.grade, drawBorder:false },
            border:{ display:false },
            ticks:{ color:TK.txt3, font:fonte,
                    callback:(v)=> g.eixoY ? g.eixoY(v) : v },
            beginAtZero: g.zero !== false,
            suggestedMax: g.max },
      },
    },
    plugins: window.ChartDataLabels ? [window.ChartDataLabels] : [],
  });
  return card;
}

/* ── PÓDIO ─────────────────────────────────────────────────────────────────
   Renan, 19/09: o pódio saía como tarja escura estreita boiando no slide
   branco, com os degraus cortados na base. Esta visão é escura por natureza,
   então o SLIDE INTEIRO é escuro e o pódio usa a altura toda. As medalhas
   viraram cor (ouro/prata/bronze): emoji não sobrevive à fonte do PDF — foi
   o que produziu "Ø>ÝG" no Ranking.                                        */
function slPodio(tit, sub, tres){
  const { el, mio } = slNovo(tit, sub, true);
  const d = document.createElement('div'); d.className = 'sl-pod';
  const ordem = [tres[1], tres[0], tres[2]];      // 2º no meio-esquerda, 1º ao centro
  const cls = ['p2','p1','p3'], lug = ['2º LUGAR','1º LUGAR','3º LUGAR'];
  ordem.forEach((p,i) => {
    if (!p) return;
    const c = document.createElement('div'); c.className = 'p ' + cls[i];
    c.innerHTML = `<div class="lug">${lug[i]}</div><div class="nm"></div><div class="un"></div><div class="pt"></div>`;
    c.querySelector('.nm').textContent = p.nome || '';
    c.querySelector('.un').textContent = p.unidade || '';
    c.querySelector('.pt').textContent = p.pontos || '';
    d.appendChild(c);
  });
  mio.appendChild(d);
  return [el];
}

/* ── captura: o slide vira imagem ──────────────────────────────────────────
   JPEG, NÃO PNG — e isto não é preferência (bug real, 19/09/2026): o deck de
   ago/2026 tem 46 slides e a geração morria em "Invalid string length" no
   "Montando o arquivo…". PNG de 3200×1800 dá ~5 MB em base64; 46 deles são
   ~230 MB de texto, e o jsPDF concatena tudo numa string só — passa do teto
   que o V8 aceita para uma string e o arquivo inteiro se perde no fim, depois
   de 5 minutos de trabalho. JPEG de qualidade alta corta isso ~8× e, em 240
   dpi, o texto continua limpo na tela e no papel.
   Fundo OPACO de propósito: JPEG não tem transparência, e sem isto o que
   estivesse transparente viraria preto. */
async function slFoto(el){
  const escuro = /escuro/.test(el.className);
  const cv = await window.html2canvas(el, {
    scale: SL.esc, backgroundColor: escuro ? '#141416' : TK.fundo, logging: false,
    width: SL.W, height: SL.H, windowWidth: SL.W, windowHeight: SL.H,
  });
  return cv.toDataURL('image/jpeg', 0.93);
}

function slLimpa(){
  const p = document.getElementById('sl-palco');
  if (p) p.innerHTML = '';
}

window.SlidePadrao = { SL, TK, slNovo, slTabela, slKpis, slHero, slGrafico, slPodio, slFoto, slLimpa, slCor, slPalco };

/* ── MONTADOR: de conteúdo colhido para páginas de slide ───────────────────
   Um slide pode ter um bloco (a tabela de pacotes) ou dois empilhados (a
   Árvore + o FCA do mesmo recorte, que o Renan pediu juntos em 18/09). Cada
   bloco é {rot, tabela|kpis|graf|png}. Quando é um bloco só e ele é tabela,
   a paginação entra: o que não coube vira o slide seguinte, nunca uma linha
   cortada em silêncio.                                                      */
function slMonta(tit, sub, blocos){
  slGaranteCss();
  const b = (blocos||[]).filter(Boolean);
  if (!b.length) return [];

  /* bloco único e tabela pura: deixa o paginador trabalhar */
  if (b.length === 1 && b[0].tabela && !b[0].graf && !(b[0].kpis||[]).length)
    return slTabela(tit, sub, b[0].tabela, { rotulo: b[0].rot });

  const { el, mio } = slNovo(tit, sub);
  b.forEach((x, i) => {
    if (x.rot) { const r = document.createElement('div'); r.className='sl-rot'; r.textContent=x.rot; mio.appendChild(r); }

    /* hero + cards: o Scorecard e os painéis de KPI */
    if (x.kpis && x.kpis.length) {
      const k = x.kpis.slice(0, 20);
      slKpis(mio, k, k.length <= 6 ? k.length : (k.length <= 12 ? Math.ceil(k.length/2) : Math.ceil(k.length/3)));
    }
    if (x.graf) slGrafico(mio, x.graf);

    if (x.tabela) {
      const wrap = document.createElement('div'); wrap.className='sl-tw';
      wrap.style.flex = b.length > 1 ? '1' : '1';
      mio.appendChild(wrap);
      const t = document.createElement('table'); t.className='sl-t';
      t.style.fontSize = (b.length > 1 ? 13 : 16) + 'px';
      wrap.appendChild(t);
      const cab = x.tabela.cab||[], dir = x.tabela.dir||[];
      t.innerHTML = '<thead><tr>' + cab.map((c,i)=>`<th class="${dir[i]?'n':''}"></th>`).join('') + '</tr></thead><tbody></tbody>';
      [...t.querySelectorAll('th')].forEach((th,i)=>{ th.textContent = cab[i]; });
      const tb = t.querySelector('tbody');
      (x.tabela.linhas||[]).forEach(l => {
        const tr = document.createElement('tr');
        if (l.total) tr.className = 'tot';
        tr.innerHTML = l.cels.map((c,i)=>`<td class="${c.dir||dir[i]?'n':''}"></td>`).join('');
        [...tr.children].forEach((td,j)=>{
          const c = l.cels[j]; if (!c) return;
          slCelula(td, c);
        });
        tb.appendChild(tr);
      });
    }

    /* último recurso: a visão que ainda não sei ler como dado entra como
       imagem, mas DENTRO da moldura do padrão — nunca solta na página */
    if (x.png) {
      const box = document.createElement('div');
      box.style.cssText = 'flex:1;min-height:0;display:flex;align-items:center;justify-content:center;'
        + `background:${TK.card};border:1px solid ${TK.cardBrd};border-radius:14px;padding:14px;overflow:hidden;`;
      const img = document.createElement('img');
      img.src = x.png; img.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;display:block;';
      box.appendChild(img); mio.appendChild(box);
    }
  });
  return [el];
}

window.SlidePadrao.slMonta = slMonta;
