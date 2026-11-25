/* ============================================================
   Apresentações · motor dos slides no desenho aprovado (Renan, 25/11/2026).
   Referência: docs/apresentacoes-roteiro.md e o mock aprovado.

   Slide de 1280×720. Capa, sumário, divisória e encerramento no desenho
   do Bússola (preto à esquerda, título em serifa, foto em tiras com
   contorno laranja à direita, barra laranja no pé). Slide de conteúdo:
   fundo cinza do tema claro do portal (sem laranja), título + unidade em
   texto cinza + período à direita, filete cinza clarinho, cards de vidro
   claro, gráficos sem eixo Y nem grade, barras quadradas em vermelho e
   verde puros. Letra e espaço de cada slide crescem ou encolhem até o
   conteúdo ocupar o slide (--k).

   Uso: ApresSlides.doc({ base, titulo, slides:[html…] }) devolve o HTML
   inteiro do deck (com o Chart.js e o ajuste); as funções ApresSlides.capa,
   sumario, divisoria, fim e conteudo montam cada slide. Os gráficos vão
   como JSON em data-g e são desenhados dentro do deck.
   ============================================================ */
(function () {
  'use strict';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  var VERM = '#FF0000', VERDE = '#00B300', CINZA = '#6B7280';

  /* ── formatos ── */
  var nf = function (v, c) { return (+v).toLocaleString('pt-BR', { minimumFractionDigits: c || 0, maximumFractionDigits: c || 0 }); };
  var f = {
    nf: nf,
    brl: function (v) { return v == null || !isFinite(v) ? '—' : (v < 0 ? '−' : '') + 'R$ ' + nf(Math.abs(v)); },
    brlc: function (v) { if (v == null || !isFinite(v)) return '—'; var a = Math.abs(v), s = v < 0 ? '−' : '';
      return a >= 1e6 ? s + 'R$ ' + nf(a / 1e6, 2) + ' mi' : a >= 1e3 ? s + 'R$ ' + nf(a / 1e3, a >= 1e5 ? 0 : 1) + ' mil' : s + 'R$ ' + nf(a); },
    curto: function (v) { if (v == null || !isFinite(v)) return '—'; var a = Math.abs(v), s = v < 0 ? '−' : '';
      return a >= 1e6 ? s + nf(a / 1e6, 2) + ' mi' : a >= 1e3 ? s + nf(a / 1e3, a >= 1e5 ? 0 : 1) + ' mil' : s + nf(a); },
    pct: function (v, c) { return v == null || !isFinite(v) ? '—' : nf(v, c == null ? 1 : c) + '%'; },
    /* ▲/▼ com a classe: bom = o lado favorável (custo: cair é bom) */
    seta: function (v, txt, ruimSeSobe) { if (v == null || !isFinite(v)) return '<b class="nt">—</b>';
      var zero = Math.abs(v) < 1e-9, ruim = ruimSeSobe === false ? v < 0 : v > 0;
      return '<b class="' + (zero ? 'nt' : ruim ? 'cr' : 'cg') + '">' + (zero ? '= ' : v > 0 ? '▲ ' : '▼ ') + txt + '</b>'; },
    MES: MES
  };

  /* ── CSS do deck ── */
  var CSS = [
    ':root{--txt:#161D2B;--txt2:#4A5568;--txt3:#737D91;--linha:rgba(15,23,42,.10);--brd:rgba(15,23,42,.10);--laranja:#F97316;--k:1;--v:1;--card:rgba(255,255,255,.74);--card-brd:rgba(15,23,42,.10);--cabec:#DCDFE6;--hover:transparent;--red:#FF0000;--green:#00B300;--vermelho:#FF0000;--verde:#00B300;--orange:#F97316}',
    '*{box-sizing:border-box;margin:0;padding:0}',
    'html,body{background:#fff}body:not(.final){overflow:hidden}',
    'body{font-family:Montserrat,sans-serif;color:var(--txt);-webkit-font-smoothing:antialiased}',
    '.slide{width:1280px;height:720px;position:relative;overflow:hidden;page-break-after:always}',
    '.slide::after{content:"";position:absolute;left:0;right:0;bottom:0;height:8px;background:linear-gradient(90deg,#F26B0F,#F97316 55%,#FFC46B);z-index:3}',
    /* arte: capa, sumário, divisória, encerramento (cópia do Apresentações do Bússola: metade preta com a marca e o título centrados, foto em tiras à direita) */
    '.arte{background:#000;color:#fff}',
    '.arte .esq{position:absolute;left:0;top:0;bottom:8px;width:638px}',
    '.marca{position:absolute;left:72px;top:92px;width:472px}',
    '.marca img{width:472px;height:auto;display:block}',
    '.marca .tv{position:absolute;right:-27px;top:102px;display:flex;align-items:center;gap:6px;white-space:nowrap}',
    '.marca .tv .w{font-size:40px;font-weight:500;letter-spacing:-.5px;line-height:1;transform:scaleX(.78);transform-origin:right center;display:inline-block;margin-left:-60px}',
    '.marca .tv .w i{font-style:normal;color:#F97316}',
    '.marca .tv .s{font-size:13px;font-weight:700;line-height:1.02;letter-spacing:.2px}',
    '.marca.p{left:64px;top:auto;bottom:30px;width:124px}.marca.p img{width:124px}',
    '.marca.p .tv{right:-7px;top:27px;gap:2px}.marca.p .tv .w{font-size:10.5px;margin-left:-16px}.marca.p .tv .s{font-size:3.6px}',
    '.arte .bloco{position:absolute;left:0;width:638px;top:276px;text-align:center}',
    '.arte h1{font-family:"Libre Baskerville",serif;font-weight:700;font-size:42px;line-height:1.18;padding:0 60px}',
    '.arte .vline{width:1px;height:124px;background:#fff;opacity:.85;margin:34px auto 0}',
    '.arte .per{font-size:20px;font-weight:400;margin-top:20px}.arte .per b{font-weight:600;margin:0 11px}',
    '.tiras{position:absolute;right:0;top:0;bottom:8px;width:642px;overflow:hidden}',
    '.tiras.e{width:382px}',
    '.tira{position:absolute;background-repeat:no-repeat;background-size:auto 712px;border:2px solid var(--laranja);border-radius:58px}',
    '.sum h1{position:absolute;left:64px;top:52px;font-size:50px;padding:0;text-align:left}',
    '.sum .tr{position:absolute;left:64px;top:126px;width:76px;height:4px;background:var(--laranja)}',
    '.sum .mes{position:absolute;left:64px;top:146px;font-size:17px;color:#BFC5CF}.sum .mes b{font-weight:500;margin:0 3px}',
    '.sum .lista{position:absolute;left:64px;top:192px;display:grid;grid-template-columns:365px 365px;column-gap:51px}',
    '.sum .it{display:flex;align-items:center;gap:22px;height:var(--h,38px);border-bottom:1px solid rgba(255,255,255,.20);font-size:15.5px;font-weight:500}',
    '.sum .it b{color:#F97316;font-weight:800;font-size:18px;width:28px;flex:0 0 28px}',
    '.sum.denso .it{font-size:14px}.sum.denso .it b{font-size:16px}',
    '.div .bloco{top:292px}',
    '.div .num{font-size:66px;font-weight:300;color:#F97316;line-height:1;margin-bottom:24px}',
    '.div .sub{font-size:15px;color:#BFC5CF;margin:16px auto 0;max-width:480px;line-height:1.5}',
    /* conteúdo */
    '.cont{background:radial-gradient(80% 60% at 90% 0%,rgba(255,255,255,.35) 0%,transparent 60%),linear-gradient(rgba(255,255,255,.20),rgba(255,255,255,.20)),#E1E2E5}',
    '.cab{position:absolute;left:0;right:0;top:0;height:64px;padding:0 40px;display:flex;align-items:center;gap:12px;background:#1E2833;border-bottom:3px solid #F97316;z-index:2}',   /* cabeçalho grafite com filete laranja (Renan, 26/11/2026) */
    '.cab h2{font-size:22px;font-weight:800;letter-spacing:-.2px;white-space:nowrap;color:#fff}',
    '.cab .un{font-size:14px;font-weight:600;color:#A9B1C0;padding-left:12px;border-left:1px solid rgba(255,255,255,.28);line-height:18px;white-space:nowrap}',
    '.cab .per{margin-left:auto;display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:#C9D0DD;white-space:nowrap}',
    '.cont::after{height:4px;background:#F97316}',   /* no slide de conteúdo a linha de baixo é laranja chapada e mais fina */
    '.cab .per svg{width:14px;height:14px}',
    '.miolo{position:absolute;left:40px;right:40px;top:84px;bottom:20px}',
    '.pe{position:absolute;left:40px;right:40px;bottom:16px;display:flex;justify-content:space-between;font-size:10px;font-weight:600;color:var(--txt3)}',
    '.card{background:linear-gradient(180deg,rgba(255,255,255,.6) 0%,rgba(255,255,255,0) 46%),rgba(255,255,255,.74);border:1px solid var(--brd);border-radius:11px;box-shadow:inset 0 1px 0 #fff,0 2px 12px rgba(0,0,0,.08);min-width:0;min-height:0}',
    '.rot{font-size:calc(10px*var(--k));font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--txt2)}',
    '.cr{color:#FF0000!important}.cg{color:#00B300!important}.nt{color:var(--txt3)!important}',
    '.g2{display:grid;gap:14px;height:100%}',
    /* hero do Financeiro */
    '.hero{padding:calc(22px*var(--k)) 24px calc(18px*var(--k));display:flex;flex-direction:column}',
    '.hero .v{font-size:calc(44px*var(--k));font-weight:800;line-height:1;margin-top:10px;letter-spacing:-1px;white-space:nowrap}',
    '.hero .sub{font-size:calc(11px*var(--k));color:var(--txt3);margin-top:6px;font-weight:600}',
    '.hero .gr{display:grid;grid-template-columns:1fr 1fr;margin-top:calc(22px*var(--k));border-top:1px solid var(--linha)}',
    '.hero .gr>div{padding:calc(14px*var(--k)) 0 calc(12px*var(--k));border-bottom:1px solid var(--linha);min-width:0}',
    '.hero .gr>div:nth-child(odd){padding-right:14px;border-right:1px solid var(--linha)}',
    '.hero .gr>div:nth-child(even){padding-left:16px}',
    '.hero .gr b{display:block;font-size:calc(20px*var(--k));font-weight:800;margin-top:6px;white-space:nowrap}',
    '.hero .gr small{display:block;font-size:calc(10px*var(--k));color:var(--txt3);font-weight:600;margin-top:3px}',
    '.leit{margin-top:auto;font-size:calc(12px*var(--k));line-height:1.55;color:var(--txt2);border-top:1px solid var(--linha);padding-top:12px}',
    '.leit b{color:var(--txt);font-weight:700}',
    /* cards de indicador */
    '.kpis{display:grid;gap:12px}',
    '.kpi{padding:calc(14px*var(--k)) 16px;display:flex;flex-direction:column;justify-content:center;gap:calc(4px*var(--k))}',
    '.kpi .kv{font-size:calc(24px*var(--k));font-weight:800;line-height:1.1;white-space:nowrap}',
    '.kpi .kv small{font-size:.55em;font-weight:700;margin-left:6px}',
    '.kpi .km{font-size:calc(10.5px*var(--k));color:var(--txt3);font-weight:600;line-height:1.35}',
    '.kpi .km b{color:var(--txt2)}',
    '.kpi.top{padding:calc(16px*var(--k)) 22px}',
    '.kpi.top .kv{font-size:calc(40px*var(--k))}',
    '.dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;vertical-align:middle}',
    /* gráfico */
    '.gc{padding:calc(12px*var(--k)) 18px 8px;display:flex;flex-direction:column}',
    '.gc .t{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}',
    '.gc .t h3{font-size:calc(13.5px*var(--k));font-weight:800}',
    '.gc .t span{font-size:calc(10.5px*var(--k));color:var(--txt3);font-weight:600}',
    '.gleg{margin-left:auto;display:flex;gap:14px;font-size:10px;font-weight:600;color:var(--txt2)}',
    '.gleg i{display:inline-block;width:14px;height:3px;border-radius:2px;margin-right:5px;vertical-align:middle}',
    '.gleg i.q{width:9px;height:9px;border-radius:0}',
    '.gc .cv{flex:1;min-height:60px;position:relative;margin-top:6px}',
    '.gc .cv canvas{position:absolute;inset:0}',
    /* tabela */
    '.tb{padding:0;overflow:hidden;display:flex;flex-direction:column}',
    '.tb .t{padding:calc(12px*var(--k)) 16px calc(8px*var(--k));font-size:calc(13.5px*var(--k));font-weight:800}',
    '.tb .t span{font-size:calc(10.5px*var(--k));color:var(--txt3);font-weight:600;margin-left:8px}',
    'table.dre{width:100%;border-collapse:collapse;font-size:calc(11.5px*var(--k))}',
    'table.dre th{background:#DCDFE6;font-size:calc(9.5px*var(--k));font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:var(--txt2);text-align:left;padding:calc(7px*var(--k)) 12px;white-space:nowrap}',
    'table.dre th.n,table.dre td.n{text-align:right}',
    'table.dre td{padding:calc(7px*var(--k)*var(--v)) 12px;border-top:1px solid var(--linha);vertical-align:top;line-height:1.4}',
    'table.dre td.n{white-space:nowrap;font-variant-numeric:tabular-nums}',
    'table.dre tr.tot td{background:#E9EBEF;font-weight:800}',
    'table.dre td.nm{font-weight:600}',
    /* árvore */
    '.arv{display:grid;grid-template-columns:1fr 360px;gap:14px;height:100%}',
    '.area{position:relative;min-width:0}',
    '.cols{position:absolute;inset:0;display:flex;justify-content:space-evenly;gap:calc(48px*var(--k))}',
    '.col{display:flex;flex-direction:column;justify-content:space-around;gap:10px;min-width:0}',
    '.col.m{display:grid;grid-auto-flow:column;align-content:space-around;column-gap:calc(26px*var(--k));row-gap:8px}',
    '.arv.so{grid-template-columns:1fr}','.col.m .tn{background:#fff}','.arv.sem-obs{grid-template-columns:1fr}','.arv.sem-obs>.com{display:none}',
    '.tn{width:calc(232px*var(--k));background:rgba(255,255,255,.82);border:1px solid var(--brd);border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,.07);overflow:hidden;position:relative;z-index:1}',
    '.tn.l{width:calc(276px*var(--k))}','.tn.l .tn-g{grid-template-columns:minmax(0,1fr) minmax(0,.92fr) minmax(0,1.3fr)}',
    '.tn-t{font-size:calc(9.5px*var(--k));font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:var(--txt2);padding:calc(8px*var(--k)) 12px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.tn-v{font-size:calc(18px*var(--k));font-weight:800;padding:2px 12px 1px;letter-spacing:-.3px;white-space:nowrap}',
    '.tn-r{font-size:calc(10.5px*var(--k));font-weight:600;color:var(--txt3);padding:0 12px calc(8px*var(--k));white-space:nowrap}',
    '.tn-r b{color:var(--txt2);font-weight:700}',
    '.tn-g{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-top:1px solid var(--linha)}',
    '.tn-g>div{padding:calc(4px*var(--k)) 9px calc(5px*var(--k));min-width:0}.tn-g>div+div{border-left:1px solid var(--linha)}',
    '.tn-g span{display:block;font-size:calc(8px*var(--k));font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--txt3)}',
    '.tn-g b{display:block;font-size:calc(11px*var(--k));font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}',
    '.tn.gap{border-color:rgba(255,0,0,.55);box-shadow:0 0 0 1px rgba(255,0,0,.18),0 4px 14px rgba(0,0,0,.08)}',
    '.tn.ok{border-color:rgba(0,179,0,.45)}',
    '.tn.info{width:calc(250px*var(--k))}','.tn.info .tn-r{white-space:normal;line-height:1.3}',
    '.tn-ls{border-top:1px solid var(--linha);padding:calc(4px*var(--k)) 12px calc(6px*var(--k))}',
    '.tn-ls>div{display:flex;justify-content:space-between;gap:8px;font-size:calc(10.5px*var(--k));line-height:1.55;white-space:nowrap}',
    '.tn-ls span{color:var(--txt2);font-weight:600;overflow:hidden;text-overflow:ellipsis;min-width:0}.tn-ls b{font-weight:800;flex:0 0 auto}',
    'svg.lig{position:absolute;inset:0;width:100%;height:100%;overflow:visible;z-index:0}',
    '.com{padding:16px 18px;display:flex;flex-direction:column}',
    '.com h3{font-size:14px;font-weight:800}','.com.baixo{min-height:200px;padding:14px 18px}','.com.baixo .caixa{margin-top:8px}',
    '.com .dica{font-size:10.5px;color:var(--txt3);font-weight:600;margin-top:3px}',
    '.com .caixa{flex:1;margin-top:12px;border:1.5px dashed rgba(15,23,42,.18);border-radius:9px;padding:12px 14px;font-size:14px;line-height:1.6;color:var(--txt);white-space:pre-wrap;overflow:hidden;outline:none}',
    '.com .caixa:empty::before{content:attr(data-ph);color:var(--txt3);font-style:italic}',
    'body.final .com .caixa:empty::before{content:""}',
    'body.final .com .caixa{border-color:transparent}',
    /* FCA */
    'table.fca td.fato{border-right:1px solid var(--linha);width:24%}',
    'table.fca td.fato b{display:block;font-size:calc(12.5px*var(--k));font-weight:800}',
    'table.fca td.fato .dv{font-weight:800;margin-top:3px}',
    'table.fca td.fato .ct{font-size:calc(10.5px*var(--k));color:var(--txt2);margin-top:6px;line-height:1.55;white-space:pre-line}',
    'table.fca td.fato .ytd{font-size:calc(10.5px*var(--k));font-weight:700;color:var(--txt2);margin-top:10px;padding-top:8px;border-top:1px dashed var(--linha)}',
    'table.fca td.causa{border-right:1px solid var(--linha);width:27%}',
    'table.fca td .of{font-size:calc(10.5px*var(--k));color:var(--txt2);margin-top:4px;white-space:pre-line}',
    'table.fca tr.dt td.ln{border-top:1px dashed rgba(15,23,42,.14)}',
    'table.fca .nn{font-weight:800;margin-right:4px}',
    'table.fca tr.ed{cursor:pointer}',
    'body:not(.final) table.fca tr.ed:hover td.ln{background:rgba(249,115,22,.06)}',
    'table.fca td.vazio{color:var(--txt3);font-style:italic}',
    '.st{display:inline-block;font-size:calc(9.5px*var(--k));font-weight:700;border-radius:20px;padding:3px 9px;white-space:nowrap}',
    '.st.ni{background:rgba(115,125,145,.14);color:var(--txt2)}.st.and{background:rgba(27,111,196,.12);color:#1B6FC4}.st.ok{background:rgba(0,179,0,.12);color:#008A00}.st.can{background:rgba(115,125,145,.10);color:var(--txt3)}.st.ven{background:rgba(255,0,0,.10);color:#D00000}',
    '.mais{display:inline-block;color:var(--laranja);font-weight:800;font-size:15px;line-height:1;margin-left:6px;cursor:pointer}',
    'body.final .mais,body.final .so-ed{display:none!important}',
    'table.fca td.ln{vertical-align:top}','table.fca .tri-r{color:#E00000}','table.fca .tri-g{color:#009A00}',
    'table.fca td.acao{min-width:0}','table.fca td.dono{white-space:nowrap;font-weight:600;font-size:calc(10.5px*var(--k))}','table.fca td.prz{white-space:nowrap;font-size:calc(10.5px*var(--k))}','table.fca td.prz.venc{color:#D00000;font-weight:700}',
    'table.fca td.semacao{color:var(--txt3);font-style:italic}',
    /* a Tabela do FCA do painel (FcaTabela + as regras do table.rel do FCA · Admin, tema claro) */
    '.fcap{padding:0;overflow:hidden;background:var(--card);border:1px solid var(--card-brd);border-radius:10px;box-shadow:none}',
    'table.rel{width:100%;border-collapse:collapse;font-size:calc(10.5px*var(--k));table-layout:fixed}',
    'table.rel thead th{background:var(--cabec)!important;color:var(--txt2)!important;padding:calc(9px*var(--k)) 10px!important;border-bottom:1px solid var(--card-brd)!important;text-align:left;font-size:calc(9.5px*var(--k));font-weight:700;text-transform:uppercase;letter-spacing:.3px!important;white-space:nowrap}',
    'table.rel tbody td{padding:calc(8px*var(--k)*var(--v)) 10px!important;color:var(--txt2)!important;border-bottom:1px solid var(--linha)!important;vertical-align:top;line-height:1.45}',
    'body table.rel.fg-rel tbody.fg td.ln{padding-top:calc(7px*var(--k)*var(--v))!important;padding-bottom:calc(7px*var(--k)*var(--v))!important}',
    'table.rel td.txt{white-space:normal;overflow-wrap:anywhere}table.rel td.txt b{color:var(--txt)}',
    'table.rel td.center{text-align:left;white-space:normal;overflow-wrap:anywhere}',
    'table.rel th.c-proj{width:10.5%}table.rel th.c-vig{width:6%}table.rel th.c-fato{width:17%}table.rel th.c-txt{width:20%}table.rel th.c-resp{width:8.5%}table.rel th.c-prazo{width:8.5%}table.rel th.c-st{width:10%}',
    'table.rel td.prazo{white-space:nowrap}.rel .dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;vertical-align:middle}',
    '.rel .chip{display:inline-block;padding:3px 7px;border-radius:5px;font-weight:700;font-size:calc(9.5px*var(--k));white-space:normal;line-height:1.25}',
    'body table.rel.fg-rel tbody.fg tr+tr td.ln{border-top:1px dashed rgba(15,23,42,.34)!important}',
    'body table.rel.fg-rel tbody.fg{border-top:2px solid rgba(15,23,42,.16)}',
    /* tamanhos da Tabela do FCA presos ao texto da célula (que segue o --k), para nada ficar maior ou menor que o resto */
    'body table.rel.fg-rel td.fato .fa-pac{font-size:1.06em}','body table.rel.fg-rel td.fato small{font-size:.92em}',
    'body table.rel.fg-rel .fa-ano{font-size:.92em}','body table.rel.fg-rel .fa-ano .kl{font-size:.85em}','body table.rel.fg-rel .fa-of{font-size:.92em}',
    'body .rel .chip{font-size:.84em}','body table.rel.fg-rel .fg-add{font-size:1.3em}',
    'body.final .fg-add{display:none!important}',
    'body:not(.final) table.rel tr[data-id]{cursor:pointer}',
    /* Resumo Gerencial dos painéis (Scorecard e Frota de Elite), no desenho deles, tema claro */
    '.pn{display:flex;flex-direction:column;gap:10px;height:100%}',
    '.pn-hero .hlbl{font-size:calc(10px*var(--k));font-weight:700;color:var(--txt3);text-transform:uppercase;letter-spacing:.9px}',
    '.pn-hero .hval{font-size:calc(34px*var(--k));font-weight:800;line-height:1.05;margin:calc(3px*var(--k)) 0 calc(8px*var(--k))}.pn-hero .hval small{font-size:calc(15px*var(--k));font-weight:700;color:var(--txt3);margin-left:4px}',
    '.pn-hero .hsub{font-size:calc(10.5px*var(--k));color:var(--txt3);font-weight:600}',
    '.pn-hero .hdel{display:flex;gap:20px;flex-wrap:wrap}',
    '.pn-hero .hdel div{font-size:calc(8px*var(--k));font-weight:700;color:var(--txt3);text-transform:uppercase;letter-spacing:.7px}',
    '.pn-hero .hdel b{display:block;font-size:calc(11.5px*var(--k));font-weight:800;color:var(--txt);margin-top:2px;letter-spacing:0;text-transform:none}',
    '.pn-faixas{display:flex;gap:12px;flex-wrap:wrap;align-items:center}',
    '.pn-faixas div{display:flex;align-items:center;gap:6px;font-size:calc(9px*var(--k));font-weight:700;color:var(--txt3);text-transform:uppercase;letter-spacing:.4px;white-space:nowrap}',
    '.pn-faixas b{color:var(--txt2);font-weight:800}.pn-faixas i{width:9px;height:9px;border-radius:2px;display:inline-block}',
    '.pn-k10{display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:7px}',
    '.pn-kpi{padding:6px 8px 5px;border:1px solid var(--card-brd);border-radius:11px;background:rgba(255,255,255,.55);display:flex;flex-direction:column;justify-content:center;min-width:0}',
    '.pn-kpi .kl{font-size:calc(7.5px*var(--k));font-weight:700;color:var(--txt3);text-transform:uppercase;letter-spacing:.2px;line-height:1.2;min-height:calc(18px*var(--k))}',
    '.pn-kpi .kv{font-size:calc(15.5px*var(--k));font-weight:800;margin-top:2px;line-height:1.1}',
    '.pn-kpi .km{font-size:calc(7.5px*var(--k));color:var(--txt3);font-weight:600;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.pn-gr{flex:1 1 0;min-height:0;display:grid;gap:12px}',
    '.pn-dq{display:flex;flex-direction:column;padding:12px 16px 16px;min-height:0}',
    '.pn-dq .gtit{font-size:calc(13.5px*var(--k));font-weight:800}.pn-dq .gsub{font-size:calc(10.5px*var(--k));color:var(--txt3);font-weight:600;margin:2px 0 6px}',
    '.pn-dq .ls{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:flex-start;padding-bottom:6px}',
    '.pn-dq .l{display:flex;align-items:center;gap:9px;line-height:1.15;flex:1 1 0;min-height:calc(19px*var(--k));max-height:calc(36px*var(--k));border-bottom:1px solid var(--linha);padding:0 6px;font-size:calc(11.5px*var(--k))}',
    '.pn-dq .l:last-child{border-bottom:0}.pn-dq .l .p{font-size:.85em;font-weight:800;color:#8E96A6;width:22px;flex:0 0 22px}',
    '.pn-dq .l .u{flex:1;min-width:0;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pn-dq .l .s{font-weight:800}.pn-dq .l .u small{color:#8E96A6;font-weight:600;font-size:.88em}.pn-dq .l .vv{color:var(--txt3);font-weight:600;white-space:nowrap}',
    '.tc-row{display:grid;gap:10px}.tc{padding:10px 16px;border:1px solid var(--card-brd);border-radius:11px;background:rgba(255,255,255,.55)}.tc .kl{font-size:9.5px;font-weight:700;color:var(--txt3);text-transform:uppercase;letter-spacing:.6px}.tc .kv{font-size:24px;font-weight:800;line-height:1.1;margin-top:3px}.tc .km{display:flex;gap:16px;margin-top:5px;font-size:10px;color:var(--txt3);font-weight:600}.tc .km b{color:var(--txt);font-weight:800}',
    '.pn-dq .l.eu{background:rgba(249,115,22,.10);border-radius:6px}',
    '.el-cards{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}',
    '.el-kpi{display:flex;align-items:center;gap:10px;padding:8px 14px;min-width:0;border:1px solid var(--card-brd);border-radius:11px;background:rgba(255,255,255,.55)}',
    '.el-kpi .f{width:14px;height:14px;border-radius:50%;flex:0 0 auto;box-shadow:0 0 0 3px rgba(15,23,42,.05)}',
    '.el-kpi .b{display:flex;flex-direction:column;gap:4px;min-width:0}',
    '.el-kpi .kl{font-size:calc(9px*var(--k));font-weight:700;color:var(--txt3);text-transform:uppercase;letter-spacing:.6px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.el-kpi .kv{font-size:calc(19px*var(--k));font-weight:800;line-height:1}',
    '.el-kpi.dupla{gap:10px;padding-left:12px;padding-right:12px}.el-kpi .meia{display:flex;align-items:center;gap:7px;flex:1 1 0;min-width:0}',
    '.el-kpi .meia+.meia{border-left:1px solid var(--linha);padding-left:10px}.el-kpi .meia .f{width:12px;height:12px}.el-kpi.dupla .kl{letter-spacing:.3px}',
    '.el-leg{display:flex;gap:16px;align-items:center;flex-wrap:wrap}.el-leg span{display:flex;align-items:center;gap:7px;font-size:10px;font-weight:700;color:var(--txt2)}.el-leg i{width:10px;height:10px;border-radius:50%;display:inline-block}',
    'table.dre tr.eu td{background:rgba(249,115,22,.10);font-weight:800}',
    '.tb.compacta table.dre{font-size:10.5px}.tb.compacta table.dre th{font-size:9px;padding:6px 10px}.tb.compacta table.dre td{padding:5px 10px}',
    '.kgrid{display:grid;gap:10px;height:100%}',
    '.solto{padding:0 2px}','.solto .v{font-size:calc(54px*var(--k));font-weight:800;line-height:1;letter-spacing:-1px;margin-top:6px;white-space:nowrap}','.solto .u{font-size:calc(11px*var(--k));font-weight:600;color:var(--txt3);margin-top:4px}',
    '.solto .ds{display:flex;gap:calc(34px*var(--k));margin-top:calc(12px*var(--k))}','.solto .ds>div{white-space:nowrap}','.solto .ds .rot{font-size:calc(9px*var(--k))}','.solto .ds b{display:block;font-size:calc(15px*var(--k));font-weight:800;margin-top:2px}','.solto .ds small{font-size:calc(10px*var(--k));font-weight:600;color:var(--txt3);margin-left:5px}',
    '.kmini{padding:calc(9px*var(--k)) 12px;display:flex;flex-direction:column;justify-content:center;gap:2px;min-width:0}',
    '.kmini .rot{font-size:calc(9px*var(--k));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.kmini .kv{font-size:calc(21px*var(--k));font-weight:800;line-height:1.1;white-space:nowrap}',
    '.kmini .km{font-size:calc(9.5px*var(--k));color:var(--txt3);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.vazio-sl{height:100%;display:flex;align-items:center;justify-content:center;text-align:center;color:var(--txt3);font-size:15px;font-weight:600;line-height:1.6}',
    '.aviso{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;font-size:15px;color:var(--txt3);font-weight:600;padding:40px;line-height:1.6}',
    /* recado */
    '.recado{padding:34px 40px;font-size:calc(20px*var(--k));line-height:1.6;white-space:pre-wrap}'
  ].join('\n');

  /* ── capa, sumário, divisória, encerramento ── */
  /* tiras: colunas com recortes de pontas arredondadas, a mesma foto correndo por todas (o desenho do Bússola) */
  /* tiras: a mesma arte de foto em tiras do Apresentações do Bússola (recortada do print dele, placas borradas) */
  function tiras(estreita) {
    return '<div class="tiras' + (estreita ? ' e' : '') + '" style="background:url(img/' + (estreita ? 'sumario' : 'capa') + '-tiras.jpg) center/100% 100% no-repeat"></div>';
  }
  var marca = function (p) { return '<div class="marca' + (p ? ' p' : '') + '"><img src="img/logo-conlog-branco.png" alt=""><div class="tv"><span class="w">TEM<i>VALOR</i></span><span class="s">PRA VOCÊ,<br>PRA NÓS!</span></div></div>'; };
  var perTxt = function (vk) { return MES[+vk.slice(5, 7) - 1] + '<b>|</b>' + vk.slice(0, 4); };
  var bloco = function (t, vk) { return '<div class="bloco"><h1>' + esc(t) + '</h1><div class="vline"></div><div class="per">' + perTxt(vk) + '</div></div>'; };
  function capa(o) {
    return '<section class="slide arte capa" data-sec="capa"><div class="esq">' + marca() + bloco(o.titulo, o.vig) + '</div>' + tiras(false) + '</section>';
  }
  function sumario(o) {
    var it = o.itens || [], metade = Math.ceil(it.length / 2), a = it.slice(0, metade), b = it.slice(metade);
    var li = function (x) { return '<div class="it"><b>' + String(x.pg).padStart(2, '0') + '</b><span>' + esc(x.t) + '</span></div>'; };
    return '<section class="slide arte sum' + (it.length > 18 ? ' denso' : '') + '" data-sec="sumario"><div class="esq" style="width:898px">' + marca(true) +
      '<h1>Sumário</h1><div class="tr"></div><div class="mes">' + perTxt(o.vig).replace('<b>|</b>', ' <b>|</b> ') + '</div>' +
      '<div class="lista" style="--h:' + Math.min(38, Math.floor(440 / Math.max(1, metade))) + 'px"><div>' + a.map(li).join('') + '</div><div>' + b.map(li).join('') + '</div></div></div>' + tiras(true) + '</section>';
  }
  function divisoria(o) {
    return '<section class="slide arte div" data-sec="div"><div class="esq">' + marca() + '<div class="bloco"><div class="num">' + String(o.n).padStart(2, '0') + '</div><h1>' + esc(o.titulo) + '</h1>' +
      (o.sub ? '<div class="sub">' + esc(o.sub) + '</div>' : '') + '</div></div>' + tiras(false) + '</section>';
  }
  function fim(o) {
    return '<section class="slide arte fim" data-sec="fim"><div class="esq">' + marca() + bloco('Obrigado!', o.vig) + '</div>' + tiras(false) + '</section>';
  }

  /* ── slide de conteúdo: moldura ── */
  var FUNIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16l-6 8v6l-4 2v-8z"/></svg>';
  function conteudo(o) {
    return '<section class="slide cont" data-sec="' + esc(o.sec || '') + '"' + (o.id ? ' data-id="' + esc(o.id) + '"' : '') + '>' +
      '<div class="cab"><h2>' + esc(o.titulo) + '</h2>' + (o.uni ? '<span class="un">' + esc(o.uni) + '</span>' : '') +
      '<div class="per">' + (o.extra || '') + FUNIL + esc(o.per || '') + '</div></div>' +
      '<div class="miolo">' + o.corpo + '</div></section>';
  }

  /* ── peças ── */
  function grafico(titulo, sub, spec, leg) {
    return '<div class="card gc"><div class="t"><h3>' + esc(titulo) + '</h3>' + (sub ? '<span>' + esc(sub) + '</span>' : '') +
      (leg ? '<div class="gleg">' + leg + '</div>' : '') + '</div><div class="cv"><canvas data-g="' + esc(JSON.stringify(spec)) + '"></canvas></div></div>';
  }
  var LEG_ANO = '<span><i class="q" style="background:#9AA3B2"></i>Realizado</span><span><i style="background:repeating-linear-gradient(90deg,#161D2B 0 5px,transparent 5px 8px)"></i>Remunerado</span><span><i style="background:repeating-linear-gradient(90deg,#1B6FC4 0 5px,transparent 5px 8px)"></i>Orçado</span>';
  function kpi(o) {
    return '<div class="card kpi' + (o.top ? ' top' : '') + '"><div class="rot">' + esc(o.rot) + '</div><div class="kv">' + o.v + '</div>' + (o.m ? '<div class="km">' + o.m + '</div>' : '') + '</div>';
  }
  function tabela(o) {
    var th = o.cols.map(function (c) { return '<th' + (c.n ? ' class="n"' : '') + '>' + esc(c.t) + '</th>'; }).join('');
    var tr = o.linhas.map(function (l) { return '<tr' + (l.cls ? ' class="' + l.cls + '"' : '') + '>' + l.c.map(function (v, i) { return '<td class="' + (o.cols[i].n ? 'n' : '') + (i === 0 ? ' nm' : '') + '">' + v + '</td>'; }).join('') + '</tr>'; }).join('');
    return '<div class="card tb"' + (o.estilo ? ' style="' + o.estilo + '"' : '') + '>' + (o.titulo ? '<div class="t">' + esc(o.titulo) + (o.sub ? '<span>' + esc(o.sub) + '</span>' : '') + '</div>' : '') +
      '<table class="dre"><thead><tr>' + th + '</tr></thead><tbody>' + (tr || '<tr><td colspan="' + o.cols.length + '" class="nt">' + esc(o.vazio || 'Sem linhas') + '</td></tr>') + '</tbody></table></div>';
  }
  /* nó da árvore: realizado grande, remunerado menor, e ▲ · ▲ % · YoY (ou Impacto) */
  function no(n) {
    if (n.info) return '<div class="tn info' + (n.cls ? ' ' + n.cls : '') + '" data-no="' + esc(n.id) + '"' + (n.pai ? ' data-pai="' + esc(n.pai) + '"' : '') + '>' +
      '<div class="tn-t">' + esc(n.t) + '</div>' + (n.v != null ? '<div class="tn-v">' + n.v + '</div>' : '') + (n.sub ? '<div class="tn-r">' + esc(n.sub) + '</div>' : '') +
      (n.linhas && n.linhas.length ? '<div class="tn-ls">' + n.linhas.map(function (l) { return '<div><span>' + esc(l[0]) + '</span><b' + (l[2] ? ' style="color:' + l[2] + '"' : '') + '>' + l[1] + '</b></div>'; }).join('') + '</div>' : '') + '</div>';
    var dv = n.real - n.rem, p = n.rem ? dv / Math.abs(n.rem) * 100 : null, ruim = n.inv ? dv < 0 : dv > 0;
    var cls = p == null ? '' : Math.abs(p) >= 1 ? (ruim ? 'gap' : 'ok') : '';
    var fv = n.fmt || f.brl, fd = n.fmtD || function (v) { return nf(Math.abs(v)); };
    var ult = n.imp !== undefined ? ['Impacto', n.imp == null ? '<b class="nt">—</b>' : f.seta(n.imp, f.brlc(Math.abs(n.imp)))]
      : ['YoY', n.ant ? f.seta(n.real / n.ant - 1, f.pct(Math.abs((n.real / n.ant - 1) * 100))) : '<b class="nt">—</b>'];
    return '<div class="tn ' + cls + (n.larga ? ' l' : '') + '" data-no="' + esc(n.id) + '"' + (n.pai ? ' data-pai="' + esc(n.pai) + '"' : '') + '>' +
      '<div class="tn-t">' + esc(n.t) + '</div><div class="tn-v">' + fv(n.real) + '</div><div class="tn-r">Remunerado <b>' + fv(n.rem) + '</b></div>' +
      '<div class="tn-g"><div><span>▲</span>' + f.seta(dv, fd(dv), !n.inv) + '</div><div><span>▲ %</span>' + (p == null ? '<b class="nt">—</b>' : f.seta(dv, f.pct(Math.abs(p)), !n.inv)) + '</div><div><span>' + ult[0] + '</span>' + ult[1] + '</div></div></div>';
  }
  /* árvore em colunas: niveis = [[nós da coluna 1], [coluna 2], …]; cada nó leva pai */
  /* árvore em colunas: um nível com mais de 7 nós vira sub-colunas (tudo aparece, nada é cortado);
     a observação sai do slide quando a árvore precisa da largura (obs null) ou quando não couber (ajusta) */
  function arvore(niveis, obs) {
    var cols = niveis.map(function (c) {
      if (c.length <= 7) return '<div class="col">' + c.map(no).join('') + '</div>';
      var nc = Math.ceil(c.length / 7), nr = Math.ceil(c.length / nc);
      return '<div class="col m" style="grid-template-rows:repeat(' + nr + ',auto);grid-template-columns:repeat(' + nc + ',auto)">' + c.map(no).join('') + '</div>';
    }).join('');
    return '<div class="arv' + (obs ? '' : ' so') + '"><div class="area"><svg class="lig"></svg><div class="cols">' + cols + '</div></div>' +
      (obs ? obsCard(obs) : '') + '</div>';
  }
  /* caixa de observações (à direita da árvore; embaixo da tabela com baixo:true) */
  function obsCard(o) {
    return '<div class="card com' + (o.baixo ? ' baixo' : '') + '"><h3>Observações</h3><div class="dica">' + esc(o.dica || 'o que a unidade explica sobre o desvio') + '</div>' +
      '<div class="caixa" contenteditable="true" data-obs="' + esc(o.chave) + '" data-ph="Escreva aqui a leitura da unidade. Fica salvo com a apresentação.">' + esc(o.texto || '') + '</div></div>';
  }

  /* FCA no desenho da Tabela do FCA: fato mesclado (desvio, contas, YTD), causa mesclada sobre as ações dela,
     uma linha por ação com dono, prazo e situação. grupos = [{fato, proj, tot, contas[], ytd, linhas:[{id, causa, acao, resp, prazo, status}]}] */
  var tri = function (t) { return esc(t).replace(/▲[^▲▼(]*(\([^)]*\))?/g, function (m) { return '<span class="tri-r">' + m + '</span>'; }).replace(/▼[^▲▼(]*(\([^)]*\))?/g, function (m) { return '<span class="tri-g">' + m + '</span>'; }); };
  var nCausa = function (t) { var m = String(t || '').match(/^\s*(\d+)\.(\s|$)/); return m ? +m[1] : null; };
  var nAcao = function (t) { var m = String(t || '').match(/^\s*(\d+)\.(\d+)\.(\s|$)/); return m ? [+m[1], +m[2]] : null; };
  var normC = function (t) { return String(t || '').replace(/\s+/g, ' ').trim().toLowerCase(); };
  var ST = function (s) { s = String(s || 'Não iniciada'); var c = /conclu/i.test(s) ? 'ok' : /andamento/i.test(s) ? 'and' : /cancel/i.test(s) ? 'can' : 'ni'; return '<span class="st ' + c + '">' + esc(s) + '</span>'; };
  var dataBR = function (p) { var m = String(p || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; };
  function causaHtml(t) {
    var s = String(t || '').trim(); if (!s) return '<span class="nt">—</span>';
    var num = '', m = s.match(/^(\d+)\.\s+/); if (m) { num = '<span class="nn">' + m[1] + '.</span>'; s = s.slice(m[0].length); }
    var i = s.search(/\n\s*\n\s*Obs\.:/), cab = i < 0 ? s : s.slice(0, i), ls = cab.split('\n'), txt = [], of = [];
    ls.forEach(function (l) { if (/^\s*-\s+/.test(l) || of.length) of.push(l.replace(/^\s*-\s+/, '')); else txt.push(l); });
    return num + tri(txt.join(' ')) + (of.length ? '<div class="of">' + of.slice(0, 5).map(function (o) { return '- ' + tri(o); }).join('\n') + (of.length > 5 ? '\n+ ' + (of.length - 5) + ' outras' : '') + '</div>' : '');
  }
  function acaoHtml(t, sozinha) {
    var s = String(t || '').trim(); if (!s) return '';
    var m = s.match(/^(\d+)\.(\d+)\.\s*/), num = '';
    if (m) { num = '<span class="nn">' + (sozinha ? m[1] + '.' : m[1] + '.' + m[2] + '.') + '</span>'; s = s.slice(m[0].length); }
    return num + esc(s.split('\n')[0]);
  }
  function ordemFca(ls) {
    var cs = [], ord = {}; ls.forEach(function (r) { var k = normC(r.causa); if (!(k in ord)) { ord[k] = cs.length; cs.push(k); } });
    return ls.slice().sort(function (a, b) {
      var ca = nCausa(a.causa), cb = nCausa(b.causa), ka = normC(a.causa), kb = normC(b.causa);
      if (ka !== kb) { if (ca != null && cb != null && ca !== cb) return ca - cb; if (ca != null && cb == null) return -1; if (cb != null && ca == null) return 1; return ord[ka] - ord[kb]; }
      var aa = nAcao(a.acao), ab = nAcao(b.acao); if (aa && ab) return aa[1] - ab[1]; if (aa) return -1; if (ab) return 1; return 0; });
  }
  function fca(grupos, o) {
    o = o || {}; var hoje = new Date().toISOString().slice(0, 10), corpo = '';
    grupos.forEach(function (g) {
      var ls = ordemFca(g.linhas || []); if (!ls.length) ls = [{ id: '', causa: '', acao: '' }];
      var span = {}; ls.forEach(function (r, i) { var k = normC(r.causa); if (i && normC(ls[i - 1].causa) === k) return; var n = 1; while (i + n < ls.length && normC(ls[i + n].causa) === k) n++; span[i] = n; });
      ls.forEach(function (r, i) {
        var k = normC(r.causa), soz = ls.filter(function (x) { return normC(x.causa) === k && String(x.acao || '').trim(); }).length === 1;
        var fech = /conclu|cancel/i.test(r.status || ''), venc = r.prazo && !fech && String(r.prazo).slice(0, 10) < hoje;
        var ultCausa = i === ls.length - 1 || normC(ls[i + 1].causa) !== k;
        var tds = '';
        if (i === 0) tds += '<td class="fato" rowspan="' + ls.length + '"><b>' + esc(g.fato) + '</b>' + (g.proj ? '<div class="of" style="margin-top:2px">' + esc(g.proj) + '</div>' : '') +
          (g.tot ? '<div class="dv">' + tri(g.tot) + '</div>' : '') + (g.contas && g.contas.length ? '<div class="ct">' + g.contas.map(tri).join('\n') + '</div>' : '') +
          (g.ytd ? '<div class="ytd">YTD ' + tri(g.ytd) + '</div>' : '') + (o.edit ? '<div class="so-ed" style="margin-top:8px"><span class="mais" data-add="causa" data-id="' + esc(ls[0].id) + '" title="Nova causa">+ causa</span></div>' : '') + '</td>';
        if (span[i]) tds += '<td class="causa" rowspan="' + span[i] + '">' + causaHtml(r.causa) + '</td>';
        var temA = String(r.acao || '').trim();
        tds += '<td class="ln acao' + (temA ? '' : ' semacao') + '">' + (temA ? acaoHtml(r.acao, soz) : 'sem ação') + '</td>' +
          '<td class="ln dono">' + esc(String(r.resp || '').trim() || '—') + '</td>' +
          '<td class="ln prz' + (venc ? ' venc' : '') + '">' + (dataBR(r.prazo) || '—') + '</td>' +
          '<td class="ln">' + ST(r.status) + (o.edit && ultCausa && r.id ? '<span class="mais" data-add="acao" data-id="' + esc(r.id) + '" title="Nova ação nesta causa">+</span>' : '') + '</td>';
        corpo += '<tr class="' + (i ? 'dt' : '') + (r.id ? ' ed' : '') + '"' + (r.id ? ' data-fca="' + esc(r.id) + '"' : '') + '>' + tds + '</tr>';
      });
    });
    var nl = (corpo.match(/<tr/g) || []).length;
    return '<div class="card tb' + (nl >= 6 ? ' fill" style="height:100%"' : '"') + '><table class="dre fca"><thead><tr><th>Fato</th><th>Causa</th><th>Ação</th><th>Resp.</th><th>Prazo</th><th>Status</th></tr></thead><tbody>' + corpo + '</tbody></table></div>';
  }
  /* número principal SEM card (o hero do portal) e, embaixo, os números pequenos */
  function solto(o) { return '<div class="solto"><div class="rot">' + esc(o.rot) + '</div><div class="v"' + (o.cor ? ' style="color:' + o.cor + '"' : '') + '>' + o.v + '</div>' + (o.u ? '<div class="u">' + o.u + '</div>' : '') +
    (o.ds && o.ds.length ? '<div class="ds">' + o.ds.map(function (d) { return '<div><span class="rot">' + esc(d.rot) + '</span><b>' + d.v + (d.m ? '<small>' + d.m + '</small>' : '') + '</b></div>'; }).join('') + '</div>' : '') + '</div>'; }
  /* a Tabela do FCA desenhada pelo FcaTabela (o mesmo HTML do painel FCA) */
  /* a tabela ocupa o slide: a letra sobe até caber e o respiro das linhas divide a sobra */
  function fcaPainel(html, n) { return '<div class="card fcap' + (n >= 6 ? ' tb fill" style="height:100%"' : '"') + '>' + html + '</div>'; }
  function vazio(t) { return '<div class="vazio-sl">' + esc(t) + '</div>'; }
  function kmini(o) { return '<div class="card kmini"><div class="rot">' + esc(o.rot) + '</div><div class="kv"' + (o.cor ? ' style="color:' + o.cor + '"' : '') + '>' + o.v + '</div>' + (o.m ? '<div class="km">' + o.m + '</div>' : '') + '</div>'; }

  /* ── o deck: HTML inteiro, com o desenho dos gráficos, a árvore e o ajuste ao slide ── */
  function doc(o) {
    var paginas = o.slides.map(function (h, i) { return h.replace(/§PG§/g, String(i + 1)); }).join('\n').replace(/url\(img\//g, 'url(' + o.base + 'img/');
    return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><base href="' + esc(o.base) + '"><title>' + esc(o.titulo || 'Apresentação') + '</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&family=Libre+Baskerville:wght@700&display=swap" rel="stylesheet">' +
      '<style>' + CSS + (o.css || '') + '</style></head><body' + (o.final ? ' class="final"' : '') + '>' + paginas +
      '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script><script>(' + RUN.toString() + ')();<\/script></body></html>';
  }

  /* roda DENTRO do deck */
  function RUN() {
    var nf = function (v, c) { return (+v).toLocaleString('pt-BR', { minimumFractionDigits: c || 0, maximumFractionDigits: c || 0 }); };
    var mi = function (v) { var a = Math.abs(v); return a >= 1e6 ? nf(a / 1e6, 2) + ' mi' : a >= 1e3 ? nf(a / 1e3, a >= 1e5 ? 0 : 1) + ' mil' : nf(a); };
    var fmtDe = function (t) { return t === 'brl' ? function (v) { return 'R$ ' + mi(v); } : t === 'pct' ? function (v) { return nf(v, 1) + '%'; } : t === 'n1' ? function (v) { return nf(v, 1); } : t === 'n2' ? function (v) { return nf(v, 2); } : t === 'int' ? function (v) { return nf(v); } : mi; };
    function bounds(vals, folgaB, folgaC) { vals = vals.filter(function (v) { return v != null && isFinite(v); }); if (!vals.length) return {};
      var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals), r = (mx - mn) || Math.abs(mx) || 1;
      var lo = mn - r * folgaB, hi = mx + r * folgaC; if (mn >= 0 && lo < 0) lo = 0; return { min: lo, max: hi }; }
    var VERM = '#FF0000', VERDE = '#00B300';
    function desenha(cv) {
      var g = JSON.parse(cv.getAttribute('data-g')), ctx = cv.getContext('2d'), fmt = fmtDe(g.fmt), k = parseFloat(getComputedStyle(cv).getPropertyValue('--k')) || 1;
      var fx = { size: Math.round(13 * k), family: 'Montserrat' }, fl = '700 ' + Math.round(13 * k) + 'px Montserrat';
      var base = { responsive: true, maintainAspectRatio: false, animation: false, devicePixelRatio: 2, plugins: { legend: { display: false }, tooltip: { enabled: false } } };
      if (g.tipo === 'ano') {          /* barras do realizado pela cor contra a referência, foco cheio, linhas tracejadas, rótulo no foco */
        var foco = g.foco || [], ruimSobe = g.ruimSeSobe !== false;
        var cor = g.real.map(function (v, i) { var r = g.rem ? g.rem[i] : null; return v == null ? null : (r == null ? '#9AA3B2' : ((ruimSobe ? v > r : v < r) ? VERM : VERDE)); });
        var ds = [{ type: 'bar', data: g.real, backgroundColor: cor.map(function (c, i) { return c ? c + (foco.length ? (foco.indexOf(i) >= 0 ? 'D9' : '33') : 'A6') : 'transparent'; }), borderColor: cor.map(function (c) { return c || 'transparent'; }), borderWidth: 1, borderRadius: 0, order: 3 }];
        var linha = function (d, c, o) { return { type: 'line', data: d, borderColor: c, borderWidth: 2.5, tension: .3, fill: false, borderDash: [5, 3], order: o, spanGaps: true,
          pointRadius: d.map(function (v, i) { return v == null ? 0 : foco.indexOf(i) >= 0 ? 6 : 3; }), pointBackgroundColor: c, pointBorderColor: c }; };
        if (g.rem) ds.push(linha(g.rem, '#161D2B', 1));
        if (g.orc) ds.push(linha(g.orc, '#1B6FC4', 2));
        var b = bounds([].concat(g.real, g.rem || [], g.orc || []), g.zero ? 9 : .5, .18); if (g.zero) b.min = 0;
        new Chart(ctx, { type: 'bar', data: { labels: g.labels, datasets: ds }, options: Object.assign({}, base, { layout: { padding: { top: 26 * k } },
          scales: { x: { grid: { display: false }, border: { display: false }, ticks: { font: fx, color: '#4A5568' } }, y: { display: false, min: b.min, max: b.max } } }),
          plugins: [{ afterDatasetsDraw: function (c) { var m = c.getDatasetMeta(0), x = c.ctx; x.save(); x.font = fl; x.fillStyle = '#333333'; x.textAlign = 'center'; x.textBaseline = 'bottom';
            (foco.length ? foco : g.real.map(function (v, i) { return i; })).forEach(function (i) { var p = m.data[i]; if (p && g.real[i] != null) x.fillText(fmt(g.real[i]), p.x, p.y - 6); }); x.restore(); } }] });
      } else if (g.tipo === 'bridge') {   /* do remunerado ao realizado: cinza escuro nas pontas, vermelho e verde nos passos */
        var acc = 0, dat = [], cores = [], txt = [];
        g.passos.forEach(function (p) { if (p.t) { dat.push([0, p.v]); cores.push('#6B7280'); txt.push(fmt(p.v)); acc = p.v; }
          else { dat.push([acc, acc + p.v]); cores.push(p.v > 0 ? VERM : VERDE); txt.push((p.v > 0 ? '▲ ' : '▼ ') + fmt(Math.abs(p.v))); acc += p.v; } });
        var bb = bounds([].concat.apply([], dat).filter(function (v, i) { return i % 2 === 1 || v !== 0; }), 1.4, .12);
        fx = { size: Math.round(11 * k), family: 'Montserrat' }; fl = '700 ' + Math.round(11.5 * k) + 'px Montserrat';
        new Chart(ctx, { type: 'bar', data: { labels: g.passos.map(function (p) { return p.n; }), datasets: [{ data: dat, backgroundColor: cores.map(function (c) { return c === '#6B7280' ? c : c + 'D9'; }), borderColor: cores, borderWidth: 1, borderRadius: 0, barPercentage: .62, categoryPercentage: .9 }] },
          options: Object.assign({}, base, { layout: { padding: { top: 26 * k } }, scales: { x: { grid: { display: false }, border: { display: false }, ticks: { font: fx, color: '#4A5568', maxRotation: 0, autoSkip: false } }, y: { display: false, min: bb.min, max: bb.max } } }),
          plugins: [{ afterDatasetsDraw: function (c) { var m = c.getDatasetMeta(0), x = c.ctx; x.save(); x.font = fl; x.textAlign = 'center'; x.textBaseline = 'bottom';
            m.data.forEach(function (b, i) { x.fillStyle = cores[i] === '#6B7280' ? '#333333' : cores[i] === VERM ? '#E00000' : '#009A00'; x.fillText(txt[i], b.x, Math.min(b.y, b.base) - 5); });
            x.strokeStyle = '#A3ABBA'; x.setLineDash([3, 3]);
            for (var i = 0; i < m.data.length - 1; i++) { var a = m.data[i], n = m.data[i + 1], yy = c.scales.y.getPixelForValue(dat[i][1]); x.beginPath(); x.moveTo(a.x + a.width / 2, yy); x.lineTo(n.x - n.width / 2, yy); x.stroke(); }
            x.restore(); } }] });
      } else if (g.tipo === 'meta' || g.tipo === 'faixa') {   /* barras por mês: cor pela meta (acima = ruim) ou pela faixa (pontuação) */
        var foco2 = g.foco || [];
        var corDe = function (v) { if (v == null) return null; if (g.tipo === 'meta') return v > g.meta ? VERM : VERDE; for (var q = 0; q < g.faixas.length; q++) if (v >= g.faixas[q][0]) return g.faixas[q][1]; return VERM; };
        var cs2 = g.v.map(corDe);
        var ds2 = [{ type: 'bar', data: g.v, backgroundColor: cs2.map(function (c, i) { return c ? c + (foco2.length ? (foco2.indexOf(i) >= 0 ? 'D9' : '33') : 'A6') : 'transparent'; }), borderColor: cs2.map(function (c) { return c || 'transparent'; }), borderWidth: 1, borderRadius: 0, order: 2 }];
        if (g.tipo === 'meta') ds2.push({ type: 'line', data: g.v.map(function () { return g.meta; }), borderColor: '#161D2B', borderWidth: 2, borderDash: [5, 3], pointRadius: 0, fill: false, order: 1 });
        var b2; if (g.tipo === 'meta') { var vv = g.v.filter(function (x) { return x != null; }), lo2 = Math.min(0, Math.min.apply(null, vv.concat([0]))), hi2 = Math.max(g.meta, Math.max.apply(null, vv.concat([0]))), r2 = (hi2 - lo2) || 1;
          b2 = { min: lo2 < 0 ? lo2 - r2 * .14 : 0, max: hi2 + r2 * .2 }; } else b2 = bounds(g.v, .6, .2);
        new Chart(ctx, { type: 'bar', data: { labels: g.labels, datasets: ds2 }, options: Object.assign({}, base, { layout: { padding: { top: 26 * k } },
          scales: { x: { grid: { display: false }, border: { display: false }, ticks: { font: fx, color: '#4A5568' } }, y: { display: false, min: b2.min, max: b2.max } } }),
          plugins: [{ afterDatasetsDraw: function (c) { var m = c.getDatasetMeta(0), x = c.ctx; x.save(); x.textAlign = 'center'; x.textBaseline = 'bottom';
            g.v.forEach(function (v, i) { var p = m.data[i]; if (!p || v == null) return; var em = !foco2.length || foco2.indexOf(i) >= 0; if (!em) return;
              x.font = (em ? '700 ' : '600 ') + Math.round((em ? 13 : 11) * k) + 'px Montserrat'; x.fillStyle = em ? '#333333' : '#737D91'; x.fillText(fmt(v), p.x, Math.min(p.y, p.base) - 5); });
            if (g.tipo === 'meta') { var yy = c.scales.y.getPixelForValue(g.meta); x.font = '600 ' + Math.round(11 * k) + 'px Montserrat'; x.fillStyle = '#161D2B'; x.textAlign = 'right'; x.fillText('meta ' + fmt(g.meta), c.chartArea.right, yy - 4); }
            x.restore(); } }] });
      } else if (g.tipo === 'barrasH') {   /* ranking horizontal: a barra destacada é a unidade */
        var cs = g.v.map(function (v, i) { return g.cores ? g.cores[i] : (i === g.foco ? '#F97316' : '#9AA3B2'); });
        new Chart(ctx, { type: 'bar', data: { labels: g.labels, datasets: [{ data: g.v, backgroundColor: cs.map(function (c) { return c + 'D9'; }), borderColor: cs, borderWidth: 1, borderRadius: 0, barPercentage: .8 }] },
          options: Object.assign({}, base, { indexAxis: 'y', layout: { padding: { right: 60 * k } }, scales: { y: { grid: { display: false }, border: { display: false }, ticks: { font: { size: Math.round(11.5 * k), family: 'Montserrat' }, color: '#161D2B' } }, x: { display: false, min: g.min != null ? g.min : 0, max: g.max } } }),
          plugins: [{ afterDatasetsDraw: function (c) { var m = c.getDatasetMeta(0), x = c.ctx; x.save(); x.font = '700 ' + Math.round(11.5 * k) + 'px Montserrat'; x.fillStyle = '#333333'; x.textBaseline = 'middle';
            m.data.forEach(function (b, i) { x.fillText(fmt(g.v[i]), b.x + 6, b.y); }); x.restore(); } }] });
      }
    }
    /* linhas da árvore: do lado direito do pai ao lado esquerdo do filho */
    function liga(area) { var sl = area.closest('.slide'), d0 = sl ? sl.style.display : ''; if (sl) sl.style.display = ''; var sv = area.querySelector('svg.lig'), r0 = area.getBoundingClientRect(), h = '';
      area.querySelectorAll('[data-pai]').forEach(function (n) { var p = area.querySelector('[data-no="' + n.getAttribute('data-pai') + '"]'); if (!p) return;
        var a = p.getBoundingClientRect(), b = n.getBoundingClientRect(), x1 = a.right - r0.left, y1 = a.top + a.height / 2 - r0.top, x2 = b.left - r0.left, y2 = b.top + b.height / 2 - r0.top, mx = (x1 + x2) / 2;
        h += '<path d="M' + x1 + ',' + y1 + ' C' + mx + ',' + y1 + ' ' + mx + ',' + y2 + ' ' + x2 + ',' + y2 + '" fill="none" stroke="rgba(15,23,42,.22)" stroke-width="1.5"/>'; });
      sv.innerHTML = h; if (sl) sl.style.display = d0; }
    /* --k: o maior em que o miolo cabe (0,72 a 1,25); --v: respiro das linhas da tabela até ocupar a altura */
    function cabe(s, duro) { var m = s.querySelector('.miolo'); if (!m) return true;
      var ok = m.scrollHeight <= m.clientHeight + 1 && m.scrollWidth <= m.clientWidth + 1;
      s.querySelectorAll('.card,.tn,.cols,table').forEach(function (e) { if (e.scrollWidth > e.clientWidth + 2 || e.scrollHeight > e.clientHeight + 2 && !e.matches('table')) ok = false; });
      var cols = s.querySelector('.cols'); if (cols && cols.scrollWidth > cols.clientWidth + 1) ok = false;
      /* nada pode passar da própria célula: pílula de status, número, texto sem quebra */
      s.querySelectorAll('table td').forEach(function (td) { var r = td.getBoundingClientRect(); for (var c = td.firstElementChild; c; c = c.nextElementSibling) { var q = c.getBoundingClientRect(); if (q.width && (q.right > r.right + 1 || q.left < r.left - 1)) { ok = false; break; } } });
      if (!duro) s.querySelectorAll('.hero .gr b,.tn-g b,.tn-v,.tn-r,.kpi .kv,.kpi .km').forEach(function (e) { if (e.scrollWidth > e.clientWidth + 1) ok = false;
        var p = e.parentElement.getBoundingClientRect(), r = e.getBoundingClientRect(); if (r.right > p.right + 1) ok = false; });
      return ok; }
    function ajusta(s) { if (!s.querySelector('.miolo')) return; var d0 = s.style.display; s.style.display = ''; var lo = .72, hi = s.querySelector('.fcap') ? 1 : 1.25;   /* FCA nunca cresce além do tamanho de tabela (Renan, 26/11/2026: "fonte exagerada nos FCAs") */
      var av = s.querySelector('.arv'); if (av && av.querySelector('.com')) { av.classList.remove('sem-obs'); s.style.setProperty('--v', 1); s.style.setProperty('--k', .9); if (!cabe(s)) av.classList.add('sem-obs'); }
      s.style.setProperty('--v', 1); s.style.setProperty('--k', hi); if (!cabe(s)) { s.style.setProperty('--k', lo); var duro = !cabe(s);   /* nem no menor cabe todo texto: vale só não estourar o slide */
        for (var i = 0; i < 12; i++) { var m = (lo + hi) / 2; s.style.setProperty('--k', m); if (cabe(s, duro)) lo = m; else hi = m; } s.style.setProperty('--k', lo); }
      var tb = s.querySelector('.tb.fill'); if (tb) { var vlo = 1, vhi = tb.classList.contains('fcap') ? 2.6 : 3; for (var j = 0; j < 10; j++) { var v = (vlo + vhi) / 2; s.style.setProperty('--v', v); if (cabe(s)) vlo = v; else vhi = v; } s.style.setProperty('--v', vlo); }
      /* listas (destaques, ranking, indicadores): as linhas dividem a altura do card e a letra cresce junto, até 17 px */
      s.querySelectorAll('.pn-dq .ls').forEach(function (ls) { var ls2 = ls.querySelectorAll('.l'); if (!ls2.length) return;
        ls2.forEach(function (l) { l.style.height = '0px'; l.style.minHeight = '0'; l.style.maxHeight = 'none'; l.style.flex = '0 0 auto'; });
        var k = parseFloat(getComputedStyle(s).getPropertyValue('--k')) || 1, h = (ls.clientHeight - 6) / ls2.length, fs = Math.max(8.5, Math.min(10.5 * k, h * .5 - 2));
        ls2.forEach(function (l) { l.style.height = h + 'px'; l.style.fontSize = fs + 'px'; }); });
      s.style.display = d0; }
    function tudo() { document.querySelectorAll('.slide').forEach(function (s) { ajusta(s); s.querySelectorAll('.area').forEach(liga); s.querySelectorAll('canvas[data-g]').forEach(function (cv) { var c = window.Chart && Chart.getChart(cv); if (c) c.destroy(); }); });
      if (window.Chart) document.querySelectorAll('canvas[data-g]').forEach(desenha); window.__deckPronto = true; }
    window.__ajustaDeck = tudo; window.__ajusta = tudo;
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function () { tudo(); });
  }

  window.ApresSlides = { f: f, css: CSS, capa: capa, sumario: sumario, divisoria: divisoria, fim: fim, conteudo: conteudo, grafico: grafico, fcaPainel: fcaPainel, LEG_ANO: LEG_ANO,
    kpi: kpi, kmini: kmini, solto: solto, obs: obsCard, tabela: tabela, no: no, arvore: arvore, fca: fca, vazio: vazio, ST: ST, tri: tri, doc: doc, esc: esc };
})();
