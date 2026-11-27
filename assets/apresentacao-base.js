// ============================================================
// Base das apresentações em PDF dos painéis (Renan, 30/10/2026: "pode montar o
// gerador automático" → Gestão à Vista, Visão Financeira, Painel KM e
// Scorecard, cada um com o botão "Gerar apresentação" em Atalhos).
//
// O mesmo layout clean do DriverPro que a Call do Frota de Elite usa: slide
// 1280×720, Montserrat, tabelas com cabeçalho cinza e filetes, blocos de
// leitura sem traço colorido na lateral (o Renan não gosta). Cada painel monta
// o conteúdo com os números que JÁ estão carregados na tela dele; esta base só
// desenha e fotografa.
//
// API: ApresBase.deck({acc, rodape, titulo, img}) → construtor de slides
//      ApresBase.pdf(htmlDoc, nomeArquivo, aviso) → baixa o PDF
//      ApresBase.f (formatos) · ApresBase.botao(btn, fn) (rótulo com andamento)
// ============================================================
(function () {
  const INK = '#0F1A20', INK2 = '#4A5563', INK3 = '#8A94A2', PALE = '#F3F4F6';
  const VERDE = '#1E8E5A', AMAR = '#D9A400', VERM = '#D83A2E';
  const FUNDO = { g: 'background:rgba(30,142,90,.13)', y: 'background:rgba(217,164,0,.16)', o: 'background:rgba(249,115,22,.17)', r: 'background:rgba(216,58,46,.14)', m: '' };
  const COR = { g: VERDE, y: '#A87D00', o: '#C2570C', r: VERM, m: INK3 };
  const MESN = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const MES3 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  const ok = v => v != null && isFinite(v);
  const f = {
    f0: v => !ok(v) ? '—' : Math.round(v).toLocaleString('pt-BR'),
    f1: v => !ok(v) ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    f2: v => !ok(v) ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    pct0: v => !ok(v) ? '—' : Math.round(v) + '%',
    pct1: v => !ok(v) ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%',
    sgnPct: v => !ok(v) ? '—' : (v > 0.05 ? '+' : v < -0.05 ? '−' : '') + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%',
    // R$ curto: 1,23 mi · 456 mil · 7.890
    brl: v => { if (!ok(v)) return '—'; const a = Math.abs(v), s = v < 0 ? '−' : ''; if (a >= 1e6) return s + 'R$ ' + (a / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' mi'; if (a >= 1e4) return s + 'R$ ' + Math.round(a / 1e3).toLocaleString('pt-BR') + ' mil'; return s + 'R$ ' + Math.round(a).toLocaleString('pt-BR'); },
    brlInt: v => !ok(v) ? '—' : (v < 0 ? '−' : '') + 'R$ ' + Math.round(Math.abs(v)).toLocaleString('pt-BR'),
    num: v => !ok(v) ? '—' : (Math.abs(v) >= 1e6 ? (v / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' mi' : Math.round(v).toLocaleString('pt-BR')),
    lista: a => a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' e ' + a[a.length - 1],
    pl: (n, s, p) => n === 1 ? s : (p || s + 's'),
    esc: s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;'),
    avg: a => { a = a.filter(ok); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; },
    sum: a => a.reduce((s, x) => s + (ok(x) ? x : 0), 0),
    MESN, MES3,
    mesAno: d => { d = d || new Date(); const m = MESN[d.getMonth()]; return m[0].toUpperCase() + m.slice(1) + '/' + d.getFullYear(); },
    quando: d => d ? new Date(d).toLocaleDateString('pt-BR') + ' ' + new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—',
    // célula colorida pela faixa: c = 'g' | 'y' | 'r' | 'm'
    cel: (txt, c, extra) => ({ v: txt, style: (FUNDO[c] || '') + ';text-align:center' + (extra ? ';' + extra : '') }),
    corTxt: (txt, c) => `<b style="color:${COR[c] || INK}">${txt}</b>`,
    // ▲ verde se a variação é boa, ▼ vermelho se ruim (bom = sentido da métrica)
    seta: (v, txt, bomSobe) => { if (!ok(v) || Math.abs(v) < 0.05) return `<span style="color:${INK3}">= ${txt || '0'}</span>`; const sobe = v > 0, bom = bomSobe === false ? !sobe : sobe; return `<span style="color:${bom ? VERDE : VERM};font-weight:800">${sobe ? '▲' : '▼'} ${txt}</span>`; },
    VERDE, AMAR, VERM, INK, INK2, INK3, PALE
  };

  /* VISÃO INFOGRÁFICO (Renan, 24/11/2026: "vou manter apenas a visão infográfico", com dois decks de
     referência de infográfico executivo → escolheu o acabamento B: "Vamos construir assim e vamos melhorando").
     Página clara com a faixa grafite em cima (Conlog · Fleet Hub | o selo do deck), o número e o
     nome da seção na lateral esquerda (em pé), o título que diz a conclusão e os cartões brancos com contorno
     e o topo grafite (os escuros com o topo laranja). Barra laranja no pé. Todo tamanho do miolo é multiplicado
     por --k, que o ajuste do fim do documento escolhe por slide: o maior que cabe (o slide não fica
     vazio nem estoura). */
  const CINK = '#16212B';
  const css = acc => `@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:#fff}
body{font-family:'Montserrat',Arial,sans-serif;color:${CINK};font-size:16px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.slide{--k:1;--v:1;width:1280px;height:720px;position:relative;overflow:hidden;background:#F5F6F8;padding:62px 64px 46px 110px;display:flex;flex-direction:column;justify-content:flex-start}
.slide>*{flex:0 0 auto}
.slide::after{content:'';position:absolute;left:0;right:0;bottom:0;height:8px;background:linear-gradient(90deg,#F97316 0%,#F97316 55%,#FDBA4D 88%,#FDE08A 100%);z-index:5}
.slide.dark{background:#121A21;color:#F4F5F7;justify-content:center;padding:62px 90px 46px}
.topo{position:absolute;left:0;right:0;top:0;height:34px;background:${CINK};color:#C9D1D9;display:flex;align-items:center;justify-content:space-between;gap:30px;padding:0 64px 0 110px;font-size:9.5px;font-weight:600;letter-spacing:2px;text-transform:uppercase;white-space:nowrap}
.topo b{color:#fff;font-weight:800}
.topo span:last-child{overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:8px}
.topo i{width:7px;height:7px;border-radius:50%;background:${acc};flex:0 0 auto}
.lat{position:absolute;left:0;top:34px;bottom:8px;width:78px;display:flex;flex-direction:column;align-items:center;padding-top:30px}
.lat .num{font-size:15px;font-weight:800;color:${CINK};position:relative;padding-left:12px}
.lat .num::before{content:'';position:absolute;left:0;top:-2px;width:4px;height:24px;background:${acc};border-radius:2px}
.lat .rot{writing-mode:vertical-rl;transform:rotate(180deg);font-size:10px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:#9AA4AF;margin-top:22px;white-space:nowrap;max-height:560px;overflow:hidden;text-overflow:ellipsis}
.kicker{display:none}
.slide.dark .kicker{display:block;font-size:12px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:${acc};margin-bottom:14px}
h1{font-size:42px;font-weight:800;line-height:1.1;letter-spacing:-.8px}
.slide.dark h1{color:#fff}
h2{font-size:27px;font-weight:800;line-height:1.15;letter-spacing:-.6px;margin-bottom:5px;color:${CINK}}
p{font-size:14.5px;line-height:1.55;color:${INK2}}
.slide.dark p{color:#B9C0CA}
.sub{font-size:13px;color:#6B7480;margin:0;max-width:1040px}
.corpo{flex:1 1 0;min-height:0;display:flex;flex-direction:column;gap:calc(14px*var(--k)*var(--v));margin-top:18px}
.corpo>*{flex:0 0 auto;margin-top:0!important}
.foot{position:absolute;left:110px;right:64px;bottom:20px;display:flex;justify-content:space-between;font-size:10px;font-weight:600;color:#9AA4AF;letter-spacing:.6px}
.foot span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:80%}
.slide.dark .foot{color:#6B7683;left:90px}
.note{font-size:calc(11px*var(--k));color:${INK2};line-height:1.4}
.tb,.card,.gf,.passo,.tile,.ml,.cap,.gs,.tl .pc{background:#fff;border:1px solid #DCE1E7;border-top:5px solid ${CINK};border-radius:6px;box-shadow:0 12px 28px -10px rgba(22,33,43,.18)}
.tb{padding:calc(4px*var(--k)) calc(16px*var(--k)) calc(8px*var(--k));min-width:0}
table{--t:1;width:100%;border-collapse:collapse;font-size:calc(13px*var(--k)*var(--t));table-layout:auto}
table.compacta{--t:.94} table.densa{--t:.86}
table th{text-align:left;padding:calc(10px*var(--k)*var(--t)*var(--v)) calc(9px*var(--k)*var(--t)) calc(8px*var(--k)*var(--t)*var(--v));white-space:nowrap;color:#8A94A2;font-size:calc(9.5px*var(--k)*var(--t));font-weight:700;letter-spacing:.9px;text-transform:uppercase;border-bottom:1.5px solid #CDD3DB}
table td{padding:calc(7px*var(--k)*var(--t)*var(--v)) calc(9px*var(--k)*var(--t));white-space:nowrap;border-bottom:1px solid #EBEEF1;color:${CINK};font-weight:500}
table td:first-child{font-weight:700}
table tr:last-child td{border-bottom:0}
td.n,th.n{text-align:right} td.w,th.w{white-space:normal}
td.c,th.c{text-align:center}
tr.sep td{background:#EEF0F3;font-weight:800;border-top:1.5px solid #CDD3DB;border-bottom:0}
.cards{display:grid;gap:calc(14px*var(--k))}
.card{padding:calc(14px*var(--k)*min(var(--v),1.3)) calc(18px*var(--k));min-width:0}
.card .k{font-size:calc(10px*var(--k));font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#8A94A2;margin-bottom:calc(6px*var(--k))}
.card .n{font-size:calc(30px*var(--k));font-weight:800;letter-spacing:-.9px;line-height:1.05;color:${CINK};white-space:nowrap} .card .n small{font-size:.45em;font-weight:700;letter-spacing:0}
.card p{font-size:calc(11.5px*var(--k));line-height:1.45;color:#6B7480;margin-top:calc(6px*var(--k))}
.card.esc,.conc,.concb{background:linear-gradient(155deg,#223140 0%,${CINK} 60%);border:1px solid #2F3F4E;border-top:5px solid ${acc};border-radius:6px;box-shadow:0 16px 34px -12px rgba(22,33,43,.45)}
.card.esc .k{color:#93A0AE} .card.esc .n{color:#fff} .card.esc p{color:#B9C2CC}
.conc,.concb{padding:calc(13px*var(--k)*min(var(--v),1.4)) calc(20px*var(--k)) calc(14px*var(--k)*min(var(--v),1.4))}
.lbl{font-size:calc(10px*var(--k));font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#8A94A2}
.conc .lbl,.concb .lbl{color:${acc}}
.conc .lbl{margin-bottom:calc(4px*var(--k))} .conc p{font-size:calc(12.5px*var(--k));line-height:1.5;color:#EEF1F5}
.concb .lbl{margin-bottom:calc(8px*var(--k))} .concb .cb{display:grid;gap:calc(10px*var(--k)) calc(22px*var(--k))}
.concb .t{font-size:calc(10px*var(--k));font-weight:700;color:#93A0AE;text-transform:uppercase;letter-spacing:.8px}
.concb .v{font-size:calc(19px*var(--k));font-weight:800;color:#fff;line-height:1.15;margin:calc(3px*var(--k)) 0;letter-spacing:-.3px}
.concb .s{font-size:calc(11.5px*var(--k));line-height:1.42;color:#B9C2CC}
.passos{display:grid;gap:calc(14px*var(--k))}
.passo{padding:calc(14px*var(--k)*min(var(--v),1.4)) calc(16px*var(--k));min-width:0;display:flex;flex-direction:column}
.passo .pn{width:calc(36px*var(--k));height:calc(36px*var(--k));border-radius:50%;background:${CINK};color:#fff;font-size:calc(13px*var(--k));font-weight:800;display:flex;align-items:center;justify-content:center;margin-bottom:calc(10px*var(--k))}
.passo:first-child .pn{background:${acc}}
.passo .pt{font-size:calc(10px*var(--k));font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#8A94A2}
.passo .pv{font-size:calc(16px*var(--k));font-weight:800;color:${CINK};letter-spacing:-.2px;margin:calc(2px*var(--k)) 0 calc(4px*var(--k));line-height:1.2}
.passo .ps{font-size:calc(11.5px*var(--k));color:#6B7480;line-height:1.42}
.gf{padding:14px 18px;min-width:0}
.gf svg{display:block;max-width:100%;height:auto;margin:0 auto}
.corpo>.gf{flex:1 1 0;min-height:190px;position:relative}
.corpo>.gf>svg{position:absolute;left:18px;top:14px;width:calc(100% - 36px);height:calc(100% - 28px);max-width:none}
.duas{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:calc(18px*var(--k));align-items:start}
.encher{flex:1 1 0!important;min-height:0}
.gx{display:grid;gap:calc(14px*var(--k))}
.ic{width:calc(42px*var(--k));height:calc(42px*var(--k));border-radius:10px;background:${CINK};display:flex;align-items:center;justify-content:center;flex:0 0 auto}
.ic svg{width:52%;height:52%}
.chip{display:inline-flex;align-items:center;gap:4px;font-size:calc(11px*var(--k));font-weight:800;border-radius:999px;padding:calc(3px*var(--k)) calc(10px*var(--k));white-space:nowrap}
.chip.r{background:#FBE9E7;color:#B42318}.chip.g{background:#E3F4EC;color:#14693F}.chip.cz{background:#EEF0F3;color:#4A5563}
.tile{padding:calc(14px*var(--k)*min(var(--v),1.3)) calc(18px*var(--k));display:flex;flex-direction:column;justify-content:space-between;gap:calc(8px*var(--k))}
.tile .a{display:flex;align-items:center;gap:calc(12px*var(--k))}
.tile .a span{font-size:calc(12.5px*var(--k));font-weight:700}
.tile .n{font-size:calc(30px*var(--k));font-weight:800;letter-spacing:-.9px;line-height:1;white-space:nowrap}
.tile .b{display:flex;justify-content:space-between;align-items:center;gap:8px;border-top:1px solid #EEF0F3;padding-top:calc(8px*var(--k))}
.tile .b em{font-style:normal;font-size:calc(10.5px*var(--k));color:#6B7480}
.ml{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:calc(16px*var(--k))}
.ml .arco{position:relative;width:100%;max-width:440px}
.ml .arco svg{display:block;width:100%;height:auto}
.ml .ct{position:absolute;left:0;right:0;bottom:6%;text-align:center}
.ml .ct b{display:block;font-size:calc(46px*var(--k));font-weight:900;letter-spacing:-2px;line-height:1}
.ml .ct span{display:block;font-size:calc(11.5px*var(--k));font-weight:600;color:#6B7480;margin-top:6px}
.ml .lg{display:flex;gap:calc(34px*var(--k));margin-top:calc(16px*var(--k));border-top:1px solid #EEF0F3;padding-top:calc(14px*var(--k))}
.ml .lg>div{display:flex;gap:9px;align-items:flex-start}
.ml .lg i{width:11px;height:11px;border-radius:50%;margin-top:6px;flex:0 0 auto}
.ml .lg b{display:block;font-size:calc(20px*var(--k));font-weight:800;letter-spacing:-.4px;white-space:nowrap}
.ml .lg span{display:block;font-size:calc(9.5px*var(--k));font-weight:700;color:#8A94A2;letter-spacing:1.2px;text-transform:uppercase;margin-top:2px}
.cap{display:flex;flex-direction:column;padding:calc(14px*var(--k)) calc(22px*var(--k)) calc(12px*var(--k))}
.cap .lgd{display:flex;gap:20px;justify-content:flex-end;font-size:calc(11px*var(--k));font-weight:600;color:#4A5563}
.cap .lgd i{display:inline-block;width:11px;height:11px;border-radius:4px;margin-right:6px;vertical-align:-1px}
.cap .bars{flex:1 1 0;min-height:170px;display:flex;align-items:flex-end;border-bottom:1px solid #E3E7EB;padding-top:26px}
.cap .par{flex:1;height:100%;display:flex;justify-content:center;align-items:flex-end;gap:calc(10px*var(--k))}
.cap .pil{width:calc(46px*var(--k));border-radius:999px;position:relative;min-height:10px}
.cap .pil b{position:absolute;left:50%;transform:translateX(-50%);top:-21px;font-size:calc(11.5px*var(--k));font-weight:800;white-space:nowrap}
.cap .nm{display:flex;padding-top:calc(8px*var(--k))}
.cap .nm>div{flex:1;display:flex;flex-direction:column;align-items:center;gap:5px;text-align:center;min-width:0}
.cap .nm>div>b{font-size:calc(12.5px*var(--k));font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.gs{padding:calc(12px*var(--k)) calc(18px*var(--k));display:flex;flex-direction:column}
.gs .lgd{display:flex;gap:20px;justify-content:flex-end;font-size:calc(11px*var(--k));font-weight:600;color:#4A5563;margin-bottom:4px}
.gs .lgd i{display:inline-block;width:18px;height:3px;border-radius:2px;margin-right:7px;vertical-align:middle}
.gs .cv{flex:1 1 0;min-height:212px;position:relative}
.gs .cv svg{position:absolute;inset:0;width:100%;height:100%}
.tl{display:grid;grid-template-rows:1fr auto 1fr;column-gap:calc(8px*var(--k));flex:1 1 0!important;min-height:0;position:relative}
.tl .lin{grid-row:2;grid-column:1/-1;height:4px;background:#E3E7EB;border-radius:2px;align-self:center}
.tl .bo{grid-row:2;justify-self:center;align-self:center;width:calc(48px*var(--k));height:calc(48px*var(--k));border-radius:50%;background:#fff;border:3px solid ${CINK};display:flex;align-items:center;justify-content:center;font-size:calc(15px*var(--k));font-weight:800;color:${CINK};z-index:1}
.tl .bo.f{background:${acc};border-color:${acc};color:#fff}
.tl .pc{padding:calc(12px*var(--k)*min(var(--v),1.3)) calc(15px*var(--k));min-width:0}
.tl .pc.up{grid-row:1;align-self:end;margin-bottom:calc(22px*var(--k))}
.tl .pc.dn{grid-row:3;align-self:start;margin-top:calc(22px*var(--k))}
.tl .hs{justify-self:center;width:3px;height:calc(22px*var(--k));background:#CDD3DB}
.tl .hs.up{grid-row:1;align-self:end}
.tl .hs.dn{grid-row:3;align-self:start}
.tl .pc .pt{font-size:calc(10px*var(--k));font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#8A94A2}
.tl .pc .pv{font-size:calc(15px*var(--k));font-weight:800;color:${CINK};letter-spacing:-.2px;margin:calc(2px*var(--k)) 0 calc(4px*var(--k));line-height:1.2}
.tl .pc .ps{font-size:calc(11.5px*var(--k));color:#6B7480;line-height:1.42}
.slide.arte{padding:0;background-color:#121A21;background-size:cover;background-position:center;color:#fff;display:block}
.arte .ak{font-size:12px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:${acc}}
.arte .at{font-weight:900;line-height:.98;letter-spacing:-2px;color:#fff;text-transform:uppercase}
.arte .at2{font-weight:300;line-height:1.02;letter-spacing:-1.4px;color:#C9D1D9;margin-top:4px}
.arte .ab{width:64px;height:5px;border-radius:2px;background:${acc};margin:24px 0 20px}
.arte .as{font-size:17px;font-weight:600;color:#fff;margin-top:22px}
.arte .per{font-size:12.5px;font-weight:500;color:#AEB8C2;letter-spacing:.2px}
.arte .si{display:flex;align-items:center;gap:26px;border-bottom:1px solid #2A3845;color:#fff;white-space:nowrap;overflow:hidden}
.arte .si b{font-weight:300;color:${acc};flex:0 0 auto}
.arte .si span{font-weight:700;overflow:hidden;text-overflow:ellipsis;flex:1;letter-spacing:-.2px}
.arte .si em{font-style:normal;font-size:12px;font-weight:600;color:#7D8A97;flex:0 0 auto}
.arte .sn{font-weight:300;color:${acc};line-height:1}`;

  // ── documento: as páginas na ordem, com o número pela posição ──
  // o ajuste: por slide, o maior --k (letra, de 1,5 a 0,7) em que o miolo cabe na altura e nenhuma tabela ou cartão passa da largura;
  // depois o maior --v (respiro das linhas, de 2,2 a 1) que ainda cabe
  const AJUSTE = `<script>(function(){function aj(){var S=document.querySelectorAll('.slide');for(var i=0;i<S.length;i++){var s=S[i],c=s.querySelector('.corpo');if(!c)continue;var d=s.style.display;s.style.display='';if(!c.clientHeight){s.style.display=d;continue;}
var cabe=function(){if(c.scrollHeight>c.clientHeight+1)return false;var f=c.children;for(var j=0;j<f.length;j++){if(f[j].offsetTop+f[j].offsetHeight>c.offsetTop+c.clientHeight+1)return false;}var t=c.querySelectorAll('.tb,.duas>div,.card .n,.tile .n,.ml .lg b');for(var j=0;j<t.length;j++){if(t[j].scrollWidth>t[j].clientWidth+1)return false;}var a=c.querySelectorAll('.encher,.tile,.ml,.tl .pc,.passo,.card');for(var j=0;j<a.length;j++){if(a[j].scrollHeight>a[j].clientHeight+1)return false;}return true;};
s.style.setProperty('--v','1');for(var k=150;k>=70;k-=5){s.style.setProperty('--k',(k/100).toFixed(2));if(cabe())break;}
for(var v=22;v>=10;v--){s.style.setProperty('--v',(v/10).toFixed(1));if(cabe())break;}s.style.display=d;}}
window.__ajusta=aj;aj();if(document.fonts&&document.fonts.ready)document.fonts.ready.then(aj);window.addEventListener('load',aj);})();<\/script>`;
  // o número da lateral: com divisórias de seção, o número da seção; sem elas, a ordem do assunto (a mesma do sumário)
  const numera = paginas => { const temSec = paginas.some(h => /class="slide[^"]*\bsec\b/.test(h)); let n = 0, ult = null;
    return paginas.map(h => { if (/class="slide[^"]*\bsec\b/.test(h)) n++; else if (!temSec && h.indexOf('§SN§') >= 0) { const k = (h.match(/data-sk="([^"]*)"/) || [])[1] || ''; if (k !== ult) { n++; ult = k; } }
      return h.replace(/§SN§/g, String(Math.max(n, 1)).padStart(2, '0')); }); };
  const docDe = ({ acc, titulo, paginas }) => `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${f.esc(titulo || 'Apresentação')}</title><style>${css(acc || '#F97316')}</style></head><body>${numera(paginas).map((h, i) => h.replace(/§PG§/g, String(i + 1))).join('\n')}${AJUSTE}</body></html>`;

  /* ── ARTE: capa, sumário, divisória e encerramento (visão Infográfico, 24/11/2026, no desenho das
     referências que o Renan mandou): grafite, a foto num quadro à direita com um bloco grafite por cima,
     o logo oficial da Conlog no alto à esquerda e a barra laranja no pé. Tudo o que é desenho (foto, blocos,
     marca, barra) é pintado num canvas e vira o fundo do slide: o html2canvas só põe o texto por cima. ── */
  const FOTO = (() => { try { return new URL('img/capa-frota.jpg', document.currentScript.src).href; } catch (e) { return ''; } })();
  // o logo oficial da Conlog (do site da empresa), em branco para fundo escuro
  const LOGO = (() => { try { return new URL('img/logo-conlog-branco.png', document.currentScript.src).href; } catch (e) { return ''; } })();
  const LAR = '#F97316', FUNDO_ESC = '#121A21', BLOCO = '#243341';
  function cobre(x, img, R, fx, fy) {              // a foto cobrindo a região R, com o foco em (fx, fy)
    x.save(); x.beginPath(); x.rect(R.x, R.y, R.w, R.h); x.clip();
    const e = Math.max(R.w / img.width, R.h / img.height), w = img.width * e, h = img.height * e;
    x.drawImage(img, R.x - (w - R.w) * (fx == null ? .5 : fx), R.y - (h - R.h) * (fy == null ? .5 : fy), w, h); x.restore();
  }
  // barra laranja do rodapé
  function barra(x) { const g = x.createLinearGradient(0, 0, 1280, 0); g.addColorStop(0, LAR); g.addColorStop(.55, LAR); g.addColorStop(.88, '#FDBA4D'); g.addColorStop(1, '#FDE08A'); x.fillStyle = g; x.fillRect(0, 712, 1280, 8); }
  // três filetes (o "menu" das referências)
  function filetes(x, X, Y, cor) { x.fillStyle = cor || '#5C6B79'; for (let i = 0; i < 3; i++) x.fillRect(X, Y + i * 8, 42, 2); }
  const _fundos = {};
  async function fundos(src) {
    src = src || FOTO; if (!src) return null; if (_fundos[src]) return _fundos[src];
    return _fundos[src] = (async () => {
      const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('a foto da capa não carregou')); i.src = src; });
      try { await Promise.all([document.fonts.load('900 60px Montserrat'), document.fonts.load('300 60px Montserrat'), document.fonts.load('700 15px Montserrat')]); } catch (e) {}
      const logo = LOGO ? await new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = LOGO; }) : null;
      const marca = (x, X, Y, h) => { if (!logo) return; const w = logo.width * h / logo.height; x.drawImage(logo, X, Y, w, h); };
      const K = 2, tela = () => { const c = document.createElement('canvas'); c.width = 1280 * K; c.height = 720 * K; const x = c.getContext('2d'); x.scale(K, K); x.fillStyle = FUNDO_ESC; x.fillRect(0, 0, 1280, 720); return [c, x]; };
      const sai = c => c.toDataURL('image/jpeg', .9), T = { x: 0, y: 0, w: 1280, h: 720 };
      // capa: a foto num quadro à direita, escurecida no lado do texto, e o bloco grafite por cima
      let [c1, x] = tela();
      const Q = { x: 600, y: 64, w: 600, h: 460 }; cobre(x, img, Q, .5, .58);
      const gq = x.createLinearGradient(Q.x, 0, Q.x + Q.w, 0); gq.addColorStop(0, 'rgba(18,26,33,.55)'); gq.addColorStop(.55, 'rgba(18,26,33,0)'); x.fillStyle = gq; x.fillRect(Q.x, Q.y, Q.w, Q.h);
      x.fillStyle = 'rgba(36,51,65,.92)'; x.fillRect(440, 170, 290, 440);
      marca(x, 84, 54, 30); filetes(x, 1158, 650); barra(x);
      // sumário: bloco grafite à esquerda, a lista à direita
      let [c2, x2] = tela(); x2.fillStyle = BLOCO; x2.fillRect(0, 0, 470, 720); marca(x2, 90, 54, 26); barra(x2);
      // divisória e encerramento: a foto inteira, escura à esquerda, com o bloco grafite atrás do texto
      const escura = (comLogo, bloco) => { const [c, xx] = tela(); cobre(xx, img, T, .5, .6);
        const g = xx.createLinearGradient(0, 0, 1280, 0); g.addColorStop(0, 'rgba(18,26,33,.94)'); g.addColorStop(.5, 'rgba(18,26,33,.82)'); g.addColorStop(1, 'rgba(18,26,33,.55)'); xx.fillStyle = g; xx.fillRect(0, 0, 1280, 720);
        xx.fillStyle = 'rgba(36,51,65,.85)'; xx.fillRect(bloco.x, bloco.y, bloco.w, bloco.h);
        if (comLogo) marca(xx, 84, 54, 30); filetes(xx, 1158, 60, '#8A97A4'); barra(xx); return sai(c); };
      return { capa: sai(c1), sum: sai(c2), div: escura(false, { x: 84, y: 232, w: 660, h: 260 }), fim: escura(true, { x: 84, y: 250, w: 560, h: 220 }) };
    })().catch(e => { console.warn('Arte da apresentação indisponível:', e); delete _fundos[src]; return null; });
  }
  const tam = (t, faixas) => { const n = String(t || '').length; for (const [lim, px] of faixas) if (n <= lim) return px; return faixas[faixas.length - 1][1]; };
  const arte = {
    // capa: o título em caixa alta, pesado; a 2ª linha (período) fina; o subtítulo e a data embaixo
    capa: (F, { titulo, sub, periodo }) => { const t = String(titulo || ''), p = String(periodo || '').replace(/\s*\|\s*/g, ' · ');
      const hoje = new Date().toLocaleDateString('pt-BR');
      return `<div style="position:absolute;inset:0;background:url('${F.capa}') center/cover"></div>
      <div style="position:absolute;left:84px;top:0;bottom:70px;width:1040px;display:flex;flex-direction:column;justify-content:center;padding-top:40px">
        <div class="ak" style="margin-bottom:18px">Fleet Hub</div>
        <div class="at" style="font-size:${tam(t, [[10, 86], [14, 74], [20, 60], [28, 48], [999, 40]])}px">${f.esc(t)}</div>
        ${p ? `<div class="at2" style="font-size:${tam(p, [[14, 72], [20, 56], [28, 44], [40, 34], [999, 28]])}px">${f.esc(p)}</div>` : ''}
        ${sub ? `<div class="as">${f.esc(sub)}</div>` : ''}
        <div class="ab"></div>
        <div class="per">Gerado em ${hoje}</div>
      </div>`; },
    sumario: (F, { periodo, itens }) => { const n = itens.length, nc = n > 20 ? 2 : 1, por = Math.ceil(n / nc), rh = Math.min(68, Math.floor(520 / Math.max(por, 1)));
      const fs = rh >= 56 ? 24 : rh >= 42 ? 19 : rh >= 32 ? 16 : rh >= 27 ? 14 : 12, lw = nc === 2 ? 300 : 630;
      const col = i => itens.slice(i * por, (i + 1) * por).map((it, j) => `<div class="si" style="height:${rh}px;font-size:${fs}px"><b style="font-size:${Math.round(fs * 1.15)}px;width:${Math.round(fs * 2)}px">${String(i * por + j + 1).padStart(2, '0')}</b><span>${f.esc(it.t)}</span><em>pág. ${it.n}</em></div>`).join('');
      return `<div style="position:absolute;inset:0;background:url('${F.sum}') center/cover"></div>
      <div style="position:absolute;left:90px;top:0;bottom:0;width:320px;display:flex;flex-direction:column;justify-content:center">
        <div class="at" style="font-size:44px;letter-spacing:-1px">Sumário</div><div class="ab" style="margin:20px 0 22px"></div>
        <div class="per" style="font-size:13px;line-height:1.6">${f.esc(String(periodo || '').replace(/\s*\|\s*/g, ' · '))}</div></div>
      <div style="position:absolute;left:560px;right:90px;top:0;bottom:60px;display:flex;align-items:center;gap:30px">${Array.from({ length: nc }, (_, i) => `<div style="width:${lw}px">${col(i)}</div>`).join('')}</div>`; },
    // divisória de seção: o número fino em laranja e o título sobre o bloco grafite
    secao: (F, { num, titulo, texto }) => `<div style="position:absolute;inset:0;background:url('${F.div}') center/cover"></div>
      <div style="position:absolute;left:128px;top:232px;width:590px;height:260px;display:flex;flex-direction:column;justify-content:center">
        <div class="sn" style="font-size:54px">${num}</div>
        <div style="font-size:${tam(f.esc(titulo), [[18, 50], [28, 40], [999, 32]])}px;font-weight:900;letter-spacing:-1.2px;color:#fff;line-height:1.05;margin-top:10px">${titulo}</div>
        ${texto ? `<div style="font-size:15px;color:#C9D1D9;margin-top:14px;line-height:1.5">${texto}</div>` : ''}
      </div>`,
    fim: (F, { texto, sub }) => `<div style="position:absolute;inset:0;background:url('${F.fim}') center/cover"></div>
      <div style="position:absolute;left:128px;top:250px;width:500px;height:220px;display:flex;flex-direction:column;justify-content:center">
        <div style="font-size:66px;font-weight:900;letter-spacing:-2px;color:#fff;line-height:1">${f.esc(texto || 'Obrigado!')}</div>
        <div class="ab" style="margin:22px 0 0"></div>
        ${sub ? `<div class="per" style="font-size:16px;margin-top:16px">${f.esc(sub)}</div>` : ''}
      </div>`
  };

  // ícones das peças de infográfico (traço, 24×24)
  const ICO = {
    fuel: '<line x1="3" x2="15" y1="22" y2="22"/><line x1="4" x2="14" y1="9" y2="9"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/>',
    wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    tire: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3.5"/><line x1="12" y1="2" x2="12" y2="8.5"/><line x1="12" y1="15.5" x2="12" y2="22"/><line x1="2" y1="12" x2="8.5" y2="12"/><line x1="15.5" y1="12" x2="22" y2="12"/>',
    truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
    box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    up: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
    down: '<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>'
  };
  const tomC = t => t === 'r' || t === 'g' ? t : 'cz';
  const svgI = (k, cor, w) => `<svg viewBox="0 0 24 24" fill="none" stroke="${cor || '#fff'}" stroke-width="${w || 2}" stroke-linecap="round" stroke-linejoin="round">${ICO[k] || ICO.box}</svg>`;
  // curva suave (Catmull-Rom) pelos pontos
  const suave = pts => { if (pts.length < 2) return ''; let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`; }
    return d; };

  // ── construtor de slides ──
  function deck(o) {
    o = o || {};
    const acc = o.acc || '#F97316';
    const S = [];                      // {html, k (assunto), sec, bloco, tipo}
    let _k = '', _sec = false, _bloco = null;
    const foot = () => `<div class="foot"><span>${o.rodape || ''}</span><span>§PG§</span></div>`;
    const limpa = t => String(t == null ? '' : t).replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    // o que vem depois do cabeçalho é o miolo do slide (ocupa a altura que sobra)
    // (os tamanhos de letra escritos à mão no miolo também acompanham o --k)
    const miolo = h => { const i = h.indexOf('§C§'); return i < 0 ? h : h.slice(0, i) + '<div class="corpo">' + h.slice(i + 3).replace(/font-size:\s*(\d+(?:\.\d+)?)px/g, 'font-size:calc($1px*var(--k))') + '</div>'; };
    const B = {
      acc,
      // os slides seguintes pertencem a este bloco (o painel Apresentações liga, desliga e reordena por bloco)
      bloco: (id, titulo) => { _bloco = { id, titulo }; },
      slide: (inner, so) => { const ar = so && (so.arte || so.dark), sec = so && so.sec;
        const moldura = ar ? '' : `<div class="topo"><span><b>Conlog</b> · Fleet Hub</span><span>${o.selo ? `<i></i>${o.selo}` : f.esc(o.titulo || '')}</span></div><div class="lat"><div class="num">§SN§</div><div class="rot">${f.esc(_k)}</div></div>`;
        S.push({ k: _k, sec: _sec, bloco: _bloco, tipo: (so && so.tipo) || 'cont',
        html: `<section class="slide${so && so.top ? ' top' : ''}${so && so.dark ? ' dark' : ''}${so && so.capa ? ' capa' : ''}${so && so.arte ? ' arte' : ''}${sec ? ' sec' : ''}"${ar ? '' : ` data-sk="${f.esc(_k)}"`}${so && so.style ? ` style="${so.style}"` : ''}>${moldura}${miolo(inner)}${so && so.arte ? '' : foot()}</section>` }); _k = ''; _sec = false; },
      head: (k, h, sub) => { _k = limpa(k); return `<div class="hd"><div class="kicker">${k}</div><h2>${h}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}</div>§C§`; },
      // lista numerada (prioridades, próximos passos): a 1ª em destaque
      passos: itens => { const n = itens.length;
        if (n >= 3 && n <= 6) { const C = 2 * n + 2;   // uma coluna de folga em cada ponta: todo cartão tem a mesma largura e fica centrado no número
          return `<div class="tl" style="grid-template-columns:repeat(${C},minmax(0,1fr))"><div class="lin"></div>${itens.map((p, i) => { const c0 = 2 * i + 1, c1 = 2 * i + 5;
            return `<div class="bo${i ? '' : ' f'}" style="grid-column:${2 * i + 2}/span 2">${i + 1}</div><div class="hs ${i % 2 ? 'dn' : 'up'}" style="grid-column:${2 * i + 2}/span 2"></div><div class="pc ${i % 2 ? 'dn' : 'up'}" style="grid-column:${c0}/${c1}"><div class="pt">${p.t}</div><div class="pv">${p.v || ''}</div><div class="ps">${p.s || ''}</div></div>`; }).join('')}</div>`; }
        return `<div class="passos" style="grid-template-columns:repeat(${n <= 4 ? n : 3},minmax(0,1fr))">${itens.map((p, i) => `<div class="passo"><div class="pn">${String(i + 1).padStart(2, '0')}</div><div class="pb"><div class="pt">${p.t}</div><div class="pv">${p.v || ''}</div><div class="ps">${p.s || ''}</div></div></div>`).join('')}</div>`; },
      conc: (txt, rot) => `<div class="conc"><div class="lbl">${rot || 'Leitura'}</div><p>${txt}</p></div>`,
      concBlocos: (itens, rot, cols) => `<div class="concb"><div class="lbl">${rot}</div><div class="cb" style="grid-template-columns:repeat(${cols || itens.length},minmax(0,1fr))">${itens.map(b => `<div><div class="t">${b.t}</div>${b.v ? `<div class="v">${b.v}</div>` : ''}<div class="s">${b.s || ''}</div></div>`).join('')}</div></div>`,
      cards: (itens, cols) => `<div class="cards" style="grid-template-columns:repeat(${cols || itens.length},minmax(0,1fr))">${itens.map(c => `<div class="card${c.acc ? ' esc' : ''}"><div class="k">${c.k}</div><div class="n"${c.cor ? ` style="color:${c.cor}"` : ''}>${c.n}</div>${c.p ? `<p>${c.p}</p>` : ''}</div>`).join('')}</div>`,
      tabela: ({ cols, rows, classe, style }) => {
        const th = cols.map(c => `<th class="${c.n ? 'n' : ''}${c.c ? ' c' : ''}${c.w ? ' w' : ''}"${c.style ? ` style="${c.style}"` : ''}>${c.t}</th>`).join('');
        const tr = r => `<tr${r.cls ? ` class="${r.cls}"` : ''}>${(r.c || r).map((v, i) => { const c = cols[i] || {}; const x = v !== null && typeof v === 'object' && !Array.isArray(v) ? v : { v }; return `<td class="${c.n ? 'n' : ''}${c.c ? ' c' : ''}${c.w ? ' w' : ''}"${x.style ? ` style="${x.style}"` : ''}>${x.v == null ? '—' : x.v}</td>`; }).join('')}</tr>`;
        return `<div class="tb"><table class="${classe || 'compacta'}" style="${style || ''}"><tr>${th}</tr>${rows.map(tr).join('')}</table></div>`;
      },
      // capa: com a arte pronta (ApresBase.fundos), o desenho da foto em tiras; sem ela, a foto escurecida de antes
      capa: ({ kicker, h1, texto, titulo, periodo }) => {
        if (o.fundos) { const per = periodo || String(h1 || '').split(/<br\s*\/?>/i).map(limpa).filter(Boolean).join('  |  '); if (!o.periodo) o.periodo = per;
          return B.slide(arte.capa(o.fundos, { titulo: titulo || limpa(kicker), periodo: per }), { arte: true, tipo: 'capa' }); }
        B.slide(`<div style="max-width:720px"><div class="kicker">${kicker || ''}</div><h1 style="font-size:50px">${h1}</h1>${texto ? `<p style="margin-top:22px;font-size:17px;max-width:620px">${texto}</p>` : ''}</div>`,
          { dark: true, capa: !!o.img, tipo: 'capa', style: o.img ? `background:linear-gradient(90deg,#0F1216 0%,rgba(15,18,22,.94) 42%,rgba(15,18,22,.55) 75%,rgba(15,18,22,.35) 100%),url('${o.img}') center right/cover` : '' });
      },
      // divisória de seção: a foto escura com o número e o título (sem a arte, o fundo grafite)
      capaSec: (num, h1, texto) => { _k = limpa(h1); _sec = true;
        if (o.fundos) return B.slide(arte.secao(o.fundos, { num: '§SN§', titulo: h1, texto }), { arte: true, sec: true });
        B.slide(`<div><div class="kicker">Parte §SN§</div><h1 style="max-width:900px">${h1}</h1>${texto ? `<p style="margin-top:18px;font-size:16px;max-width:820px">${texto}</p>` : ''}</div>`, { dark: true, sec: true }); },
      // ── peças de infográfico ──
      ic: (k, cor) => svgI(k, cor),
      // r = vermelho · g = verde · o resto = cinza
      chip: (txt, tom) => `<span class="chip ${tomC(tom)}">${txt}</span>`,
      // grade de cartões com ícone: {ic, k, n, s, chip:{t, tom}}
      tiles: (itens, cols, cls) => `<div class="gx${cls ? ' ' + cls : ''}" style="grid-template-columns:repeat(${cols || itens.length},minmax(0,1fr));grid-auto-rows:1fr">${itens.map(t => `<div class="tile"><div class="a"><div class="ic"${t.icCor ? ` style="background:${t.icCor}"` : ''}>${svgI(t.ic)}</div><span>${t.k}</span></div><div class="n"${t.cor ? ` style="color:${t.cor}"` : ''}>${t.n}</div>${t.s || t.chip ? `<div class="b"><em>${t.s || ''}</em>${t.chip ? `<span class="chip ${tomC(t.chip.tom)}">${t.chip.t}</span>` : ''}</div>` : ''}</div>`).join('')}</div>`,
      // meia-lua: o arco de fora é o realizado, o de dentro o remunerado (proporcionais ao maior); o número no centro
      meiaLua: ({ a, b, ta, tb, la, lb, centro, centroSub, corA, corB }) => {
        const mx = Math.max(Math.abs(a || 0), Math.abs(b || 0), 1) * 1.12, ca = corA || VERM, cb = corB || CINK;
        const arco = (r, fr, cor, esp) => { fr = Math.max(0, Math.min(1, fr)); const an = Math.PI * (1 - fr), x = 230 + r * Math.cos(an), y = 230 - r * Math.sin(an);
          return `<path d="M ${230 - r} 230 A ${r} ${r} 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}" fill="none" stroke="${cor}" stroke-width="${esp}" stroke-linecap="round"/>`; };
        return `<div class="ml"><div class="arco"><svg viewBox="0 0 460 250">${arco(200, 1, '#E3E7EB', 30)}${arco(200, Math.abs(a || 0) / mx, ca, 30)}${arco(158, 1, '#E3E7EB', 20)}${arco(158, Math.abs(b || 0) / mx, cb, 20)}</svg>
          <div class="ct"><b style="color:${ca}">${centro || ''}</b><span>${centroSub || ''}</span></div></div>
          <div class="lg"><div><i style="background:${ca}"></i><div><b>${ta}</b><span>${la}</span></div></div><div><i style="background:${cb}"></i><div><b>${tb}</b><span>${lb}</span></div></div></div></div>`;
      },
      // cápsulas: duas barras por categoria (a = realizado, b = remunerado), com o chip embaixo
      capsulas: (itens, oo) => { oo = oo || {}; const mx = Math.max(...itens.map(i => Math.max(Math.abs(i.a || 0), Math.abs(i.b || 0))), 1);
        const h = v => Math.max(4, Math.round(Math.abs(v || 0) / mx * 100));
        return `<div class="cap encher"><div class="lgd"><span><i style="background:${CINK}"></i>${oo.la || 'Realizado'}</span><span><i style="background:#CDD3DB"></i>${oo.lb || 'Remunerado'}</span></div>
          <div class="bars">${itens.map(i => `<div class="par"><div class="pil" style="height:${h(i.a)}%;background:${i.corA || CINK}"><b>${i.ta}</b></div><div class="pil" style="height:${h(i.b)}%;background:#CDD3DB"><b style="color:#6B7480">${i.tb}</b></div></div>`).join('')}</div>
          <div class="nm">${itens.map(i => `<div><b title="${f.esc(i.rot)}">${f.esc(i.rot)}</b>${i.chip ? `<span class="chip ${tomC(i.chip.tom)}">${i.chip.t}</span>` : ''}</div>`).join('')}</div></div>`; },
      // picos: um pico por categoria, vermelho acima da meta (ou quando ruim(v)), com a meta tracejada
      picos: (cats, vals, oo) => { oo = oo || {}; const W = 1100, H = 236, top = 40, base = H - 26, nums = vals.filter(ok);
        const lo = Math.min(0, ...nums), mx = Math.max(...nums, oo.meta || 0) * 1.08 || 1, Y = v => base - (base - top) * ((v - lo) / ((mx - lo) || 1)), bw = W / Math.max(cats.length, 1);
        const ruim = oo.ruim || (v => oo.meta != null && v > oo.meta);
        let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" font-family="Montserrat,Arial"><defs><linearGradient id="pkR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${VERM}"/><stop offset="1" stop-color="${VERM}" stop-opacity=".45"/></linearGradient><linearGradient id="pkN" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${CINK}"/><stop offset="1" stop-color="${CINK}" stop-opacity=".45"/></linearGradient></defs>`;
        s += `<line x1="0" x2="${W}" y1="${base}" y2="${base}" stroke="#DCE1E7" stroke-width="2"/>`;
        cats.forEach((c, i) => { const v = vals[i], cx = bw * i + bw / 2, hw = Math.min(bw * .46, 90);
          if (ok(v)) { const y = Y(v), r = ruim(v), y0 = Y(Math.max(lo, 0));
            s += v >= 0 ? `<path d="M${cx - hw} ${y0} C${cx - hw * .36} ${y0} ${cx - hw * .16} ${y} ${cx} ${y} C${cx + hw * .16} ${y} ${cx + hw * .36} ${y0} ${cx + hw} ${y0}Z" fill="url(#${r ? 'pkR' : 'pkN'})"/>`
              : `<path d="M${cx - hw} ${y0} C${cx - hw * .36} ${y0} ${cx - hw * .16} ${y} ${cx} ${y} C${cx + hw * .16} ${y} ${cx + hw * .36} ${y0} ${cx + hw} ${y0}Z" fill="${VERDE}" fill-opacity=".7"/>`;
            s += `<text x="${cx}" y="${v >= 0 ? y - 10 : y + 20}" text-anchor="middle" font-size="16" font-weight="800" paint-order="stroke" stroke="#fff" stroke-width="5" stroke-linejoin="round" fill="${r ? VERM : CINK}">${oo.fmt ? oo.fmt(v) : f.f1(v)}</text>`; }
          s += `<text x="${cx}" y="${H - 6}" text-anchor="middle" font-size="13" font-weight="700" fill="#4A5563">${f.esc(c)}</text>`; });
        if (oo.meta != null) s += `<line x1="0" x2="${W}" y1="${Y(oo.meta)}" y2="${Y(oo.meta)}" stroke="${acc}" stroke-width="2.2" stroke-dasharray="8 6"/><text x="4" y="${Y(oo.meta) - 8}" text-anchor="start" font-size="12" font-weight="700" paint-order="stroke" stroke="#fff" stroke-width="5" stroke-linejoin="round" fill="${acc}">${oo.metaTxt || 'Meta'}</text>`;
        return `<div class="gs encher"><div class="cv">${s}</svg></div></div>`; },
      // curva: séries suaves por categoria; a 1ª em laranja com área, as outras tracejadas
      curva: (cats, series, oo) => { oo = oo || {}; const W = 1100, H = 226, pl = 58, pr = 20, pt = 24, pb = 26;
        const nums = series.flatMap(x => x.vals).filter(ok); if (!nums.length) return '';
        let lo = Math.min(...nums), hi = Math.max(...nums); const amp = (hi - lo) || Math.abs(hi) || 1; lo -= amp * .25; hi += amp * .18; if (oo.zero && lo > 0) lo = 0;
        const X = i => pl + (W - pl - pr) * (cats.length > 1 ? i / (cats.length - 1) : .5), Y = v => pt + (H - pt - pb) * (1 - (v - lo) / ((hi - lo) || 1));
        let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" font-family="Montserrat,Arial"><defs><linearGradient id="cvA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${acc}" stop-opacity=".28"/><stop offset="1" stop-color="${acc}" stop-opacity="0"/></linearGradient></defs>`;
        for (let g = 0; g <= 4; g++) { const v = lo + (hi - lo) * g / 4, y = Y(v); s += `<line x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}" stroke="#EEF0F3"/><text x="${pl - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#8A94A2">${oo.fmtEixo ? oo.fmtEixo(v) : f.f0(v)}</text>`; }
        series.slice().reverse().forEach((se, ri) => { const si = series.length - 1 - ri, pts = se.vals.map((v, i) => ok(v) ? [X(i), Y(v)] : null).filter(Boolean); if (!pts.length) return;
          const d = suave(pts), cor = se.cor || (si === 0 ? acc : CINK);
          if (si === 0) s += `<path d="${d} L${pts[pts.length - 1][0]} ${H - pb} L${pts[0][0]} ${H - pb}Z" fill="url(#cvA)"/>`;
          s += `<path d="${d}" fill="none" stroke="${cor}" stroke-width="${si === 0 ? 4 : 2.6}"${si === 0 ? '' : ' stroke-dasharray="7 5"'}/>`;
          if (si === 0) se.vals.forEach((v, i) => { if (!ok(v)) return; s += `<circle cx="${X(i)}" cy="${Y(v)}" r="5" fill="${cor}" stroke="#fff" stroke-width="2"/><text x="${X(i)}" y="${Y(v) - 11}" text-anchor="middle" font-size="12" font-weight="800" fill="${CINK}">${oo.fmt ? oo.fmt(v) : f.f0(v)}</text>`; }); });
        cats.forEach((c, i) => { s += `<text x="${X(i)}" y="${H - 6}" text-anchor="middle" font-size="12" font-weight="600" fill="#6B7480">${f.esc(c)}</text>`; });
        return `<div class="gs encher"><div class="lgd">${series.map((se, i) => `<span><i style="background:${se.cor || (i === 0 ? acc : CINK)}"></i>${f.esc(se.nome)}</span>`).join('')}</div><div class="cv">${s}</svg></div></div>`; },
      // barras horizontais simples (rótulo · barra · valor), cor por item
      barrasH: (itens, oo) => {
        oo = oo || {}; const w = oo.w || 560, lh = oo.lh || 26, lw = oo.lw || 150, mx = oo.max || Math.max(...itens.map(i => Math.abs(i.v || 0)), 1), bw = w - lw - 70;
        let s = `<svg viewBox="0 0 ${w} ${itens.length * lh + 6}" width="${w}" height="${itens.length * lh + 6}" font-family="Montserrat,Arial" font-size="11.5">`;
        itens.forEach((it, i) => { const y = 3 + i * lh, ww = Math.max(1.5, bw * Math.abs(it.v || 0) / mx);
          s += `<text x="${lw - 10}" y="${y + lh / 2 + 4}" text-anchor="end" fill="${INK}" font-weight="600">${f.esc(it.rot)}</text>`;
          s += `<rect x="${lw}" y="${y + 5}" width="${bw}" height="${lh - 10}" rx="${(lh - 10) / 2}" fill="#EEF0F3"/><rect x="${lw}" y="${y + 5}" width="${ww}" height="${lh - 10}" rx="${Math.min((lh - 10) / 2, ww / 2)}" fill="${it.cor || CINK}"/>`;
          s += `<text x="${lw + ww + 6}" y="${y + lh / 2 + 4}" fill="${INK}" font-weight="700">${it.txt != null ? it.txt : f.f0(it.v)}</text>`; });
        return s + '</svg>';
      },
      // colunas verticais por categoria (mês a mês), com linha de meta opcional
      colunas: (cats, vals, oo) => {
        oo = oo || {}; const w = oo.w || 1136, h = oo.h || 280, pad = { l: 16, r: 16, t: 26, b: 30 };
        const nums = vals.filter(ok), mx = oo.max != null ? oo.max : Math.max(...nums, oo.meta || 0) * 1.1, lo = oo.lo != null ? oo.lo : 0;
        const bw = (w - pad.l - pad.r) / Math.max(cats.length, 1), H = h - pad.t - pad.b, Y = v => pad.t + H * (1 - (Math.max(Math.min(v, mx), lo) - lo) / ((mx - lo) || 1));
        let s = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="Montserrat,Arial" font-size="11">`;
        if (lo < 0) s += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(0)}" y2="${Y(0)}" stroke="${INK3}"/>`;
        if (oo.meta != null) s += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(oo.meta)}" y2="${Y(oo.meta)}" stroke="${INK3}" stroke-dasharray="5 4"/><text x="${pad.l}" y="${Y(oo.meta) - 5}" text-anchor="start" fill="${INK2}" font-weight="700" font-size="10">${oo.metaTxt || 'Meta'}</text>`;
        cats.forEach((c, i) => { const v = vals[i], x = pad.l + bw * i + bw * .18;
          // a barra sai do zero (ou do piso, quando ele é positivo): negativo desce
          const y0 = Y(lo > 0 ? lo : 0);
          const hh = Math.max(1, Math.abs(y0 - Y(v)));
          if (ok(v)) s += `<rect x="${x}" y="${Math.min(Y(v), y0)}" width="${bw * .64}" height="${hh}" rx="${Math.min(bw * .32, 14, hh / 2)}" fill="${(oo.cor && oo.cor(v, i)) || CINK}"/><text x="${x + bw * .32}" y="${v < 0 ? Y(v) + 14 : Y(v) - 6}" text-anchor="middle" font-weight="800" fill="${INK}">${oo.fmt ? oo.fmt(v) : f.f1(v)}</text>`;
          s += `<text x="${x + bw * .32}" y="${h - 10}" text-anchor="middle" fill="${INK2}" font-weight="600">${f.esc(c)}</text>`; });
        return '<div class="gf">' + s + '</svg></div>';
      },
      // divide uma lista longa em páginas de n linhas
      paginas: (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out.length ? out : [[]]; },
      // sumário: as partes (capaSec) quando o deck tem; senão, os assuntos (kicker) na ordem em que aparecem
      _paginas: () => {
        let P = S.slice();
        if (o.fundos && o.sumario !== false) {
          const iCapa = P.findIndex(x => x.tipo === 'capa'), ini = iCapa + 1, desl = 1;
          const cont = P.slice(ini), temSec = cont.some(x => x.sec), it = []; let ult = null;
          cont.forEach((x, i) => { if (!x.k || (temSec && !x.sec) || x.k === ult) return; ult = x.k; it.push({ n: ini + i + 1 + desl, t: x.k }); });
          if (it.length > 1) P.splice(ini, 0, { tipo: 'sum', html: `<section class="slide arte">${arte.sumario(o.fundos, { periodo: o.periodo || '', itens: it })}</section>` });
          P.push({ tipo: 'fim', html: `<section class="slide arte">${arte.fim(o.fundos, { texto: o.fim || 'Obrigado!' })}</section>` });
        }
        return P;
      },
      doc: () => docDe({ acc, titulo: o.titulo, paginas: B._paginas().map(x => x.html) }),
      // os slides de conteúdo, um a um, com o bloco e o assunto de cada (para o painel Apresentações)
      lista: () => S.filter(x => x.tipo === 'cont').map(x => ({ bloco: x.bloco ? x.bloco.id : '', blocoTitulo: x.bloco ? x.bloco.titulo : '', k: x.k, html: x.html })),
      n: () => B._paginas().length
    };
    return B;
  }

  // ── PDF: cada slide fotografado (html2canvas) numa página 1280×720 (jsPDF) ──
  const carrega = (src, pronto) => pronto() ? Promise.resolve() : new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('não carregou ' + src)); document.head.appendChild(s); });
  // fotografa cada slide do deck (iframe fora da tela) e entrega a imagem a quem monta o arquivo
  async function fotos(doc, aviso, oque, cada) {
    await carrega('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js', () => typeof window.html2canvas !== 'undefined');
    const ifr = document.createElement('iframe');
    ifr.setAttribute('aria-hidden', 'true');
    ifr.style.cssText = 'position:fixed;left:-20000px;top:0;width:1280px;height:720px;border:0';
    document.body.appendChild(ifr);
    try {
      await new Promise(r => { ifr.onload = r; ifr.srcdoc = doc; });
      const d = ifr.contentDocument;
      try { await d.fonts.ready; } catch (_) {}
      try { if (ifr.contentWindow.__ajusta) ifr.contentWindow.__ajusta(); } catch (_) {}
      await Promise.all([...d.images].map(im => im.complete ? 0 : new Promise(r => { im.onload = im.onerror = r; })));
      // imagens de fundo (capa) também precisam estar carregadas antes da foto
      const bgs = [...d.querySelectorAll('.slide')].map(s => (getComputedStyle(s).backgroundImage.match(/url\("?([^")]+)"?\)/) || [])[1]).filter(Boolean);
      await Promise.all(bgs.map(u => new Promise(r => { const im = new Image(); im.onload = im.onerror = r; im.src = u; })));
      const sl = [...d.querySelectorAll('.slide')];
      for (let i = 0; i < sl.length; i++) {
        if (aviso) aviso(`Montando o ${oque} · slide ${i + 1} de ${sl.length}…`);
        const c = await window.html2canvas(sl[i], { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false, windowWidth: 1280, windowHeight: 720 });
        await cada(c.toDataURL('image/jpeg', .92), i);
      }
      return sl.length;
    } finally { ifr.remove(); }
  }
  async function pdf(doc, nome, aviso) {
    await carrega('https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js', () => !!window.jspdf);
    const pdfDoc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'px', format: [1280, 720], hotfixes: ['px_scaling'], compress: true });
    const n = await fotos(doc, aviso, 'PDF', (img, i) => { if (i) pdfDoc.addPage([1280, 720], 'landscape'); pdfDoc.addImage(img, 'JPEG', 0, 0, 1280, 720); });
    pdfDoc.save(nome);
    return n;
  }
  // PowerPoint: uma página por slide, do tamanho do slide (16:9, 13,333 × 7,5 pol), com a mesma imagem do PDF
  async function pptx(doc, nome, aviso, titulo) {
    await carrega('https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js', () => typeof window.PptxGenJS !== 'undefined');
    const P = new window.PptxGenJS(); P.defineLayout({ name: 'GEM169', width: 13.333, height: 7.5 }); P.layout = 'GEM169';
    P.author = 'Fleet Hub'; P.title = titulo || 'Apresentação';
    const n = await fotos(doc, aviso, 'PowerPoint', img => { P.addSlide().addImage({ data: img, x: 0, y: 0, w: 13.333, h: 7.5 }); });
    await P.writeFile({ fileName: nome });
    return n;
  }

  // botão da lateral: mostra o andamento no rótulo e volta ao normal no fim
  async function botao(btn, fn) {
    if (!btn || btn.dataset.gerando) return;
    const lab = btn.querySelector('.n-txt, .n') || btn;
    const orig = lab.textContent;
    btn.dataset.gerando = '1'; btn.style.opacity = '.7';
    const aviso = t => { lab.textContent = t.length > 40 ? t.slice(0, 38) + '…' : t; };
    try { const r = await fn(aviso); aviso(r && r.slides ? `PDF pronto · ${r.slides} slides` : 'PDF pronto'); }
    catch (e) { console.error(e); alert('Não consegui gerar a apresentação: ' + (e && e.message || e)); }
    finally { setTimeout(() => { lab.textContent = orig; btn.style.opacity = ''; delete btn.dataset.gerando; }, 2500); }
  }

  // ícone do botão (slides) e o HTML do item da lateral
  const ICONE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M12 17v4M8 21h8"/><path d="M7 13l3-3 2 2 4-4"/></svg>';

  window.ApresBase = { ICO, deck, pdf, pptx, botao, f, ICONE, carrega, fundos, arte, docDe, css, FOTO };
})();
