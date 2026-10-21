// ============================================================
// Deck "Consumo remunerado Km/L" — monta o HTML (layout do DriverPro) a partir
// do dados.json gerado por analise.mjs. Render em PDF: ../driverpro-apresentacao/render.mjs
//   KML_REM_DADOS=…/dados.json node deck.mjs → deck.html
// ============================================================
import { readFileSync, writeFileSync } from 'node:fs';
const D = JSON.parse(readFileSync(process.env.KML_REM_DADOS || new URL('./dados.json', import.meta.url).pathname, 'utf8'));
const OUT = new URL('./deck.html', import.meta.url).pathname;

const ACC = '#F22C05', AZUL = '#1F6FEB', INK = '#0F1A20', INK2 = '#4A5563', INK3 = '#8A94A2', LINE = '#E3E6EA', PALE = '#F3F4F6';
const f2 = v => v == null || !isFinite(v) ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const f1 = v => v == null || !isFinite(v) ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const f0 = v => v == null || !isFinite(v) ? '—' : Math.round(v).toLocaleString('pt-BR');
const pct = (v, d = 1) => v == null || !isFinite(v) ? '—' : (Math.abs(v) < 0.5 / Math.pow(10, d) ? 0 : v) === 0 ? '0,0%'.slice(0, d ? 4 : 2) : (v > 0 ? '+' : '') + v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%';
const rs = v => v == null ? '—' : (v < 0 ? '−' : '') + 'R$ ' + Math.abs(Math.round(v)).toLocaleString('pt-BR');
const rsK = v => v == null ? '—' : (v < 0 ? '−' : '') + 'R$ ' + (Math.abs(v) >= 1e6 ? (Math.abs(v) / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' mi' : (Math.abs(v) / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' mil');
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
const MES = D.MESES;
const cor = v => v > 0 ? ACC : v < 0 ? AZUL : INK3; // Δ no remunerado: subir = pior para nós (vermelho), cair = melhor (azul)
const sinal = (v, cls = true) => v == null ? '—' : `<span style="color:${v > 0.005 ? ACC : v < -0.005 ? AZUL : INK3};font-weight:700">${(v > 0 ? '+' : '') + f2(v)}</span>`;
const sinalPct = v => v == null ? '—' : `<span style="color:${v > 0.5 ? ACC : v < -0.5 ? AZUL : INK3};font-weight:700">${pct(v)}</span>`;
const nomeUp = up => { const [u, p] = up.split(' · '); return `${u} · ${p}`; };
const foot = n => `<div class="foot"><span>Consumo remunerado Km/L · análise do ano · Conlog</span><span>${n}</span></div>`;
let N = 1;
const slide = (inner, cls = '') => `<section class="slide ${cls}">${inner}${foot(N++)}</section>`;

// ── gráfico de linhas (SVG): séries no mesmo eixo, faixas de trimestre ──
function lineChart({ w = 1100, h = 330, series, labels, bands = [], marks = [], yfmt = f2, pad = { l: 56, r: 24, t: 24, b: 40 } }) {
  const all = series.flatMap(s => s.data.filter(v => v != null));
  let y0 = Math.min(...all), y1 = Math.max(...all); const amp = y1 - y0 || 1; y0 -= amp * .25; y1 += amp * .2;
  const X = i => pad.l + (w - pad.l - pad.r) * (labels.length === 1 ? .5 : i / (labels.length - 1));
  const Y = v => pad.t + (h - pad.t - pad.b) * (1 - (v - y0) / (y1 - y0));
  let s = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="Montserrat,Arial" font-size="12">`;
  bands.forEach(b => { const x0 = X(b.de) - (w - pad.l - pad.r) / (labels.length - 1) / 2, x1 = X(b.ate) + (w - pad.l - pad.r) / (labels.length - 1) / 2; s += `<rect x="${x0}" y="${pad.t - 10}" width="${x1 - x0}" height="${h - pad.t - pad.b + 10}" fill="${b.fill || PALE}" opacity=".7"/><text x="${(x0 + x1) / 2}" y="${pad.t - 14}" text-anchor="middle" font-size="11" font-weight="700" fill="${INK3}" letter-spacing="1">${b.label}</text>`; });
  // eixo y: 4 linhas
  for (let i = 0; i <= 4; i++) { const v = y0 + (y1 - y0) * i / 4; s += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="${LINE}" stroke-width="1"/><text x="${pad.l - 8}" y="${Y(v) + 4}" text-anchor="end" fill="${INK3}">${yfmt(v)}</text>`; }
  labels.forEach((l, i) => { s += `<text x="${X(i)}" y="${h - 12}" text-anchor="middle" fill="${INK2}" font-weight="600">${l}</text>`; });
  marks.forEach(m => { const dir = X(m.i) > w * .8 ? -1 : 1; s += `<line x1="${X(m.i)}" x2="${X(m.i)}" y1="${pad.t}" y2="${h - pad.b}" stroke="${m.cor || INK3}" stroke-width="1.5" stroke-dasharray="4 4"/><text x="${X(m.i) + 6 * dir}" y="${pad.t + 12}" text-anchor="${dir < 0 ? 'end' : 'start'}" fill="${m.cor || INK3}" font-size="11" font-weight="700">${m.label}</text>`; });
  series.forEach(sr => {
    const pts = sr.data.map((v, i) => v == null ? null : [X(i), Y(v)]);
    let dpath = '', open = false; pts.forEach(p => { if (!p) { open = false; return; } dpath += (open ? 'L' : 'M') + p[0] + ' ' + p[1] + ' '; open = true; });
    s += `<path d="${dpath}" fill="none" stroke="${sr.cor}" stroke-width="2.5" stroke-linejoin="round" ${sr.dash ? 'stroke-dasharray="6 4"' : ''}/>`;
    pts.forEach((p, i) => { if (!p) return; s += `<circle cx="${p[0]}" cy="${p[1]}" r="4.5" fill="#fff" stroke="${sr.cor}" stroke-width="2"/>`; if (sr.labelAll || i === pts.length - 1 || i === 0 || sr.labelIdx?.includes(i)) s += `<text x="${p[0]}" y="${p[1] + (sr.above ? -10 : 18)}" text-anchor="middle" font-size="11.5" font-weight="700" fill="${INK}">${yfmt(sr.data[i])}</text>`; });
  });
  s += '</svg>';
  return s;
}
// ── barras verticais simples ──
function barChart({ w = 1100, h = 260, data, labels, cor = INK, corFn, pad = { l: 44, r: 16, t: 26, b: 36 }, fmt = f0, destaque = [] }) {
  const max = Math.max(...data, 1);
  const bw = (w - pad.l - pad.r) / data.length;
  const Y = v => pad.t + (h - pad.t - pad.b) * (1 - v / max);
  let s = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="Montserrat,Arial" font-size="11">`;
  s += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${h - pad.b}" y2="${h - pad.b}" stroke="${LINE}"/>`;
  data.forEach((v, i) => { const x = pad.l + bw * i + bw * .15, c = corFn ? corFn(i, v) : cor; s += `<rect x="${x}" y="${Y(v)}" width="${bw * .7}" height="${h - pad.b - Y(v)}" fill="${c}" rx="3"/>`; if (v > 0) s += `<text x="${x + bw * .35}" y="${Y(v) - 5}" text-anchor="middle" font-weight="700" fill="${INK}">${fmt(v)}</text>`; s += `<text x="${x + bw * .35}" y="${h - 12}" text-anchor="middle" fill="${destaque.includes(i) ? ACC : INK2}" font-weight="${destaque.includes(i) ? 800 : 500}">${labels[i]}</text>`; });
  s += '</svg>'; return s;
}
const legenda = (itens) => `<div style="display:flex;gap:22px;font-size:12.5px;color:${INK2};margin-top:4px">${itens.map(i => `<span><i style="display:inline-block;width:22px;height:3px;background:${i.cor};vertical-align:middle;margin-right:7px;${i.dash ? 'border-top:3px dashed ' + i.cor + ';height:0;background:none;' : ''}"></i>${i.label}</span>`).join('')}</div>`;

// ═════════════════ dados derivados para os slides ═════════════════
const frotaMes = D.MES_IDX.map(m => D.frota.mes[m]?.media ?? null);
const realMes = D.MES_IDX.map(m => D.realMesSimples[m]?.kml ?? null);
const q = D.frota.q;
const UPS = D.UPS.filter(up => !/UDC|LATA|GNA/.test(up) || D.rankUP.find(r => r.up === up)?.q3); // sem as que não têm série
const rank = D.rankUP.filter(r => r.q3 != null && r.q1 != null);
const piorAlta = [...rank].sort((a, b) => b.dQ1Q3 - a.dQ1Q3)[0], maiorQueda = [...rank].sort((a, b) => a.dQ1Q3 - b.dQ1Q3)[0];
const gapQ4 = rank.filter(r => r.prem?.[4]).map(r => ({ up: r.up, gap: r.prem[4].gapPct, rem: r.prem[4].rem, real: r.prem[4].realAnt }));
const piorGap = [...gapQ4].sort((a, b) => b.gap - a.gap)[0], melhorGap = [...gapQ4].sort((a, b) => a.gap - b.gap)[0];
const semRev = D.UPS.map(up => ({ up, ...(D.premissa[up]?.semRevisao || {}) })).filter(x => x.litMes != null);
const semRevTotL = semRev.reduce((s, x) => s + x.litMes, 0), semRevTotRS = semRev.reduce((s, x) => s + x.rsMes, 0);
const semRevPerde = semRev.filter(x => x.litMes < 0), semRevGanha = semRev.filter(x => x.litMes > 0);
const ativOrd = D.rankUP.filter(r => r.ativMed != null).sort((a, b) => b.ativMed - a.ativMed);
const dispTot = Object.values(D.impDisp).reduce((a, v) => ({ perde: a.perde + v.perde, ganha: a.ganha + v.ganha, rsPerde: a.rsPerde + v.rsPerde, rsGanha: a.rsGanha + v.rsGanha }), { perde: 0, ganha: 0, rsPerde: 0, rsGanha: 0 });
const kmInatPct = D.kmInatFTTot.km / D.kmInatTot.total * 100;
const fr = D.fronteiras;
const mudQz = D.QZ.map(z => fr[z.t] ? fr[z.t].mudaram : 0);

// unidades (sem tier) na ordem do portal; projetos dentro
const UNIS = [...new Set(D.UPS.map(up => up.split(' · ')[0].replace(/ UDC| LATA/, '')))].sort();
const upsDe = u => D.UPS.filter(up => up.split(' · ')[0].replace(/ UDC| LATA/, '') === u);

const S = [];

// ── 1 · CAPA ──
S.push(slide(`
  <div class="kicker" style="color:#F4F5F7;opacity:.8">Freightech · consumo remunerado · unidade-projeto</div>
  <h1 style="max-width:960px">O consumo remunerado de Km/L<br>em 2026: o que a revisão fez,<br>o que a falta dela está custando.</h1>
  <p style="margin-top:26px;font-size:18px;max-width:860px">Planilha do FT (${f0(D.totais.linhas)} linhas · ${D.totais.placas} placas · ${D.totais.ups} unidade-projeto · 1ª jan a 2ª out) cruzada placa a placa com os abastecimentos da aba Km/L (${f0(D.totais.kmlLinhas)} linhas, jan a set). Quatro perguntas, na ordem de importância: a revisão do 4º tri, a dispersão dentro do modelo, o efeito da ativação e os demais erros.</p>
  <div class="foot"><span>Gestão em Movimento · Fortes Indicadores</span><span>Outubro de 2026</span></div>`, 'dark'));
N = 1; // a capa não numera
S.pop(); S.push(`<section class="slide dark" style="display:flex;flex-direction:column;justify-content:center;">
  <div class="kicker" style="color:#F4F5F7;opacity:.8">Freightech · consumo remunerado · unidade-projeto</div>
  <h1 style="max-width:960px">O consumo remunerado de Km/L<br>em 2026: o que a revisão fez,<br>o que a falta dela está custando.</h1>
  <p style="margin-top:26px;font-size:18px;max-width:860px">Planilha do FT (${f0(D.totais.linhas)} linhas · ${D.totais.placas} placas · ${D.totais.ups} unidade-projeto · 1ª jan a 2ª out) cruzada placa a placa com os abastecimentos da aba Km/L (${f0(D.totais.kmlLinhas)} linhas, jan a set). Quatro perguntas, na ordem de importância: a revisão do 4º tri, a dispersão dentro do modelo, o efeito da ativação e os demais erros.</p>
  <div class="foot"><span>Gestão em Movimento · Fortes Indicadores</span><span>Outubro de 2026</span></div>
</section>`);
N = 2;

// ── 2 · VISÃO GERAL DO ANO ──
const dQ1Q3 = (q[3].media / q[1].media - 1) * 100, dQ3Q4 = (q[4].media / q[3].media - 1) * 100;
const gapSet = (D.frota.mes[9].media / D.realMesSimples[9].kml - 1) * 100;
S.push(slide(`
  <div class="kicker">Visão geral do ano</div>
  <h2 style="font-size:25px">O remunerado subiu 2 vezes no ano (1ª abr e 1ª jul), ficou parado em outubro e está ${pct(gapSet)} acima do realizado.</h2>
  <div class="grid" style="grid-template-columns:1fr 400px;gap:18px;margin-top:4px;align-items:start">
    <div>
      ${lineChart({ w: 730, h: 268, labels: MES.slice(0, 10).map(m => m.toUpperCase()), series: [
        { data: frotaMes, cor: ACC, labelAll: true, above: true },
        { data: realMes, cor: AZUL, labelAll: true },
      ], bands: [{ de: 0, ate: 2, label: 'Q1' }, { de: 3, ate: 5, label: 'Q2', fill: '#fff' }, { de: 6, ate: 8, label: 'Q3' }, { de: 9, ate: 9, label: 'Q4', fill: '#fff' }],
        marks: [{ i: 3, label: 'revisão 1ª abr', cor: INK3 }, { i: 6, label: 'revisão 1ª jul', cor: INK3 }, { i: 9, label: 'sem revisão', cor: ACC }] })}
      ${legenda([{ cor: ACC, label: 'Remunerado · média simples das placas ativas no FT (Km/L)' }, { cor: AZUL, label: 'Realizado · média simples por placa, abastecimentos (Km/L)' }])}
    </div>
    <div class="grid" style="grid-template-columns:1fr 1fr;gap:10px">
      <div class="box" style="padding:10px 13px"><div class="lbl">Q1 → Q3</div><div class="num" style="font-size:26px;color:${ACC};margin:2px 0">${pct(dQ1Q3)}</div><p style="font-size:11px">${f2(q[1].media)} → ${f2(q[3].media)} km/L. Subir é pior para nós: menos litros remunerados.</p></div>
      <div class="box" style="padding:10px 13px"><div class="lbl">Q3 → Q4</div><div class="num" style="font-size:26px;margin:2px 0">${pct(dQ3Q4)}</div><p style="font-size:11px">${D.q3q4.iguais} placas com o mesmo valor, ${D.q3q4.mudaram} mudaram. Sem revisão: o 4º tri roda com a régua do 3º.</p></div>
      <div class="box" style="padding:10px 13px"><div class="lbl">Maior alta Q1→Q3</div><div class="num" style="font-size:17px;color:${ACC};margin:4px 0;letter-spacing:0">${esc(piorAlta.up)}</div><p style="font-size:11px">${f2(piorAlta.q1)} → ${f2(piorAlta.q3)} (${pct(piorAlta.dQ1Q3)})</p></div>
      <div class="box" style="padding:10px 13px"><div class="lbl">Maior queda Q1→Q3</div><div class="num" style="font-size:17px;color:${AZUL};margin:4px 0;letter-spacing:0">${esc(maiorQueda.up)}</div><p style="font-size:11px">${f2(maiorQueda.q1)} → ${f2(maiorQueda.q3)} (${pct(maiorQueda.dQ1Q3)})</p></div>
      <div class="box" style="padding:10px 13px;grid-column:1/3"><div class="lbl">Sem a revisão do Q4</div><div class="num" style="font-size:24px;color:${ACC};margin:2px 0">${rsK(semRevTotRS)}<small style="font-size:12px;color:${INK2}"> /mês</small></div><p style="font-size:11px">Se o Q4 tivesse recebido o realizado do Q3 (a regra), a frota receberia ${f0(-semRevTotL)} litros a mais por mês. Em ${semRevPerde.length} unidade-projeto a falta da revisão custa; em ${semRevGanha.length} ela ajuda.</p></div>
    </div>
  </div>
  <div class="grid g4" style="gap:10px;margin-top:8px">
    <div class="box" style="padding:9px 12px"><b style="font-size:12.5px">1 · Revisão do Q4</b><p style="font-size:11px">Não aconteceu: nenhuma placa mudou de valor em outubro. As únicas mudanças desde julho foram 10 placas de Cuiabá, na 2ª set.</p></div>
    <div class="box" style="padding:9px 12px"><b style="font-size:12.5px">2 · Mesmo modelo, médias diferentes</b><p style="font-size:11px">Em ${D.dispRes.comDif} de ${D.dispRes.grupos} grupos modelo-mês. Saldo contra nós: ${f0(dispTot.perde - dispTot.ganha)} L em 9 meses.</p></div>
    <div class="box" style="padding:9px 12px"><b style="font-size:12.5px">3 · Ativação</b><p style="font-size:11px">Sobe a média em até +${f2(Math.max(...ativOrd.map(r => r.ativMed)))} km/L (${esc(ativOrd[0].up)}). Placas inativas rodaram ${f1(kmInatPct)}% do km do ano.</p></div>
    <div class="box" style="padding:9px 12px"><b style="font-size:12.5px">4 · Erros</b><p style="font-size:11px">${D.erros.ativasZero.length} linhas ativas com consumo zero, placa "TESTE", ${D.erros.duplaGrafia.length} placas em duas grafias, ${D.mudancasCiclo} mudanças fora da revisão.</p></div>
  </div>`));

// ── 3 · MATRIZ unidade-projeto × ciclo ──
{
  const rows = D.rankUP.filter(r => r.q1 != null || r.q3 != null).sort((a, b) => a.up.localeCompare(b.up));
  const linha = r => `<tr><td style="white-space:nowrap"><b>${esc(r.up)}</b></td><td class="r">${f2(r.q1)}</td><td class="r">${f2(r.q2)}</td><td class="r">${f2(r.q3)}</td><td class="r">${f2(r.q4)}</td><td class="r">${sinalPct(r.dQ1Q3)}</td><td class="r">${sinalPct(r.dQ3Q4)}</td><td class="r">${r.prem?.[4] ? f2(r.prem[4].realAnt) : '—'}</td><td class="r">${r.prem?.[4] ? sinalPct(r.prem[4].gapPct) : '—'}</td></tr>`;
  const meio = Math.ceil(rows.length / 2);
  const tab = rs2 => `<table style="font-size:9.8px;table-layout:auto" class="compacta"><thead><tr><th>Operação</th><th class="r">Q1</th><th class="r">Q2</th><th class="r">Q3</th><th class="r">Q4</th><th class="r">Δ Q1→3</th><th class="r">Δ Q3→4</th><th class="r">Real Q3</th><th class="r">Q4 × real</th></tr></thead><tbody>${rs2.map(linha).join('')}</tbody></table>`;
  S.push(slide(`
  <div class="kicker">Matriz do ano</div>
  <h2 style="font-size:24px">Unidade-projeto × ciclo de revisão: a régua de cada operação e a distância do realizado</h2>
  <div class="grid" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:20px;margin-top:4px;align-items:start">${tab(rows.slice(0, meio))}${tab(rows.slice(meio))}</div>
  <p class="note">Q1 = jan a mar · Q2 = abr a jun · Q3 = jul a set · Q4 = outubro (1ª e 2ª quinzena). Média simples das placas ativas com consumo (a régua do FT). Real Q3 = média simples por placa dos abastecimentos de jul a set. Vermelho = remunerado subiu ou está acima do realizado (pior para nós); azul = o contrário.</p>`));
}

// ── 4 · PERGUNTA 1 · resumo ──
{
  const mud = D.fronteiras[17]; const lista17 = (D.listaMud17 || []);
  S.push(slide(`
  <div class="kicker">1 · Revisão do 3º para o 4º trimestre</div>
  <h2 style="font-size:28px">Não houve revisão: as ${D.q3q4.iguais} placas presentes em 2ª set e 1ª out entraram em outubro com o mesmo valor. Nenhuma mudou.</h2>
  <div class="grid" style="grid-template-columns:1fr 380px;gap:24px;margin-top:6px;align-items:start">
    <div>
      ${barChart({ w: 820, h: 250, data: mudQz, labels: D.QZ.map(z => z.label), corFn: (i, v) => [6, 12].includes(D.QZ[i].t) ? INK : D.QZ[i].t >= 18 ? ACC : INK3, destaque: [18, 19] })}
      <p class="note">Placas ativas cujo consumo remunerado mudou em relação à quinzena anterior. As duas revisões do ano entram na <b>1ª quinzena</b> do trimestre (1ª abr: ${fr[6].mudaram} placas · 1ª jul: ${fr[12].mudaram}). Em 1ª out mudaram ${fr[18].mudaram}; em 2ª out, ${fr[19].mudaram}. O 4º tri está rodando com a régua do 3º.</p>
    </div>
    <div>
      <div class="box" style="margin-bottom:12px"><h3 style="font-size:15px">As últimas ${mud.mudaram} mudanças: 2ª set, em Cuiabá</h3><p style="font-size:12.5px">Cuiabá ROTA: 8 placas (RAZ3F18/28/38/68/88, RRP5C22/32, RRR8A49) caíram de 3,27–4,09 para 2,31 (a favor). Cuiabá AS: RRT3H09 e RRT1D26 subiram de 2,21 para 3,36 (+52%, contra). Nada disso é revisão: é ajuste de placa no meio do ciclo.</p></div>
      <div class="box"><h3 style="font-size:15px">Fora da revisão</h3><p style="font-size:12.5px">${D.mudancasCiclo} mudanças aconteceram fora da 1ª quinzena do trimestre (2ª jan ${fr[1].mudaram} · 2ª fev ${fr[3].mudaram} · 2ª mar ${fr[5].mudaram} · 2ª abr ${fr[7].mudaram} · 1ª mai ${fr[8].mudaram} · 2ª set ${fr[17].mudaram}). São ajustes pontuais de placa, não revisão de régua.</p></div>
    </div>
  </div>`));
}

// ── 5…  · UM SLIDE POR UNIDADE: modelos × ciclo ──
for (const u of UNIS) {
  const ups = upsDe(u);
  const blocos = ups.map(up => {
    const lista = (D.modelosQ[up] || []).filter(m => m.placas > 0);
    if (!lista.length) return '';
    const tr = lista.map(m => {
      const c = k => m.q[k] ? f2(m.q[k].media) : '—';
      const d34 = m.q[3] && m.q[4] ? (m.q[4].media / m.q[3].media - 1) * 100 : null;
      const disp = m.q[3] ? (m.q[3].max - m.q[3].min > 0.005 ? `${f2(m.q[3].min)}–${f2(m.q[3].max)}` : 'igual') : '—';
      const real = D.realModQ[up]?.[m.modelo]?.[3]?.simples;
      return `<tr><td><b>${esc(m.modelo)}</b></td><td class="r">${m.placas}</td><td class="r">${c(1)}</td><td class="r">${c(2)}</td><td class="r">${c(3)}</td><td class="r">${c(4)}</td><td class="r">${sinalPct(d34)}</td><td class="r" style="color:${INK2}">${disp}</td><td class="r">${f2(real)}</td><td class="r">${m.q[3] && real ? sinalPct((m.q[3].media / real - 1) * 100) : '—'}</td></tr>`;
    }).join('');
    const mu = D.mediaUP[up];
    return `<div style="break-inside:avoid;margin-bottom:10px"><div style="display:flex;justify-content:space-between;align-items:baseline"><h3 style="font-size:14px;margin:0 0 4px">${esc(up)}</h3><span style="font-size:11.5px;color:${INK2}">média da operação: Q1 ${f2(mu.q[1]?.media)} · Q2 ${f2(mu.q[2]?.media)} · Q3 ${f2(mu.q[3]?.media)} · Q4 ${f2(mu.q[4]?.media)}</span></div>
      <table style="font-size:11px"><thead><tr><th>Modelo</th><th class="r">Placas</th><th class="r">Q1</th><th class="r">Q2</th><th class="r">Q3</th><th class="r">Q4</th><th class="r">Δ Q3→Q4</th><th class="r">Faixa no Q3</th><th class="r">Real Q3</th><th class="r">Q3 × real</th></tr></thead><tbody>${tr}</tbody></table></div>`;
  }).join('');
  const nUps = ups.length;
  S.push(slide(`
  <div class="kicker">1 · Modelos × trimestre · ${esc(D.NOME[u] || u)}</div>
  <h2 style="font-size:22px;margin-bottom:4px">${esc(u)} · consumo remunerado por modelo em cada ciclo de revisão</h2>
  <div style="${nUps >= 3 ? 'font-size:10.5px' : ''}">${blocos}</div>
  <p class="note" style="margin-top:6px">Média simples das placas ativas do modelo. "Faixa no Q3" = menor e maior valor pago a placas do mesmo modelo no 3º tri (igual = todas com o mesmo valor). Real Q3 = média simples por placa dos abastecimentos de jul a set. Vermelho = acima do realizado ou subiu (pior para nós).</p>`));
}

// ── PERGUNTA 2 · dispersão ──
{
  const porUp = D.UPS.map(up => ({ up, ...D.impDisp[up] })).filter(x => x.grupos > 0).sort((a, b) => (b.perde - b.ganha) - (a.perde - a.ganha));
  const tr = porUp.filter(x => x.comDif > 0 && (x.perde + x.ganha) >= 200).map(x => `<tr><td><b>${esc(x.up)}</b></td><td class="r">${x.comDif} / ${x.grupos}</td><td class="r" style="color:${ACC}">${f0(x.perde)}</td><td class="r" style="color:${AZUL}">${f0(x.ganha)}</td><td class="r"><b>${f0(x.perde - x.ganha)}</b></td><td class="r">${rs(x.rsPerde - x.rsGanha)}</td></tr>`).join('');
  const casos = [...D.erros.outliers].sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
  const vistos = new Set(); const top = [];
  for (const c of casos) { const k = c.up + c.modelo; if (vistos.has(k)) continue; vistos.add(k); top.push(c); if (top.length >= 6) break; }
  S.push(slide(`
  <div class="kicker">2 · Mesmo modelo, médias diferentes</div>
  <h2 style="font-size:23px">Em ${D.dispRes.comDif} de ${D.dispRes.grupos} grupos modelo-mês há placas do mesmo modelo com valores diferentes. Saldo: ${f0(dispTot.perde - dispTot.ganha)} litros contra nós em 9 meses.</h2>
  <div class="grid" style="grid-template-columns:1fr 1fr;gap:24px;margin-top:4px;align-items:start">
    <div>
      <table style="font-size:10.5px"><thead><tr><th>Unidade · projeto</th><th class="r">Grupos c/ dif.</th><th class="r">Perde (L)</th><th class="r">Ganha (L)</th><th class="r">Saldo (L)</th><th class="r">Saldo (R$)</th></tr></thead><tbody>${tr}</tbody></table>
      <p class="note">Referência = mediana do modelo na unidade-mês. Acima da mediana a placa recebe menos litros (perde); abaixo, mais (ganha). Litros = km da placa × (1/mediana − 1/valor); R$ ao preço remunerado. Só operações com 200 L ou mais.</p>
    </div>
    <div>
      <div class="grid g3" style="gap:10px;margin-bottom:12px">
        <div class="box" style="padding:10px 12px"><div class="lbl">Placas constantes</div><div class="num" style="font-size:24px;margin:2px 0">${D.placaRes.constantes}</div><p style="font-size:11px">mesmo valor o ano todo</p></div>
        <div class="box" style="padding:10px 12px"><div class="lbl">Mudam só na revisão</div><div class="num" style="font-size:24px;margin:2px 0">${D.placaRes.soFronteira}</div><p style="font-size:11px">1ª abr e 1ª jul, como esperado</p></div>
        <div class="box" style="padding:10px 12px"><div class="lbl">Mudam fora da revisão</div><div class="num" style="font-size:24px;color:${ACC};margin:2px 0">${D.placaRes.dentroTri}</div><p style="font-size:11px">de ${D.placaRes.total} placas-operação</p></div>
      </div>
      <h3 style="font-size:14px">Os casos mais distantes do modelo</h3>
      <table style="font-size:10.5px"><thead><tr><th>Operação</th><th>Modelo</th><th>Placa</th><th class="r">Mês</th><th class="r">Valor</th><th class="r">Mediana</th><th class="r">Desvio</th></tr></thead><tbody>
      ${top.map(c => `<tr><td>${esc(c.up)}</td><td>${esc(c.modelo)}</td><td><b>${c.placa}</b></td><td class="r">${MES[c.mes - 1]}</td><td class="r">${f2(c.v)}</td><td class="r">${f2(c.mediana)}</td><td class="r">${sinalPct(c.pct, 0)}</td></tr>`).join('')}
      </tbody></table>
      <p class="note">${D.erros.outliersRes.placas} placas-operação ficaram a mais de 25% da mediana do próprio modelo em algum mês (${D.erros.outliersRes.n} placa-mês).</p>
    </div>
  </div>`));
}

// ── PERGUNTA 3 · ativação ──
{
  const meses = D.MES_IDX;
  const rows = D.UPS.filter(up => Object.values(D.ativacao[up] || {}).some(x => x.nInat > 0)).map(up => {
    const a = D.ativacao[up];
    const cells = meses.map(m => { const o = a[m]; if (!o || o.delta == null) return '<td class="r" style="color:#bbb">—</td>'; const v = o.delta; const bg = v > 0.03 ? 'rgba(242,44,5,.14)' : v < -0.03 ? 'rgba(31,111,235,.14)' : 'transparent'; return `<td class="r" style="background:${bg};font-weight:${Math.abs(v) > 0.03 ? 700 : 400}">${(v > 0 ? '+' : '') + f2(v)}</td>`; }).join('');
    const r = D.realAtInat[up] || {};
    return `<tr><td><b>${esc(up)}</b></td>${cells}<td class="r"><b>${(D.rankUP.find(x => x.up === up).ativMed > 0 ? '+' : '') + f2(D.rankUP.find(x => x.up === up).ativMed)}</b></td><td class="r">${f2(r.ativas)}</td><td class="r">${f2(r.inativas)}</td></tr>`;
  }).join('');
  const ev = D.evRes;
  S.push(slide(`
  <div class="kicker">3 · Efeito da ativação na média</div>
  <h2 style="font-size:21px">A ativação mexe pouco na média (até +${f2(ativOrd[0].ativMed)} km/L em ${esc(ativOrd[0].up)}) e não há padrão de "ativar as melhores": as inativas rodam ${f2(D.realAtInatTot.inativas)} km/L contra ${f2(D.realAtInatTot.ativas)} das ativas, e isso vira em metade das operações.</h2>
  <div class="grid" style="grid-template-columns:1fr 230px;gap:16px;margin-top:0;align-items:start">
    <table style="font-size:9.5px" class="compacta"><thead><tr><th>Unidade · projeto</th>${meses.map(m => `<th class="r">${MES[m - 1]}</th>`).join('')}<th class="r">Média</th><th class="r">Real ativas</th><th class="r">Real inativas</th></tr></thead><tbody>${rows}</tbody></table>
    <div>
      <div class="box" style="padding:10px 12px;margin-bottom:8px"><div class="lbl">Desativações</div><div class="num" style="font-size:22px;margin:2px 0">${Math.round(ev.desat.abaixo / ev.desat.n * 100)}%</div><p style="font-size:11.5px">das ${ev.desat.n} desativações do ano tiraram uma placa <b>abaixo</b> da média da operação (acaso = 50%).</p></div>
      <div class="box" style="padding:10px 12px;margin-bottom:8px"><div class="lbl">Ativações</div><div class="num" style="font-size:22px;margin:2px 0">${Math.round(ev.ativ.abaixo / ev.ativ.n * 100)}%</div><p style="font-size:11.5px">das ${ev.ativ.n} ativações trouxeram uma placa abaixo da média.</p></div>
      <div class="box" style="padding:10px 12px"><div class="lbl">Km de placas inativas</div><div class="num" style="font-size:22px;color:${ACC};margin:2px 0">${f1(kmInatPct)}%</div><p style="font-size:11.5px">${f0(D.kmInatFTTot.km)} km de jan a set rodados por ${D.kmInatFTTot.placas} placas marcadas inativas no FT. O consumo delas não entra na média que nos paga.</p></div>
    </div>
  </div>
  <p class="note" style="margin-top:6px">Célula = média das placas ativas (a que o FT paga) − média de todas as placas da operação com valor no ciclo, no mês. Positivo (vermelho) = a ativação deixou a média mais alta, pior para nós. "Real ativas/inativas" = Km/L realizado (abastecimentos) das placas no mês em que estavam ativas ou inativas no FT.</p>`));
}

// ── PREMISSA DA REVISÃO: rem Q × real Q−1 e o custo do Q4 sem revisão ──
{
  const rows = D.rankUP.filter(r => r.prem && (r.prem[2] || r.prem[3] || r.prem[4])).sort((a, b) => (b.prem.semRevisao?.rsMes ?? 0) - (a.prem.semRevisao?.rsMes ?? 0)).reverse();
  const linhaP = r => { const p = r.prem; const c = k => p[k] ? `${f2(p[k].rem)} <span style="color:${INK3}">×</span> ${f2(p[k].realAnt)} ${sinalPct(p[k].gapPct, 0)}` : '—'; const s = p.semRevisao; return `<tr><td><b>${esc(r.up)}</b></td><td class="r">${c(3)}</td><td class="r">${c(4)}</td><td class="r">${s ? f0(s.litMes) : '—'}</td><td class="r"><b style="color:${s && s.rsMes < 0 ? ACC : AZUL}">${s ? rs(s.rsMes) : '—'}</b></td></tr>`; };
  S.push(slide(`
  <div class="kicker">A regra da revisão · remunerado do tri × realizado do tri anterior</div>
  <h2 style="font-size:21px">A régua "Q(n) = realizado de Q(n−1)" não fecha: o remunerado fica em média acima do realizado anterior, e sem a revisão do Q4 a frota deixa de receber ${f0(-semRevTotL)} L/mês (${rsK(-semRevTotRS)}).</h2>
  <div class="grid g2" style="gap:22px;margin-top:2px;align-items:start">${[rows.slice(0, Math.ceil(rows.length / 2)), rows.slice(Math.ceil(rows.length / 2))].map(rs2 => `<table style="font-size:10px" class="compacta"><thead><tr><th>Unidade · projeto</th><th class="r">Q3 rem × real Q2</th><th class="r">Q4 rem × real Q3</th><th class="r">Sem rev. L/mês</th><th class="r">R$/mês</th></tr></thead><tbody>${rs2.map(linhaP).join('')}</tbody></table>`).join('')}</div>
  <p class="note">Rem × real = remunerado do trimestre contra o realizado (média simples por placa) do trimestre anterior. "Sem rev." = litros por mês que a operação receberia a mais (negativo) ou a menos (positivo) se o Q4 tivesse recebido o realizado do Q3, com o km de setembro e o R$/L remunerado. Campo Grande (CGR) carrega o benchmark da montadora no lugar do SUMA (tanque interno), assunto do limpa-pauta; mesmo tirando CGR, o saldo segue contra nós.</p>`));
}

// ── PERGUNTA 4 · erros ──
{
  const az = D.erros.ativasZeroPorUp;
  const dup = D.erros.duplaGrafia.map(x => x.grafias.join('/')).join(', ');
  const semAt = D.erros.upSemAtivas.filter(x => x.up === 'PLT · AS').length;
  S.push(slide(`
  <div class="kicker">4 · Outros erros encontrados</div>
  <h2 style="font-size:26px">Oito achados para levar à Ambev, do maior para o menor</h2>
  <div class="grid g2" style="gap:14px 26px;margin-top:4px">
    <div class="step"><div class="n">1</div><div><b>${D.erros.ativasZero.length} linhas de placa ativa com consumo zero</b><span>${Object.entries(az).map(([k, v]) => `${esc(k)}: ${v.placas.length} placas (${v.linhas} linhas)`).join(' · ')}. Em CGR ROTA são 8 placas novas (RHU8F34…46, RHS6B05) ativas o ano inteiro sem consumo. Nas três Empurradas os zeros são da 1ª abr, a quinzena da revisão do Q2: o valor novo entrou atrasado. Se o FT conta zero na média, a unidade cai; se ignora, a placa roda sem régua.</span></div></div>
    <div class="step"><div class="n">2</div><div><b>Piraí Empurrada: UGU5D17 a 0,67 km/L</b><span>Em jul, set e out, contra 2,2 das irmãs Actros 2548. É 3× mais litros remunerados para uma placa: vai ser corrigido na próxima revisão e vale saber o quanto entrou.</span></div></div>
    <div class="step"><div class="n">3</div><div><b>Campo Grande: VW 17.190 a 4,41 km/L no Q1 e Q2</b><span>7 placas (RXT0J17…RXT1A07, RLN2A07) a 4,41 contra 2,11 das outras 17.190 da mesma operação — o benchmark da montadora no lugar do abastecimento real (SUMA). No Q3 todas foram para 3,28–3,35, com realizado de ${f2(D.realModQ['CGR · ROTA']?.['VW 17.190']?.[3]?.simples)}; a operação inteira está em 3,45 contra 2,42 realizados no Q2.</span></div></div>
    <div class="step"><div class="n">4</div><div><b>Cuiabá AS subiu 52% fora da revisão</b><span>RRT3H09 e RRT1D26 (VW 30.280) passaram de 2,21 para 3,36 na 2ª set, com realizado de 1,97 no Q3. É a maior distância rem × real da frota (+70%), e entrou sem revisão.</span></div></div>
    <div class="step"><div class="n">5</div><div><b>Placa "TESTE" ativa o ano inteiro</b><span>${D.erros.placaTeste.length} quinzenas em ${esc(D.erros.placaTeste[0]?.up || '')} (é a única placa dessa operação), com consumo ${f2(D.erros.placaTeste[0]?.v)} e depois 4,59. Entra na média como se fosse caminhão.</span></div></div>
    <div class="step"><div class="n">6</div><div><b>${D.erros.duplaGrafia.length} placas em duas grafias</b><span>${dup}. A mesma placa aparece no formato antigo e no Mercosul; em FLP e PLT a mesma placa está em duas operações.</span></div></div>
    <div class="step"><div class="n">7</div><div><b>Pelotas AS sem placa ativa desde 2ª jun</b><span>${semAt} quinzenas com as 2 placas inativas: a operação não tem consumo remunerado.</span></div></div>
    <div class="step"><div class="n">8</div><div><b>${D.mudancasCiclo} mudanças de valor fora da revisão</b><span>21 placas em 2ª jan, 22 em 2ª abr, 10 em 2ª set (Cuiabá) e mais 7 espalhadas. Ajuste de placa no meio do ciclo não está na regra; vale pedir a trilha de cada um. Também há ${D.erros.foraFT.placas} placas rodando (${f0(D.erros.foraFT.km)} km) sem constar na planilha do FT no mês.</span></div></div>
  </div>`));
}

// ── PRÓXIMOS PASSOS ──
S.push(slide(`
  <div class="kicker">O que levar à Ambev</div>
  <h2 style="font-size:28px">Cinco pontos, na ordem do dinheiro</h2>
  <div class="grid g2" style="gap:16px 26px;margin-top:14px">
    <div class="box"><h3>1 · Rodar a revisão do Q4 agora</h3><p>Com o realizado do Q3 a frota recebe ${f0(-semRevTotL)} L/mês a mais (${rsK(-semRevTotRS)}). As maiores: ${semRevPerde.sort((a, b) => a.rsMes - b.rsMes).slice(0, 4).map(x => `${esc(x.up)} ${rsK(-x.rsMes)}`).join(' · ')}.</p></div>
    <div class="box"><h3>2 · Uma régua por modelo dentro da operação</h3><p>${D.dispRes.comDif} grupos modelo-mês com valores diferentes para o mesmo modelo. Saldo de ${f0(dispTot.perde - dispTot.ganha)} L contra nós; o caso de Campo Grande (ROTA) sozinho pesa ${f0(D.impDisp['CGR · ROTA'].perde - D.impDisp['CGR · ROTA'].ganha)} L.</p></div>
    <div class="box"><h3>3 · Campo Grande: tanque interno (SUMA)</h3><p>O remunerado está ${pct(D.premissa['CGR · ROTA'][4].gapPct, 0)} acima do realizado no Q3 e as 17.190 chegaram a 4,41 km/L. É o limpa-pauta, e é o maior item em reais.</p></div>
    <div class="box"><h3>4 · Limpeza do cadastro no FT</h3><p>Placa TESTE, ${D.erros.duplaGrafia.length} grafias duplas, 8 placas ativas sem consumo em CGR, Pelotas AS sem ativa, UGU5D17 a 0,67. Corrigir antes da próxima revisão, para a base do Q1/27 nascer limpa.</p></div>
    <div class="box" style="grid-column:1/3"><h3>5 · Ativação: monitorar, não brigar</h3><p>O efeito na média é pequeno (até +${f2(ativOrd[0].ativMed)} km/L em ${esc(ativOrd[0].up)}) e sem padrão de escolher as melhores. O ponto é outro: ${f1(kmInatPct)}% do km do ano foi rodado por placas inativas no FT — consumo real sem régua. Vale pedir o critério de ativação por escrito e acompanhar mês a mês com esta mesma matriz.</p></div>
  </div>`));

const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>Consumo remunerado Km/L · 2026</title>
<link rel="stylesheet" href="../driverpro-apresentacao/base.css">
<style>
  .slide{padding:44px 64px 52px;justify-content:flex-start;}
  h2{margin-bottom:8px}
  th{padding:6px 7px} td{padding:5px 7px}
  table.compacta th{padding:4px 5px} table.compacta td{padding:3px 5px}
  .note{margin-top:8px}
  .step{margin-bottom:0} .step .n{flex:0 0 32px;width:32px;height:32px;font-size:14px;border-radius:9px} .step b{font-size:14px} .step span{font-size:12.5px;line-height:1.45}
</style></head>
<body>
${S.join('\n')}
</body></html>`;
writeFileSync(OUT, html);
console.log('deck.html', S.length, 'slides');
