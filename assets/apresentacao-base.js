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

  /* VISÃO EXECUTIVA (Renan, 24/11/2026: "apagado, feio… olhe nossos painéis, meu nível de exigência").
     Fundo cinza claro, cartões brancos com sombra, tabela dentro de cartão (cabeçalho sem fundo, total
     em faixa), a leitura numa faixa escura e a barra laranja no pé. Todo tamanho do miolo é multiplicado
     por --k, que o ajuste do fim do documento escolhe por slide: o maior que cabe (o slide não fica
     vazio nem estoura). */
  const css = acc => `@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:#fff}
body{font-family:'Montserrat',Arial,sans-serif;color:${INK};font-size:16px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.slide{--k:1;--v:1;width:1280px;height:720px;position:relative;overflow:hidden;background:#ECEEF1;padding:44px 64px 62px;display:flex;flex-direction:column;justify-content:flex-start}
.slide>*{flex:0 0 auto}
.slide:not(.arte)::after{content:'';position:absolute;left:0;right:0;bottom:0;height:8px;background:linear-gradient(90deg,#F97316 0%,#F97316 50%,#FDBA4D 86%,#FDE08A 100%)}
.slide.dark{background:radial-gradient(70% 90% at 85% 10%,${acc}29,transparent 60%),#0F1216;color:#F4F5F7;justify-content:center}
.slide.capa{background-size:cover;background-position:center right}
.kicker{font-size:10.5px;font-weight:700;letter-spacing:2.4px;text-transform:uppercase;color:${INK3};margin-bottom:9px;display:flex;align-items:center;gap:10px}
.kicker::before{content:'';width:9px;height:9px;border-radius:3px;background:${acc};flex:0 0 auto}
.slide.dark .kicker{color:#A9B4C0}
h1{font-size:42px;font-weight:800;line-height:1.1;letter-spacing:-.8px}
.slide.dark h1{color:#fff}
h2{font-size:28px;font-weight:800;line-height:1.15;letter-spacing:-.6px;margin-bottom:5px;color:${INK}}
p{font-size:14.5px;line-height:1.55;color:${INK2}}
.slide.dark p{color:#B9C0CA}
.sub{font-size:13.5px;color:${INK2};margin:0;max-width:1010px}
.selo{position:absolute;top:42px;right:64px;display:flex;align-items:center;gap:8px;background:${INK};color:#fff;font-size:10.5px;font-weight:700;letter-spacing:.5px;padding:7px 13px;border-radius:999px;white-space:nowrap}
.selo i{width:7px;height:7px;border-radius:50%;background:${acc}}
.hd{padding-right:230px}
.corpo{flex:1 1 0;min-height:0;display:flex;flex-direction:column;gap:calc(13px*var(--k)*var(--v));margin-top:16px}
.corpo>*{flex:0 0 auto;margin-top:0!important}
.foot{position:absolute;left:64px;right:64px;bottom:24px;display:flex;justify-content:space-between;font-size:10.5px;color:${INK3};letter-spacing:.4px}
.slide.dark .foot{color:#6B7683}
.note{font-size:calc(11px*var(--k));color:${INK2};line-height:1.4}
.tb{background:#fff;border-radius:16px;box-shadow:0 8px 24px rgba(15,26,32,.07);padding:calc(5px*var(--k)) calc(16px*var(--k)) calc(8px*var(--k));min-width:0}
table{--t:1;width:100%;border-collapse:collapse;font-size:calc(13px*var(--k)*var(--t));table-layout:auto}
table.compacta{--t:.94} table.densa{--t:.86}
table th{text-align:left;padding:calc(10px*var(--k)*var(--t)*var(--v)) calc(9px*var(--k)*var(--t)) calc(8px*var(--k)*var(--t)*var(--v));white-space:nowrap;color:${INK3};font-size:calc(9.5px*var(--k)*var(--t));font-weight:700;letter-spacing:.9px;text-transform:uppercase;border-bottom:1.5px solid #CDD3DB}
table td{padding:calc(7px*var(--k)*var(--t)*var(--v)) calc(9px*var(--k)*var(--t));white-space:nowrap;border-bottom:1px solid #EBEEF1;color:${INK};font-weight:500}
table td:first-child{font-weight:700}
table tr:last-child td{border-bottom:0}
td.n,th.n{text-align:right} td.w,th.w{white-space:normal}
td.c,th.c{text-align:center}
tr.sep td{background:#EEF0F3;font-weight:800;border-bottom:0}
tr.sep td:first-child{border-radius:9px 0 0 9px} tr.sep td:last-child{border-radius:0 9px 9px 0}
.cards{display:grid;gap:calc(12px*var(--k))}
.card{background:#fff;border-radius:16px;box-shadow:0 8px 24px rgba(15,26,32,.07);padding:calc(15px*var(--k)*min(var(--v),1.3)) calc(18px*var(--k));min-width:0}
.card .k{font-size:calc(10px*var(--k));font-weight:700;letter-spacing:.9px;text-transform:uppercase;color:${INK3};margin-bottom:calc(6px*var(--k))}
.card .n{font-size:calc(30px*var(--k));font-weight:800;letter-spacing:-.9px;line-height:1.05;color:${INK};white-space:nowrap} .card .n small{font-size:.45em;font-weight:700;letter-spacing:0}
.card p{font-size:calc(11.5px*var(--k));line-height:1.45;color:${INK2};margin-top:calc(6px*var(--k))}
.card.esc{background:${INK};box-shadow:0 10px 26px rgba(15,26,32,.22)} .card.esc .k{color:#93A0AE} .card.esc .n{color:#fff} .card.esc p{color:#B9C2CC}
.conc,.concb{background:${INK};border-radius:16px;padding:calc(14px*var(--k)*min(var(--v),1.4)) calc(20px*var(--k)) calc(15px*var(--k)*min(var(--v),1.4));box-shadow:0 10px 26px rgba(15,26,32,.18)}
.lbl{font-size:calc(10px*var(--k));font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${INK2}}
.conc .lbl,.concb .lbl{color:#93A0AE}
.conc .lbl{margin-bottom:calc(4px*var(--k))} .conc p{font-size:calc(12.5px*var(--k));line-height:1.5;color:#EEF1F5}
.concb .lbl{margin-bottom:calc(8px*var(--k))} .concb .cb{display:grid;gap:calc(10px*var(--k)) calc(22px*var(--k))}
.concb .t{font-size:calc(10px*var(--k));font-weight:700;color:#93A0AE;text-transform:uppercase;letter-spacing:.8px}
.concb .v{font-size:calc(19px*var(--k));font-weight:800;color:#fff;line-height:1.15;margin:calc(3px*var(--k)) 0;letter-spacing:-.3px}
.concb .s{font-size:calc(11.5px*var(--k));line-height:1.42;color:#B9C2CC}
.passos{background:#fff;border-radius:16px;box-shadow:0 8px 24px rgba(15,26,32,.07);padding:calc(8px*var(--k)) calc(12px*var(--k))}
.passo{display:flex;align-items:center;gap:calc(18px*var(--k));padding:calc(11px*var(--k)*var(--v)) calc(14px*var(--k));border-top:1px solid #EBEEF1}
.passo:first-child{border-top:0;background:${INK};border-radius:12px} .passo:first-child+.passo{border-top:0}
.passo .pn{font-size:calc(26px*var(--k));font-weight:800;letter-spacing:-1px;color:#C5CCD5;width:calc(40px*var(--k));flex:0 0 auto}
.passo:first-child .pn{color:${acc}}
.passo .pb{flex:1;min-width:0}
.passo .pt{font-size:calc(10px*var(--k));font-weight:700;letter-spacing:.9px;text-transform:uppercase;color:${INK3}}
.passo .pv{font-size:calc(16px*var(--k));font-weight:800;color:${INK};letter-spacing:-.2px;margin:calc(1px*var(--k)) 0 calc(2px*var(--k))}
.passo .ps{font-size:calc(11.5px*var(--k));color:${INK2};line-height:1.4}
.passo:first-child .pt{color:#93A0AE} .passo:first-child .pv{color:#fff} .passo:first-child .ps{color:#B9C2CC}
.gf{background:#fff;border-radius:16px;box-shadow:0 8px 24px rgba(15,26,32,.07);padding:14px 18px;min-width:0}
.gf svg{display:block;max-width:100%;height:auto;margin:0 auto}
.corpo>.gf{flex:1 1 0;min-height:190px;position:relative}
.corpo>.gf>svg{position:absolute;left:18px;top:14px;width:calc(100% - 36px);height:calc(100% - 28px);max-width:none}
.duas{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:calc(18px*var(--k));align-items:start}
.slide.arte{padding:0;background-color:#0D0E11;background-size:cover;background-position:center;color:#fff;display:block}
.arte .ak{font-size:13px;font-weight:700;letter-spacing:3.2px;text-transform:uppercase;color:${acc}}
.arte .at{font-weight:800;line-height:1.04;letter-spacing:-1.4px;margin-top:14px;color:#fff}
.arte .ab{width:76px;height:5px;border-radius:3px;background:${acc};margin:26px 0 22px}
.arte .as{font-size:22px;font-weight:700;color:#fff;margin-bottom:6px}
.arte .per{font-size:16px;font-weight:500;color:#C9CED6;letter-spacing:.2px}
.arte .si{display:flex;align-items:baseline;gap:22px;padding:8px 0 7px;border-bottom:1px solid rgba(255,255,255,.17);font-size:14.5px;color:#fff;white-space:nowrap;overflow:hidden}
.arte .si b{font-size:18px;font-weight:800;color:${acc};min-width:28px;font-variant-numeric:tabular-nums}
.arte .si span{overflow:hidden;text-overflow:ellipsis}`;

  // ── documento: as páginas na ordem, com o número pela posição ──
  // o ajuste: por slide, o maior --k (letra, de 1,5 a 0,7) em que o miolo cabe na altura e nenhuma tabela ou cartão passa da largura;
  // depois o maior --v (respiro das linhas, de 2,2 a 1) que ainda cabe
  const AJUSTE = `<script>(function(){function aj(){var S=document.querySelectorAll('.slide');for(var i=0;i<S.length;i++){var s=S[i],c=s.querySelector('.corpo');if(!c)continue;var d=s.style.display;s.style.display='';if(!c.clientHeight){s.style.display=d;continue;}
var cabe=function(){if(c.scrollHeight>c.clientHeight+1)return false;var f=c.children;for(var j=0;j<f.length;j++){if(f[j].offsetTop+f[j].offsetHeight>c.offsetTop+c.clientHeight+1)return false;}var t=c.querySelectorAll('.tb,.duas>div,.card .n');for(var j=0;j<t.length;j++){if(t[j].scrollWidth>t[j].clientWidth+1)return false;}return true;};
s.style.setProperty('--v','1');for(var k=150;k>=70;k-=5){s.style.setProperty('--k',(k/100).toFixed(2));if(cabe())break;}
for(var v=22;v>=10;v--){s.style.setProperty('--v',(v/10).toFixed(1));if(cabe())break;}s.style.display=d;}}
window.__ajusta=aj;aj();if(document.fonts&&document.fonts.ready)document.fonts.ready.then(aj);window.addEventListener('load',aj);})();<\/script>`;
  const docDe = ({ acc, titulo, paginas }) => `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${f.esc(titulo || 'Apresentação')}</title><style>${css(acc || '#F97316')}</style></head><body>${paginas.map((h, i) => h.replace(/§PG§/g, String(i + 1))).join('\n')}${AJUSTE}</body></html>`;

  /* ── ARTE: capa, sumário e encerramento (Renan, 23/11/2026, vendo as apresentações do FP&A:
     "gostei da capa e do sumário"). A foto entra em TIRAS com cantos arredondados e filete laranja,
     sobre preto, com a barra laranja no rodapé. Tudo o que é desenho (foto, tiras, marca, barra) é
     pintado num canvas e vira o fundo do slide: o html2canvas só precisa pôr o texto por cima. ── */
  const FOTO = (() => { try { return new URL('img/capa-frota.jpg', document.currentScript.src).href; } catch (e) { return ''; } })();
  // o logo oficial da Conlog (do site da empresa), em branco para fundo escuro
  const LOGO = (() => { try { return new URL('img/logo-conlog-branco.png', document.currentScript.src).href; } catch (e) { return ''; } })();
  const LAR = '#F97316';
  function rr(x, X, Y, W, H, r) { r = Math.min(r, W / 2, H / 2); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r); x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath(); }
  function cobre(x, img, R, fx, fy) {              // a foto cobrindo a região R, com o foco em (fx, fy)
    const e = Math.max(R.w / img.width, R.h / img.height), w = img.width * e, h = img.height * e;
    x.drawImage(img, R.x - (w - R.w) * (fx == null ? .5 : fx), R.y - (h - R.h) * (fy == null ? .5 : fy), w, h);
  }
  // o selo do portal (o quadrado laranja com a linha de tendência do hub) + "Gestão em Movimento"
  // barra laranja do rodapé (capa, sumário e encerramento)
  function barra(x) { const g = x.createLinearGradient(0, 0, 1280, 0); g.addColorStop(0, LAR); g.addColorStop(.5, LAR); g.addColorStop(.86, '#FDBA4D'); g.addColorStop(1, '#FDE08A'); x.fillStyle = g; x.fillRect(0, 709, 1280, 11); }
  function selo(x, X, Y) {
    x.save(); x.fillStyle = LAR; x.beginPath(); rr(x, X, Y, 30, 30, 8); x.fill();
    x.strokeStyle = '#fff'; x.lineWidth = 2.6; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); x.moveTo(X + 7, Y + 21); x.lineTo(X + 13, Y + 14); x.lineTo(X + 18, Y + 18); x.lineTo(X + 24, Y + 9); x.stroke();
    x.fillStyle = '#fff'; x.font = '700 15px Montserrat,Arial,sans-serif'; x.textBaseline = 'middle'; x.fillText('Gestão em Movimento', X + 42, Y + 16); x.restore();
  }
  // a foto escurecida da esquerda para a direita: o texto fica sobre o escuro, a foto aparece do meio em diante
  function veu(x, forte) {
    const g = x.createLinearGradient(0, 0, 1280, 0); g.addColorStop(0, 'rgba(13,14,17,1)'); g.addColorStop(.17, 'rgba(13,14,17,1)'); g.addColorStop(.42, 'rgba(13,14,17,.92)'); g.addColorStop(.66, `rgba(13,14,17,${forte ? .7 : .46})`); g.addColorStop(1, `rgba(13,14,17,${forte ? .46 : .14})`);
    x.fillStyle = g; x.fillRect(0, 0, 1280, 720);
    const v = x.createLinearGradient(0, 470, 0, 720); v.addColorStop(0, 'rgba(13,14,17,0)'); v.addColorStop(1, 'rgba(13,14,17,.78)'); x.fillStyle = v; x.fillRect(0, 470, 1280, 250);
  }
  const _fundos = {};
  /* Capa, sumário e encerramento do portal (Renan, 23/11/2026: "use como inspiração mas não copie exatamente o FP&A";
     "Não é o conlog da empresa" sobre a marca desenhada): foto de página inteira com o véu grafite, texto em
     Montserrat à esquerda, o selo do Gestão em Movimento embaixo. O logo da Conlog é o arquivo oficial do site (assets/img/logo-conlog-branco.png), embaixo à direita. */
  async function fundos(src) {
    src = src || FOTO; if (!src) return null; if (_fundos[src]) return _fundos[src];
    return _fundos[src] = (async () => {
      const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('a foto da capa não carregou')); i.src = src; });
      try { await Promise.all([document.fonts.load('800 60px Montserrat'), document.fonts.load('700 15px Montserrat')]); } catch (e) {}
      const logo = LOGO ? await new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = LOGO; }) : null;
      const marca = (x, dir) => { if (!logo) return; const h = 30, w = logo.width * h / logo.height; x.drawImage(logo, dir - w, 636, w, h); };   // encostada à direita, na linha do selo
      const K = 2, tela = () => { const c = document.createElement('canvas'); c.width = 1280 * K; c.height = 720 * K; const x = c.getContext('2d'); x.scale(K, K); x.fillStyle = '#0D0E11'; x.fillRect(0, 0, 1280, 720); return [c, x]; };
      const sai = c => c.toDataURL('image/jpeg', .9), T = { x: 0, y: 0, w: 1280, h: 720 };
      // foto deitada (a do cavalo de Piraí): entra 200 px à direita, para a cabine ficar fora do texto (o véu é opaco nesse trecho); foto em pé cobre a página
      const deitada = img.width / img.height > 1.4, poe = x => { if (deitada) { const w = img.width * 720 / img.height; x.drawImage(img, 200, 0, w, 720); } else cobre(x, img, T, .5, .42); };
      // capa: a foto inteira, o texto à esquerda sobre o véu
      let [c1, x] = tela(); poe(x); veu(x); selo(x, 84, 636); marca(x, 1196); barra(x);
      // sumário: grafite, a foto num painel só, de cantos arredondados, à direita
      let [c2, x2] = tela();
      x2.save(); x2.beginPath(); rr(x2, 884, 48, 348, 624, 26); x2.clip(); cobre(x2, img, { x: 884, y: 48, w: 348, h: 624 }, deitada ? .25 : .5, .42);
      const g2 = x2.createLinearGradient(0, 380, 0, 672); g2.addColorStop(0, 'rgba(13,14,17,0)'); g2.addColorStop(1, 'rgba(13,14,17,.7)'); x2.fillStyle = g2; x2.fillRect(884, 380, 348, 292); x2.restore();
      selo(x2, 84, 636); marca(x2, 836); barra(x2);
      // encerramento: a mesma foto, mais escura
      let [c3, x3] = tela(); poe(x3); veu(x3, true); selo(x3, 84, 636); marca(x3, 1196); barra(x3);
      return { capa: sai(c1), sum: sai(c2), fim: sai(c3) };
    })().catch(e => { console.warn('Arte da apresentação indisponível:', e); delete _fundos[src]; return null; });
  }
  const arte = {
    capa: (F, { titulo, sub, periodo }) => { const n = String(titulo || '').length;
      return `<div style="position:absolute;inset:0;background:url('${F.capa}') center/cover"></div>
      <div style="position:absolute;left:84px;top:0;bottom:60px;width:640px;display:flex;flex-direction:column;justify-content:center">
        <div class="ak">Gestão em Movimento</div>
        <div class="at" style="font-size:${n > 34 ? 42 : n > 22 ? 52 : 64}px">${f.esc(titulo || '')}</div>
        <div class="ab"></div>
        ${sub ? `<div class="as">${f.esc(sub)}</div>` : ''}
        <div class="per">${f.esc(periodo || '')}</div>
      </div>`; },
    sumario: (F, { periodo, itens }) => { const nc = itens.length > 20 ? 3 : 2, por = Math.ceil(itens.length / nc), lw = nc === 3 ? 228 : 350, gap = nc === 3 ? 22 : 40;
      const col = i => itens.slice(i * por, (i + 1) * por).map(it => `<div class="si"><b>${String(it.n).padStart(2, '0')}</b><span>${f.esc(it.t)}</span></div>`).join('');
      return `<div style="position:absolute;inset:0;background:url('${F.sum}') center/cover"></div>
      <div class="ak" style="position:absolute;left:84px;top:74px">Nesta apresentação</div>
      <div class="at" style="position:absolute;left:84px;top:98px;font-size:46px">Sumário</div>
      <div class="per" style="position:absolute;left:84px;top:164px;margin:0">${f.esc(periodo || '')}</div>
      <div style="position:absolute;left:84px;top:${por > 10 ? 206 : 222}px;display:flex;gap:${gap}px;${nc === 3 || por > 10 ? 'font-size:13px' : ''}">${Array.from({ length: nc }, (_, i) => `<div style="width:${lw}px">${col(i)}</div>`).join('')}</div>`; },
    fim: (F, { texto, sub }) => `<div style="position:absolute;inset:0;background:url('${F.fim}') center/cover"></div>
      <div style="position:absolute;left:84px;top:0;bottom:60px;width:760px;display:flex;flex-direction:column;justify-content:center">
        <div class="at" style="font-size:96px;letter-spacing:-2.5px">${f.esc(texto || 'Obrigado!')}</div>
        <div class="ab"></div>
        ${sub ? `<div class="per" style="font-size:18px">${f.esc(sub)}</div>` : ''}
      </div>`
  };

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
      slide: (inner, so) => { S.push({ k: _k, sec: _sec, bloco: _bloco, tipo: (so && so.tipo) || 'cont',
        html: `<section class="slide${so && so.top ? ' top' : ''}${so && so.dark ? ' dark' : ''}${so && so.capa ? ' capa' : ''}${so && so.arte ? ' arte' : ''}"${so && so.style ? ` style="${so.style}"` : ''}>${miolo(inner)}${o.selo && !(so && (so.arte || so.dark)) ? `<div class="selo"><i></i>${o.selo}</div>` : ''}${so && so.arte ? '' : foot()}</section>` }); _k = ''; _sec = false; },
      head: (k, h, sub) => { _k = limpa(k); return `<div class="hd"><div class="kicker">${k}</div><h2>${h}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}</div>§C§`; },
      // lista numerada (prioridades, próximos passos): a 1ª em destaque
      passos: itens => `<div class="passos">${itens.map((p, i) => `<div class="passo"><div class="pn">${String(i + 1).padStart(2, '0')}</div><div class="pb"><div class="pt">${p.t}</div><div class="pv">${p.v || ''}</div><div class="ps">${p.s || ''}</div></div></div>`).join('')}</div>`,
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
      capaSec: (num, h1, texto) => { _k = limpa(h1); _sec = true; B.slide(`<div><div class="kicker">Parte ${num}</div><h1 style="max-width:900px">${h1}</h1>${texto ? `<p style="margin-top:18px;font-size:16px;max-width:820px">${texto}</p>` : ''}</div>`, { dark: true }); },
      // barras horizontais simples (rótulo · barra · valor), cor por item
      barrasH: (itens, oo) => {
        oo = oo || {}; const w = oo.w || 560, lh = oo.lh || 26, lw = oo.lw || 150, mx = oo.max || Math.max(...itens.map(i => Math.abs(i.v || 0)), 1), bw = w - lw - 70;
        let s = `<svg viewBox="0 0 ${w} ${itens.length * lh + 6}" width="${w}" height="${itens.length * lh + 6}" font-family="Montserrat,Arial" font-size="11.5">`;
        itens.forEach((it, i) => { const y = 3 + i * lh, ww = Math.max(1.5, bw * Math.abs(it.v || 0) / mx);
          s += `<text x="${lw - 10}" y="${y + lh / 2 + 4}" text-anchor="end" fill="${INK}" font-weight="600">${f.esc(it.rot)}</text>`;
          s += `<rect x="${lw}" y="${y + 5}" width="${ww}" height="${lh - 10}" rx="3" fill="${it.cor || acc}" fill-opacity=".85"/>`;
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
          if (ok(v)) s += `<rect x="${x}" y="${Math.min(Y(v), y0)}" width="${bw * .64}" height="${Math.max(1, Math.abs(y0 - Y(v)))}" rx="3" fill="${(oo.cor && oo.cor(v, i)) || acc}" fill-opacity=".85"/><text x="${x + bw * .32}" y="${v < 0 ? Y(v) + 14 : Y(v) - 6}" text-anchor="middle" font-weight="800" fill="${INK}">${oo.fmt ? oo.fmt(v) : f.f1(v)}</text>`;
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
    P.author = 'Gestão em Movimento'; P.title = titulo || 'Apresentação';
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

  window.ApresBase = { deck, pdf, pptx, botao, f, ICONE, carrega, fundos, arte, docDe, css, FOTO };
})();
