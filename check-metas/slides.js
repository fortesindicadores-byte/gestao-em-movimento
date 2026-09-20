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

.sl-cab{flex:0 0 auto;padding:50px 64px 0;}
.sl-tit{font-size:38px;font-weight:800;letter-spacing:-.5px;line-height:1.1;color:${TK.txt};}
.sl-sub{font-size:15px;font-weight:500;color:${TK.txt3};margin-top:8px;}
.sl-mio{flex:1;min-height:0;padding:24px 64px 50px;display:flex;flex-direction:column;gap:16px;}
.sl-rot{flex:0 0 auto;font-size:13px;font-weight:800;color:${TK.laranja};
  text-transform:uppercase;letter-spacing:1.2px;}

/* ── cards de KPI (a fileira do Scorecard) ── */
.sl-kpis{flex:0 0 auto;display:grid;gap:14px;}
.sl-kpi{background:${TK.card};border:1px solid ${TK.cardBrd};border-radius:12px;
  padding:18px 20px;display:flex;flex-direction:column;justify-content:center;gap:4px;}
.sl-kpi .r{font-size:11px;font-weight:700;color:${TK.txt3};text-transform:uppercase;letter-spacing:.8px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.sl-kpi .v{font-size:32px;font-weight:800;line-height:1.05;}
.sl-kpi .m{font-size:11px;font-weight:500;color:${TK.txt3};}
/* grade DENSA: quando o painel põe 8+ por linha (o Scorecard mostra os 20
   indicadores em 10 colunas), o card encolhe junto — senão os cards tomam a
   altura que no painel é do gráfico. */
.sl-kpis.denso{gap:7px;}
.sl-kpis.denso .sl-kpi{padding:9px 9px 8px;border-radius:9px;gap:1px;}
.sl-kpis.denso .r{font-size:8.5px;letter-spacing:.4px;white-space:normal;line-height:1.25;}
.sl-kpis.denso .v{font-size:20px;}
.sl-kpis.denso .m{font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}

/* ── hero (o número grande sem card) ──
   COMPACTO, como estava quando ele aprovou ("ficou perfeito, bem alinhado e
   distribuído"): os deltas AO LADO do valor, na mesma linha, e fundo nenhum —
   o hero é solto sobre a página. Em coluna ele ficou alto, pareceu uma faixa
   clara atrás e roubou a altura do gráfico. */
.sl-hero{flex:0 0 auto;display:flex;align-items:flex-end;gap:26px;background:transparent;}
.sl-hero .r{font-size:11px;font-weight:700;color:${TK.txt3};text-transform:uppercase;letter-spacing:1px;}
.sl-hero .v{font-size:44px;font-weight:800;line-height:1;margin-top:1px;}
.sl-hero .v .mg{font-size:.52em;font-weight:700;color:${TK.txt3};margin-left:6px;}
.sl-hero .d{display:flex;gap:18px;flex-wrap:wrap;padding-bottom:5px;}
.sl-hero .d div{font-size:9.5px;color:${TK.txt3};font-weight:700;text-transform:uppercase;letter-spacing:.6px;}
.sl-hero .d b{display:block;font-size:14px;font-weight:800;margin-top:2px;}
/* o 2º hero (o EBITDA da Visão Financeira) vai à direita, como no painel */
.sl-hero.dir{margin-left:auto;align-items:flex-end;text-align:right;}
.sl-hero.dir .d{justify-content:flex-end;}
.sl-heros{flex:0 0 auto;display:flex;align-items:flex-end;gap:32px;background:transparent;
  padding-bottom:10px;border-bottom:1px solid ${TK.linha};}
.sl-hero .s{font-size:10.5px;color:${TK.txt3};font-weight:600;margin-top:4px;}

/* ── legenda: a .gleg do painel, não as bolinhas do Chart.js ──
   Renan, 19/09/2026: "legendas nem gráfico está no padrão". O portal desenha a
   legenda em HTML acima do canvas — quadradinho para barra, tracinho tracejado
   para linha — e mantém "legend:{display:false}" no gráfico. */
.sl-gleg{display:flex;gap:14px;flex-wrap:wrap;margin-top:6px;flex:0 0 auto;}
.sl-gleg span{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:700;
  color:${TK.txt3};letter-spacing:.4px;}
.sl-gleg i{width:16px;height:0;border-top:2px dashed currentColor;display:inline-block;}
.sl-gleg i.sq{width:10px;height:10px;border:0;border-radius:2px;background:currentColor;}

/* dois gráficos lado a lado (a Dispersão e o Scorecard Financeiro têm dois) */
.sl-gg{flex:1;min-height:0;display:grid;gap:14px;}

/* ── card que embrulha gráfico ── */
.sl-card{background:${TK.card};border:1px solid ${TK.cardBrd};border-radius:14px;
  padding:18px 20px;display:flex;flex-direction:column;min-height:0;}
.sl-card .ct{font-size:15px;font-weight:800;color:${TK.txt};}
.sl-card .cs{font-size:11px;color:${TK.txt3};margin-top:2px;}
.sl-cv{flex:1;min-height:0;position:relative;margin-top:12px;}

/* ── TABELA: o table.dre do portal ──
   cabeçalho e linha de total no --cabec, grade fina, número à direita.

   table-layout AUTO, não fixed (Renan, 19/09/2026: "faltou alguns ajustes de
   espaço" no FCA e "a coluna do # pode ser pequena"). Com "fixed" eu repartia
   a largura por uma conta de caracteres minha: o "#" do ranking ficava gordo,
   o cabeçalho do FCA cortava em "PROJET"/"RESPONS" e "10/11/2026" quebrava no
   meio. Com "auto" quem reparte é o browser, pelo conteúdo — que é o que o
   painel faz. O "nowrap" no cabeçalho garante que o rótulo nunca corte, e o
   ".curto" impede data e número de quebrarem. */
.sl-tw{flex:1;min-height:0;display:flex;flex-direction:column;}
table.sl-t{width:100%;border-collapse:collapse;table-layout:auto;}
table.sl-t th{background:${TK.cabec};color:${TK.txt2};font-weight:800;font-size:.86em;
  text-transform:uppercase;letter-spacing:.5px;text-align:left;white-space:nowrap;
  padding:11px 12px;border-bottom:1px solid ${TK.linha};}
table.sl-t th.sl-n{text-align:right;}
table.sl-t td{padding:10px 12px;border-bottom:1px solid ${TK.linha};color:${TK.txt};
  vertical-align:top;overflow-wrap:anywhere;}
table.sl-t td.sl-n{text-align:right;white-space:nowrap;}
table.sl-t td.curto,table.sl-t th.curto{white-space:nowrap;overflow-wrap:normal;width:1%;}
/* NOWRAP SEM ENCOLHER: quando TODA coluna é curta (tabela só de números, como
   a abertura por unidade), pôr width:1% em todas deixa a tabela sem ninguém
   para absorver a sobra — e ela foi inteira para a primeira coluna, com um
   vão enorme entre UNIDADE e REM (Renan, 20/09/2026: "aqui dá para distribuir
   um pouco melhor"). Aí vale só o nowrap, e o browser reparte o resto. */
table.sl-t td.nq,table.sl-t th.nq{white-space:nowrap;overflow-wrap:normal;}
table.sl-t tr.tot td{background:${TK.cabec};font-weight:800;border-bottom:none;}
/* SEM ZEBRA (Renan, 19/09/2026: "tabela com cor sim cor não"). A tabela do
   portal não tem linha alternada: o que separa as linhas é o filete de
   --linha, e o realce é o hover — que num slide não existe. Eu havia posto o
   nth-child par achando que ajudava a ler; é invenção, e invenção sai. */

/* ── CHIP: quando é o PAINEL que pinta a célula ──
   Renan, 19/09/2026: "auditorias sem as cores dos níveis, ranking do Frota de
   Elite totalmente sem cor". As duas telas pintam um <span> DENTRO do <td>
   (.niv da Auditoria, .score-pill/.ind-green do ranking) e eu lia a cor do
   <td>, que é a herdada — então TODA cor se perdia. Agora a cor sai do
   elemento que realmente pinta, e quando ele tem fundo o chip vem junto. */
table.sl-t td .sl-chip{display:inline-block;padding:3px 11px;border-radius:12px;
  font-weight:800;text-align:center;min-width:44px;}
table.sl-t td .sl-chip.bloco{display:block;padding:9px 6px;border-radius:7px;min-width:0;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
table.sl-t td.chip{padding:3px 4px;}

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

/* ── pódio: escuro, o slide inteiro, na temática do Frota de Elite ──
   o fundo é o mesmo do .podio-section do painel (radiais quentes sobre um
   quase-preto), não um cinza escuro qualquer */
.sl.escuro{color:#EEF2FA;
  background:radial-gradient(ellipse at 20% 0%,rgba(196,145,26,.14) 0%,transparent 55%),
             radial-gradient(ellipse at 80% 100%,rgba(120,60,10,.20) 0%,transparent 50%),
             linear-gradient(180deg,#0a0c0e 0%,#050608 100%);}
.sl.escuro .sl-tit{color:#FFF;text-transform:uppercase;letter-spacing:2px;
  text-shadow:0 0 30px rgba(196,145,26,.5);}
.sl.escuro .sl-sub{color:#FFF;font-weight:600;}
.sl.escuro .sl-cab,.sl.escuro .sl-mio{position:relative;z-index:2;}
/* O BONECO É PARTE DO PÓDIO (Renan, 19/09/2026: "pódios sem os bonecos").
   O painel desenha o avatar do gestor acima do degrau — é o que faz o slide
   ser o pódio dele e não uma tabela de três linhas. A imagem vem do próprio
   painel (a URL do <img class="avatar-img">), então não há arte nova aqui. */
/* O NOME DA CLASSE ERA ".av" E COLIDIA COM A DO PRÓPRIO CHECK DE METAS
   (bug real, 19/09/2026: "esse laranja curvado atrás ficou ridículo"). O palco
   do slide mora DENTRO desta página, e ela tem ".av{border-radius:50%;
   background:#F97316}" para o avatar do usuário na lateral — então cada boneco
   ganhava uma elipse laranja atrás. Não era blend mode nem o arquivo do
   boneco: os PNGs têm alfa e os cantos são transparentes. Toda classe do slide
   é "sl-" justamente por isso; esta tinha escapado. */
.sl-pod-bras{position:absolute;top:50%;left:50%;transform:translate(-50%,-55%);
  width:600px;height:600px;background-position:center;background-repeat:no-repeat;
  background-size:contain;opacity:.09;pointer-events:none;z-index:0;}
.sl-pod{flex:1;display:flex;align-items:flex-end;justify-content:center;gap:0;
  padding-bottom:18px;position:relative;z-index:2;}
.sl-pod .s{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;}
.sl-pod .sl-av{display:block;background:none;border-radius:0;object-fit:contain;
  object-position:bottom center;margin-bottom:-2px;
  filter:drop-shadow(0 16px 40px rgba(0,0,0,.9));}
.sl-pod .s1 .sl-av{width:200px;height:240px;}
.sl-pod .s2 .sl-av,.sl-pod .s3 .sl-av{width:170px;height:200px;}
/* o pedestal do painel: cilindro escuro, colado no vizinho, com o filete de
   luz no topo — no painel os três se encostam (gap:0) e formam um pódio só */
.sl-pod .p{width:220px;padding:18px 16px 20px;text-align:center;
  display:flex;flex-direction:column;align-items:center;gap:5px;
  background:linear-gradient(180deg,#1c1c1e 0%,#0d0d0f 100%);
  border-top:3px solid rgba(255,255,255,.12);
  border-left:1px solid rgba(255,255,255,.06);
  border-right:1px solid rgba(255,255,255,.06);
  box-shadow:inset 0 2px 0 rgba(255,255,255,.07), 0 -2px 20px rgba(0,0,0,.6);}
.sl-pod .p .lug{font-size:11px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:#8C93A3;}
.sl-pod .p .nm{font-size:24px;font-weight:800;color:#FFF;line-height:1.15;}
.sl-pod .p .un{font-size:11px;font-weight:600;letter-spacing:1px;color:#8C93A3;text-transform:uppercase;}
.sl-pod .p .pt{font-size:21px;font-weight:800;margin-top:2px;}
.sl-pod .s1 .p{height:210px;border-top:3px solid #C4911A;}
.sl-pod .s1 .p .lug,.sl-pod .s1 .p .pt{color:#C4911A;}
.sl-pod .s2 .p{height:172px;}
.sl-pod .s3 .p{height:150px;}

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

/* A SOBRA DE LARGURA É REPARTIDA POR IGUAL, NÃO PROPORCIONALMENTE
   (Renan, 20/09/2026: "todas as tabelas assim, sem distribuir").
   O table-layout auto dá a folga a quem já é largo, então a coluna de rótulo
   ficava com ~62% da tabela e os números se amontoavam na ponta direita, com
   um vão no meio. Aqui eu meço a largura INTRÍNSECA de cada coluna e devolvo a
   sobra em partes iguais — ninguém aperta e ninguém engorda. */
function slLarguras(t, wrap){
  const ths = [...t.querySelectorAll('thead th')];
  if (ths.length < 2) return;
  /* o wrap é FLEX: com align-items:stretch a tabela ocupa a largura toda mesmo
     com width:auto, e a medida saía igual à esticada — folga zero, nada
     mudava. align-self:flex-start solta o eixo cruzado. */
  const largAnt = t.style.width, selfAnt = t.style.alignSelf;
  t.style.width = 'auto'; t.style.alignSelf = 'flex-start';
  const nat = ths.map(th => th.getBoundingClientRect().width);
  t.style.width = largAnt || '100%'; t.style.alignSelf = selfAnt;
  const somaNat = nat.reduce((a,b)=>a+b,0);
  const disp = wrap.clientWidth;
  const folga = disp - somaNat;
  if (folga <= 10) return;
  const parte = folga / nat.length;
  t.style.tableLayout = 'fixed';
  const velho = t.querySelector('colgroup'); if (velho) velho.remove();
  const cg = document.createElement('colgroup');
  nat.forEach(w => { const c = document.createElement('col');
    c.style.width = ((w + parte) / disp * 100).toFixed(3) + '%'; cg.appendChild(c); });
  t.insertBefore(cg, t.firstChild);
}

/* ── TABELA ────────────────────────────────────────────────────────────────
   Recebe o que o __cm.extrai devolveu e devolve UMA OU MAIS páginas, porque
   tabela que não cabe vira slide seguinte — nunca linha cortada em silêncio.
   A fonte cai por degraus até caber; abaixo do piso, pagina. */
function slTabela(tit, sub, dados, opt){
  opt = opt || {};
  const cab = dados.cab || [], linhas = dados.linhas || [];
  if (!linhas.length) return [];

  /* COLUNA CURTA NÃO QUEBRA. Quem reparte a largura é o browser (table-layout
     auto), mas ele ainda quebraria "10/11/2026" ao meio se a coluna apertasse.
     Coluna cujo maior valor cabe em 14 caracteres é rótulo curto, data ou
     número: leva nowrap e ocupa o mínimo — é o que deixa o `#` do ranking
     estreito e devolve a largura para Fato, Causa e Ação. */
  const curta = cab.map((c,i) => {
    const maior = Math.max(...linhas.map(l => (l.cels[i] ? String(l.cels[i].t).length : 0)), 0);
    return maior > 0 && maior <= 14 && !/\n/.test(linhas.map(l => (l.cels[i]||{}).t || '').join(''));
  });
  /* ENCOLHER SÓ QUANDO HÁ DUAS OU MAIS COLUNAS LARGAS (o FCA, com Fato, Causa
     e Ação). Com UMA só — a abertura por conta, a abertura por unidade — toda
     a sobra ia para ela e abria um vão enorme entre o rótulo e o primeiro
     número. Aí o browser reparte, que é o que o painel faz. */
  const kls = curta.filter(c => !c).length >= 2 ? 'curto' : 'nq';

  const paginas = [];
  let corpo = linhas.slice(), pag = 0;
  while (corpo.length) {
    const { el, mio } = slNovo(tit, pag ? (sub ? sub + ' · continuação' : 'continuação') : sub);
    const rot = opt.rotulo && !pag;
    if (rot) { const r = document.createElement('div'); r.className='sl-rot'; r.textContent=opt.rotulo; mio.appendChild(r); }

    const wrap = document.createElement('div'); wrap.className = 'sl-tw'; mio.appendChild(wrap);
    const t = document.createElement('table'); t.className = 'sl-t'; wrap.appendChild(t);
    t.innerHTML = '<thead><tr>'
      + cab.map((c,i)=>`<th class="${dados.dir&&dados.dir[i]?'sl-n ':''}${curta[i]?kls:''}"></th>`).join('')
      + '</tr></thead><tbody></tbody>';
    [...t.querySelectorAll('th')].forEach((th,i)=>{ th.textContent = cab[i]; });

    const tb = t.querySelector('tbody');
    const agr = slRepetido(cab, opt.agrupa);
    let ant = [];

    /* A RÉGUA É A ALTURA DO WRAP, NÃO UMA CONTA DE CABEÇA (bug real,
       19/09/2026). Eu comparava `wrap.scrollHeight` com uma altura estimada
       (900 − 150 − 52). Mas o `.sl-tw` é `flex:1`, então o scrollHeight dele
       NUNCA é menor que o clientHeight — a comparação dava verdadeira já na
       PRIMEIRA linha e a tabela saía a UMA LINHA POR SLIDE. Foi isso que
       inflou o deck de ago/2026 (o R$/Km sozinho virou quatro páginas de uma
       linha). O que cabe ou não é a altura da TABELA contra a caixa. */
    let fs = opt.fs || 14, entraram = 0;
    for (;;) {
      t.style.fontSize = fs + 'px';
      tb.innerHTML = ''; entraram = 0; ant = [];
      for (const l of corpo) {
        const tr = document.createElement('tr');
        if (l.total) tr.className = 'tot';
        tr.innerHTML = l.cels.map((c,i)=>
          `<td class="${c.dir||(dados.dir&&dados.dir[i])?'sl-n ':''}${curta[i]?kls:''}"></td>`).join('');
        [...tr.children].forEach((td,i)=>{
          const c = l.cels[i]; if (!c) return;
          if (agr[i] && !l.total && ant[i] === c.t) { td.textContent = ''; return; }
          if (agr[i]) ant[i] = c.t;
          slCelula(td, c);
        });
        tb.appendChild(tr);
        if (t.offsetHeight > wrap.clientHeight + 2 && entraram > 0) { tb.removeChild(tr); ant = []; break; }
        entraram++;
      }
      if (entraram === corpo.length || fs <= 10) break;
      fs -= 1;
    }
    slLarguras(t, wrap);

    /* NADA DE "RESPIRO" AQUI (revertido em 20/09/2026). Eu repartia a sobra
       de altura como padding das linhas, e isso: inflou o cabeçalho a ponto de
       virar uma placa clara no meio da página, abriu um vão entre ele e a
       única linha, esticou tabelas que já estavam boas e — o pior — fez caber
       MENOS linha, jogando a RON das Auditorias e a 13ª do Ranking para fora.
       Renan: "mudou o que estava bom". Tabela curta fica curta. */
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

  /* O PAINEL PINTOU A CÉLULA: vira chip, com o par fundo+texto que ELE
     escolheu. Reinterpretar a cor aqui é o que o slCor faz com texto comum
     (cinza herdado → token do slide); sobre um fundo de nível de auditoria
     isso quebraria o contraste que a tela já resolveu. */
  if (c.bg) {
    const s = document.createElement('span');
    s.className = 'sl-chip' + (c.bloco ? ' bloco' : '');
    s.textContent = c.t;
    s.style.background = c.bg;
    s.style.color = c.cor || slContraste(c.bg);
    td.className += ' chip';
    td.style.textAlign = 'center';
    td.appendChild(s);
    return;
  }

  td.textContent = c.t;
  if (/\n/.test(c.t)) td.style.whiteSpace = 'pre-line';
  td.style.color = slCor(c.cor);
  if (c.neg) td.style.fontWeight = '700';
}

/* o texto que o painel escreveu para aquele ponto: string, '' (vazio de
   propósito) ou false (não deu para saber — aí quem formata é o portal) */
function slRot(g, c){
  const d = (g.datasets||[])[c.datasetIndex];
  if (!d || !d.rotulos) return false;
  const t = d.rotulos[c.dataIndex];
  return t === undefined || t === null ? false : t;
}

/* preto ou branco sobre o fundo dado — só usado quando o painel não declarou
   cor de texto no elemento que pinta */
function slContraste(bg){
  const m = String(bg||'').match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (!m) return TK.txt;
  return (0.299*+m[1] + 0.587*+m[2] + 0.114*+m[3]) > 150 ? '#0C1017' : '#FFFFFF';
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

function slHero(pai, h, dir){
  const d = document.createElement('div'); d.className = 'sl-hero' + (dir ? ' dir' : '');
  d.innerHTML = `<div><div class="r"></div><div class="v"></div>${h.sub?'<div class="s"></div>':''}</div><div class="d"></div>`;
  d.querySelector('.r').textContent = h.rotulo || '';
  const v = d.querySelector('.v');
  /* o "(19,7%)" do EBITDA é um sufixo menor e apagado no painel; no mesmo
     corpo do número ele competia com o valor */
  const m = String(h.valor || '—').match(/^(.*?)\s*(\([^)]*\))\s*$/);
  if (m) { v.textContent = m[1];
    const sp = document.createElement('span'); sp.className = 'mg'; sp.textContent = m[2];
    v.appendChild(sp); }
  else v.textContent = h.valor || '—';
  v.style.color = slCor(h.cor);
  if (h.sub) d.querySelector('.s').textContent = h.sub;
  const ds = d.querySelector('.d');
  (h.deltas||[]).forEach(x => {
    const e = document.createElement('div');
    e.innerHTML = '<span></span><b></b>';
    e.querySelector('span').textContent = x.rotulo;
    const b = e.querySelector('b'); b.textContent = x.valor; b.style.color = slCor(x.cor);
    ds.appendChild(e);
  });
  pai.appendChild(d);
  return d;
}

/* O HERO É O NÚMERO QUE SE LÊ PRIMEIRO e ficava de fora do deck (Renan,
   19/09/2026: "faltou realizado"). Quando o painel tem dois — Receita Líquida
   e EBITDA —, o segundo vai à direita, como no painel. */
function slHeros(mio, hs){
  if (!hs || !hs.length) return null;
  if (hs.length === 1) { const h = slHero(mio, hs[0]); h.style.flex = '0 0 auto'; return h; }
  const fila = document.createElement('div'); fila.className = 'sl-heros';
  mio.appendChild(fila);
  hs.slice(0, 2).forEach((h, i) => slHero(fila, h, i > 0));
  return fila;
}

/* vários gráficos no mesmo slide, lado a lado */
function slGrafs(mio, gs){
  if (!gs || !gs.length) return null;
  if (gs.length === 1) return slGrafico(mio, gs[0]);
  const g = document.createElement('div'); g.className = 'sl-gg';
  const n = Math.min(gs.length, 3);
  g.style.gridTemplateColumns = `repeat(${n},minmax(0,1fr))`;
  mio.appendChild(g);
  gs.slice(0, 3).forEach(x => slGrafico(g, x));
  return g;
}

/* FATO IGUAL NÃO SE REPETE LINHA A LINHA (Renan, 19/09/2026, duas vezes:
   "esse FCA repetiu 3 vezes" · "FCA PIR repetindo 3 vezes de novo").
   Os três registros são do MESMO pacote com causas e ações diferentes, então a
   coluna Fato traz o mesmo bloco — pacote, desvio e a lista de Contas — três
   vezes, e a página inteira parece o mesmo FCA copiado. Aqui o Fato aparece
   UMA vez por grupo e as repetições ficam em branco; nada é removido, e o que
   muda de linha para linha (Causa, Ação, Prazo) fica óbvio.
   Recomeça a cada página: quem vê a continuação precisa saber de que Fato é. */
function slRepetido(cab, agrupa){
  const nrm = s => String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().trim();
  const alvo = (agrupa||[]).map(nrm);
  return (cab||[]).map(c => alvo.includes(nrm(c)));
}

/* COLUNA DO RECORTE SAI DA TABELA: Unidade, Projeto e Vigência do FCA são
   iguais em toda linha e já estão no título do slide. Só remove quando o
   cabeçalho casa E sobra coluna — nunca esvazia a tabela. */
function slSemCols(tab, fora){
  if (!tab || !(fora||[]).length) return tab;
  const nrm = s => String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().trim();
  const alvo = fora.map(nrm);
  const manter = (tab.cab||[]).map((c,i) => !alvo.includes(nrm(c)));
  if (manter.filter(Boolean).length < 2) return tab;
  return { ...tab,
    cab: tab.cab.filter((_,i)=>manter[i]),
    dir: (tab.dir||[]).filter((_,i)=>manter[i]),
    linhas: (tab.linhas||[]).map(l => ({ ...l, cels: l.cels.filter((_,i)=>manter[i]) })) };
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

  /* A LEGENDA DO PAINEL, em HTML, acima do canvas — a do Chart.js (bolinhas
     no canto, dentro de uma caixa) não existe em lugar nenhum do portal. */
  /* SEM .gleg MAS COM LEGENDA NATIVA LIGADA (o Frota de Elite é assim), a
     legenda é montada dos próprios datasets — no desenho do portal, não nas
     bolinhas do Chart.js. Sem isto o slide saía sem legenda alguma. */
  let leg = g.legenda;
  if (!(leg||[]).length && g.legNativa)
    leg = (g.datasets||[]).filter(d => d.label).map(d => ({
      t: d.label,
      cor: (typeof d.backgroundColor === 'string' ? d.backgroundColor : null)
        || (typeof d.borderColor === 'string' ? d.borderColor : null) || TK.txt3,
      sq: d.tipo !== 'line',
    }));
  if ((leg||[]).length) {
    const lg = document.createElement('div'); lg.className = 'sl-gleg';
    leg.forEach(x => {
      const s = document.createElement('span');
      s.style.color = x.cor || TK.txt3;
      const i = document.createElement('i'); if (x.sq) i.className = 'sq';
      s.appendChild(i);
      const t = document.createElement('b');
      t.style.cssText = 'font-weight:700;color:' + TK.txt3;
      t.textContent = x.t; s.appendChild(t);
      lg.appendChild(s);
    });
    card.insertBefore(lg, card.querySelector('.sl-cv'));
  }

  const cv = card.querySelector('canvas');
  const Chart = window.Chart;
  if (!Chart) { card.querySelector('.sl-cv').innerHTML = '<div class="sl-vazio">gráfico indisponível</div>'; return card; }
  slRegistraRotulos();

  const fonte = { family:'Montserrat', size:12 };
  /* O EIXO É O DO PAINEL: mesma janela e os MESMOS rótulos, que já vêm com
     "%" e "mi". Forçar beginAtZero achatava o desenho — a Evolução vai de 70%
     a 110% e virava 0 a 100, com as barras viradas torres. */
  const eY = g.eixoY || null;
  const mapaY = {};
  if (eY) (eY.ticks||[]).forEach(t => { mapaY[t.v] = t.l; });

  new Chart(cv.getContext('2d'), {
    type: g.tipo || 'bar',
    data: {
      labels: g.labels || [],
      /* sem default meu: o que o painel definiu (borda, raio, largura da
         barra, pontos, tensão) vem no próprio dataset; o que ele não definiu
         fica no default do Chart.js — o mesmo que o painel usa */
      datasets: (g.datasets||[]).map(d => Object.assign({}, d, { type: d.tipo || undefined })),
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      animation:false,                       // ← é isto que tira a corrida
      layout:{ padding:{ top:18 } },
      plugins:{
        /* nunca a legenda nativa: quando o painel tem .gleg ela já foi
           desenhada acima; quando não tem, o portal também não mostra */
        legend:{ display:false },
        tooltip:{ enabled:false },
        /* RÓTULO DE DADOS NO TOPO DA BARRA — é o padrão do portal ("sem grade,
           barras coladas, rótulo de dados no topo") e faltava no deck
           (Renan, 19/09/2026). O número passa pelo slNum: cru, o valor vinha
           "1234567.8912" e ocupava mais que a barra. clamp segura o rótulo
           dentro da área quando a barra bate no teto. */
        /* O RÓTULO É O QUE O PAINEL ESCREVE ("+17.7%", "334.55k", "5.00 mi"),
           inclusive a regra de QUANDO aparecer — a Dispersão põe em toda
           barra, o Scorecard Financeiro só no mês corrente. Reformatando eu
           tirava o sinal e o sufixo. 13px = os 11 de antes + os 2 que ele
           pediu. */
        datalabels: {
          anchor:'end', align:'end', offset:3, clamp:true, clip:false,
          color:TK.txt, font:{ family:'Montserrat', size:13, weight:'700' },
          /* O PAINEL MANDA EM DUAS COISAS SEPARADAS: se o rótulo aparece
             (`mostra`) e, quando ele mesmo escreve o texto, qual é
             (`rotulos`, só quando o painel tem formatter). Juntar as duas foi
             o que deixou a Evolução SEM rótulo nenhum: lá o painel só liga o
             plugin (`datalabels:{}`) e desliga nas linhas de meta, sem dizer o
             texto — então quem formata é o portal. */
          formatter:(v,c)=>{
            const t = slRot(g, c);
            return t === false ? slNum(v) : t;
          },
          display:(c)=>{
            const d = (g.datasets||[])[c.datasetIndex];
            if (d && d.mostra && d.mostra[c.dataIndex] === false) return false;
            const t = slRot(g, c);
            if (t === '') return false;            // o painel escreveu vazio
            if (t !== false) return true;          // o painel escreveu o texto
            if (g.rotDef) return true;             // o painel rotula, só não sei o texto
            return c.dataset.type !== 'line' && c.dataset.type !== 'pie';
          },
        },
      },
      scales:{
        x:{ grid:{ display:!!(g.eixoX && g.eixoX.grade), color:TK.grade },
            border:{ color:TK.linha },
            ticks:{ color:TK.txt3, font:fonte } },
        y:{ display: !(eY && eY.oculto),
            grid:{ color:TK.grade, drawBorder:false },
            border:{ display:false },
            ticks:{ color:TK.txt3, font:fonte,
                    callback:(v)=> (mapaY[v] !== undefined ? mapaY[v] : slNum(v)) },
            beginAtZero: eY ? false : true,
            min: eY && isFinite(eY.min) ? eY.min : undefined,
            max: eY && isFinite(eY.max) ? eY.max : undefined },
      },
    },
  });
  return card;
}

/* O PLUGIN PRECISA SER REGISTRADO — e UMA vez só.
   Antes eu o passava no `plugins:[]` de cada gráfico. Registrar no Chart é o
   caminho documentado e vale para todos; e registrar aqui, em vez de no topo
   do arquivo, é porque o slides.js carrega antes de o Chart.js estar pronto em
   alguma ordem de <script> — a checagem no uso não depende da ordem. */
let _rotReg = false;
function slRegistraRotulos(){
  if (_rotReg || !window.Chart || !window.ChartDataLabels) return;
  try { window.Chart.register(window.ChartDataLabels); } catch(e){}
  _rotReg = true;
}

/* número no vocabulário do portal (o numFmt do padrão), mas guardando a casa
   decimal quando o valor é pequeno: km/L 2,52 arredondado para "3" viraria
   outro indicador. */
function slNum(v){
  if (v == null || v === '' || isNaN(v)) return '';
  const n = +v, a = Math.abs(n), s = n < 0 ? '-' : '';
  const br = (x,d)=> x.toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
  if (a >= 1e9) return s + br(a/1e9,1) + ' bi';
  if (a >= 1e6) return s + br(a/1e6,1) + ' mi';
  if (a >= 1e4) return s + br(Math.round(a/1e3),0) + 'k';
  if (a >= 100) return s + br(Math.round(a),0);
  if (a >= 10)  return s + br(Math.round(a*10)/10,1);
  return s + br(Math.round(a*100)/100, a === Math.round(a) ? 0 : 2);
}

/* ── PÓDIO ─────────────────────────────────────────────────────────────────
   Renan, 19/09: o pódio saía como tarja escura estreita boiando no slide
   branco, com os degraus cortados na base. Esta visão é escura por natureza,
   então o SLIDE INTEIRO é escuro e o pódio usa a altura toda. As medalhas
   viraram cor (ouro/prata/bronze): emoji não sobrevive à fonte do PDF — foi
   o que produziu "Ø>ÝG" no Ranking.                                        */
function slPodio(tit, sub, tres, brasao){
  const { el, mio } = slNovo(tit, sub, true);
  if (brasao) {
    const b = document.createElement('div'); b.className = 'sl-pod-bras';
    b.style.backgroundImage = `url("${brasao}")`;
    el.appendChild(b);
  }
  const d = document.createElement('div'); d.className = 'sl-pod';
  const ordem = [tres[1], tres[0], tres[2]];      // 2º à esquerda, 1º ao centro
  const cls = ['s2','s1','s3'], lug = ['2º LUGAR','1º LUGAR','3º LUGAR'];
  ordem.forEach((p,i) => {
    if (!p) return;
    const s = document.createElement('div'); s.className = 's ' + cls[i];
    /* o boneco vem do painel; sem avatar, o degrau só fica mais baixo — nada
       de silhueta inventada no lugar */
    if (p.avatar) {
      const im = document.createElement('img');
      im.className = 'sl-av'; im.src = p.avatar; im.alt = '';
      s.appendChild(im);
    }
    const c = document.createElement('div'); c.className = 'p';
    c.innerHTML = `<div class="lug">${lug[i]}</div><div class="nm"></div><div class="un"></div><div class="pt"></div>`;
    c.querySelector('.nm').textContent = p.nome || '';
    c.querySelector('.un').textContent = p.unidade || '';
    c.querySelector('.pt').textContent = p.pontos || '';
    s.appendChild(c);
    d.appendChild(s);
  });
  mio.appendChild(d);
  return [el];
}

/* ── ESPERA A IMAGEM ANTES DE FOTOGRAFAR ───────────────────────────────────
   O html2canvas desenha o que estiver decodificado NO MOMENTO da chamada. Um
   <img> recém-criado quase nunca está, então o pódio sairia sem boneco por
   corrida — o mesmo tipo de armadilha da animação do Chart.js. */
async function slImgsProntas(el){
  const ims = [...el.querySelectorAll('img')];
  await Promise.all(ims.map(im => im.complete && im.naturalWidth
    ? Promise.resolve()
    : new Promise(res => {
        const fim = () => res();
        im.addEventListener('load', fim, { once:true });
        im.addEventListener('error', () => { im.style.display='none'; res(); }, { once:true });
        setTimeout(fim, 4000);           // imagem que não vem não trava o deck
      })));
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
  await slImgsProntas(el);
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

window.SlidePadrao = { SL, TK, slNovo, slTabela, slKpis, slHero, slHeros, slGrafico,
  slGrafs, slPodio, slFoto, slLimpa, slCor, slPalco, slNum, slContraste, slSemCols };

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

  b.forEach(x => { if (x.tabela && x.semCols) x.tabela = slSemCols(x.tabela, x.semCols); });

  /* FCAs DE VÁRIAS UNIDADES = UMA TABELA SÓ (Renan, 20/09/2026: "coluna
     unidade, igual o FCA do painel. Não invente" · "se não cabe inteira,
     mantenha uma por unidade mesmo").
     Antes eu empilhava um bloco por unidade, cada um com rótulo laranja e o
     CABEÇALHO REPETIDO, em fonte minúscula — e ainda estourava. Agora as
     linhas entram numa tabela só, com um cabeçalho; se ela não couber numa
     página, o agrupamento é desfeito e cada unidade volta ao seu slide. */
  /* SÓ QUEM PEDE (`juntar`). Sem essa trava o slide "Vs Remunerado / Vs
     Orçado" da Visão Financeira, que são DUAS leituras da mesma tabela,
     virava uma tabela só com as linhas misturadas e sem os rótulos — dois
     recortes diferentes apresentados como um. */
  if (b.length > 1 && b.every(x => x.juntar && x.tabela && !(x.grafs||[]).length
        && !(x.kpis||[]).length && !(x.heros||[]).length)) {
    const cab0 = JSON.stringify(b[0].tabela.cab);
    if (b.every(x => JSON.stringify(x.tabela.cab) === cab0)) {
      const juntas = { ...b[0].tabela,
        linhas: b.flatMap(x => x.tabela.linhas.filter(l => !l.total)) };
      const pg = slTabela(tit, sub, juntas, { agrupa: b[0].agrupa });
      if (pg.length === 1) return pg;
      pg.forEach(el => el.remove());          // não coube: volta uma por unidade
      return b.flatMap(x => slTabela(tit, x.rot || sub, x.tabela, { agrupa: x.agrupa }));
    }
  }

  /* bloco único e tabela pura: deixa o paginador trabalhar */
  if (b.length === 1 && b[0].tabela && !(b[0].grafs||[]).length
      && !(b[0].kpis||[]).length && !(b[0].heros||[]).length)
    return slTabela(tit, sub, b[0].tabela, { rotulo: b[0].rot, agrupa: b[0].agrupa });

  const { el, mio } = slNovo(tit, sub);
  b.forEach((x, i) => {
    if (x.rot) { const r = document.createElement('div'); r.className='sl-rot'; r.textContent=x.rot; mio.appendChild(r); }

    /* hero + cards: o Scorecard e os painéis de KPI */
    if (x.heros && x.heros.length) slHeros(mio, x.heros);
    if (x.kpis && x.kpis.length) {
      /* A DENSIDADE É A DO PAINEL (x.kcols). O Scorecard põe os 20
         indicadores em 10 colunas compactas; a minha regra fazia 7 por linha,
         gordos, e o gráfico ficava com o resto. */
      const k = x.kpis.slice(0, 24);
      const cols = x.kcols && x.kcols > 1 ? Math.min(x.kcols, 10)
        : (k.length <= 6 ? k.length : (k.length <= 12 ? Math.ceil(k.length/2) : Math.ceil(k.length/3)));
      const g = slKpis(mio, k, cols);
      if (cols >= 8) g.classList.add('denso');
    }
    if (x.grafs && x.grafs.length) slGrafs(mio, x.grafs);

    if (x.tabela) {
      const wrap = document.createElement('div'); wrap.className='sl-tw';
      wrap.style.flex = b.length > 1 ? '1' : '1';
      mio.appendChild(wrap);
      const t = document.createElement('table'); t.className='sl-t';
      t.style.fontSize = (b.length > 1 ? 12 : 13) + 'px';
      wrap.appendChild(t);
      x._t = t; x._wrap = wrap;
      const cab = x.tabela.cab||[], dir = x.tabela.dir||[], lin = x.tabela.linhas||[];
      const curta = cab.map((c,i) => {
        const maior = Math.max(...lin.map(l => (l.cels[i] ? String(l.cels[i].t).length : 0)), 0);
        return maior > 0 && maior <= 14;
      });
      const kls = curta.filter(c => !c).length >= 2 ? 'curto' : 'nq';
      t.innerHTML = '<thead><tr>'
        + cab.map((c,i)=>`<th class="${dir[i]?'sl-n ':''}${curta[i]?kls:''}"></th>`).join('')
        + '</tr></thead><tbody></tbody>';
      [...t.querySelectorAll('th')].forEach((th,i)=>{ th.textContent = cab[i]; });
      const tb = t.querySelector('tbody');
      const agr = slRepetido(cab, x.agrupa); let ant = [];
      lin.forEach(l => {
        const tr = document.createElement('tr');
        if (l.total) tr.className = 'tot';
        tr.innerHTML = l.cels.map((c,i)=>
          `<td class="${c.dir||dir[i]?'sl-n ':''}${curta[i]?kls:''}"></td>`).join('');
        [...tr.children].forEach((td,j)=>{
          const c = l.cels[j]; if (!c) return;
          if (agr[j] && !l.total && ant[j] === c.t) { td.textContent = ''; return; }
          if (agr[j]) ant[j] = c.t;
          slCelula(td, c);
        });
        tb.appendChild(tr);
      });
      slLarguras(t, wrap);
    }

    /* A FOTO NÃO VAI DENTRO DE UM CARD (Renan, 19/09/2026: "por que essa porra
       branca no fundo?" · "por que não distribui mais").
       Eu embrulhava a imagem num `.sl-card` claro com borda e 14px de padding:
       o painel já vem com o fundo dele, então o card virava um slab branco por
       baixo, e o padding + a moldura ainda encolhiam a imagem no meio da
       página. A foto agora vai colada, do tamanho que o slide dá, sobre o
       MESMO cinza do slide — o que sobra de proporção vira margem, não um
       retângulo branco. */
    if (x.png) {
      const box = document.createElement('div');
      box.style.cssText = 'flex:1;min-height:0;display:flex;align-items:center;'
        + 'justify-content:center;background:transparent;overflow:hidden;';
      const img = document.createElement('img');
      img.src = x.png; img.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block;';
      box.appendChild(img); mio.appendChild(box);
      /* ALINHADA COM O TÍTULO. Eu reduzia o respiro do miolo para 28px no
         slide de foto e a imagem começava 36px à esquerda do título — o
         "descentralizado" do Resumo Executivo (Renan, 20/09/2026). O miolo
         fica nos 64px de todo slide. */
      if (x.escala) { img.style.width = (x.escala*100) + '%'; img.style.height = (x.escala*100) + '%'; }
    }
  });

  /* NÃO CORTAR EM SILÊNCIO. No slide de dois blocos (Árvore + FCA) e no de
     gráfico + tabela a paginação não entra, e uma tabela alta era simplesmente
     estourada para fora da página — o slide saía com meia tabela e nada
     dizendo. Aqui a fonte desce até caber; abaixo do piso, o slide avisa. */
  b.forEach(x => {
    if (!x._t) return;
    let fs = parseFloat(x._t.style.fontSize) || 12;
    while (fs > 9 && x._wrap.scrollHeight > x._wrap.clientHeight + 2) {
      fs -= 0.5; x._t.style.fontSize = fs + 'px';
    }
    if (x._wrap.scrollHeight > x._wrap.clientHeight + 2) {
      const av = document.createElement('div');
      av.style.cssText = `flex:0 0 auto;font-size:11px;font-weight:700;color:${TK.vermelho};padding-top:4px;`;
      av.textContent = 'a tabela não caiu inteira neste slide';
      x._wrap.parentNode.appendChild(av);
    }
    delete x._t; delete x._wrap;
  });
  return [el];
}

window.SlidePadrao.slMonta = slMonta;
