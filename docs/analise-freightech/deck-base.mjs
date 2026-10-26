// ============================================================
// Peças comuns dos decks do Freightech (Manual, Treinamento, Análise 2026,
// Histórico). Layout do DriverPro (../driverpro-apresentacao/base.css) com a
// régua visual fechada com o Renan em 26/10/2026 (CONTEXTO.md, seção 6b):
//  · fórmula escrita como fórmula, em texto, sem caixa (formula / frac);
//  · cartões de etapa com o número grande (cartoes), o único "box" aceito;
//  · capa de seção no desenho escuro da capa (capaSec);
//  · conclusão em blocos, um por achado (concBlocos); parágrafo só quando é uma frase (conc);
//  · rodapé didático em todo slide do Manual (didat);
//  · tabela sem quebra de linha, largura pelo conteúdo, unidade no cabeçalho (tabela);
//  · origem dos campos em português, com o nome técnico em cinza (origem).
// ============================================================
import { readFileSync, writeFileSync } from 'node:fs';
export const CSS = readFileSync(new URL('../driverpro-apresentacao/base.css', import.meta.url), 'utf8');
export const ACC = '#F22C05', AZUL = '#1F6FEB', VERDE = '#1E8E5A', AMB = '#C98A00', INK = '#0F1A20', INK2 = '#4A5563', INK3 = '#8A94A2', LINE = '#E3E6EA', PALE = '#F3F4F6', CINZA = '#B9C0CA';
export const f0 = v => v == null || !isFinite(v) ? '—' : Math.round(v).toLocaleString('pt-BR');
export const f1 = v => v == null || !isFinite(v) ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const f2 = v => v == null || !isFinite(v) ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const f3 = v => v == null || !isFinite(v) ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
export const mi = v => (v / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' mi';
export const mil = v => Math.round(v / 1e3).toLocaleString('pt-BR') + ' mil';
export const rs = v => Math.abs(v) >= 1e6 ? 'R$ ' + mi(v) : 'R$ ' + mil(v);
export const rs2 = v => 'R$ ' + f2(v);
export const rk = v => 'R$ ' + f2(v) + '/km';
export const pct = (v, d = 1) => { if (v == null || !isFinite(v)) return '—'; const z = Math.abs(v) < 0.5 / 10 ** d; return (z ? '' : v > 0 ? '+' : '') + (z ? 0 : v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%'; };
export const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const mv = v => MES[+v.slice(5, 7) - 1] + '/' + v.slice(2, 4);
export const NOME = { BLC: 'Camboriú', CBA: 'Cuiabá', FLP: 'Florianópolis', GRL: 'Guarulhos', NFR: 'Nova Friburgo', PLT: 'Pelotas', CGR: 'Rio de Janeiro', RON: 'Rondonópolis', MCC: 'Macacu', PIR: 'Piraí', GNA: 'Goiânia' };
export const lista = a => a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' e ' + a[a.length - 1];
export const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function deck({ rodape, marca, titulo }) {
  let N = 1; const S = [];
  const LOGO = `<div class="logo" style="margin-bottom:38px"><div class="ic"><svg viewBox="0 0 48 48" fill="none"><path d="M10 32h28M14 32V20h12l6 6v6" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="18" cy="33" r="3" fill="#fff"/><circle cx="31" cy="33" r="3" fill="#fff"/></svg></div><div class="nm">${marca}</div></div>`;
  const foot = () => `<div class="foot"><span>${rodape}</span><span>${N++}</span></div>`;
  return {
    LOGO,
    // slide comum: kicker + título + conteúdo; `top` = conteúdo encostado no topo (padrão) em vez de centrado
    slide: (inner, { top = false } = {}) => S.push(`<section class="slide${top ? ' top' : ''}">${inner}${foot()}</section>`),
    capa: (kicker, h1, texto) => S.push(`<section class="slide dark">${LOGO}<div class="kicker">${kicker}</div><h1 style="max-width:1020px">${h1}</h1><p style="margin-top:26px;font-size:16.5px;max-width:860px">${texto}</p>${foot()}</section>`),
    // capa de seção: mesmo desenho escuro, número da parte + título grande + uma frase
    capaSec: (num, h1, texto) => S.push(`<section class="slide dark">${LOGO}<div class="kicker">Parte ${num}</div><h1 style="max-width:1020px">${h1}</h1>${texto ? `<p style="margin-top:22px;font-size:16.5px;max-width:860px">${texto}</p>` : ''}${foot()}</section>`),
    conc: (txt, rot = 'Conclusão') => `<div class="conc"><div class="lbl">${rot}</div><p>${txt}</p></div>`,
    // conclusão em blocos: [{t: rótulo, v: número em destaque (opcional), s: uma ou duas linhas}]
    concBlocos: (itens, rot = 'Conclusão', cols = itens.length) => `<div class="concb"><div class="lbl">${rot}</div><div class="cb" style="grid-template-columns:repeat(${cols},minmax(0,1fr))">${itens.map(b => `<div><div class="t">${b.t}</div>${b.v ? `<div class="v">${b.v}</div>` : ''}<div class="s">${b.s || ''}</div></div>`).join('')}</div></div>`,
    // rodapé didático do Manual: como o custo é composto, em 2 ou 3 frases
    didat: (txt, rot = 'Como é composto') => `<div class="didat"><div class="lbl">${rot}</div><p>${txt}</p></div>`,
    escuro: txt => `<div class="box res" style="background:${INK}"><p style="color:#F4F5F7">${txt}</p></div>`,
    write: out => {
      writeFileSync(out, `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${titulo}</title>
<style>${CSS}
  .slide.top{justify-content:flex-start}
  .kicker{font-size:11px;margin-bottom:10px} h1{font-size:42px} h2{font-size:27px;margin-bottom:6px} h3{font-size:15px} p{font-size:14.5px}
  .sub{font-size:14px;color:${INK2};margin:0 0 6px}
  .box{padding:18px 20px;border-radius:14px} .box h3{font-size:14.5px} .box p{font-size:12.5px;line-height:1.5} .num{font-size:32px;letter-spacing:-.8px} .num small{font-size:14px} .lbl{font-size:10.5px}
  .step{margin-bottom:12px;flex-direction:column;gap:0} .step b{font-size:14px} .step span{font-size:12.5px} .step span b{display:inline;font-size:inherit;margin:0;color:var(--ink)}
  .note{font-size:11px;color:${INK3};line-height:1.4;margin-top:8px} .foot{font-size:10.5px}
  table{font-size:12.5px;table-layout:auto} table th{padding:7px 9px;white-space:nowrap} table td{padding:6px 9px;white-space:nowrap}
  table.compacta{font-size:11.5px} table.compacta th{padding:6px 7px} table.compacta td{padding:5px 7px}
  table.mini{font-size:9.5px} table.mini th{padding:4px 3px;font-size:8.5px;letter-spacing:.2px} table.mini td{padding:3px 3px}
  table th{background:#E4E7EC;color:${INK};border-bottom:0;font-size:10px;font-weight:700;letter-spacing:.6px}
  table th:first-child{border-radius:8px 0 0 8px} table th:last-child{border-radius:0 8px 8px 0}
  table td{border-bottom:1px solid #D9DDE3;color:${INK};font-weight:500} td.n,th.n{text-align:right;font-variant-numeric:tabular-nums} td.w,th.w{white-space:normal}
  tr.tot td{font-weight:800;border-top:2px solid ${INK};border-bottom:0} tr.sep td{border-top:2px solid ${INK3}}
  td.fr,th.fr{background:rgba(242,44,5,.06)} tr.fr td{background:rgba(242,44,5,.06)} td.neutro{color:${INK3}}
  .conc{margin-top:12px;border-left:4px solid ${ACC};background:${PALE};border-radius:0 10px 10px 0;padding:10px 18px}
  .conc .lbl{color:${ACC};margin-bottom:3px} .conc p{font-size:12.5px;line-height:1.48;color:${INK}} .conc p b{color:${INK}}
  .concb{margin-top:12px;border-left:4px solid ${ACC};background:${PALE};border-radius:0 10px 10px 0;padding:10px 18px 12px}
  .concb .lbl{color:${ACC};margin-bottom:6px} .concb .cb{display:grid;gap:8px 18px} .concb .t{font-size:11.5px;font-weight:800;color:${INK};text-transform:uppercase;letter-spacing:.4px} .concb .v{font-size:19px;font-weight:800;color:${ACC};line-height:1.15;margin:2px 0} .concb .s{font-size:11.5px;line-height:1.42;color:${INK2}}
  .didat{margin-top:16px;padding-top:10px;border-top:1px solid ${LINE}} .didat .lbl{color:${ACC};margin-bottom:3px} .didat p{font-size:12.5px;line-height:1.5;color:${INK}} .didat p b{color:${INK}}
  .slide .box.res{padding:12px 18px} .slide .box.res p{font-size:12.5px;line-height:1.45}
  .tag{display:inline-block;font-size:10px;font-weight:700;letter-spacing:.6px;padding:3px 9px;border-radius:999px;text-transform:uppercase}
  .tag.alta{background:#E5F4EC;color:${VERDE}} .tag.media{background:#FBF1D9;color:${AMB}} .tag.baixa{background:#F1F2F4;color:${INK2}} .tag.erro{background:rgba(242,44,5,.1);color:${ACC}}
  /* fórmula como fórmula: texto, sem caixa */
  .fx{font-family:Montserrat,Arial;font-size:19px;font-weight:600;color:${INK};line-height:1.35;display:flex;align-items:center;flex-wrap:wrap;gap:6px 10px;margin:14px 0 4px}
  .fx .op{color:${ACC};font-weight:800;padding:0 2px} .fx .eq{color:${ACC};font-weight:800;padding:0 6px} .fx .res{font-weight:800;color:${INK}}
  .fx .fr{display:inline-flex;flex-direction:column;align-items:center;vertical-align:middle} .fx .fr .nu{padding:0 6px 3px;border-bottom:2px solid ${INK}} .fx .fr .de{padding:3px 6px 0}
  .fx small{font-size:12px;font-weight:500;color:${INK2}} .fx.ex{font-size:15px;font-weight:500;color:${INK2};margin:0 0 2px} .fx.ex .res{color:${ACC}} .fx.ex .fr .nu{border-bottom-color:${INK3}}
  .fx .lab{font-size:10.5px;font-weight:700;color:${INK3};text-transform:uppercase;letter-spacing:.5px;width:112px;flex:0 0 112px}
  /* cartões de etapa (aprovados: número em cima, explicação embaixo) */
  .cards{display:grid;gap:12px;margin-top:10px} .card{background:${PALE};border-radius:14px;padding:16px 18px;min-width:0}
  .card .k{font-size:10.5px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:${INK3};margin-bottom:6px}
  .card .n{font-size:30px;font-weight:800;letter-spacing:-.8px;line-height:1.05;color:${INK};white-space:nowrap} .card .n.txt{font-size:21px;white-space:normal;letter-spacing:-.3px;line-height:1.15} .card .n.acc{color:${ACC}} .card .n small{font-size:13px;font-weight:700;letter-spacing:0}
  .card p{font-size:12px;line-height:1.45;color:${INK2};margin-top:7px} .card p b{color:${INK}} .card .o{font-size:10.5px;color:${INK3};margin-top:7px;line-height:1.35}
  .card.dark{background:${INK}} .card.dark .k{color:${CINZA}} .card.dark .n{color:#fff} .card.dark p{color:#D5DAE1} .card.dark p b{color:#fff}
  .origem td.tec{font-size:10px;color:${INK3};font-family:Menlo,Consolas,monospace} .origem td:nth-child(2){white-space:normal;line-height:1.3}
  .livro{display:grid;grid-template-columns:auto 1fr auto;gap:0 14px;font-size:14px;align-items:baseline;max-width:560px}
  .livro .o{color:${ACC};font-weight:800;width:16px} .livro .l{color:${INK2}} .livro .v{text-align:right;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
  .livro .t{border-top:2px solid ${INK};padding-top:6px;margin-top:4px} .livro .t.v{font-size:18px;font-weight:800;color:${ACC}}
  .vs{display:grid;grid-template-columns:1fr 1fr;gap:26px} .filete{border-top:1px solid ${LINE};margin:10px 0}
  .duas{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:24px;align-items:start}
</style></head><body>${S.join('\n')}</body></html>`);
      return S.length;
    },
  };
}

// ── fórmula ──
// fx(partes) — partes são strings (texto), {op:'×'} / {eq} operadores, {fr:[n, d]} fração, {res:'…'} resultado.
export const frac = (n, d) => `<span class="fr"><span class="nu">${n}</span><span class="de">${d}</span></span>`;
export function fx(partes, { ex = false, lab = '' } = {}) {
  const s = partes.map(p => typeof p === 'string' ? `<span>${p}</span>` : p.op ? `<span class="op">${p.op}</span>` : p.eq != null ? `<span class="eq">=</span><span class="res">${p.eq}</span>` : p.fr ? frac(p.fr[0], p.fr[1]) : '').join('');
  return `<div class="fx${ex ? ' ex' : ''}">${lab ? `<span class="lab">${lab}</span>` : ''}${s}</div>`;
}
// par fórmula geral + exemplo numérico, um embaixo do outro
export const formula = (geral, exemplo) => fx(geral, { lab: 'Fórmula' }) + (exemplo ? fx(exemplo, { ex: true, lab: 'No exemplo' }) : '');
// livro-razão: linhas [{l, v}] e o total {l, v}; operador na margem
export const livro = (linhas, total) => `<div class="livro">${linhas.map((x, i) => `<div class="o">${i ? (x.o || '+') : ''}</div><div class="l">${x.l}</div><div class="v">${x.v}</div>`).join('')}<div class="o t"></div><div class="l t"><b>${total.l}</b></div><div class="v t">${total.v}</div></div>`;

// ── cartões de etapa ──
// cartoes([{k, n, p, o, acc, dark}], cols)
export const cartoes = (itens, cols = itens.length) => `<div class="cards" style="grid-template-columns:repeat(${cols},minmax(0,1fr))">${itens.map(c => `<div class="card${c.dark ? ' dark' : ''}">${c.k ? `<div class="k">${c.k}</div>` : ''}<div class="n${c.acc ? ' acc' : ''}${/[a-záéíóúç]/i.test(String(c.n).replace(/<[^>]+>/g, '').replace(/R\$|km|mil|mi|\/h|HL|\/L|ao mês|por mês/g, '')) || String(c.n).replace(/<[^>]+>/g, '').length > 14 ? ' txt' : ''}">${c.n}</div>${c.p ? `<p>${c.p}</p>` : ''}${c.o ? `<div class="o">${c.o}</div>` : ''}</div>`).join('')}</div>`;

// ── tabela sem quebra ──
// tabela({cols:[{t, n:true, w:true}], rows:[[...]], classe:'compacta', tot:[...]})
export function tabela({ cols, rows, classe = 'compacta', tot, style = '' }) {
  const th = cols.map(c => `<th class="${c.n ? 'n' : ''}${c.w ? ' w' : ''}">${c.t}</th>`).join('');
  const tr = r => `<tr${r.cls ? ` class="${r.cls}"` : ''}>${(r.c || r).map((v, i) => { const c = cols[i] || {}; const o = typeof v === 'object' && v !== null && !Array.isArray(v) ? v : { v }; return `<td class="${c.n ? 'n' : ''}${c.w ? ' w' : ''}${o.cls ? ' ' + o.cls : ''}"${o.style ? ` style="${o.style}"` : ''}>${o.v}</td>`; }).join('')}</tr>`;
  return `<table class="${classe}" style="${style}"><tr>${th}</tr>${rows.map(tr).join('')}${tot ? tr({ c: tot, cls: 'tot' }) : ''}</table>`;
}
// origem dos campos: [{c: nome em português, tec: nome técnico, o: o que é, v: no exemplo}], relatório no título
export const origem = (rel, linhas) => `<table class="compacta origem" style="margin-top:12px"><tr><th>Campo · ${rel}</th><th>O que é</th><th class="n">No exemplo</th></tr>${linhas.map(l => `<tr><td><b>${l.c}</b>${l.tec ? ` <span class="tec" style="font-size:10px;color:${INK3};font-family:Menlo,Consolas,monospace">${l.tec}</span>` : ''}</td><td>${l.o}</td><td class="n">${l.v ?? '—'}</td></tr>`).join('')}</table>`;

// ── gráficos em SVG ──
export function bars({ w = 560, h = 240, labels, data, cor = INK, fmt = f0, pad = { l: 16, r: 16, t: 24, b: 32 }, fs = 10 }) {
  const max = Math.max(...data.map(Math.abs), 1) * 1.14, bw = (w - pad.l - pad.r) / data.length, Y = v => pad.t + (h - pad.t - pad.b) * (1 - v / max);
  let s = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="Montserrat,Arial" font-size="${fs}">`;
  data.forEach((v, i) => { const x = pad.l + bw * i + bw * .14; s += `<rect x="${x}" y="${Y(Math.max(v, 0))}" width="${bw * .72}" height="${Math.max(h - pad.b - Y(Math.max(v, 0)), 0)}" rx="2" fill="${typeof cor === 'function' ? cor(i) : cor}"/><text x="${x + bw * .36}" y="${Y(Math.max(v, 0)) - 5}" text-anchor="middle" font-weight="700" fill="${INK}">${fmt(v)}</text><text x="${x + bw * .36}" y="${h - 12}" text-anchor="middle" fill="${INK2}">${labels[i]}</text>`; });
  return s + '</svg>';
}
// barras empilhadas por categoria: series [{k, cor, rot}], linhas [{rot, k1, k2…}]
export function stacked({ w = 1136, h = 240, linhas, series, fmt = f0, pad = { l: 16, r: 16, t: 40, b: 32 } }) {
  const tot = l => series.reduce((s, x) => s + Math.max(l[x.k] || 0, 0), 0), max = Math.max(...linhas.map(tot), 1) * 1.12;
  const bw = (w - pad.l - pad.r) / linhas.length, H = h - pad.t - pad.b;
  let s = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="Montserrat,Arial" font-size="10">`;
  series.forEach((se, k) => { s += `<rect x="${pad.l + k * 150}" y="6" width="10" height="10" rx="2" fill="${se.cor}"/><text x="${pad.l + k * 150 + 14}" y="15" fill="${INK2}">${se.rot}</text>`; });
  linhas.forEach((l, i) => { let acc = 0; const x = pad.l + bw * i + bw * .16; series.forEach(se => { const v = Math.max(l[se.k] || 0, 0), hh = H * v / max; s += `<rect x="${x}" y="${pad.t + H - acc - hh}" width="${bw * .68}" height="${hh}" fill="${se.cor}"/>`; acc += hh; }); s += `<text x="${x + bw * .34}" y="${pad.t + H - acc - 5}" text-anchor="middle" font-weight="700" fill="${INK}">${fmt(tot(l))}</text><text x="${x + bw * .34}" y="${h - 12}" text-anchor="middle" fill="${INK2}">${l.rot}</text>`; });
  return s + '</svg>';
}
export function lines({ w = 1136, h = 280, labels, series, yfmt = f0, tick = 1, y0, y1, pad = { l: 60, r: 70, t: 24, b: 34 }, ref }) {
  const all = series.flatMap(x => x.data).filter(v => v != null); let a0 = y0 ?? Math.min(...all), a1 = y1 ?? Math.max(...all);
  if (y0 == null || y1 == null) { const a = a1 - a0 || 1; a0 -= a * .15; a1 += a * .15; }
  const step = (w - pad.l - pad.r) / (labels.length - 1), X = i => pad.l + step * i, Y = v => pad.t + (h - pad.t - pad.b) * (1 - (v - a0) / (a1 - a0));
  let s = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="Montserrat,Arial" font-size="11">`;
  for (let i = 0; i <= 4; i++) { const v = a0 + (a1 - a0) * i / 4; s += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="${LINE}"/><text x="${pad.l - 8}" y="${Y(v) + 4}" text-anchor="end" fill="${INK3}">${yfmt(v)}</text>`; }
  if (ref != null) s += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(ref)}" y2="${Y(ref)}" stroke="${INK3}" stroke-dasharray="4 4"/>`;
  labels.forEach((l, i) => { if (l && i % tick === 0) s += `<text x="${X(i)}" y="${h - 12}" text-anchor="middle" fill="${INK2}" font-weight="600">${l}</text>`; });
  series.forEach(sr => {
    let d = '', pen = false;
    sr.data.forEach((v, i) => { if (v == null) { pen = false; return; } d += (pen ? 'L' : 'M') + X(i) + ' ' + Y(v) + ' '; pen = true; });
    s += `<path d="${d}" fill="none" stroke="${sr.cor}" stroke-width="${sr.w || 2.6}"${sr.dash ? ' stroke-dasharray="7 5"' : ''}/>`;
    if (sr.pontos) sr.data.forEach((v, i) => { if (v != null) s += `<circle cx="${X(i)}" cy="${Y(v)}" r="3.2" fill="${sr.cor}"/>`; });
    if (sr.rotulo) { const i = sr.data.length - 1 - [...sr.data].reverse().findIndex(v => v != null); s += `<text x="${X(i) + 6}" y="${Y(sr.data[i]) + 4}" fill="${sr.cor}" font-weight="700">${sr.rotulo}</text>`; }
  });
  return s + '</svg>';
}
// ponte (cascata): itens [{rot, v, tot?, cor?}] — tot=true desenha a barra cheia a partir do zero
export function ponte({ w = 1136, h = 300, itens, fmt = v => f0(v), corPos = ACC, corNeg = VERDE, corTot = INK, pad = { l: 16, r: 16, t: 30, b: 46 }, fs = 11 }) {
  let acc = 0; const bars = itens.map(it => { if (it.tot) { const b = { ...it, y0: 0, y1: it.v }; acc = it.v; return b; } const b = { ...it, y0: acc, y1: acc + it.v }; acc += it.v; return b; });
  const lo = Math.min(0, ...bars.map(b => Math.min(b.y0, b.y1))), hi = Math.max(...bars.map(b => Math.max(b.y0, b.y1))) * 1.08;
  const bw = (w - pad.l - pad.r) / bars.length, Y = v => pad.t + (h - pad.t - pad.b) * (1 - (v - lo) / (hi - lo));
  let s = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="Montserrat,Arial" font-size="${fs}">`;
  s += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(0)}" y2="${Y(0)}" stroke="${LINE}"/>`;
  bars.forEach((b, i) => {
    const x = pad.l + bw * i + bw * .16, ww = bw * .68, top = Y(Math.max(b.y0, b.y1)), hh = Math.max(Math.abs(Y(b.y0) - Y(b.y1)), 1.5);
    const cor = b.tot ? corTot : b.v >= 0 ? corPos : corNeg;
    s += `<rect x="${x}" y="${top}" width="${ww}" height="${hh}" rx="2" fill="${b.cor || cor}"/>`;
    if (i < bars.length - 1 && !bars[i + 1].tot) s += `<line x1="${x + ww}" x2="${x + bw}" y1="${Y(b.y1)}" y2="${Y(b.y1)}" stroke="${INK3}" stroke-dasharray="3 3"/>`;
    s += `<text x="${x + ww / 2}" y="${top - 6}" text-anchor="middle" font-weight="700" fill="${INK}">${b.tot ? '' : b.v > 0 ? '+' : '−'}${fmt(b.tot ? b.v : Math.abs(b.v))}</text>`;
    String(b.rot).split('\n').forEach((t, k) => { s += `<text x="${x + ww / 2}" y="${h - pad.b + 16 + k * 13}" text-anchor="middle" fill="${INK2}" font-weight="600">${t}</text>`; });
  });
  return s + '</svg>';
}
// barras verticais agrupadas: linhas [{rot, k1, k2…}], series [{k, rot, cor}], valor em cima de cada barra
export function gbars({ w = 1136, h = 220, linhas, series, fmt = f0, pad = { l: 16, r: 16, t: 40, b: 30 }, fs = 9.5 }) {
  const max = Math.max(...linhas.flatMap(l => series.map(s => l[s.k] || 0)), 1) * 1.14, gw = (w - pad.l - pad.r) / linhas.length, bw = gw * .78 / series.length, H = h - pad.t - pad.b, Y = v => pad.t + H * (1 - v / max);
  let s = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="Montserrat,Arial" font-size="${fs}">`;
  series.forEach((se, k) => { s += `<rect x="${pad.l + k * 130}" y="6" width="10" height="10" rx="2" fill="${se.cor}"/><text x="${pad.l + k * 130 + 14}" y="15" fill="${INK2}">${se.rot}</text>`; });
  linhas.forEach((l, i) => { const x0 = pad.l + gw * i + gw * .11; series.forEach((se, k) => { const v = l[se.k] || 0, x = x0 + k * bw; s += `<rect x="${x}" y="${Y(v)}" width="${bw - 2}" height="${Math.max(H - (Y(v) - pad.t), 0)}" rx="2" fill="${se.cor}"/><text x="${x + (bw - 2) / 2}" y="${Y(v) - 4}" text-anchor="middle" font-weight="700" fill="${INK}" font-size="${fs - 1}">${fmt(v)}</text>`; }); s += `<text x="${x0 + gw * .39}" y="${h - 10}" text-anchor="middle" fill="${INK2}" font-weight="600">${l.rot}</text>`; });
  return s + '</svg>';
}
// barras horizontais agrupadas (até 3 séries) com rótulo à direita
export function hbars({ w = 560, linhas, series, fmt = v => f0(v), lh = 26, lw = 130, fs = 10.5 }) {
  const max = Math.max(...linhas.flatMap(l => series.map(s => Math.abs(l[s.k] || 0))), 1), bh = (lh - 8) / series.length, W = w - lw - 80;
  let s = `<svg viewBox="0 0 ${w} ${linhas.length * lh + 22}" width="${w}" height="${linhas.length * lh + 22}" font-family="Montserrat,Arial" font-size="${fs}">`;
  series.forEach((se, k) => { s += `<rect x="${lw + k * 130}" y="2" width="10" height="10" rx="2" fill="${se.cor}"/><text x="${lw + k * 130 + 14}" y="11" fill="${INK2}">${se.rot}</text>`; });
  linhas.forEach((l, i) => {
    const y = 20 + i * lh; s += `<text x="${lw - 8}" y="${y + lh / 2}" text-anchor="end" fill="${INK}" font-weight="600">${l.rot}</text>`;
    series.forEach((se, k) => { const v = l[se.k] || 0, ww = W * Math.abs(v) / max; s += `<rect x="${lw}" y="${y + 2 + k * bh}" width="${ww}" height="${bh - 1}" rx="2" fill="${se.cor}"/><text x="${lw + ww + 4}" y="${y + 1 + (k + 1) * bh - 1}" fill="${INK2}" font-size="${fs - 1}">${fmt(v)}</text>`; });
  });
  return s + '</svg>';
}
// matriz de células (heatmap simples): linhas [{rot, vals:[...]}], cols [rótulos], cor(v) → css color, fmt(v)
export function matriz({ linhas, cols, cor, fmt = f2, classe = 'mini', primeira = '' }) {
  return `<table class="${classe}"><tr><th>${primeira}</th>${cols.map(c => `<th class="n">${c}</th>`).join('')}</tr>${linhas.map(l => `<tr><td><b>${l.rot}</b></td>${l.vals.map(v => `<td class="n" style="${v == null ? '' : 'background:' + cor(v)}">${v == null ? '·' : fmt(v)}</td>`).join('')}</tr>`).join('')}</table>`;
}
