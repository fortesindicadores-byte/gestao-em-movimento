// Peças comuns dos decks da análise do Freightech: o layout do DriverPro
// (../driverpro-apresentacao/base.css), formatação e os gráficos em SVG.
import { readFileSync, writeFileSync } from 'node:fs';
export const CSS = readFileSync(new URL('../driverpro-apresentacao/base.css', import.meta.url), 'utf8');
export const ACC = '#F22C05', AZUL = '#1F6FEB', VERDE = '#1E8E5A', AMB = '#C98A00', INK = '#0F1A20', INK2 = '#4A5563', INK3 = '#8A94A2', LINE = '#E3E6EA', PALE = '#F3F4F6';
export const f0 = v => v == null || !isFinite(v) ? '—' : Math.round(v).toLocaleString('pt-BR');
export const f1 = v => v == null || !isFinite(v) ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const f2 = v => v == null || !isFinite(v) ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const f3 = v => v == null || !isFinite(v) ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
export const mi = v => (v / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' mi';
export const mil = v => Math.round(v / 1e3).toLocaleString('pt-BR') + ' mil';
export const rs = v => Math.abs(v) >= 1e6 ? 'R$ ' + mi(v) : 'R$ ' + mil(v);
export const pct = (v, d = 1) => { if (v == null || !isFinite(v)) return '—'; const z = Math.abs(v) < 0.5 / 10 ** d; return (z ? '' : v > 0 ? '+' : '') + (z ? 0 : v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%'; };
export const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const NOME = { BLC: 'Camboriú', CBA: 'Cuiabá', FLP: 'Florianópolis', GRL: 'Guarulhos', NFR: 'Nova Friburgo', PLT: 'Pelotas', CGR: 'Rio de Janeiro', RON: 'Rondonópolis', MCC: 'Macacu', PIR: 'Piraí', GNA: 'Goiânia' };

export function deck({ rodape, marca, titulo }) {
  let N = 1; const S = [];
  const LOGO = `<div class="logo" style="margin-bottom:38px"><div class="ic"><svg viewBox="0 0 48 48" fill="none"><path d="M10 32h28M14 32V20h12l6 6v6" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="18" cy="33" r="3" fill="#fff"/><circle cx="31" cy="33" r="3" fill="#fff"/></svg></div><div class="nm">${marca}</div></div>`;
  const foot = () => `<div class="foot"><span>${rodape}</span><span>${N++}</span></div>`;
  return {
    LOGO,
    slide: (inner, extra = '') => S.push(`<section class="slide"${extra}>${inner}${foot()}</section>`),
    capa: (kicker, h1, texto) => S.push(`<section class="slide dark">${LOGO}<div class="kicker">${kicker}</div><h1 style="max-width:1000px">${h1}</h1><p style="margin-top:26px;font-size:16.5px;max-width:860px">${texto}</p>${foot()}</section>`),
    escuro: txt => `<div class="box res" style="background:${INK}"><p style="color:#F4F5F7">${txt}</p></div>`,
    write: out => {
      writeFileSync(out, `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${titulo}</title>
<style>${CSS}
  .kicker{font-size:11px} h1{font-size:42px} h2{font-size:28px} h3{font-size:15px} p{font-size:15px}
  .box h3{font-size:15px} .box p{font-size:13px} .num{font-size:34px} .num small{font-size:15px} .lbl{font-size:10.5px}
  .step{margin-bottom:12px;flex-direction:column;gap:0} .step b{font-size:14.5px} .step span{font-size:12.5px} .step span b{display:inline;font-size:inherit;margin:0;color:var(--ink)} .note{font-size:11px;color:var(--ink3);line-height:1.4} .foot{font-size:10.5px}
  table{font-size:12.5px} table th{padding:7px 9px} table td{padding:6px 9px}
  table.compacta{font-size:11.5px} table.compacta th{padding:6px 8px} table.compacta td{padding:5px 8px}
  table th{background:#EEF0F3;color:var(--ink2);border-bottom:0;font-size:9.5px;letter-spacing:.8px}
  table th:first-child{border-radius:8px 0 0 8px} table th:last-child{border-radius:0 8px 8px 0}
  table td{border-bottom:1px solid #EDEFF2} td.n,th.n{text-align:right}
  .slide .box.res{padding:12px 18px} .slide .box.res p{font-size:12.5px;line-height:1.45}
  .ficha{display:grid;grid-template-columns:150px 1fr;gap:6px 14px;font-size:13px;line-height:1.42}
  .ficha dt{font-weight:700;color:var(--ink2);font-size:10.5px;letter-spacing:.6px;text-transform:uppercase;padding-top:2px}
  .ficha dd{margin:0;color:var(--ink)}
  .tag{display:inline-block;font-size:10px;font-weight:700;letter-spacing:.6px;padding:3px 9px;border-radius:999px;text-transform:uppercase}
  .tag.alta{background:#E5F4EC;color:${VERDE}} .tag.media{background:#FBF1D9;color:${AMB}} .tag.baixa{background:#F1F2F4;color:${INK2}}
  .formula{font-family:Montserrat,Arial;background:${PALE};border-radius:10px;padding:12px 16px;font-size:14.5px;font-weight:600;color:${INK};line-height:1.5}
  .formula small{display:block;font-weight:500;font-size:11.5px;color:var(--ink2);margin-top:3px}
</style></head><body>${S.join('\n')}</body></html>`);
      return S.length;
    },
  };
}

export function bars({ w = 560, h = 240, labels, data, cor = INK, fmt = f0, pad = { l: 16, r: 16, t: 24, b: 32 } }) {
  const max = Math.max(...data.map(Math.abs), 1) * 1.14, bw = (w - pad.l - pad.r) / data.length, Y = v => pad.t + (h - pad.t - pad.b) * (1 - v / max);
  let s = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="Montserrat,Arial" font-size="10">`;
  data.forEach((v, i) => { const x = pad.l + bw * i + bw * .14; s += `<rect x="${x}" y="${Y(Math.max(v, 0))}" width="${bw * .72}" height="${Math.max(h - pad.b - Y(Math.max(v, 0)), 0)}" rx="2" fill="${typeof cor === 'function' ? cor(i) : cor}"/><text x="${x + bw * .36}" y="${Y(Math.max(v, 0)) - 5}" text-anchor="middle" font-weight="700" fill="${INK}">${fmt(v)}</text><text x="${x + bw * .36}" y="${h - 12}" text-anchor="middle" fill="${INK2}">${labels[i]}</text>`; });
  return s + '</svg>';
}
export function lines({ w = 1136, h = 280, labels, series, yfmt = f0, tick = 1, y0, y1, pad = { l: 60, r: 20, t: 24, b: 34 } }) {
  const all = series.flatMap(x => x.data).filter(v => v != null); let a0 = y0 ?? Math.min(...all), a1 = y1 ?? Math.max(...all);
  if (y0 == null || y1 == null) { const a = a1 - a0 || 1; a0 -= a * .15; a1 += a * .15; }
  const step = (w - pad.l - pad.r) / (labels.length - 1), X = i => pad.l + step * i, Y = v => pad.t + (h - pad.t - pad.b) * (1 - (v - a0) / (a1 - a0));
  let s = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="Montserrat,Arial" font-size="11">`;
  for (let i = 0; i <= 4; i++) { const v = a0 + (a1 - a0) * i / 4; s += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="${LINE}"/><text x="${pad.l - 8}" y="${Y(v) + 4}" text-anchor="end" fill="${INK3}">${yfmt(v)}</text>`; }
  labels.forEach((l, i) => { if (l && i % tick === 0) s += `<text x="${X(i)}" y="${h - 12}" text-anchor="middle" fill="${INK2}" font-weight="600">${l}</text>`; });
  series.forEach(sr => {
    let d = '', pen = false;
    sr.data.forEach((v, i) => { if (v == null) { pen = false; return; } d += (pen ? 'L' : 'M') + X(i) + ' ' + Y(v) + ' '; pen = true; });
    s += `<path d="${d}" fill="none" stroke="${sr.cor}" stroke-width="2.6"${sr.dash ? ' stroke-dasharray="7 5"' : ''}/>`;
    if (sr.rotulo) { const i = sr.data.length - 1 - [...sr.data].reverse().findIndex(v => v != null); s += `<text x="${X(i) + 6}" y="${Y(sr.data[i]) + 4}" fill="${sr.cor}" font-weight="700">${sr.rotulo}</text>`; }
  });
  return s + '</svg>';
}
