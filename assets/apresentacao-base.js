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

  const css = acc => `@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:#fff}
body{font-family:'Montserrat',Arial,sans-serif;color:${INK};font-size:16px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.slide{width:1280px;height:720px;position:relative;overflow:hidden;background:#fff;padding:56px 72px 60px;display:flex;flex-direction:column;justify-content:center}
.slide>*{flex:0 0 auto}
.slide.top{justify-content:flex-start}
.slide.dark{background:radial-gradient(70% 90% at 85% 10%,${acc}29,transparent 60%),#0F1216;color:#F4F5F7}
.slide.capa{background-size:cover;background-position:center right}
.kicker{font-size:11px;font-weight:700;letter-spacing:2.2px;text-transform:uppercase;color:${acc};margin-bottom:10px}
h1{font-size:42px;font-weight:800;line-height:1.1;letter-spacing:-.8px}
.slide.dark h1{color:#fff}
h2{font-size:27px;font-weight:800;line-height:1.15;letter-spacing:-.5px;margin-bottom:6px}
p{font-size:14.5px;line-height:1.55;color:${INK2}}
.slide.dark p{color:#B9C0CA}
.sub{font-size:14px;color:${INK2};margin:0 0 6px}
.foot{position:absolute;left:72px;right:72px;bottom:26px;display:flex;justify-content:space-between;font-size:10.5px;color:${INK3};letter-spacing:.4px}
.slide.dark .foot{color:#6B7683}
.note{font-size:11px;color:${INK3};line-height:1.4;margin-top:8px}
table{width:100%;border-collapse:collapse;font-size:12.5px;table-layout:auto}
table th{text-align:left;padding:7px 9px;white-space:nowrap;background:#E4E7EC;color:${INK};font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase}
table th:first-child{border-radius:8px 0 0 8px} table th:last-child{border-radius:0 8px 8px 0}
table td{padding:6px 9px;white-space:nowrap;border-bottom:1px solid #D9DDE3;color:${INK};font-weight:500}
table.compacta{font-size:11.5px} table.compacta th{padding:6px 7px} table.compacta td{padding:5px 7px}
table.densa{font-size:10.5px} table.densa th{padding:5px 6px;font-size:9px;letter-spacing:.3px} table.densa td{padding:4px 6px}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums} td.w,th.w{white-space:normal}
td.c,th.c{text-align:center}
tr.sep td{border-top:2px solid ${INK3};font-weight:700}
.cards{display:grid;gap:12px;margin-top:10px} .card{background:${PALE};border-radius:14px;padding:16px 18px;min-width:0}
.card .k{font-size:10.5px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:${INK3};margin-bottom:6px}
.card .n{font-size:30px;font-weight:800;letter-spacing:-.8px;line-height:1.05;color:${INK};white-space:nowrap} .card .n.acc{color:${acc}} .card .n small{font-size:13px;font-weight:700;letter-spacing:0}
.card p{font-size:12px;line-height:1.45;color:${INK2};margin-top:7px}
.conc,.concb{margin-top:12px;background:${PALE};border-radius:12px;padding:12px 18px 13px}
.lbl{font-size:10.5px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:${acc}}
.conc .lbl{margin-bottom:3px} .conc p{font-size:12.5px;line-height:1.48;color:${INK}}
.concb .lbl{margin-bottom:6px} .concb .cb{display:grid;gap:8px 18px}
.concb .t{font-size:11.5px;font-weight:800;color:${INK};text-transform:uppercase;letter-spacing:.4px}
.concb .v{font-size:19px;font-weight:800;color:${acc};line-height:1.15;margin:2px 0}
.concb .s{font-size:11.5px;line-height:1.42;color:${INK2}}
.duas{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:24px;align-items:start}`;

  // ── construtor de slides ──
  function deck(o) {
    o = o || {};
    const acc = o.acc || '#F97316';
    let N = 1; const S = [];
    const foot = () => `<div class="foot"><span>${o.rodape || ''}</span><span>${N++}</span></div>`;
    const B = {
      acc,
      slide: (inner, so) => { S.push(`<section class="slide${so && so.top ? ' top' : ''}${so && so.dark ? ' dark' : ''}${so && so.capa ? ' capa' : ''}"${so && so.style ? ` style="${so.style}"` : ''}>${inner}${foot()}</section>`); },
      head: (k, h, sub) => `<div class="kicker">${k}</div><h2>${h}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}`,
      conc: (txt, rot) => `<div class="conc"><div class="lbl">${rot || 'Leitura'}</div><p>${txt}</p></div>`,
      concBlocos: (itens, rot, cols) => `<div class="concb"><div class="lbl">${rot}</div><div class="cb" style="grid-template-columns:repeat(${cols || itens.length},minmax(0,1fr))">${itens.map(b => `<div><div class="t">${b.t}</div>${b.v ? `<div class="v">${b.v}</div>` : ''}<div class="s">${b.s || ''}</div></div>`).join('')}</div></div>`,
      cards: (itens, cols) => `<div class="cards" style="grid-template-columns:repeat(${cols || itens.length},minmax(0,1fr))">${itens.map(c => `<div class="card"><div class="k">${c.k}</div><div class="n${c.acc ? ' acc' : ''}"${c.cor ? ` style="color:${c.cor}"` : ''}>${c.n}</div>${c.p ? `<p>${c.p}</p>` : ''}</div>`).join('')}</div>`,
      tabela: ({ cols, rows, classe, style }) => {
        const th = cols.map(c => `<th class="${c.n ? 'n' : ''}${c.c ? ' c' : ''}${c.w ? ' w' : ''}"${c.style ? ` style="${c.style}"` : ''}>${c.t}</th>`).join('');
        const tr = r => `<tr${r.cls ? ` class="${r.cls}"` : ''}>${(r.c || r).map((v, i) => { const c = cols[i] || {}; const x = v !== null && typeof v === 'object' && !Array.isArray(v) ? v : { v }; return `<td class="${c.n ? 'n' : ''}${c.c ? ' c' : ''}${c.w ? ' w' : ''}"${x.style ? ` style="${x.style}"` : ''}>${x.v == null ? '—' : x.v}</td>`; }).join('')}</tr>`;
        return `<table class="${classe || 'compacta'}" style="${style || ''}"><tr>${th}</tr>${rows.map(tr).join('')}</table>`;
      },
      // capa: foto da CONLOG à direita, escurecida para o título ficar legível
      capa: ({ kicker, h1, texto }) => B.slide(`<div style="max-width:720px"><div class="kicker">${kicker || ''}</div><h1 style="font-size:50px">${h1}</h1>${texto ? `<p style="margin-top:22px;font-size:17px;max-width:620px">${texto}</p>` : ''}</div>`,
        { dark: true, capa: !!o.img, style: o.img ? `background:linear-gradient(90deg,#0F1216 0%,rgba(15,18,22,.94) 42%,rgba(15,18,22,.55) 75%,rgba(15,18,22,.35) 100%),url('${o.img}') center right/cover` : '' }),
      capaSec: (num, h1, texto) => B.slide(`<div><div class="kicker">Parte ${num}</div><h1 style="max-width:900px">${h1}</h1>${texto ? `<p style="margin-top:18px;font-size:16px;max-width:820px">${texto}</p>` : ''}</div>`, { dark: true }),
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
        return s + '</svg>';
      },
      // divide uma lista longa em páginas de n linhas
      paginas: (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out.length ? out : [[]]; },
      doc: () => `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${f.esc(o.titulo || 'Apresentação')}</title><style>${css(acc)}</style></head><body>${S.join('\n')}</body></html>`,
      n: () => S.length
    };
    return B;
  }

  // ── PDF: cada slide fotografado (html2canvas) numa página 1280×720 (jsPDF) ──
  const carrega = (src, pronto) => pronto() ? Promise.resolve() : new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('não carregou ' + src)); document.head.appendChild(s); });
  async function pdf(doc, nome, aviso) {
    await carrega('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js', () => typeof window.html2canvas !== 'undefined');
    await carrega('https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js', () => !!window.jspdf);
    const ifr = document.createElement('iframe');
    ifr.setAttribute('aria-hidden', 'true');
    ifr.style.cssText = 'position:fixed;left:-20000px;top:0;width:1280px;height:720px;border:0';
    document.body.appendChild(ifr);
    try {
      await new Promise(r => { ifr.onload = r; ifr.srcdoc = doc; });
      const d = ifr.contentDocument;
      try { await d.fonts.ready; } catch (_) {}
      await Promise.all([...d.images].map(im => im.complete ? 0 : new Promise(r => { im.onload = im.onerror = r; })));
      // imagens de fundo (capa) também precisam estar carregadas antes da foto
      const bgs = [...d.querySelectorAll('.slide')].map(s => (getComputedStyle(s).backgroundImage.match(/url\("?([^")]+)"?\)/) || [])[1]).filter(Boolean);
      await Promise.all(bgs.map(u => new Promise(r => { const im = new Image(); im.onload = im.onerror = r; im.src = u; })));
      const sl = [...d.querySelectorAll('.slide')];
      const pdfDoc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'px', format: [1280, 720], hotfixes: ['px_scaling'], compress: true });
      for (let i = 0; i < sl.length; i++) {
        if (aviso) aviso(`Montando o PDF · slide ${i + 1} de ${sl.length}…`);
        const c = await window.html2canvas(sl[i], { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false, windowWidth: 1280, windowHeight: 720 });
        if (i) pdfDoc.addPage([1280, 720], 'landscape');
        pdfDoc.addImage(c.toDataURL('image/jpeg', .92), 'JPEG', 0, 0, 1280, 720);
      }
      pdfDoc.save(nome);
      return sl.length;
    } finally { ifr.remove(); }
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

  window.ApresBase = { deck, pdf, botao, f, ICONE, carrega };
})();
